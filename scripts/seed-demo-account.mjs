import "dotenv/config";

import { createHash, createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";

import pg from "pg";

const { Pool } = pg;

const DEFAULT_TARGET_EMAIL = "mahmoudbahnasawy820@gmail.com";
const DEVELOPMENT_AUTH_SECRET =
  "development-only-better-auth-secret-change-before-production";

const demoUsers = {
  curator: {
    id: "demo_user_curator",
    profileId: "demo_profile_curator",
    email: "demo.curator@example.test",
    name: "Lina Curator",
    username: "demo_curator",
    displayName: "Lina Curator",
    role: "user",
    sessionId: "demo_session_curator",
    sessionToken: "demo_session_curator_token",
    magicToken: "demo_magic_curator_token_for_local_testing",
    callbackPath: "/feed",
  },
  researcher: {
    id: "demo_user_researcher",
    profileId: "demo_profile_researcher",
    email: "demo.researcher@example.test",
    name: "Omar Researcher",
    username: "demo_researcher",
    displayName: "Omar Researcher",
    role: "user",
    sessionId: "demo_session_researcher",
    sessionToken: "demo_session_researcher_token",
    magicToken: "demo_magic_researcher_token_for_local_testing",
    callbackPath: "/feed",
  },
  asker: {
    id: "demo_user_asker",
    profileId: "demo_profile_asker",
    email: "demo.asker@example.test",
    name: "Nour Asker",
    username: "demo_asker",
    displayName: "Nour Asker",
    role: "user",
    sessionId: "demo_session_asker",
    sessionToken: "demo_session_asker_token",
    magicToken: "demo_magic_asker_token_for_local_testing",
    callbackPath: "/feed",
  },
  private: {
    id: "demo_user_private",
    profileId: "demo_profile_private",
    email: "demo.private@example.test",
    name: "Mona Private",
    username: "demo_private",
    displayName: "Mona Private",
    role: "user",
    sessionId: "demo_session_private",
    sessionToken: "demo_session_private_token",
    magicToken: "demo_magic_private_token_for_local_testing",
    callbackPath: "/feed",
  },
  admin: {
    id: "demo_user_admin",
    profileId: "demo_profile_admin",
    email: "demo.admin@example.test",
    name: "Amina Admin",
    username: "demo_admin",
    displayName: "Amina Admin",
    role: "admin",
    sessionId: "demo_session_admin",
    sessionToken: "demo_session_admin_token",
    magicToken: "demo_magic_admin_token_for_local_testing",
    callbackPath: "/admin",
  },
  suspended: {
    id: "demo_user_suspended",
    profileId: "demo_profile_suspended",
    email: "demo.suspended@example.test",
    name: "Sam Suspended",
    username: "demo_suspended",
    displayName: "Sam Suspended",
    role: "user",
    sessionId: "demo_session_suspended",
    sessionToken: "demo_session_suspended_token",
    magicToken: "demo_magic_suspended_token_for_local_testing",
    callbackPath: "/feed",
    suspensionStatus: "suspended",
  },
  incomplete: {
    id: "demo_user_incomplete",
    email: "demo.incomplete@example.test",
    name: "Ivy Incomplete",
    role: "user",
    sessionId: "demo_session_incomplete",
    sessionToken: "demo_session_incomplete_token",
    magicToken: "demo_magic_incomplete_token_for_local_testing",
    callbackPath: "/setup",
  },
};

const targetSession = {
  id: "demo_session_target",
  token: "demo_session_target_token",
  magicToken: "demo_magic_target_token_for_local_testing",
  callbackPath: "/feed",
};

export function assertDemoSeedAllowed(environment = process.env) {
  const databaseUrl = environment.DIRECT_DATABASE_URL ?? environment.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required.");
  }

  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    throw new Error("Refusing to seed demo fixtures in production.");
  }

  if (environment.DEMO_SEED_CONFIRM !== "seed-demo-account") {
    throw new Error(
      "Set DEMO_SEED_CONFIRM=seed-demo-account before running the demo seed.",
    );
  }

  if (!["local", "preview", "test"].includes(environment.DEMO_SEED_SCOPE ?? "")) {
    throw new Error("Set DEMO_SEED_SCOPE to local, preview, or test.");
  }

  return databaseUrl;
}

export async function seedDemoAccount({
  appUrl = process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
  now = new Date(),
  pool,
  secret = process.env.BETTER_AUTH_SECRET ?? DEVELOPMENT_AUTH_SECRET,
  targetEmail = process.env.DEMO_SEED_ACCOUNT_EMAIL ?? DEFAULT_TARGET_EMAIL,
}) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const target = await findTargetAccount(client, targetEmail);
    await resetDemoFixtures(client, target);
    await prepareTargetProfile({ client, now, target });
    await insertDemoUsers({ client, now });
    await insertDemoSessions({ client, now, target });
    await insertDemoMagicLinks({ appUrl, client, now, target });
    await insertDemoProfiles({ client, now });
    await insertDemoQuestionsAndAnswers({ client, now, target, secret });
    await insertDemoSocialData({ client, now, target });
    await insertDemoNotifications({ client, now, target });
    await insertDemoModerationData({ client, now, target, secret });

    await client.query("commit");

    return getSeedSummary({ appUrl, secret, target });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function findTargetAccount(client, targetEmail) {
  const result = await client.query(
    `
      select
        users.id as user_id,
        users.email,
        users.name,
        profiles.id as profile_id,
        profiles.username,
        profiles.display_name
      from users
      inner join profiles on profiles.user_id = users.id and profiles.is_active = true
      where lower(users.email) = lower($1)
      limit 1
    `,
    [targetEmail],
  );
  const target = result.rows[0];

  if (target === undefined) {
    throw new Error(
      `No active completed profile was found for ${targetEmail}. Sign in and finish setup first.`,
    );
  }

  return {
    email: target.email,
    displayName: target.display_name,
    name: target.name,
    profileId: target.profile_id,
    userId: target.user_id,
    username: target.username,
  };
}

async function resetDemoFixtures(client, target) {
  const statements = [
    "delete from admin_actions where id like 'demo_%' or report_id like 'demo_%'",
    "delete from reports where id like 'demo_%' or target_id like 'demo_%' or reporter_user_id like 'demo_%' or reporter_profile_id like 'demo_%'",
    "delete from answer_like_notifications where actor_user_id like 'demo_%' or owner_user_id like 'demo_%' or thread_item_id like 'demo_%'",
    "delete from likes where profile_id like 'demo_%' or thread_item_id like 'demo_%'",
    "delete from follows where follower_profile_id like 'demo_%' or followed_profile_id like 'demo_%'",
    "delete from blocks where id like 'demo_%' or owner_profile_id like 'demo_%' or owner_user_id like 'demo_%' or blocked_user_id like 'demo_%' or blocked_profile_id like 'demo_%' or source_question_id like 'demo_%'",
    "delete from notifications where id like 'demo_%' or recipient_user_id like 'demo_%' or actor_user_id like 'demo_%' or thread_id like 'demo_%' or thread_item_id like 'demo_%' or question_id like 'demo_%'",
    "delete from pinned_answers where profile_id like 'demo_%' or thread_item_id like 'demo_%'",
    "delete from thread_items where id like 'demo_%' or public_id like 'demo_%' or thread_id like 'demo_%' or question_id like 'demo_%'",
    "delete from threads where id like 'demo_%' or public_id like 'demo_%' or owner_profile_id like 'demo_%' or initial_question_id like 'demo_%'",
    "delete from questions where id like 'demo_%' or public_id like 'demo_%' or recipient_profile_id like 'demo_%' or recipient_user_id like 'demo_%' or asker_user_id like 'demo_%' or asker_profile_id like 'demo_%'",
    "delete from muted_phrases where id like 'demo_%' or profile_id like 'demo_%'",
    "delete from username_reservations where id like 'demo_%' or username like 'demo_%' or profile_id like 'demo_%'",
    "delete from events where id like 'demo_%' or user_id like 'demo_%' or profile_id like 'demo_%'",
    "delete from invite_codes where id like 'demo_%' or used_by_user_id like 'demo_%'",
    "delete from verifications where id like 'demo_%' or identifier like 'demo_%'",
    "delete from accounts where id like 'demo_%' or user_id like 'demo_%'",
    "delete from sessions where id like 'demo_%' or token like 'demo_%' or user_id like 'demo_%'",
    "delete from profiles where id like 'demo_%' or user_id like 'demo_%' or username like 'demo_%'",
    "delete from users where id like 'demo_%' or email like 'demo.%@example.test'",
  ];

  for (const statement of statements) {
    await client.query(statement);
  }

  await client.query(
    "delete from sessions where id = $1 or token = $2",
    [targetSession.id, targetSession.token],
  );
  await client.query(
    "delete from verifications where id = $1",
    ["demo_verification_target"],
  );
  await client.query(
    "delete from muted_phrases where id like 'demo_%' and profile_id = $1",
    [target.profileId],
  );
}

async function prepareTargetProfile({ client, now, target }) {
  await client.query(
    `
      update profiles
      set
        accepting_questions = true,
        anonymous_questions_enabled = true,
        ask_permission = 'everyone',
        follow_up_permission_default = 'anyone',
        show_follower_counts = true,
        show_like_counts = true,
        bio = coalesce(bio, 'Seeded demo profile with inbox, feed, notifications, and moderation data.'),
        updated_at = $2
      where id = $1
    `,
    [target.profileId, now],
  );
}

async function insertDemoUsers({ client, now }) {
  const suspendedUntil = addDays(now, 7);

  for (const user of Object.values(demoUsers)) {
    await client.query(
      `
        insert into users (
          id,
          name,
          email,
          email_verified,
          image,
          role,
          suspension_status,
          suspended_until,
          created_at,
          updated_at
        )
        values ($1, $2, $3, true, null, $4, $5, $6, $7, $7)
      `,
      [
        user.id,
        user.name,
        user.email,
        user.role,
        user.suspensionStatus ?? null,
        user.suspensionStatus === "suspended" ? suspendedUntil : null,
        now,
      ],
    );
  }
}

async function insertDemoSessions({ client, now, target }) {
  const expiresAt = addDays(now, 30);
  const sessionUsers = [
    {
      id: target.userId,
      sessionId: targetSession.id,
      sessionToken: targetSession.token,
    },
    ...Object.values(demoUsers).map((user) => ({
      id: user.id,
      sessionId: user.sessionId,
      sessionToken: user.sessionToken,
    })),
  ];

  for (const user of sessionUsers) {
    await client.query(
      `
        insert into sessions (
          id,
          expires_at,
          token,
          created_at,
          updated_at,
          ip_address,
          user_agent,
          user_id
        )
        values ($1, $2, $3, $4, $4, '127.0.0.1', 'demo-seed', $5)
      `,
      [user.sessionId, expiresAt, user.sessionToken, now, user.id],
    );
  }
}

async function insertDemoMagicLinks({ appUrl, client, now, target }) {
  const expiresAt = addDays(now, 30);
  const links = [
    {
      id: "demo_verification_target",
      email: target.email,
      name: target.name,
      token: targetSession.magicToken,
    },
    ...Object.values(demoUsers).map((user) => ({
      id: `demo_verification_${user.id.replace("demo_user_", "")}`,
      email: user.email,
      name: user.name,
      token: user.magicToken,
    })),
  ];

  for (const link of links) {
    await client.query(
      `
        insert into verifications (
          id,
          identifier,
          value,
          expires_at,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $5)
      `,
      [
        link.id,
        hashMagicLinkToken(link.token),
        JSON.stringify({ email: link.email, name: link.name }),
        expiresAt,
        now,
      ],
    );
  }

  new URL(appUrl);
}

async function insertDemoProfiles({ client, now }) {
  const profileUsers = Object.values(demoUsers).filter(
    (user) => "profileId" in user,
  );

  for (const user of profileUsers) {
    await client.query(
      `
        insert into profiles (
          id,
          user_id,
          username,
          display_name,
          avatar_url,
          bio,
          is_active,
          accepting_questions,
          anonymous_questions_enabled,
          ask_permission,
          follow_up_permission_default,
          show_follower_counts,
          show_like_counts,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, null, $5, true, true, true, $6, 'anyone', true, true, $7, $7)
      `,
      [
        user.profileId,
        user.id,
        user.username,
        user.displayName,
        getDemoBio(user),
        user.id === demoUsers.private.id ? "followers" : "everyone",
        now,
      ],
    );

    await client.query(
      `
        insert into username_reservations (
          id,
          username,
          profile_id,
          redirect_to_username,
          reserved_until,
          redirect_until,
          created_at
        )
        values ($1, $2, $3, null, null, null, $4)
      `,
      [`demo_reservation_${user.username}`, user.username, user.profileId, now],
    );
  }
}

async function insertDemoQuestionsAndAnswers({ client, now, target, secret }) {
  const questionRows = createQuestionRows({ now, target });

  for (const question of questionRows) {
    await insertQuestion({ client, now: question.createdAt, question, secret });
  }

  const threadRows = createThreadRows({ now, target });

  for (const thread of threadRows) {
    await client.query(
      `
        insert into threads (
          id,
          public_id,
          owner_profile_id,
          initial_question_id,
          status,
          follow_up_permission_override,
          follow_ups_enabled,
          published_at,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        thread.id,
        thread.publicId,
        thread.ownerProfileId,
        thread.initialQuestionId,
        thread.status,
        thread.followUpPermissionOverride,
        thread.followUpsEnabled,
        thread.publishedAt,
        thread.createdAt,
        thread.updatedAt,
      ],
    );
  }

  const itemRows = createThreadItemRows({ now });

  for (const item of itemRows) {
    await client.query(
      `
        insert into thread_items (
          id,
          public_id,
          thread_id,
          question_id,
          answer_text,
          display_question_text,
          question_text_mode,
          status,
          position,
          published_at,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        item.id,
        item.publicId,
        item.threadId,
        item.questionId,
        item.answerText,
        item.displayQuestionText,
        item.questionTextMode,
        item.status,
        item.position,
        item.publishedAt,
        item.createdAt,
        item.updatedAt,
      ],
    );
  }

  await client.query(
    `
      insert into pinned_answers (
        profile_id,
        thread_item_id,
        position,
        created_at
      )
      values ($1, 'demo_item_target_operating_notes', 1, $2)
    `,
    [target.profileId, now],
  );
}

async function insertQuestion({ client, now, question, secret }) {
  await client.query(
    `
      insert into questions (
        id,
        public_id,
        recipient_profile_id,
        recipient_user_id,
        asker_user_id,
        asker_profile_id,
        identity_mode,
        source,
        status,
        thread_id,
        original_text,
        normalized_text_hash,
        ip_hash,
        user_agent_hash,
        safety_fingerprint_hash,
        safety_metadata_retain_until,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, 'public_profile', $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $16
      )
    `,
    [
      question.id,
      question.publicId,
      question.recipientProfileId,
      question.recipientUserId,
      question.askerUserId,
      question.askerProfileId,
      question.identityMode,
      question.status,
      question.threadId,
      question.text,
      hashFixtureValue(normalizeQuestionText(question.text), "question-text", secret),
      `demo_ip_${question.id}`,
      `demo_user_agent_${question.id}`,
      `demo_safety_${question.id}`,
      addDays(now, 30),
      now,
    ],
  );
}

async function insertDemoSocialData({ client, now, target }) {
  const follows = [
    [target.profileId, demoUsers.curator.profileId, addMinutes(now, -140)],
    [target.profileId, demoUsers.researcher.profileId, addMinutes(now, -130)],
    [target.profileId, demoUsers.private.profileId, addMinutes(now, -120)],
    [demoUsers.curator.profileId, target.profileId, addMinutes(now, -110)],
    [demoUsers.researcher.profileId, target.profileId, addMinutes(now, -90)],
    [demoUsers.asker.profileId, target.profileId, addMinutes(now, -70)],
  ];

  for (const [followerProfileId, followedProfileId, createdAt] of follows) {
    await client.query(
      `
        insert into follows (
          follower_profile_id,
          followed_profile_id,
          created_at
        )
        values ($1, $2, $3)
      `,
      [followerProfileId, followedProfileId, createdAt],
    );
  }

  const likes = [
    [target.profileId, "demo_item_curator_product_principles", addMinutes(now, -60)],
    [target.profileId, "demo_item_researcher_user_interviews", addMinutes(now, -50)],
    [demoUsers.curator.profileId, "demo_item_target_operating_notes", addMinutes(now, -40)],
    [demoUsers.researcher.profileId, "demo_item_target_operating_notes", addMinutes(now, -35)],
    [demoUsers.asker.profileId, "demo_item_target_growth_question", addMinutes(now, -30)],
    [demoUsers.admin.profileId, "demo_item_target_operating_notes", addMinutes(now, -25)],
  ];

  for (const [profileId, threadItemId, createdAt] of likes) {
    await client.query(
      `
        insert into likes (
          profile_id,
          thread_item_id,
          created_at
        )
        values ($1, $2, $3)
      `,
      [profileId, threadItemId, createdAt],
    );
  }

  await client.query(
    `
      insert into answer_like_notifications (
        actor_user_id,
        thread_item_id,
        owner_user_id,
        created_at
      )
      values
        ($1, 'demo_item_target_operating_notes', $2, $3),
        ($4, 'demo_item_target_operating_notes', $2, $3)
    `,
    [demoUsers.curator.id, target.userId, now, demoUsers.researcher.id],
  );
}

async function insertDemoNotifications({ client, now, target }) {
  const notifications = [
    {
      id: "demo_notification_answer_liked",
      recipientUserId: target.userId,
      type: "answer_liked",
      actorUserId: demoUsers.curator.id,
      threadId: "demo_thread_target_operating_notes",
      threadItemId: "demo_item_target_operating_notes",
      questionId: null,
      readAt: null,
      createdAt: addMinutes(now, -18),
    },
    {
      id: "demo_notification_profile_followed",
      recipientUserId: target.userId,
      type: "profile_followed",
      actorUserId: demoUsers.researcher.id,
      threadId: null,
      threadItemId: null,
      questionId: null,
      readAt: null,
      createdAt: addMinutes(now, -46),
    },
    {
      id: "demo_notification_follow_up_asked",
      recipientUserId: target.userId,
      type: "follow_up_asked",
      actorUserId: demoUsers.asker.id,
      threadId: "demo_thread_target_operating_notes",
      threadItemId: null,
      questionId: "demo_q_target_followup_inbox",
      readAt: null,
      createdAt: addMinutes(now, -72),
    },
    {
      id: "demo_notification_question_answered",
      recipientUserId: target.userId,
      type: "question_answered",
      actorUserId: demoUsers.curator.id,
      threadId: "demo_thread_curator_product_principles",
      threadItemId: "demo_item_curator_product_principles",
      questionId: "demo_q_curator_product_principles",
      readAt: addMinutes(now, -12),
      createdAt: addDays(now, -1),
    },
  ];

  for (const notification of notifications) {
    await client.query(
      `
        insert into notifications (
          id,
          recipient_user_id,
          type,
          actor_user_id,
          thread_id,
          thread_item_id,
          question_id,
          read_at,
          created_at,
          expires_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        notification.id,
        notification.recipientUserId,
        notification.type,
        notification.actorUserId,
        notification.threadId,
        notification.threadItemId,
        notification.questionId,
        notification.readAt,
        notification.createdAt,
        addDays(now, 180),
      ],
    );
  }
}

async function insertDemoModerationData({ client, now, target, secret }) {
  await client.query(
    `
      insert into muted_phrases (
        id,
        profile_id,
        phrase,
        normalized_phrase,
        created_at,
        updated_at
      )
      values
        ('demo_muted_phrase_spoilers', $1, 'spoilers', 'spoilers', $2, $2),
        ('demo_muted_phrase_low_effort', $1, 'low effort', 'low effort', $2, $2)
    `,
    [target.profileId, now],
  );

  await client.query(
    `
      insert into blocks (
        id,
        owner_profile_id,
        owner_user_id,
        blocked_user_id,
        blocked_profile_id,
        safety_fingerprint_hash,
        ip_hash,
        source_question_id,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'demo_q_target_filtered_edge', $8, $8)
    `,
    [
      "demo_block_target_suspended",
      target.profileId,
      target.userId,
      demoUsers.suspended.id,
      demoUsers.suspended.profileId,
      hashFixtureValue("demo_suspended_block", "block", secret),
      hashFixtureValue("127.0.0.42", "ip", secret),
      now,
    ],
  );

  await client.query(
    `
      insert into reports (
        id,
        reporter_user_id,
        reporter_profile_id,
        target_type,
        target_id,
        reason,
        details,
        status,
        reviewed_at,
        created_at,
        updated_at
      )
      values (
        'demo_report_researcher_answer',
        $1,
        $2,
        'thread_item',
        'demo_item_researcher_user_interviews',
        'other',
        'Demo report seeded so the admin queue has a real open item.',
        'open',
        null,
        $3,
        $3
      )
    `,
    [target.userId, target.profileId, now],
  );
}

function createQuestionRows({ now, target }) {
  return [
    {
      id: "demo_q_target_operating_notes",
      publicId: "demo_qst_target_operating_notes",
      recipientProfileId: target.profileId,
      recipientUserId: target.userId,
      askerUserId: demoUsers.asker.id,
      askerProfileId: demoUsers.asker.profileId,
      identityMode: "account_attributed",
      status: "answered",
      threadId: "demo_thread_target_operating_notes",
      text: "What operating habit made your week noticeably easier?",
      createdAt: addDays(now, -6),
    },
    {
      id: "demo_q_target_operating_followup",
      publicId: "demo_qst_target_operating_followup",
      recipientProfileId: target.profileId,
      recipientUserId: target.userId,
      askerUserId: demoUsers.researcher.id,
      askerProfileId: demoUsers.researcher.profileId,
      identityMode: "account_attributed",
      status: "answered",
      threadId: "demo_thread_target_operating_notes",
      text: "How would you turn that habit into a repeatable team ritual?",
      createdAt: addDays(now, -5),
    },
    {
      id: "demo_q_target_growth_question",
      publicId: "demo_qst_target_growth_question",
      recipientProfileId: target.profileId,
      recipientUserId: target.userId,
      askerUserId: null,
      askerProfileId: null,
      identityMode: "guest_anonymous",
      status: "answered",
      threadId: "demo_thread_target_growth_question",
      text: "What question do you wish more people asked before building a product?",
      createdAt: addDays(now, -4),
    },
    {
      id: "demo_q_target_inbox_strategy",
      publicId: "demo_qst_target_inbox_strategy",
      recipientProfileId: target.profileId,
      recipientUserId: target.userId,
      askerUserId: demoUsers.curator.id,
      askerProfileId: demoUsers.curator.profileId,
      identityMode: "account_attributed",
      status: "inbox",
      threadId: null,
      text: "What would you prioritize first if you had only one week to improve onboarding?",
      createdAt: addMinutes(now, -10),
    },
    {
      id: "demo_q_target_inbox_guest",
      publicId: "demo_qst_target_inbox_guest",
      recipientProfileId: target.profileId,
      recipientUserId: target.userId,
      askerUserId: null,
      askerProfileId: null,
      identityMode: "guest_anonymous",
      status: "inbox",
      threadId: null,
      text: "What is one underrated detail in a good Q&A experience?",
      createdAt: addMinutes(now, -30),
    },
    {
      id: "demo_q_target_followup_inbox",
      publicId: "demo_qst_target_followup_inbox",
      recipientProfileId: target.profileId,
      recipientUserId: target.userId,
      askerUserId: demoUsers.asker.id,
      askerProfileId: demoUsers.asker.profileId,
      identityMode: "account_attributed",
      status: "inbox",
      threadId: "demo_thread_target_operating_notes",
      text: "Could you share the first checklist item for that ritual?",
      createdAt: addMinutes(now, -72),
    },
    {
      id: "demo_q_target_filtered_edge",
      publicId: "demo_qst_target_filtered_edge",
      recipientProfileId: target.profileId,
      recipientUserId: target.userId,
      askerUserId: demoUsers.suspended.id,
      askerProfileId: demoUsers.suspended.profileId,
      identityMode: "account_anonymous",
      status: "filtered",
      threadId: null,
      text: "This seeded question starts filtered so moderation controls are visible.",
      createdAt: addMinutes(now, -52),
    },
    {
      id: "demo_q_target_draft_answer",
      publicId: "demo_qst_target_draft_answer",
      recipientProfileId: target.profileId,
      recipientUserId: target.userId,
      askerUserId: demoUsers.researcher.id,
      askerProfileId: demoUsers.researcher.profileId,
      identityMode: "account_attributed",
      status: "draft",
      threadId: "demo_thread_target_draft_answer",
      text: "Which answer are you still shaping before publishing?",
      createdAt: addDays(now, -2),
    },
    {
      id: "demo_q_curator_product_principles",
      publicId: "demo_qst_curator_product_principles",
      recipientProfileId: demoUsers.curator.profileId,
      recipientUserId: demoUsers.curator.id,
      askerUserId: target.userId,
      askerProfileId: target.profileId,
      identityMode: "account_attributed",
      status: "answered",
      threadId: "demo_thread_curator_product_principles",
      text: "Which product principle do you keep coming back to?",
      createdAt: addDays(now, -3),
    },
    {
      id: "demo_q_researcher_user_interviews",
      publicId: "demo_qst_researcher_user_interviews",
      recipientProfileId: demoUsers.researcher.profileId,
      recipientUserId: demoUsers.researcher.id,
      askerUserId: demoUsers.asker.id,
      askerProfileId: demoUsers.asker.profileId,
      identityMode: "account_attributed",
      status: "answered",
      threadId: "demo_thread_researcher_user_interviews",
      text: "What is a better first question in user interviews?",
      createdAt: addDays(now, -2),
    },
    {
      id: "demo_q_private_focus",
      publicId: "demo_qst_private_focus",
      recipientProfileId: demoUsers.private.profileId,
      recipientUserId: demoUsers.private.id,
      askerUserId: demoUsers.curator.id,
      askerProfileId: demoUsers.curator.profileId,
      identityMode: "account_attributed",
      status: "answered",
      threadId: "demo_thread_private_focus",
      text: "How do you decide which questions stay private until answered?",
      createdAt: addDays(now, -1),
    },
  ];
}

function createThreadRows({ now, target }) {
  return [
    {
      id: "demo_thread_target_operating_notes",
      publicId: "demo_thr_target_operating_notes",
      ownerProfileId: target.profileId,
      initialQuestionId: "demo_q_target_operating_notes",
      status: "published",
      followUpPermissionOverride: null,
      followUpsEnabled: true,
      publishedAt: addDays(now, -6),
      createdAt: addDays(now, -6),
      updatedAt: addDays(now, -5),
    },
    {
      id: "demo_thread_target_growth_question",
      publicId: "demo_thr_target_growth_question",
      ownerProfileId: target.profileId,
      initialQuestionId: "demo_q_target_growth_question",
      status: "published",
      followUpPermissionOverride: "logged_in",
      followUpsEnabled: true,
      publishedAt: addDays(now, -4),
      createdAt: addDays(now, -4),
      updatedAt: addDays(now, -4),
    },
    {
      id: "demo_thread_target_draft_answer",
      publicId: "demo_thr_target_draft_answer",
      ownerProfileId: target.profileId,
      initialQuestionId: "demo_q_target_draft_answer",
      status: "draft",
      followUpPermissionOverride: null,
      followUpsEnabled: true,
      publishedAt: null,
      createdAt: addDays(now, -2),
      updatedAt: addMinutes(now, -20),
    },
    {
      id: "demo_thread_curator_product_principles",
      publicId: "demo_thr_curator_product_principles",
      ownerProfileId: demoUsers.curator.profileId,
      initialQuestionId: "demo_q_curator_product_principles",
      status: "published",
      followUpPermissionOverride: null,
      followUpsEnabled: true,
      publishedAt: addDays(now, -3),
      createdAt: addDays(now, -3),
      updatedAt: addDays(now, -3),
    },
    {
      id: "demo_thread_researcher_user_interviews",
      publicId: "demo_thr_researcher_user_interviews",
      ownerProfileId: demoUsers.researcher.profileId,
      initialQuestionId: "demo_q_researcher_user_interviews",
      status: "published",
      followUpPermissionOverride: null,
      followUpsEnabled: true,
      publishedAt: addDays(now, -2),
      createdAt: addDays(now, -2),
      updatedAt: addDays(now, -2),
    },
    {
      id: "demo_thread_private_focus",
      publicId: "demo_thr_private_focus",
      ownerProfileId: demoUsers.private.profileId,
      initialQuestionId: "demo_q_private_focus",
      status: "published",
      followUpPermissionOverride: "logged_in",
      followUpsEnabled: true,
      publishedAt: addDays(now, -1),
      createdAt: addDays(now, -1),
      updatedAt: addDays(now, -1),
    },
  ];
}

function createThreadItemRows({ now }) {
  return [
    {
      id: "demo_item_target_operating_notes",
      publicId: "demo_titem_target_operating_notes",
      threadId: "demo_thread_target_operating_notes",
      questionId: "demo_q_target_operating_notes",
      answerText:
        "I write the riskiest assumption in one sentence before opening a task. It keeps the work honest and makes reviews sharper.",
      displayQuestionText:
        "What operating habit made your week noticeably easier?",
      questionTextMode: "original",
      status: "published",
      position: 0,
      publishedAt: addDays(now, -6),
      createdAt: addDays(now, -6),
      updatedAt: addDays(now, -6),
    },
    {
      id: "demo_item_target_operating_followup",
      publicId: "demo_titem_target_operating_followup",
      threadId: "demo_thread_target_operating_notes",
      questionId: "demo_q_target_operating_followup",
      answerText:
        "Make it a two-minute kickoff: assumption, signal, rollback. If nobody can name the signal, the task is not ready yet.",
      displayQuestionText:
        "How would you turn that habit into a repeatable team ritual?",
      questionTextMode: "original",
      status: "published",
      position: 1,
      publishedAt: addDays(now, -5),
      createdAt: addDays(now, -5),
      updatedAt: addDays(now, -5),
    },
    {
      id: "demo_item_target_growth_question",
      publicId: "demo_titem_target_growth_question",
      threadId: "demo_thread_target_growth_question",
      questionId: "demo_q_target_growth_question",
      answerText:
        "Ask what behavior should change after this ships. It forces the conversation away from output and toward evidence.",
      displayQuestionText:
        "What question do you wish more people asked before building a product?",
      questionTextMode: "original",
      status: "published",
      position: 0,
      publishedAt: addDays(now, -4),
      createdAt: addDays(now, -4),
      updatedAt: addDays(now, -4),
    },
    {
      id: "demo_item_target_draft_answer",
      publicId: "demo_titem_target_draft_answer",
      threadId: "demo_thread_target_draft_answer",
      questionId: "demo_q_target_draft_answer",
      answerText:
        "Draft answer seeded for the Drafts page. Edit me, publish me, or discard me during testing.",
      displayQuestionText:
        "Which answer are you still shaping before publishing?",
      questionTextMode: "original",
      status: "draft",
      position: 0,
      publishedAt: null,
      createdAt: addDays(now, -2),
      updatedAt: addMinutes(now, -20),
    },
    {
      id: "demo_item_curator_product_principles",
      publicId: "demo_titem_curator_product_principles",
      threadId: "demo_thread_curator_product_principles",
      questionId: "demo_q_curator_product_principles",
      answerText:
        "Start with the smallest promise the product can keep every day. Durable trust beats a wide but unreliable surface area.",
      displayQuestionText:
        "Which product principle do you keep coming back to?",
      questionTextMode: "original",
      status: "published",
      position: 0,
      publishedAt: addDays(now, -3),
      createdAt: addDays(now, -3),
      updatedAt: addDays(now, -3),
    },
    {
      id: "demo_item_researcher_user_interviews",
      publicId: "demo_titem_researcher_user_interviews",
      threadId: "demo_thread_researcher_user_interviews",
      questionId: "demo_q_researcher_user_interviews",
      answerText:
        "Ask for the last time it happened. Concrete memory gives you sequence, constraints, and emotion without asking people to predict themselves.",
      displayQuestionText:
        "What is a better first question in user interviews?",
      questionTextMode: "original",
      status: "published",
      position: 0,
      publishedAt: addDays(now, -2),
      createdAt: addDays(now, -2),
      updatedAt: addDays(now, -2),
    },
    {
      id: "demo_item_private_focus",
      publicId: "demo_titem_private_focus",
      threadId: "demo_thread_private_focus",
      questionId: "demo_q_private_focus",
      answerText:
        "I keep drafts private until the answer has a clear takeaway. Visibility should amplify clarity, not pressure.",
      displayQuestionText:
        "How do you decide which questions stay private until answered?",
      questionTextMode: "original",
      status: "published",
      position: 0,
      publishedAt: addDays(now, -1),
      createdAt: addDays(now, -1),
      updatedAt: addDays(now, -1),
    },
  ];
}

function getSeedSummary({ appUrl, secret, target }) {
  const targetAccount = {
    email: target.email,
    name: target.name,
    username: target.username,
    loginLink: createMagicLoginLink({
      appUrl,
      callbackPath: targetSession.callbackPath,
      token: targetSession.magicToken,
    }),
    sessionCookieValue: createSignedBetterAuthSessionCookie({
      secret,
      sessionToken: targetSession.token,
    }),
  };
  const accounts = Object.values(demoUsers).map((user) => ({
    email: user.email,
    name: user.name,
    username: user.username ?? null,
    role: user.role,
    state: user.id === demoUsers.incomplete.id ? "incomplete-profile" : user.suspensionStatus ?? "active",
    loginLink: createMagicLoginLink({
      appUrl,
      callbackPath: user.callbackPath,
      token: user.magicToken,
    }),
    sessionCookieValue: createSignedBetterAuthSessionCookie({
      secret,
      sessionToken: user.sessionToken,
    }),
  }));

  return {
    targetAccount,
    accounts,
    routes: {
      feed: `${appUrl}/feed`,
      inbox: `${appUrl}/inbox`,
      filtered: `${appUrl}/filtered`,
      drafts: `${appUrl}/drafts`,
      notifications: `${appUrl}/notifications`,
      settings: `${appUrl}/settings/profile`,
      publicProfile: `${appUrl}/${target.username}`,
      targetThread: `${appUrl}/${target.username}/a/demo_thr_target_operating_notes`,
      adminReport: `${appUrl}/admin/reports/demo_report_researcher_answer`,
    },
    seeded: {
      users: Object.keys(demoUsers).length,
      targetSessions: 1,
      profiles: Object.values(demoUsers).filter((user) => "profileId" in user).length,
      questions: 11,
      threads: 6,
      threadItems: 7,
      notifications: 4,
      follows: 6,
      likes: 6,
      reports: 1,
      blocks: 1,
      mutedPhrases: 2,
    },
  };
}

function createMagicLoginLink({ appUrl, callbackPath, token }) {
  const url = new URL("/api/auth/magic-link/verify", appUrl);
  url.searchParams.set("token", token);
  url.searchParams.set("callbackURL", callbackPath);
  url.searchParams.set("errorCallbackURL", "/login");
  return url.toString();
}

function createSignedBetterAuthSessionCookie({ secret, sessionToken }) {
  return `${sessionToken}.${createBetterAuthSignature(sessionToken, secret)}`;
}

function createBetterAuthSignature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64");
}

function hashMagicLinkToken(token) {
  return createHash("sha256").update(token).digest("base64url");
}

function hashFixtureValue(value, purpose, secret) {
  return createHmac("sha256", secret)
    .update(purpose)
    .update("\0")
    .update(value)
    .digest("hex");
}

function normalizeQuestionText(text) {
  return text.replaceAll(/\s+/g, " ").trim().toLowerCase();
}

function getDemoBio(user) {
  if (user.id === demoUsers.private.id) {
    return "Follower-gated seeded profile for permission checks.";
  }

  if (user.id === demoUsers.admin.id) {
    return "Seeded admin profile for moderation review testing.";
  }

  if (user.id === demoUsers.suspended.id) {
    return "Seeded suspended user for safety and block checks.";
  }

  return `Seeded test profile for ${user.displayName}.`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  const databaseUrl = assertDemoSeedAllowed();
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const summary = await seedDemoAccount({ pool });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
