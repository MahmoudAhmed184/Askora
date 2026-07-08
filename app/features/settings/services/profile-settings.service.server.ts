import { and, eq } from "drizzle-orm";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { profiles, usernameReservations } from "~/db/schema";
import type {
  CompletedProfileSessionSummary
} from "~/features/auth/services/auth.service.server";;
import {
  avatarSourceValues,
  profileSettingsSubmissionSchema,
  type AvatarSource,
  type ProfileSettingsSubmission,
} from "~/features/settings/validations/settings.validations";
import { createDatabaseId } from "~/lib/ids.server";
import { parseFormData } from "~/lib/zod-form";

export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;
export const OLD_USERNAME_REDIRECT_DAYS = 90;

export interface ProfileSettingsFormValues {
  username: string;
  displayName: string;
  bio: string;
  avatarSource: AvatarSource;
}

export interface ProfileSettingsFieldErrors {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarSource?: string;
}

export interface UsernameCooldownStatus {
  lastChangedAt: string;
  nextChangeAt: string;
  nextChangeDate: string;
  isActive: boolean;
}

export interface ProfileSettingsViewData {
  values: ProfileSettingsFormValues;
  googleAvatarUrl: string | undefined;
  currentAvatarUrl: string | null;
  usernameCooldown: UsernameCooldownStatus | undefined;
  redirectReservationDays: number;
}

export type ProfileSettingsSubmissionResult =
  | {
      status: "updated";
      values: ProfileSettingsFormValues;
      usernameChanged: boolean;
      previousUsername?: string;
      redirectUntilDate?: string;
    }
  | {
      status: "invalid";
      values: ProfileSettingsFormValues;
      fieldErrors: ProfileSettingsFieldErrors;
      formError?: string;
    }
  | {
      status: "username_taken";
      values: ProfileSettingsFormValues;
      fieldErrors: Required<Pick<ProfileSettingsFieldErrors, "username">>;
      formError?: string;
    }
  | {
      status: "cooldown";
      values: ProfileSettingsFormValues;
      fieldErrors: Required<Pick<ProfileSettingsFieldErrors, "username">>;
      cooldown: UsernameCooldownStatus;
      formError?: string;
    }
  | {
      status: "suspended";
      values: ProfileSettingsFormValues;
      formError: string;
    }
  | {
      status: "not_found";
      values: ProfileSettingsFormValues;
      formError: string;
    }
  | {
      status: "stale";
      values: ProfileSettingsFormValues;
      formError: string;
    };

export interface StoredProfileSettings {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  activeUsernameReservation:
    | {
        id: string;
        createdAt: Date;
      }
    | undefined;
}

export interface ExistingProfileUsername {
  id: string;
  username: string;
}

export interface ExistingUsernameReservation {
  id: string;
  profileId: string;
}

export interface ProfileIdentityUpdate {
  profileId: string;
  userId: string;
  displayName: string;
  bio: string | undefined;
  avatarUrl: string | null;
  updatedAt: Date;
}

export interface ProfileUsernameChange extends ProfileIdentityUpdate {
  previousUsername: string;
  newUsername: string;
  newReservationId: string;
  oldUsernameReservedUntil: Date;
  oldUsernameRedirectUntil: Date;
}

export type ProfileUsernameChangeStoreResult =
  | { status: "changed" }
  | { status: "profile_not_found" }
  | { status: "active_reservation_missing" }
  | { status: "stale_profile" };

export interface ProfileSettingsStore {
  findProfileSettings(params: {
    profileId: string;
    userId: string;
  }): Promise<StoredProfileSettings | undefined>;
  findActiveProfileByUsername(
    username: string,
  ): Promise<ExistingProfileUsername | undefined>;
  findUsernameReservation(
    username: string,
  ): Promise<ExistingUsernameReservation | undefined>;
  updateProfileIdentity(update: ProfileIdentityUpdate): Promise<void>;
  changeProfileUsername(
    change: ProfileUsernameChange,
  ): Promise<ProfileUsernameChangeStoreResult>;
}

interface LoadProfileSettingsOptions {
  session: CompletedProfileSessionSummary;
  store?: ProfileSettingsStore;
  now?: Date;
}

interface SubmitProfileSettingsOptions extends LoadProfileSettingsOptions {
  formData: FormData;
  createId?: () => string;
}

const usernameTakenMessage = "This username is not available.";
const suspendedProfileSettingsMessage =
  "Profile settings are unavailable while this account is suspended.";
const profileNotFoundMessage = "Your profile settings could not be loaded.";
const staleProfileMessage =
  "Your profile changed in another request. Reload and try again.";

export async function loadProfileSettings({
  session,
  store = createDrizzleProfileSettingsStore(),
  now = new Date(),
}: LoadProfileSettingsOptions): Promise<ProfileSettingsViewData> {
  const profile = await store.findProfileSettings({
    profileId: session.profile.id,
    userId: session.user.id,
  });

  if (profile === undefined) {
    throw new Error(profileNotFoundMessage);
  }

  return createProfileSettingsViewData({
    profile,
    googleAvatarUrl: getOptionalText(session.user.image),
    now,
  });
}

export async function submitProfileSettings({
  formData,
  session,
  store = createDrizzleProfileSettingsStore(),
  createId = createDatabaseId,
  now = new Date(),
}: SubmitProfileSettingsOptions): Promise<ProfileSettingsSubmissionResult> {
  const values = getProfileSettingsFormValues(formData);

  if (session.suspensionStatus === "active") {
    return {
      status: "suspended",
      values,
      formError: suspendedProfileSettingsMessage,
    };
  }

  const parsed = parseFormData(profileSettingsSubmissionSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getProfileSettingsFieldErrors(parsed.error),
    };
  }

  const profile = await store.findProfileSettings({
    profileId: session.profile.id,
    userId: session.user.id,
  });

  if (profile === undefined) {
    return {
      status: "not_found",
      values: getProfileSettingsValues(parsed.value),
      formError: profileNotFoundMessage,
    };
  }

  const normalizedValues = getProfileSettingsValues(parsed.value);
  const avatarUrl = getAvatarUrlForSource(
    parsed.value.avatarSource,
    session.user.image,
  );

  if (parsed.value.username === profile.username) {
    await store.updateProfileIdentity({
      profileId: session.profile.id,
      userId: session.user.id,
      displayName: parsed.value.displayName,
      bio: parsed.value.bio,
      avatarUrl,
      updatedAt: now,
    });

    return {
      status: "updated",
      values: normalizedValues,
      usernameChanged: false,
    };
  }

  const cooldown = getUsernameCooldownStatus(
    profile.activeUsernameReservation?.createdAt,
    now,
  );

  if (cooldown?.isActive === true) {
    return {
      status: "cooldown",
      values: normalizedValues,
      fieldErrors: {
        username: `You can change your username again on ${cooldown.nextChangeDate}.`,
      },
      cooldown,
    };
  }

  if (
    (await findUsernameSettingsConflict({
      store,
      username: parsed.value.username,
      profileId: session.profile.id,
    })) === "taken"
  ) {
    return getUsernameTakenResult(normalizedValues);
  }

  const oldUsernameExpiration = addDays(now, OLD_USERNAME_REDIRECT_DAYS);

  try {
    const changeResult = await store.changeProfileUsername({
      profileId: session.profile.id,
      userId: session.user.id,
      previousUsername: profile.username,
      newUsername: parsed.value.username,
      newReservationId: createId(),
      displayName: parsed.value.displayName,
      bio: parsed.value.bio,
      avatarUrl,
      updatedAt: now,
      oldUsernameReservedUntil: oldUsernameExpiration,
      oldUsernameRedirectUntil: oldUsernameExpiration,
    });

    if (changeResult.status === "profile_not_found") {
      return {
        status: "not_found",
        values: normalizedValues,
        formError: profileNotFoundMessage,
      };
    }

    if (changeResult.status === "active_reservation_missing") {
      return {
        status: "stale",
        values: normalizedValues,
        formError: "Your active username reservation could not be found.",
      };
    }

    if (changeResult.status === "stale_profile") {
      return {
        status: "stale",
        values: normalizedValues,
        formError: staleProfileMessage,
      };
    }

    return {
      status: "updated",
      values: normalizedValues,
      usernameChanged: true,
      previousUsername: profile.username,
      redirectUntilDate: formatSettingsDate(oldUsernameExpiration),
    };
  } catch (error) {
    if (isUsernameUniqueConstraintError(error)) {
      return getUsernameTakenResult(normalizedValues);
    }

    throw error;
  }
}

export function createDrizzleProfileSettingsStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): ProfileSettingsStore {
  return {
    async findProfileSettings({ profileId, userId }) {
      const [profile] = await database
        .select({
          id: profiles.id,
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          bio: profiles.bio,
        })
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
        .limit(1);

      if (profile === undefined) {
        return undefined;
      }

      const [activeUsernameReservation] = await database
        .select({
          id: usernameReservations.id,
          createdAt: usernameReservations.createdAt,
        })
        .from(usernameReservations)
        .where(
          and(
            eq(usernameReservations.profileId, profileId),
            eq(usernameReservations.username, profile.username),
          ),
        )
        .limit(1);

      return {
        ...profile,
        activeUsernameReservation,
      };
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
    async updateProfileIdentity(update) {
      await database
        .update(profiles)
        .set({
          displayName: update.displayName,
          bio: update.bio ?? null,
          avatarUrl: update.avatarUrl,
          updatedAt: update.updatedAt,
        })
        .where(
          and(eq(profiles.id, update.profileId), eq(profiles.userId, update.userId)),
        );
    },
    async changeProfileUsername(change) {
      return database.transaction(async (transaction) => {
        const [ownerProfile] = await transaction
          .select({
            id: profiles.id,
            username: profiles.username,
          })
          .from(profiles)
          .where(
            and(
              eq(profiles.id, change.profileId),
              eq(profiles.userId, change.userId),
            ),
          )
          .for("update")
          .limit(1);

        if (ownerProfile === undefined) {
          return { status: "profile_not_found" };
        }

        if (ownerProfile.username !== change.previousUsername) {
          return { status: "stale_profile" };
        }

        const [activeUsernameReservation] = await transaction
          .select({
            id: usernameReservations.id,
          })
          .from(usernameReservations)
          .where(
            and(
              eq(usernameReservations.profileId, change.profileId),
              eq(usernameReservations.username, ownerProfile.username),
            ),
          )
          .for("update")
          .limit(1);

        if (activeUsernameReservation === undefined) {
          return { status: "active_reservation_missing" };
        }

        await transaction
          .update(profiles)
          .set({
            username: change.newUsername,
            displayName: change.displayName,
            bio: change.bio ?? null,
            avatarUrl: change.avatarUrl,
            updatedAt: change.updatedAt,
          })
          .where(
            and(
              eq(profiles.id, change.profileId),
              eq(profiles.userId, change.userId),
            ),
          );

        await transaction
          .update(usernameReservations)
          .set({
            redirectToUsername: change.newUsername,
            reservedUntil: change.oldUsernameReservedUntil,
            redirectUntil: change.oldUsernameRedirectUntil,
          })
          .where(eq(usernameReservations.id, activeUsernameReservation.id));

        await transaction.insert(usernameReservations).values({
          id: change.newReservationId,
          username: change.newUsername,
          profileId: change.profileId,
          createdAt: change.updatedAt,
        });

        return { status: "changed" };
      });
    },
  };
}

function createProfileSettingsViewData({
  profile,
  googleAvatarUrl,
  now,
}: {
  profile: StoredProfileSettings;
  googleAvatarUrl: string | undefined;
  now: Date;
}): ProfileSettingsViewData {
  const avatarSource = getAvatarSource(profile.avatarUrl, googleAvatarUrl);

  return {
    values: {
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio ?? "",
      avatarSource,
    },
    googleAvatarUrl,
    currentAvatarUrl: avatarSource === "google" ? googleAvatarUrl ?? null : null,
    usernameCooldown: getUsernameCooldownStatus(
      profile.activeUsernameReservation?.createdAt,
      now,
    ),
    redirectReservationDays: OLD_USERNAME_REDIRECT_DAYS,
  };
}

function getProfileSettingsFormValues(
  formData: FormData,
): ProfileSettingsFormValues {
  const avatarSource = getFormText(formData, "avatarSource");

  return {
    username: getFormText(formData, "username").trim(),
    displayName: getFormText(formData, "displayName").trim(),
    bio: getFormText(formData, "bio").trim(),
    avatarSource: isAvatarSource(avatarSource) ? avatarSource : "fallback",
  };
}

function getProfileSettingsValues(
  submission: ProfileSettingsSubmission,
): ProfileSettingsFormValues {
  return {
    username: submission.username,
    displayName: submission.displayName,
    bio: submission.bio ?? "",
    avatarSource: submission.avatarSource,
  };
}

function getProfileSettingsFieldErrors(
  error: ZodError,
): ProfileSettingsFieldErrors {
  const fieldErrors: ProfileSettingsFieldErrors = {};

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

    if (field === "avatarSource" && fieldErrors.avatarSource === undefined) {
      fieldErrors.avatarSource = issue.message;
    }
  }

  return fieldErrors;
}

async function findUsernameSettingsConflict({
  store,
  username,
  profileId,
}: {
  store: ProfileSettingsStore;
  username: string;
  profileId: string;
}): Promise<"taken" | "none"> {
  const [activeUsernameProfile, usernameReservation] = await Promise.all([
    store.findActiveProfileByUsername(username),
    store.findUsernameReservation(username),
  ]);

  if (
    (activeUsernameProfile !== undefined && activeUsernameProfile.id !== profileId) ||
    usernameReservation !== undefined
  ) {
    return "taken";
  }

  return "none";
}

function getUsernameTakenResult(
  values: ProfileSettingsFormValues,
): ProfileSettingsSubmissionResult {
  return {
    status: "username_taken",
    values,
    fieldErrors: {
      username: usernameTakenMessage,
    },
  };
}

function getAvatarSource(
  avatarUrl: string | null,
  googleAvatarUrl: string | undefined,
): AvatarSource {
  return avatarUrl !== null && googleAvatarUrl !== undefined ? "google" : "fallback";
}

function getAvatarUrlForSource(
  avatarSource: AvatarSource,
  googleAvatarUrl: string | undefined,
) {
  return avatarSource === "google" ? getOptionalText(googleAvatarUrl) ?? null : null;
}

function getUsernameCooldownStatus(
  lastChangedAt: Date | undefined,
  now: Date,
): UsernameCooldownStatus | undefined {
  if (lastChangedAt === undefined) {
    return undefined;
  }

  const nextChangeAt = addDays(lastChangedAt, USERNAME_CHANGE_COOLDOWN_DAYS);

  return {
    lastChangedAt: lastChangedAt.toISOString(),
    nextChangeAt: nextChangeAt.toISOString(),
    nextChangeDate: formatSettingsDate(nextChangeAt),
    isActive: nextChangeAt.getTime() > now.getTime(),
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatSettingsDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function getOptionalText(value: string | undefined) {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function isAvatarSource(value: string): value is AvatarSource {
  return avatarSourceValues.includes(value as AvatarSource);
}

const usernameConstraintNames = new Set([
  "profiles_username_active_unique",
  "username_reservations_username_unique",
]);

function isUsernameUniqueConstraintError(error: unknown) {
  const constraint = getPostgresConstraintName(error);

  return constraint !== undefined && usernameConstraintNames.has(constraint);
}

function getPostgresConstraintName(error: unknown): string | undefined {
  const constraint = getConstraintFromErrorCause(error);

  if (constraint !== undefined) {
    return constraint;
  }

  const message = error instanceof Error ? error.message : undefined;

  if (message === undefined) {
    return undefined;
  }

  return [...usernameConstraintNames].find((name) => message.includes(name));
}

function getConstraintFromErrorCause(error: unknown): string | undefined {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (isRecord(current) && !visited.has(current)) {
    visited.add(current);

    if (current.code === "23505" && typeof current.constraint === "string") {
      return current.constraint;
    }

    current = current.cause;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
