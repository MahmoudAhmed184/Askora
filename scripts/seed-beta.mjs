import "dotenv/config";

import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";

import pg from "pg";

const { Pool } = pg;

const DEVELOPMENT_AUTH_SECRET =
  "development-only-better-auth-secret-change-before-production";

export const betaFixture = {
  users: {
    owner: {
      id: "beta_user_owner",
      email: "beta_owner@example.test",
      name: "Beta Owner",
      sessionId: "beta_session_owner",
      sessionToken: "beta_session_owner_token",
    },
    viewer: {
      id: "beta_user_viewer",
      email: "beta_viewer@example.test",
      name: "Beta Viewer",
      sessionId: "beta_session_viewer",
      sessionToken: "beta_session_viewer_token",
    },
    admin: {
      id: "beta_user_admin",
      email: "beta_admin@example.test",
      name: "Beta Admin",
      sessionId: "beta_session_admin",
      sessionToken: "beta_session_admin_token",
    },
    incomplete: {
      id: "beta_user_incomplete",
      email: "beta_incomplete@example.test",
      name: "Beta Incomplete",
      sessionId: "beta_session_incomplete",
      sessionToken: "beta_session_incomplete_token",
    },
    suspended: {
      id: "beta_user_suspended",
      email: "beta_suspended@example.test",
      name: "Beta Suspended",
      sessionId: "beta_session_suspended",
      sessionToken: "beta_session_suspended_token",
    },
  },
  profiles: {
    owner: {
      id: "beta_profile_owner",
      username: "beta_owner",
      displayName: "Beta Owner",
      userId: "beta_user_owner",
    },
    viewer: {
      id: "beta_profile_viewer",
      username: "beta_viewer",
      displayName: "Beta Viewer",
      userId: "beta_user_viewer",
    },
    admin: {
      id: "beta_profile_admin",
      username: "beta_admin",
      displayName: "Beta Admin",
      userId: "beta_user_admin",
    },
    suspended: {
      id: "beta_profile_suspended",
      username: "beta_suspended",
      displayName: "Beta Suspended",
      userId: "beta_user_suspended",
    },
  },
  questions: {
    inbox: {
      id: "beta_question_inbox",
      publicId: "beta_qst_inbox",
      text: "What should I answer first during beta?",
    },
    filtered: {
      id: "beta_question_filtered",
      publicId: "beta_qst_filtered",
      text: "This beta question should start filtered.",
    },
    answered: {
      id: "beta_question_answered",
      publicId: "beta_qst_answered",
      text: "What is already published in beta?",
    },
  },
  threads: {
    published: {
      id: "beta_thread_published",
      publicId: "beta_thr_published",
    },
  },
  threadItems: {
    published: {
      id: "beta_thread_item_published",
      publicId: "beta_titem_published",
      answerText:
        "This seeded answer gives smoke tests a public thread to inspect.",
    },
  },
  report: {
    id: "beta_report_thread_item",
  },
  block: {
    id: "beta_block_owner_suspended",
  },
};

export function assertBetaSeedAllowed(environment = process.env) {
  const databaseUrl = environment.DIRECT_DATABASE_URL ?? environment.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required.");
  }

  if (
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production"
  ) {
    throw new Error("Refusing to seed beta fixtures in production.");
  }

  if (environment.BETA_SEED_CONFIRM !== "reset-beta-fixtures") {
    throw new Error(
      "Set BETA_SEED_CONFIRM=reset-beta-fixtures before running the beta seed.",
    );
  }

  if (!["local", "preview", "test"].includes(environment.BETA_SEED_SCOPE ?? "")) {
    throw new Error("Set BETA_SEED_SCOPE to local, preview, or test.");
  }

  return databaseUrl;
}

export async function seedBetaFixtures({
  now = new Date(),
  pool,
  secret = DEVELOPMENT_AUTH_SECRET,
}) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await resetBetaFixtures(client);
    await insertBetaFixtures({ client, now, secret });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return getSeedSummary();
}

export function createSignedBetterAuthSessionCookie({
  secret = DEVELOPMENT_AUTH_SECRET,
  sessionToken,
}) {
  return `${sessionToken}.${createBetterAuthSignature(sessionToken, secret)}`;
}

export function createBetaSessionCookie({
  appUrl = "http://127.0.0.1:5173",
  expiresAt = addDays(new Date(), 30),
  secret = DEVELOPMENT_AUTH_SECRET,
  user,
}) {
  return {
    name: "better-auth.session_token",
    value: createSignedBetterAuthSessionCookie({
      secret,
      sessionToken: user.sessionToken,
    }),
    domain: new URL(appUrl).hostname,
    path: "/",
    httpOnly: true,
    secure: appUrl.startsWith("https://"),
    sameSite: "Lax",
    expires: Math.floor(expiresAt.getTime() / 1000),
  };
}

export function getBetaResetStatements() {
  return [
    "delete from admin_actions where id like 'beta_%' or report_id like 'beta_%'",
    "delete from reports where id like 'beta_%' or target_id like 'beta_%' or reporter_user_id like 'beta_%' or reporter_profile_id like 'beta_%'",
    "delete from answer_like_notifications where actor_user_id like 'beta_%' or owner_user_id like 'beta_%' or thread_item_id like 'beta_%'",
    "delete from likes where profile_id like 'beta_%' or thread_item_id like 'beta_%'",
    "delete from follows where follower_profile_id like 'beta_%' or followed_profile_id like 'beta_%'",
    "delete from blocks where id like 'beta_%' or owner_profile_id like 'beta_%' or owner_user_id like 'beta_%' or blocked_user_id like 'beta_%' or blocked_profile_id like 'beta_%' or source_question_id like 'beta_%'",
    "delete from notifications where id like 'beta_%' or recipient_user_id like 'beta_%' or actor_user_id like 'beta_%' or thread_id like 'beta_%' or thread_item_id like 'beta_%' or question_id like 'beta_%'",
    "delete from pinned_answers where profile_id like 'beta_%' or thread_item_id like 'beta_%'",
    "delete from thread_items where id like 'beta_%' or public_id like 'beta_%' or thread_id like 'beta_%' or question_id like 'beta_%'",
    "delete from threads where id like 'beta_%' or public_id like 'beta_%' or owner_profile_id like 'beta_%' or initial_question_id like 'beta_%'",
    "delete from questions where id like 'beta_%' or public_id like 'beta_%' or recipient_profile_id like 'beta_%' or recipient_user_id like 'beta_%' or asker_user_id like 'beta_%' or asker_profile_id like 'beta_%'",
    "delete from muted_phrases where id like 'beta_%' or profile_id like 'beta_%'",
    "delete from username_reservations where id like 'beta_%' or username like 'beta_%' or profile_id like 'beta_%'",
    "delete from events where id like 'beta_%' or user_id like 'beta_%' or profile_id like 'beta_%'",
    "delete from invite_codes where id like 'beta_%' or used_by_user_id like 'beta_%'",
    "delete from verifications where id like 'beta_%' or identifier like 'beta_%@example.test'",
    "delete from accounts where id like 'beta_%' or user_id like 'beta_%'",
    "delete from sessions where id like 'beta_%' or token like 'beta_%' or user_id like 'beta_%'",
    "delete from profiles where id like 'beta_%' or user_id like 'beta_%' or username like 'beta_%'",
    "delete from users where id like 'beta_%' or email like 'beta_%@example.test'",
  ];
}

async function resetBetaFixtures(client) {
  for (const statement of getBetaResetStatements()) {
    await client.query(statement);
  }
}

async function insertBetaFixtures({ client, now, secret }) {
  const expiresAt = addDays(now, 30);
  const suspendedUntil = addDays(now, 7);

  await insertUsers({ client, now, suspendedUntil });
  await insertSessions({ client, expiresAt, now });
  await insertProfiles({ client, now });
  await insertQuestions({ client, now, secret });
  await insertPublishedThread({ client, now });
  await insertSocialFixtures({ client, now });
  await insertNotificationFixtures({ client, now });
  await insertModerationFixtures({ client, now });
}

async function insertUsers({ client, now, suspendedUntil }) {
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
      values
        ($1, $2, $3, true, null, 'user', null, null, $11, $11),
        ($4, $5, $6, true, null, 'user', null, null, $11, $11),
        ($7, $8, $9, true, null, 'admin', null, null, $11, $11),
        ('beta_user_incomplete', 'Beta Incomplete', 'beta_incomplete@example.test', true, null, 'user', null, null, $11, $11),
        ('beta_user_suspended', 'Beta Suspended', 'beta_suspended@example.test', true, null, 'user', 'suspended', $10, $11, $11)
    `,
    [
      betaFixture.users.owner.id,
      betaFixture.users.owner.name,
      betaFixture.users.owner.email,
      betaFixture.users.viewer.id,
      betaFixture.users.viewer.name,
      betaFixture.users.viewer.email,
      betaFixture.users.admin.id,
      betaFixture.users.admin.name,
      betaFixture.users.admin.email,
      suspendedUntil,
      now,
    ],
  );
}

async function insertSessions({ client, expiresAt, now }) {
  const users = Object.values(betaFixture.users);

  for (const user of users) {
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
        values ($1, $2, $3, $4, $4, '127.0.0.1', 'beta-seed', $5)
      `,
      [user.sessionId, expiresAt, user.sessionToken, now, user.id],
    );
  }
}

async function insertProfiles({ client, now }) {
  for (const profile of Object.values(betaFixture.profiles)) {
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
        values ($1, $2, $3, $4, null, $5, true, true, true, 'everyone', 'anyone', true, true, $6, $6)
      `,
      [
        profile.id,
        profile.userId,
        profile.username,
        profile.displayName,
        `Seeded profile for ${profile.displayName}.`,
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
      [`beta_reservation_${profile.username}`, profile.username, profile.id, now],
    );
  }
}

async function insertQuestions({ client, now, secret }) {
  await insertQuestion({
    askerProfileId: null,
    askerUserId: null,
    client,
    identityMode: "guest_anonymous",
    now,
    question: betaFixture.questions.inbox,
    secret,
    source: "public_profile",
    status: "inbox",
    threadId: null,
  });
  await insertQuestion({
    askerProfileId: betaFixture.profiles.viewer.id,
    askerUserId: betaFixture.users.viewer.id,
    client,
    identityMode: "account_anonymous",
    now,
    question: betaFixture.questions.filtered,
    secret,
    source: "public_profile",
    status: "filtered",
    threadId: null,
  });
  await insertQuestion({
    askerProfileId: betaFixture.profiles.viewer.id,
    askerUserId: betaFixture.users.viewer.id,
    client,
    identityMode: "account_attributed",
    now,
    question: betaFixture.questions.answered,
    secret,
    source: "public_profile",
    status: "answered",
    threadId: betaFixture.threads.published.id,
  });
}

async function insertQuestion({
  askerProfileId,
  askerUserId,
  client,
  identityMode,
  now,
  question,
  secret,
  source,
  status,
  threadId,
}) {
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $17
      )
    `,
    [
      question.id,
      question.publicId,
      betaFixture.profiles.owner.id,
      betaFixture.users.owner.id,
      askerUserId,
      askerProfileId,
      identityMode,
      source,
      status,
      threadId,
      question.text,
      hashFixtureValue(normalizeQuestionText(question.text), "question-text", secret),
      `beta_ip_${question.id}`,
      `beta_user_agent_${question.id}`,
      `beta_safety_${question.id}`,
      addDays(now, 30),
      now,
    ],
  );
}

async function insertPublishedThread({ client, now }) {
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
      values ($1, $2, $3, $4, 'published', null, true, $5, $5, $5)
    `,
    [
      betaFixture.threads.published.id,
      betaFixture.threads.published.publicId,
      betaFixture.profiles.owner.id,
      betaFixture.questions.answered.id,
      now,
    ],
  );
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
      values ($1, $2, $3, $4, $5, $6, 'original', 'published', 0, $7, $7, $7)
    `,
    [
      betaFixture.threadItems.published.id,
      betaFixture.threadItems.published.publicId,
      betaFixture.threads.published.id,
      betaFixture.questions.answered.id,
      betaFixture.threadItems.published.answerText,
      betaFixture.questions.answered.text,
      now,
    ],
  );
  await client.query(
    `
      insert into pinned_answers (
        profile_id,
        thread_item_id,
        position,
        created_at
      )
      values ($1, $2, 1, $3)
    `,
    [
      betaFixture.profiles.owner.id,
      betaFixture.threadItems.published.id,
      now,
    ],
  );
}

async function insertSocialFixtures({ client, now }) {
  await client.query(
    `
      insert into follows (
        follower_profile_id,
        followed_profile_id,
        created_at
      )
      values ($1, $2, $3)
    `,
    [betaFixture.profiles.admin.id, betaFixture.profiles.owner.id, now],
  );
  await client.query(
    `
      insert into likes (
        profile_id,
        thread_item_id,
        created_at
      )
      values ($1, $2, $3)
    `,
    [
      betaFixture.profiles.admin.id,
      betaFixture.threadItems.published.id,
      now,
    ],
  );
}

async function insertNotificationFixtures({ client, now }) {
  const notifications = [
    {
      id: "beta_notification_follow_up_asked",
      recipientUserId: betaFixture.users.owner.id,
      type: "follow_up_asked",
      actorUserId: betaFixture.users.viewer.id,
      threadId: betaFixture.threads.published.id,
      threadItemId: null,
      questionId: betaFixture.questions.filtered.id,
      readAt: null,
      createdAt: addMinutes(now, -8),
    },
    {
      id: "beta_notification_answer_liked",
      recipientUserId: betaFixture.users.owner.id,
      type: "answer_liked",
      actorUserId: betaFixture.users.admin.id,
      threadId: betaFixture.threads.published.id,
      threadItemId: betaFixture.threadItems.published.id,
      questionId: null,
      readAt: null,
      createdAt: addMinutes(now, -42),
    },
    {
      id: "beta_notification_profile_followed",
      recipientUserId: betaFixture.users.owner.id,
      type: "profile_followed",
      actorUserId: betaFixture.users.admin.id,
      threadId: null,
      threadItemId: null,
      questionId: null,
      readAt: addMinutes(now, -30),
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

async function insertModerationFixtures({ client, now }) {
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
      values ($1, $2, $3, 'thread_item', $4, 'other', 'Seeded beta report for admin smoke tests.', 'open', null, $5, $5)
    `,
    [
      betaFixture.report.id,
      betaFixture.users.viewer.id,
      betaFixture.profiles.viewer.id,
      betaFixture.threadItems.published.id,
      now,
    ],
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
      values ($1, $2, $3, $4, $5, null, null, $6, $7, $7)
    `,
    [
      betaFixture.block.id,
      betaFixture.profiles.owner.id,
      betaFixture.users.owner.id,
      betaFixture.users.suspended.id,
      betaFixture.profiles.suspended.id,
      betaFixture.questions.filtered.id,
      now,
    ],
  );
}

function createBetterAuthSignature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64");
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

function getSeedSummary() {
  return {
    users: 5,
    profiles: 4,
    sessions: 5,
    questions: 3,
    threads: 1,
    threadItems: 1,
    pinnedAnswers: 1,
    follows: 1,
    likes: 1,
    notifications: 3,
    reports: 1,
    blocks: 1,
  };
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  const databaseUrl = assertBetaSeedAllowed();
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const summary = await seedBetaFixtures({
      pool,
      secret: process.env.BETTER_AUTH_SECRET ?? DEVELOPMENT_AUTH_SECRET,
    });
    console.log(`Seeded beta fixtures: ${JSON.stringify(summary)}`);
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
