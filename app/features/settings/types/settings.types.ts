import type { AccountSettingsViewData } from "~/features/settings/services/account-settings.service.server";
import type { PrivacySettingsFormValues } from "~/features/settings/services/privacy-settings.service.server";
import type { ProfileSettingsViewData } from "~/features/settings/services/profile-settings.service.server";
import type { SafetySettingsViewData } from "~/features/settings/services/safety-settings.service.server";
import type { QuestionGenerationSettingsViewData } from "~/features/question-generation/question-generation-settings.service.server";

export type * from "~/features/settings/services/account-settings.service.server";
export type * from "~/features/settings/services/privacy-settings.service.server";
export type * from "~/features/settings/services/profile-settings.service.server";
export type * from "~/features/settings/services/safety-settings.service.server";
export type * from "~/features/question-generation/question-generation-settings.service.server";

export interface SettingsRouteContext {
  isSuspended: boolean;
  settings: {
    account: AccountSettingsViewData;
    privacy: PrivacySettingsFormValues;
    profile: ProfileSettingsViewData;
    safety: SafetySettingsViewData;
    questionGeneration: QuestionGenerationSettingsViewData;
  };
}
