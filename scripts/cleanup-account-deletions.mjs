import "dotenv/config";

import { pathToFileURL } from "node:url";

import pg from "pg";

const { Pool } = pg;

const DEFAULT_LIMIT = 100;

export async function cleanupExpiredAccountDeletions({
  limit = DEFAULT_LIMIT,
  now = new Date(),
  store,
}) {
  const requests = await store.findExpiredDeletionRequests({ limit, now });
  const results = [];

  for (const request of requests) {
    results.push(await store.anonymizeDeletionRequest({ now, request }));
  }

  return {
    scanned: requests.length,
    anonymized: results.filter((result) => result.status === "anonymized").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    results,
  };
}

export function createPoolCleanupStore(pool) {
  return {
    async findExpiredDeletionRequests({ limit, now }) {
      const result = await pool.query(
        `
          select
            users.id as user_id,
            profiles.id as profile_id
          from users
          inner join profiles on profiles.user_id = users.id
          where users.deleted_at is not null
            and users.deletion_grace_ends_at is not null
            and users.deletion_grace_ends_at <= $1
            and users.deletion_anonymized_at is null
          order by users.deletion_grace_ends_at asc, users.id asc
          limit $2
        `,
        [now, limit],
      );

      return result.rows.map((row) => ({
        userId: row.user_id,
        profileId: row.profile_id,
      }));
    },
    async anonymizeDeletionRequest({ now, request }) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        const result = await anonymizeDeletionRequestInTransaction({
          client,
          now,
          request,
        });
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export function createAnonymizedEmail(userId) {
  return `deleted+${Buffer.from(userId).toString("hex")}@deleted.local`;
}

export function createAnonymizedUsername(profileId) {
  return `deleted_${Buffer.from(profileId).toString("hex")}`;
}

async function anonymizeDeletionRequestInTransaction({ client, now, request }) {
  const user = await lockDeletionUser({ client, userId: request.userId });

  if (user === undefined) {
    return skippedResult(request, "not_found");
  }

  if (user.deletion_anonymized_at !== null) {
    return skippedResult(request, "already_anonymized");
  }

  if (user.deleted_at === null) {
    return skippedResult(request, "not_pending");
  }

  if (
    user.deletion_grace_ends_at === null ||
    user.deletion_grace_ends_at.getTime() > now.getTime()
  ) {
    return skippedResult(request, "grace_active");
  }

  const profileId = await lockDeletionProfile({
    client,
    fallbackProfileId: request.profileId,
    userId: request.userId,
  });

  await executeCleanupStatements({
    client,
    email: user.email,
    now,
    profileId,
    userId: request.userId,
  });

  return {
    status: "anonymized",
    userId: request.userId,
    profileId,
  };
}

async function lockDeletionUser({ client, userId }) {
  const result = await client.query(
    `
      select
        id,
        email,
        deleted_at,
        deletion_grace_ends_at,
        deletion_anonymized_at
      from users
      where id = $1
      for update
    `,
    [userId],
  );

  return result.rows[0];
}

async function lockDeletionProfile({ client, fallbackProfileId, userId }) {
  const result = await client.query(
    `
      select id
      from profiles
      where user_id = $1
      for update
    `,
    [userId],
  );

  return result.rows[0]?.id ?? fallbackProfileId;
}

async function executeCleanupStatements({ client, email, now, profileId, userId }) {
  const statements = [
    {
      sql: `
        /* cleanup: anonymize_user */
        update users
        set
          name = 'Deleted user',
          email = $2,
          email_verified = false,
          image = null,
          deletion_anonymized_at = $3,
          updated_at = $3
        where id = $1
      `,
      values: [userId, createAnonymizedEmail(userId), now],
    },
    {
      sql: `
        /* cleanup: anonymize_profile */
        update profiles
        set
          username = $2,
          display_name = 'Deleted profile',
          avatar_url = null,
          bio = null,
          is_active = false,
          accepting_questions = false,
          deactivated_at = coalesce(deactivated_at, $3),
          deactivation_reason = 'account_deletion',
          updated_at = $3
        where id = $1
      `,
      values: [profileId, createAnonymizedUsername(profileId), now],
    },
    {
      sql: "/* cleanup: delete_sessions */ delete from sessions where user_id = $1",
      values: [userId],
    },
    {
      sql: "/* cleanup: delete_accounts */ delete from accounts where user_id = $1",
      values: [userId],
    },
    {
      sql: "/* cleanup: delete_verifications */ delete from verifications where identifier = $1",
      values: [email],
    },
    {
      sql: "/* cleanup: release_username_reservations */ delete from username_reservations where profile_id = $1",
      values: [profileId],
    },
    {
      sql: "/* cleanup: delete_follows */ delete from follows where follower_profile_id = $1 or followed_profile_id = $1",
      values: [profileId],
    },
    {
      sql: "/* cleanup: delete_likes */ delete from likes where profile_id = $1",
      values: [profileId],
    },
    {
      sql: "/* cleanup: delete_answer_like_notifications */ delete from answer_like_notifications where actor_user_id = $1 or owner_user_id = $1",
      values: [userId],
    },
    {
      sql: "/* cleanup: delete_recipient_notifications */ delete from notifications where recipient_user_id = $1",
      values: [userId],
    },
    {
      sql: "/* cleanup: unlink_actor_notifications */ update notifications set actor_user_id = null where actor_user_id = $1",
      values: [userId],
    },
    {
      sql: "/* cleanup: delete_owned_blocks */ delete from blocks where owner_user_id = $1 or owner_profile_id = $2",
      values: [userId, profileId],
    },
    {
      sql: `
        /* cleanup: unlink_blocked_identity */
        update blocks
        set
          blocked_user_id = case when blocked_user_id = $1 then null else blocked_user_id end,
          blocked_profile_id = case when blocked_profile_id = $2 then null else blocked_profile_id end,
          updated_at = $3
        where blocked_user_id = $1 or blocked_profile_id = $2
      `,
      values: [userId, profileId, now],
    },
    {
      sql: `
        /* cleanup: soft_delete_unanswered_questions */
        update questions
        set
          deleted_at = $3,
          deleted_by = 'recipient',
          updated_at = $3
        where recipient_user_id = $1
          and recipient_profile_id = $2
          and deleted_at is null
          and status in ('inbox', 'filtered', 'draft')
      `,
      values: [userId, profileId, now],
    },
    {
      sql: `
        /* cleanup: anonymize_asked_questions */
        update questions
        set
          asker_user_id = null,
          asker_profile_id = null,
          identity_mode = case
            when identity_mode = 'account_attributed' then 'account_anonymous'
            else identity_mode
          end,
          anonymized_at = coalesce(anonymized_at, $3),
          updated_at = $3
        where asker_user_id = $1 or asker_profile_id = $2
      `,
      values: [userId, profileId, now],
    },
    {
      sql: "/* cleanup: unlink_reporter_identity */ update reports set reporter_user_id = null, reporter_profile_id = null, updated_at = $3 where reporter_user_id = $1 or reporter_profile_id = $2",
      values: [userId, profileId, now],
    },
    {
      sql: "/* cleanup: unlink_events */ update events set user_id = null, profile_id = null where user_id = $1 or profile_id = $2",
      values: [userId, profileId],
    },
    {
      sql: "/* cleanup: unlink_invite_codes */ update invite_codes set used_by_user_id = null where used_by_user_id = $1",
      values: [userId],
    },
  ];

  for (const statement of statements) {
    await client.query(statement.sql, statement.values);
  }
}

function skippedResult(request, reason) {
  return {
    status: "skipped",
    reason,
    userId: request.userId,
    profileId: request.profileId,
  };
}

async function main() {
  const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    console.error("DIRECT_DATABASE_URL or DATABASE_URL is required.");
    process.exit(1);
  }

  const limit = getLimit(process.argv[2]);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await cleanupExpiredAccountDeletions({
      limit,
      store: createPoolCleanupStore(pool),
    });

    console.log(
      `Account deletion cleanup scanned ${result.scanned}, anonymized ${result.anonymized}, skipped ${result.skipped}.`,
    );
  } finally {
    await pool.end();
  }
}

function getLimit(value) {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error("Usage: npm run account:cleanup-deletions -- [positive-limit]");
    process.exit(1);
  }

  return parsed;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
