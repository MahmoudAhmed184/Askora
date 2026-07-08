import type { Pool } from "pg";

export interface BetaUserFixture {
  id: string;
  email: string;
  name: string;
  sessionId: string;
  sessionToken: string;
}

export interface BetaProfileFixture {
  id: string;
  username: string;
  displayName: string;
  userId: string;
}

export interface BetaQuestionFixture {
  id: string;
  publicId: string;
  text: string;
}

export interface BetaFixture {
  users: {
    owner: BetaUserFixture;
    viewer: BetaUserFixture;
    admin: BetaUserFixture;
    incomplete: BetaUserFixture;
    suspended: BetaUserFixture;
  };
  profiles: {
    owner: BetaProfileFixture;
    viewer: BetaProfileFixture;
    admin: BetaProfileFixture;
    suspended: BetaProfileFixture;
  };
  questions: {
    inbox: BetaQuestionFixture;
    filtered: BetaQuestionFixture;
    answered: BetaQuestionFixture;
  };
  threads: {
    published: {
      id: string;
      publicId: string;
    };
  };
  threadItems: {
    published: {
      id: string;
      publicId: string;
      answerText: string;
    };
  };
  report: {
    id: string;
  };
  block: {
    id: string;
  };
}

export interface BetaSeedSummary {
  users: number;
  profiles: number;
  sessions: number;
  questions: number;
  threads: number;
  threadItems: number;
  follows: number;
  likes: number;
  reports: number;
  blocks: number;
}

export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax";
  expires: number;
}

export const betaFixture: BetaFixture;

export function assertBetaSeedAllowed(
  environment?: NodeJS.ProcessEnv,
): string;

export function seedBetaFixtures(params: {
  pool: Pool;
  now?: Date;
  secret?: string;
}): Promise<BetaSeedSummary>;

export function createSignedBetterAuthSessionCookie(params: {
  sessionToken: string;
  secret?: string;
}): string;

export function createBetaSessionCookie(params: {
  user: BetaUserFixture;
  appUrl?: string;
  expiresAt?: Date;
  secret?: string;
}): PlaywrightCookie;

export function getBetaResetStatements(): string[];
