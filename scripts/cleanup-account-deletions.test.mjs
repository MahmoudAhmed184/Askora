import { describe, expect, it } from "vitest";

import {
  cleanupExpiredAccountDeletions,
  createAnonymizedEmail,
  createAnonymizedUsername,
  createPoolCleanupStore,
} from "./cleanup-account-deletions.mjs";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("cleanupExpiredAccountDeletions", () => {
  it("anonymizes expired deletion requests and unlinks account data", async () => {
    const state = createState();
    const pool = createFakePool(state);

    const result = await cleanupExpiredAccountDeletions({
      now,
      store: createPoolCleanupStore(pool),
    });

    expect(result).toMatchObject({
      scanned: 1,
      anonymized: 1,
      skipped: 0,
    });
    expect(state.users[0]).toMatchObject({
      name: "Deleted user",
      email: createAnonymizedEmail("user_1"),
      email_verified: false,
      image: null,
      deletion_anonymized_at: now,
    });
    expect(state.profiles[0]).toMatchObject({
      username: createAnonymizedUsername("profile_1"),
      display_name: "Deleted profile",
      avatar_url: null,
      bio: null,
      is_active: false,
      accepting_questions: false,
      deactivation_reason: "account_deletion",
    });
    expect(state.sessions).toEqual([]);
    expect(state.accounts).toEqual([]);
    expect(state.username_reservations).toEqual([]);
    expect(state.follows).toEqual([]);
    expect(state.likes).toEqual([]);
    expect(state.answer_like_notifications).toEqual([]);
    expect(state.notifications).toEqual([
      {
        id: "notification_actor",
        recipient_user_id: "user_2",
        actor_user_id: null,
      },
    ]);
    expect(state.questions.find((question) => question.id === "recipient_unanswered"))
      .toMatchObject({
        deleted_at: now,
        deleted_by: "recipient",
        original_text: "Unanswered question",
        safety_fingerprint_hash: "safety_recipient",
      });
    expect(state.questions.find((question) => question.id === "recipient_answered"))
      .toMatchObject({
        deleted_at: null,
        deleted_by: null,
      });
    expect(state.questions.find((question) => question.id === "asked_attributed"))
      .toMatchObject({
        asker_user_id: null,
        asker_profile_id: null,
        identity_mode: "account_anonymous",
        anonymized_at: now,
        original_text: "Retain attributed question text",
        safety_fingerprint_hash: "safety_asked",
      });
  });

  it("skips requests already anonymized inside the transaction", async () => {
    const state = createState({
      users: [
        {
          ...createUser(),
          deletion_anonymized_at: new Date("2026-05-30T12:00:00.000Z"),
        },
      ],
    });
    const store = createPoolCleanupStore(createFakePool(state));

    const result = await store.anonymizeDeletionRequest({
      now,
      request: {
        userId: "user_1",
        profileId: "profile_1",
      },
    });

    expect(result).toEqual({
      status: "skipped",
      reason: "already_anonymized",
      userId: "user_1",
      profileId: "profile_1",
    });
    expect(state.sessions).toHaveLength(1);
    expect(state.users[0].email).toBe("person@example.com");
  });
});

function createState(overrides = {}) {
  return {
    users: [createUser()],
    profiles: [
      {
        id: "profile_1",
        user_id: "user_1",
        username: "person",
        display_name: "Person",
        avatar_url: "https://cdn.example.com/avatar.png",
        bio: "Hello",
        is_active: false,
        accepting_questions: true,
        deactivated_at: now,
        deactivation_reason: "account_deletion",
      },
    ],
    sessions: [{ id: "session_1", user_id: "user_1" }],
    accounts: [{ id: "account_1", user_id: "user_1" }],
    verifications: [{ id: "verification_1", identifier: "person@example.com" }],
    username_reservations: [{ id: "reservation_1", profile_id: "profile_1" }],
    follows: [
      { follower_profile_id: "profile_1", followed_profile_id: "profile_2" },
      { follower_profile_id: "profile_2", followed_profile_id: "profile_1" },
    ],
    likes: [{ profile_id: "profile_1", thread_item_id: "item_1" }],
    answer_like_notifications: [
      {
        actor_user_id: "user_1",
        owner_user_id: "user_2",
        thread_item_id: "item_1",
      },
    ],
    notifications: [
      {
        id: "notification_recipient",
        recipient_user_id: "user_1",
        actor_user_id: "user_2",
      },
      {
        id: "notification_actor",
        recipient_user_id: "user_2",
        actor_user_id: "user_1",
      },
    ],
    blocks: [
      { id: "owned_block", owner_user_id: "user_1", owner_profile_id: "profile_1" },
      {
        id: "blocked_identity",
        owner_user_id: "user_2",
        owner_profile_id: "profile_2",
        blocked_user_id: "user_1",
        blocked_profile_id: "profile_1",
      },
    ],
    questions: [
      {
        id: "recipient_unanswered",
        recipient_user_id: "user_1",
        recipient_profile_id: "profile_1",
        asker_user_id: "user_2",
        asker_profile_id: "profile_2",
        status: "inbox",
        deleted_at: null,
        deleted_by: null,
        original_text: "Unanswered question",
        safety_fingerprint_hash: "safety_recipient",
      },
      {
        id: "recipient_answered",
        recipient_user_id: "user_1",
        recipient_profile_id: "profile_1",
        asker_user_id: "user_2",
        asker_profile_id: "profile_2",
        status: "answered",
        deleted_at: null,
        deleted_by: null,
        original_text: "Answered question",
        safety_fingerprint_hash: "safety_answered",
      },
      {
        id: "asked_attributed",
        recipient_user_id: "user_2",
        recipient_profile_id: "profile_2",
        asker_user_id: "user_1",
        asker_profile_id: "profile_1",
        identity_mode: "account_attributed",
        status: "answered",
        anonymized_at: null,
        deleted_at: null,
        original_text: "Retain attributed question text",
        safety_fingerprint_hash: "safety_asked",
      },
    ],
    reports: [
      {
        id: "report_1",
        reporter_user_id: "user_1",
        reporter_profile_id: "profile_1",
      },
    ],
    events: [{ id: "event_1", user_id: "user_1", profile_id: "profile_1" }],
    invite_codes: [{ id: "invite_1", used_by_user_id: "user_1" }],
    ...overrides,
  };
}

function createUser() {
  return {
    id: "user_1",
    name: "Person",
    email: "person@example.com",
    email_verified: true,
    image: "https://cdn.example.com/avatar.png",
    deleted_at: new Date("2026-05-01T12:00:00.000Z"),
    deletion_grace_ends_at: new Date("2026-05-15T12:00:00.000Z"),
    deletion_anonymized_at: null,
  };
}

function createFakePool(state) {
  return {
    query(sql, values = []) {
      return Promise.resolve(handleQuery(state, sql, values));
    },
    connect() {
      return Promise.resolve({
        query(sql, values = []) {
          return Promise.resolve(handleQuery(state, sql, values));
        },
        release() {},
      });
    },
  };
}

function handleQuery(state, sql, values) {
  const text = sql.replace(/\s+/g, " ").trim();

  if (text === "begin" || text === "commit" || text === "rollback") {
    return rows([]);
  }

  if (text.includes("inner join profiles")) {
    return rows(findExpiredRequests(state, values[0], values[1]));
  }

  if (text.includes("from users") && text.includes("for update")) {
    return rows(state.users.filter((user) => user.id === values[0]));
  }

  if (text.includes("from profiles") && text.includes("for update")) {
    return rows(state.profiles.filter((profile) => profile.user_id === values[0]));
  }

  applyCleanupMutation(state, text, values);
  return rows([]);
}

function findExpiredRequests(state, nowValue, limit) {
  return state.users
    .filter(
      (user) =>
        user.deleted_at !== null &&
        user.deletion_grace_ends_at !== null &&
        user.deletion_grace_ends_at.getTime() <= nowValue.getTime() &&
        user.deletion_anonymized_at === null,
    )
    .slice(0, limit)
    .flatMap((user) =>
      state.profiles
        .filter((profile) => profile.user_id === user.id)
        .map((profile) => ({
          user_id: user.id,
          profile_id: profile.id,
        })),
    );
}

function applyCleanupMutation(state, text, values) {
  if (text.includes("cleanup: anonymize_user")) {
    const user = state.users.find((candidate) => candidate.id === values[0]);

    if (user !== undefined) {
      user.name = "Deleted user";
      user.email = values[1];
      user.email_verified = false;
      user.image = null;
      user.deletion_anonymized_at = values[2];
    }
  }

  if (text.includes("cleanup: anonymize_profile")) {
    const profile = state.profiles.find((candidate) => candidate.id === values[0]);

    if (profile !== undefined) {
      profile.username = values[1];
      profile.display_name = "Deleted profile";
      profile.avatar_url = null;
      profile.bio = null;
      profile.is_active = false;
      profile.accepting_questions = false;
      profile.deactivated_at ??= values[2];
      profile.deactivation_reason = "account_deletion";
    }
  }

  deleteMatching(state, "sessions", "cleanup: delete_sessions", (row) => row.user_id === values[0], text);
  deleteMatching(state, "accounts", "cleanup: delete_accounts", (row) => row.user_id === values[0], text);
  deleteMatching(state, "verifications", "cleanup: delete_verifications", (row) => row.identifier === values[0], text);
  deleteMatching(state, "username_reservations", "cleanup: release_username_reservations", (row) => row.profile_id === values[0], text);
  deleteMatching(state, "follows", "cleanup: delete_follows", (row) => row.follower_profile_id === values[0] || row.followed_profile_id === values[0], text);
  deleteMatching(state, "likes", "cleanup: delete_likes", (row) => row.profile_id === values[0], text);
  deleteMatching(state, "answer_like_notifications", "cleanup: delete_answer_like_notifications", (row) => row.actor_user_id === values[0] || row.owner_user_id === values[0], text);
  deleteMatching(state, "notifications", "cleanup: delete_recipient_notifications", (row) => row.recipient_user_id === values[0], text);
  deleteMatching(state, "blocks", "cleanup: delete_owned_blocks", (row) => row.owner_user_id === values[0] || row.owner_profile_id === values[1], text);

  if (text.includes("cleanup: unlink_actor_notifications")) {
    for (const notification of state.notifications) {
      if (notification.actor_user_id === values[0]) {
        notification.actor_user_id = null;
      }
    }
  }

  if (text.includes("cleanup: unlink_blocked_identity")) {
    for (const block of state.blocks) {
      if (block.blocked_user_id === values[0]) {
        block.blocked_user_id = null;
      }

      if (block.blocked_profile_id === values[1]) {
        block.blocked_profile_id = null;
      }
    }
  }

  if (text.includes("cleanup: soft_delete_unanswered_questions")) {
    for (const question of state.questions) {
      if (
        question.recipient_user_id === values[0] &&
        question.recipient_profile_id === values[1] &&
        question.deleted_at === null &&
        ["inbox", "filtered", "draft"].includes(question.status)
      ) {
        question.deleted_at = values[2];
        question.deleted_by = "recipient";
      }
    }
  }

  if (text.includes("cleanup: anonymize_asked_questions")) {
    for (const question of state.questions) {
      if (question.asker_user_id === values[0] || question.asker_profile_id === values[1]) {
        question.asker_user_id = null;
        question.asker_profile_id = null;
        question.identity_mode =
          question.identity_mode === "account_attributed"
            ? "account_anonymous"
            : question.identity_mode;
        question.anonymized_at ??= values[2];
      }
    }
  }

  if (text.includes("cleanup: unlink_reporter_identity")) {
    for (const report of state.reports) {
      if (report.reporter_user_id === values[0] || report.reporter_profile_id === values[1]) {
        report.reporter_user_id = null;
        report.reporter_profile_id = null;
      }
    }
  }

  if (text.includes("cleanup: unlink_events")) {
    for (const event of state.events) {
      if (event.user_id === values[0] || event.profile_id === values[1]) {
        event.user_id = null;
        event.profile_id = null;
      }
    }
  }

  if (text.includes("cleanup: unlink_invite_codes")) {
    for (const inviteCode of state.invite_codes) {
      if (inviteCode.used_by_user_id === values[0]) {
        inviteCode.used_by_user_id = null;
      }
    }
  }
}

function deleteMatching(state, table, marker, predicate, text) {
  if (!text.includes(marker)) {
    return;
  }

  state[table] = state[table].filter((row) => !predicate(row));
}

function rows(rowValues) {
  return {
    rows: rowValues,
    rowCount: rowValues.length,
  };
}
