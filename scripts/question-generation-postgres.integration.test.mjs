import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createRuntimeDatabase } from "../app/db/client.server.ts";
import {
  createDrizzleQuestionGenerationRepository,
  createDrizzleQuestionGenerationSettingsRepository,
} from "../app/features/question-generation/question-generation.repository.server.ts";
import { checkRateLimit } from "../app/lib/rate-limit.server.ts";
import {
  cleanupExpiredAccountDeletions,
  createPoolCleanupStore,
} from "./cleanup-account-deletions.mjs";

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
const runIntegrationTest = databaseUrl === undefined ? it.skip : it;

describe.sequential("question-generation PostgreSQL integration", () => {
  runIntegrationTest(
    "persists supported batch sizes, rolls back partial inserts, isolates owners, and cleans up safely",
    async () => {
      const database = createRuntimeDatabase(databaseUrl);
      const pool = database.$client;
      const repository = createDrizzleQuestionGenerationRepository(database);
      const settingsRepository =
        createDrizzleQuestionGenerationSettingsRepository(database);
      const suffix = `pr2_${process.pid}_${randomUUID().replaceAll("-", "")}`;
      const ownerA = await createOwner(pool, `${suffix}_a`);
      const ownerB = await createOwner(pool, `${suffix}_b`);
      const rollingRateKey = `${suffix}_rolling_rate`;

      try {
        for (const requestedCount of [3, 5, 10]) {
          await persistProductionBatch(
            repository,
            ownerA,
            `${suffix}_batch_${String(requestedCount)}`,
            requestedCount,
          );
        }

        const persistedCounts = await pool.query(
          `
            select
              (select sum(requested_count)::int from question_generation_batches where owner_user_id = $1) as requested_count,
              (select count(*)::int from questions where recipient_profile_id = $2) as question_count
          `,
          [ownerA.userId, ownerA.profileId],
        );
        expect(persistedCounts.rows).toEqual([
          { requested_count: 18, question_count: 18 },
        ]);

        const rollbackBatchId = `${suffix}_rollback_batch`;
        try {
          await repository.persistGeneratedBatch({
            ownerUserId: ownerA.userId,
            profileId: ownerA.profileId,
            language: "english",
            style: "balanced",
            requestedCount: 3,
            modelUsed: "gemini-3.6-flash",
            usage: emptyUsage(),
            batchId: rollbackBatchId,
            now: new Date(),
            questions: [
              {
                id: `${suffix}_rollback_question_1`,
                publicId: `${suffix}_duplicate_public_id`,
                text: "Rollback one?",
                normalizedTextHash: `${suffix}_rollback_hash_one`,
              },
              {
                id: `${suffix}_rollback_question_2`,
                publicId: `${suffix}_duplicate_public_id`,
                text: "Rollback duplicate?",
                normalizedTextHash: `${suffix}_rollback_hash_two`,
              },
            ],
          });
          throw new Error("expected the production repository to reject a duplicate public ID");
        } catch (error) {
          expect(error?.cause?.code ?? error?.code).toBe("23505");
        }

        const rollbackCheck = await pool.query(
          `select count(*)::int as count from question_generation_batches where id = $1`,
          [rollbackBatchId],
        );
        expect(rollbackCheck.rows[0]?.count).toBe(0);

        const sharedHash = `${suffix}_shared_hash`;
        await persistProductionBatch(
          repository,
          ownerB,
          `${suffix}_owner_b_shared`,
          3,
          sharedHash,
        );
        const ownerAHashes = await pool.query(
          `select count(*)::int as count from questions where recipient_profile_id = $1 and normalized_text_hash like $2`,
          [ownerA.profileId, `${sharedHash}_%`],
        );
        const ownerBHashes = await pool.query(
          `select count(*)::int as count from questions where recipient_profile_id = $1 and normalized_text_hash like $2`,
          [ownerB.profileId, `${sharedHash}_%`],
        );
        expect(ownerAHashes.rows[0]?.count).toBe(0);
        expect(ownerBHashes.rows[0]?.count).toBe(3);

        await assertConcurrentOwnerLock(repository, ownerA, suffix);
        await assertLegacyHashCompatibility(repository, pool, ownerA, suffix);
        await assertCredentialRotationCompareAndSwap(
          settingsRepository,
          ownerA,
        );

        await persistProductionBatch(
          repository,
          ownerA,
          `${suffix}_cleanup_batch`,
          3,
        );
        const cleanupNow = new Date();
        await pool.query(
          `update users set deleted_at = $2, deletion_grace_ends_at = $2 where id = $1`,
          [ownerA.userId, new Date(cleanupNow.getTime() - 1_000)],
        );
        const cleanup = await cleanupExpiredAccountDeletions({
          now: cleanupNow,
          store: createPoolCleanupStore(pool),
        });
        expect(cleanup.anonymized).toBe(1);

        const cleanedOwner = await pool.query(
          `
            select
              (select count(*)::int from question_generation_settings where owner_user_id = $1) as settings,
              (select count(*)::int from question_generation_batches where owner_user_id = $1) as batches,
              (select count(*)::int from questions where recipient_user_id = $1 and deleted_at is null) as active_questions,
              (select count(*)::int from questions where recipient_user_id = $1) as retained_questions
          `,
          [ownerA.userId],
        );
        expect(cleanedOwner.rows[0]).toEqual({
          settings: 0,
          batches: 0,
          active_questions: 0,
          retained_questions: 27,
        });

        const unrelatedOwner = await pool.query(
          `
            select count(*)::int as count
            from questions
            where recipient_profile_id = $1
          `,
          [ownerB.profileId],
        );
        expect(unrelatedOwner.rows[0]?.count).toBe(3);

        let rollingNow = 0;
        const rollingOptions = {
          algorithm: "rolling",
          database,
          key: rollingRateKey,
          max: 2,
          now: () => rollingNow,
          storage: "database",
          windowSeconds: 10,
        };
        expect((await checkRateLimit(rollingOptions)).allowed).toBe(true);
        rollingNow = 9_000;
        expect((await checkRateLimit(rollingOptions)).allowed).toBe(true);
        // The first timestamp has expired, but the second remains in the
        // rolling window. A fixed window would incorrectly reset to one here.
        rollingNow = 10_001;
        expect((await checkRateLimit(rollingOptions)).allowed).toBe(true);
        rollingNow = 10_002;
        const rollingDenied = await checkRateLimit(rollingOptions);
        expect(rollingDenied.allowed).toBe(false);
        if (rollingDenied.allowed) {
          throw new Error("expected the rolling PostgreSQL limiter to deny the fourth request");
        }
        expect(rollingDenied.retryAfterSeconds).toBeGreaterThan(0);
      } finally {
        await pool.query(`delete from rate_limits where key = $1`, [rollingRateKey]);
        await cleanupOwner(pool, ownerB);
        // The owner-A cleanup is intentionally exercised above; these deletes
        // are idempotent guards for failures before that section.
        await cleanupOwner(pool, ownerA);
        await pool.end();
      }
    },
    30_000,
  );
});

async function createOwner(pool, prefix) {
  const owner = { userId: `${prefix}_user`, profileId: `${prefix}_profile` };
  await pool.query(
    `insert into users (id, name, email) values ($1, $2, $3)`,
    [owner.userId, prefix, `${prefix}@example.test`],
  );
  await pool.query(
    `insert into profiles (id, user_id, username, display_name) values ($1, $2, $3, $4)`,
    [owner.profileId, owner.userId, prefix, prefix],
  );
  return owner;
}

async function persistProductionBatch(repository, owner, batchId, requestedCount, hashPrefix = batchId) {
  return repository.persistGeneratedBatch({
    ownerUserId: owner.userId,
    profileId: owner.profileId,
    language: "english",
    style: "balanced",
    requestedCount,
    modelUsed: "gemini-3.6-flash",
    usage: emptyUsage(),
    batchId,
    now: new Date(),
    questions: Array.from({ length: requestedCount }, (_, index) => {
      const normalizedTextHash = `${hashPrefix}_${String(index)}`;
      const id = `${batchId}_question_${String(index)}`;
      return {
        id,
        publicId: `${id}_public`,
        text: `Question ${normalizedTextHash}?`,
        normalizedTextHash,
      };
    }),
  });
}

async function assertConcurrentOwnerLock(repository, owner, suffix) {
  const attempts = [0, 1].map((index) =>
    persistProductionBatch(
      repository,
      owner,
      `${suffix}_concurrent_batch_${String(index)}`,
      3,
      `${suffix}_concurrent_hash`,
    ),
  );
  const results = await Promise.allSettled(attempts);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find((result) => result.status === "rejected");
  expect(rejected?.reason?.code).toBe("duplicate");
}

async function assertLegacyHashCompatibility(repository, pool, owner, suffix) {
  const legacyPrefix = `${suffix}_legacy_existing`;
  await persistProductionBatch(
    repository,
    owner,
    `${suffix}_legacy_seed_batch`,
    3,
    legacyPrefix,
  );

  const conflictBatchId = `${suffix}_legacy_conflict_batch`;
  await expect(
    repository.persistGeneratedBatch({
      ownerUserId: owner.userId,
      profileId: owner.profileId,
      language: "english",
      style: "balanced",
      requestedCount: 3,
      modelUsed: "gemini-3.6-flash",
      usage: emptyUsage(),
      batchId: conflictBatchId,
      now: new Date(),
      questions: Array.from({ length: 3 }, (_, index) => ({
        id: `${conflictBatchId}_question_${String(index)}`,
        publicId: `${conflictBatchId}_public_${String(index)}`,
        text: `Legacy compatibility ${String(index)}?`,
        normalizedTextHash: `${suffix}_current_hash_${String(index)}`,
        legacyNormalizedTextHash:
          index === 0
            ? `${legacyPrefix}_0`
            : `${suffix}_legacy_hash_${String(index)}`,
      })),
    }),
  ).rejects.toMatchObject({ code: "duplicate" });

  const conflictBatch = await pool.query(
    `select count(*)::int as count from question_generation_batches where id = $1`,
    [conflictBatchId],
  );
  expect(conflictBatch.rows[0]?.count).toBe(0);
}

async function assertCredentialRotationCompareAndSwap(repository, owner) {
  const previousMaterial = {
    ciphertext: "previous-ciphertext",
    nonce: "previous-nonce",
    authTag: "previous-auth-tag",
    keyVersion: 1,
  };
  const replacementMaterial = {
    ciphertext: "replacement-ciphertext",
    nonce: "replacement-nonce",
    authTag: "replacement-auth-tag",
    keyVersion: 2,
  };

  await repository.saveValidatedCredential({
    ownerUserId: owner.userId,
    profileId: owner.profileId,
    modelPreference: "auto",
    material: previousMaterial,
    action: "credential_connected",
    now: new Date(),
  });

  await expect(
    repository.replaceCredentialMaterial({
      ownerUserId: owner.userId,
      previousMaterial: { ...previousMaterial, ciphertext: "stale-ciphertext" },
      material: replacementMaterial,
      now: new Date(),
    }),
  ).resolves.toBe(false);
  await expect(repository.findSettings(owner.userId)).resolves.toMatchObject({
    geminiKeyCiphertext: previousMaterial.ciphertext,
    geminiKeyVersion: previousMaterial.keyVersion,
  });

  await expect(
    repository.replaceCredentialMaterial({
      ownerUserId: owner.userId,
      previousMaterial,
      material: replacementMaterial,
      now: new Date(),
    }),
  ).resolves.toBe(true);
  await expect(repository.findSettings(owner.userId)).resolves.toMatchObject({
    geminiKeyCiphertext: replacementMaterial.ciphertext,
    geminiKeyVersion: replacementMaterial.keyVersion,
  });
}

function emptyUsage() {
  return {
    promptTokenCount: undefined,
    candidateTokenCount: undefined,
    totalTokenCount: undefined,
  };
}

async function cleanupOwner(pool, owner) {
  await pool.query(`delete from questions where recipient_user_id = $1`, [owner.userId]);
  await pool.query(`delete from question_generation_settings where owner_user_id = $1`, [owner.userId]);
  await pool.query(`delete from question_generation_batches where owner_user_id = $1`, [owner.userId]);
  await pool.query(`delete from profiles where id = $1`, [owner.profileId]);
  await pool.query(`delete from users where id = $1`, [owner.userId]);
}
