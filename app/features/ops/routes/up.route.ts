import { sql } from "drizzle-orm";

import { getRuntimeDatabase } from "~/db/client.server";

type ReadinessCheck = () => Promise<void>;

export async function loader(
  _args: { request: Request },
  checkReadiness: ReadinessCheck = checkDatabaseReadiness,
) {
  const headers = { "Cache-Control": "no-store" };

  try {
    await checkReadiness();
    return Response.json({ status: "ok" as const }, { headers });
  } catch {
    return Response.json(
      { status: "unavailable" as const },
      { headers, status: 503 },
    );
  }
}

async function checkDatabaseReadiness() {
  await getRuntimeDatabase().execute(sql`select 1`);
}
