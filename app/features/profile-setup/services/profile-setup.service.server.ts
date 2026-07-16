import { and, eq } from "drizzle-orm";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { events, profiles, usernameReservations } from "~/db/schema";
import type {
  IncompleteProfileSessionSummary
} from "~/features/auth/services/auth.service.server";;
import { profileSetupSubmissionSchema } from "~/features/profile-setup/validations/profile-setup.validations";
import { isAllowedUsername } from "~/features/profile-setup/username-policy";
import { createDatabaseId } from "~/lib/ids.server";
import { ok, type Result } from "~/lib/result";
import { parseFormData } from "~/lib/zod-form";

export interface ProfileSetupFormValues {
  username: string;
  displayName: string;
  bio: string;
}

export interface ProfileSetupFieldErrors {
  username?: string;
  displayName?: string;
  bio?: string;
}

export type ProfileSetupSubmissionResult =
  | {
      status: "created";
      profile: {
        id: string;
        username: string;
        displayName: string;
      };
    }
  | {
      status: "invalid";
      values: ProfileSetupFormValues;
      fieldErrors: ProfileSetupFieldErrors;
      formError?: string;
    }
  | {
      status: "username_taken";
      values: ProfileSetupFormValues;
      fieldErrors: Required<Pick<ProfileSetupFieldErrors, "username">>;
      formError?: string;
    }
  | {
      status: "duplicate_profile";
      values: ProfileSetupFormValues;
      formError: string;
    }
  | {
      status: "suspended";
      values: ProfileSetupFormValues;
      formError: string;
    };

export type ProfileSetupFormResult = Exclude<
  ProfileSetupSubmissionResult,
  { status: "created" }
>;

export interface ExistingProfile {
  id: string;
  username: string;
}

export interface ExistingUsernameReservation {
  id: string;
  profileId: string;
}

export interface NewProfileSetup {
  profileId: string;
  reservationId: string;
  eventId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | undefined;
  bio: string | undefined;
}

export interface ProfileSetupStore {
  findProfileByUserId(userId: string): Promise<ExistingProfile | undefined>;
  findActiveProfileByUsername(
    username: string,
  ): Promise<ExistingProfile | undefined>;
  findUsernameReservation(
    username: string,
  ): Promise<ExistingUsernameReservation | undefined>;
  createProfileSetup(setup: NewProfileSetup): Promise<void>;
}

interface SubmitProfileSetupOptions {
  formData: FormData;
  session: IncompleteProfileSessionSummary;
  store?: ProfileSetupStore;
  createId?: () => string;
}

const usernameTakenMessage = "This username is not available.";
const duplicateProfileMessage = "Your account already has a profile.";
const suspendedSetupMessage =
  "Profile setup is unavailable while this account is suspended.";

export async function submitProfileSetup({
  formData,
  session,
  store = createDrizzleProfileSetupStore(),
  createId = createDatabaseId,
}: SubmitProfileSetupOptions): Promise<ProfileSetupSubmissionResult> {
  const values = getProfileSetupFormValues(formData);

  if (session.suspensionStatus === "active") {
    return {
      status: "suspended",
      values,
      formError: suspendedSetupMessage,
    };
  }

  const parsed = parseProfileSetupFormData(formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getProfileSetupFieldErrors(parsed.error),
    };
  }

  const conflict = await findProfileSetupConflict({
    store,
    userId: session.user.id,
    username: parsed.value.username,
  });

  if (conflict.status === "duplicate_profile") {
    return {
      status: "duplicate_profile",
      values,
      formError: duplicateProfileMessage,
    };
  }

  if (conflict.status === "username_taken") {
    return getUsernameTakenResult(values);
  }

  try {
    const setup = {
      profileId: createId(),
      reservationId: createId(),
      eventId: createId(),
      userId: session.user.id,
      username: parsed.value.username,
      displayName: parsed.value.displayName,
      avatarUrl: getOptionalText(session.user.image),
      bio: parsed.value.bio,
    } satisfies NewProfileSetup;

    await store.createProfileSetup(setup);

    return {
      status: "created",
      profile: {
        id: setup.profileId,
        username: setup.username,
        displayName: setup.displayName,
      },
    };
  } catch (error) {
    const mappedError = mapProfileSetupCreationError(error, values);

    if (mappedError !== undefined) {
      return mappedError;
    }

    throw error;
  }
}

export type UsernameAvailability = "available" | "taken" | "invalid";

export async function checkUsernameAvailability(
  username: string,
  store: ProfileSetupStore = createDrizzleProfileSetupStore(),
): Promise<UsernameAvailability> {
  const normalized = username.trim().toLowerCase();

  if (!isAllowedUsername(normalized)) {
    return "invalid";
  }

  const [activeProfile, reservation] = await Promise.all([
    store.findActiveProfileByUsername(normalized),
    store.findUsernameReservation(normalized),
  ]);

  return activeProfile !== undefined || reservation !== undefined
    ? "taken"
    : "available";
}

export function getProfileSetupDefaults(user: {
  email: string;
  name: string;
}): ProfileSetupFormValues {
  return {
    username: getSuggestedUsername(user),
    displayName: getSuggestedDisplayName(user),
    bio: "",
  };
}

export function createCanonicalProfileUrl(appUrl: string, username: string) {
  return `${appUrl.replace(/\/+$/, "")}/${username}`;
}

export function createDrizzleProfileSetupStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): ProfileSetupStore {
  return {
    async findProfileByUserId(userId) {
      const [profile] = await database
        .select({ id: profiles.id, username: profiles.username })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      return profile;
    },
    async findActiveProfileByUsername(username) {
      const [profile] = await database
        .select({ id: profiles.id, username: profiles.username })
        .from(profiles)
        .where(and(eq(profiles.username, username), eq(profiles.isActive, true)))
        .limit(1);

      return profile;
    },
    async findUsernameReservation(username) {
      const [reservation] = await database
        .select({
          id: usernameReservations.id,
          profileId: usernameReservations.profileId,
        })
        .from(usernameReservations)
        .where(eq(usernameReservations.username, username))
        .limit(1);

      return reservation;
    },
    async createProfileSetup(setup) {
      await database.transaction(async (transaction) => {
        await transaction.insert(profiles).values({
          id: setup.profileId,
          userId: setup.userId,
          username: setup.username,
          displayName: setup.displayName,
          avatarUrl: setup.avatarUrl ?? null,
          bio: setup.bio ?? null,
        });

        await transaction.insert(usernameReservations).values({
          id: setup.reservationId,
          username: setup.username,
          profileId: setup.profileId,
        });

        await transaction.insert(events).values({
          id: setup.eventId,
          userId: setup.userId,
          profileId: setup.profileId,
          type: "profile_setup_completed",
          metadata: {
            username: setup.username,
          },
        });
      });
    },
  };
}

function parseProfileSetupFormData(
  formData: FormData,
): Result<
  {
    username: string;
    displayName: string;
    bio: string | undefined;
  },
  ZodError
> {
  const parsed = parseFormData(profileSetupSubmissionSchema, formData);

  if (!parsed.ok) {
    return parsed;
  }

  return ok({
    username: parsed.value.username,
    displayName: parsed.value.displayName,
    bio: parsed.value.bio,
  });
}

async function findProfileSetupConflict({
  store,
  userId,
  username,
}: {
  store: ProfileSetupStore;
  userId: string;
  username: string;
}): Promise<
  | { status: "none" }
  | { status: "duplicate_profile" }
  | { status: "username_taken" }
> {
  const [profile, activeUsernameProfile, usernameReservation] =
    await Promise.all([
      store.findProfileByUserId(userId),
      store.findActiveProfileByUsername(username),
      store.findUsernameReservation(username),
    ]);

  if (profile !== undefined) {
    return { status: "duplicate_profile" };
  }

  if (activeUsernameProfile !== undefined || usernameReservation !== undefined) {
    return { status: "username_taken" };
  }

  return { status: "none" };
}

function getProfileSetupFormValues(formData: FormData): ProfileSetupFormValues {
  return {
    username: getFormText(formData, "username").trim(),
    displayName: getFormText(formData, "displayName").trim(),
    bio: getFormText(formData, "bio").trim(),
  };
}

function getProfileSetupFieldErrors(
  error: ZodError,
): ProfileSetupFieldErrors {
  const fieldErrors: ProfileSetupFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "username" && fieldErrors.username === undefined) {
      fieldErrors.username = issue.message;
    }

    if (field === "displayName" && fieldErrors.displayName === undefined) {
      fieldErrors.displayName = issue.message;
    }

    if (field === "bio" && fieldErrors.bio === undefined) {
      fieldErrors.bio = issue.message;
    }
  }

  return fieldErrors;
}

function mapProfileSetupCreationError(
  error: unknown,
  values: ProfileSetupFormValues,
): ProfileSetupFormResult | undefined {
  const constraint = getPostgresConstraintName(error);

  if (constraint === undefined) {
    return undefined;
  }

  if (profileConstraintNames.has(constraint)) {
    return {
      status: "duplicate_profile",
      values,
      formError: duplicateProfileMessage,
    };
  }

  if (usernameConstraintNames.has(constraint)) {
    return getUsernameTakenResult(values);
  }

  return undefined;
}

function getUsernameTakenResult(
  values: ProfileSetupFormValues,
): ProfileSetupFormResult {
  return {
    status: "username_taken",
    values,
    fieldErrors: {
      username: usernameTakenMessage,
    },
  };
}

const profileConstraintNames = new Set(["profiles_user_id_unique"]);
const usernameConstraintNames = new Set([
  "profiles_username_active_unique",
  "username_reservations_username_unique",
]);

function getPostgresConstraintName(error: unknown): string | undefined {
  const constraint = getConstraintFromErrorCause(error);

  if (constraint !== undefined) {
    return constraint;
  }

  const message = error instanceof Error ? error.message : undefined;

  if (message === undefined) {
    return undefined;
  }

  return [...profileConstraintNames, ...usernameConstraintNames].find((name) =>
    message.includes(name),
  );
}

function getConstraintFromErrorCause(error: unknown): string | undefined {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (isRecord(current) && !visited.has(current)) {
    visited.add(current);

    if (
      current.code === "23505" &&
      typeof current.constraint === "string"
    ) {
      return current.constraint;
    }

    current = current.cause;
  }

  return undefined;
}

function getSuggestedDisplayName({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  const trimmedName = name.trim();

  if (trimmedName.length > 0) {
    return trimmedName.slice(0, 50);
  }

  return getEmailLocalPart(email).slice(0, 50);
}

function getSuggestedUsername({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  const candidates = [getEmailLocalPart(email), name];

  for (const candidate of candidates) {
    const username = normalizeUsernameSuggestion(candidate);

    if (isAllowedUsername(username)) {
      return username;
    }
  }

  return "";
}

function normalizeUsernameSuggestion(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .slice(0, 30);
}

function getEmailLocalPart(email: string) {
  return email.split("@")[0] ?? "";
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getOptionalText(value: string | undefined) {
  return value === undefined || value.trim().length === 0 ? undefined : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
