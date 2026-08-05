import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("deployment readiness configuration", () => {
  it("runs migrations before the Vercel production build", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve("package.json"), "utf8"),
    );
    const vercelConfig = JSON.parse(
      await readFile(resolve("vercel.json"), "utf8"),
    );
    const deployCommand = packageJson.scripts?.["deploy:build"];

    expect(vercelConfig.buildCommand).toBe("npm run deploy:build");
    expect(deployCommand).toContain("npm run db:migrate");
    expect(deployCommand).toContain("npm run build");
    expect(deployCommand).toContain("VERCEL_ENV");
  });

  it("keeps the validation workflow and retention schedule configured", async () => {
    const workflow = await readFile(
      resolve(".github/workflows/ci.yml"),
      "utf8",
    );
    const vercelConfig = JSON.parse(
      await readFile(resolve("vercel.json"), "utf8"),
    );

    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
    expect(vercelConfig.crons).toContainEqual({
      path: "/api/cron/cleanup",
      schedule: "0 3 * * *",
    });
  });
});
