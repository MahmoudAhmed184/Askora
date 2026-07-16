import pg from "pg";
import { data } from "react-router";

import { serverEnv } from "~/lib/env.server";

import {
  cleanupExpiredAccountDeletions,
  createPoolCleanupStore,
} from "../../../../scripts/cleanup-account-deletions.mjs";

const { Pool } = pg;

export async function loader({ request }: { request: Request }) {
  if (!isAuthorizedCronRequest(request)) {
    return data({ status: "unauthorized" as const }, { status: 401 });
  }

  const databaseUrl = serverEnv.DIRECT_DATABASE_URL ?? serverEnv.DATABASE_URL;

  if (databaseUrl === undefined) {
    return data({ status: "database_unavailable" as const }, { status: 503 });
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await cleanupExpiredAccountDeletions({
      store: createPoolCleanupStore(pool),
    });

    return data({ status: "ok" as const, result });
  } finally {
    await pool.end();
  }
}

function isAuthorizedCronRequest(request: Request) {
  const secret = serverEnv.CRON_SECRET;
  return (
    secret !== undefined &&
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}
