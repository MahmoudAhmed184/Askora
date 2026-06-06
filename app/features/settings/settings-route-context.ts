import type { AccountSettingsViewData } from "~/features/settings/account-settings.server";
import type { PrivacySettingsFormValues } from "~/features/settings/privacy-settings.server";
import type { ProfileSettingsViewData } from "~/features/settings/profile-settings.server";
import type { SafetySettingsViewData } from "~/features/settings/safety-settings.server";

export interface SettingsRouteContext {
  isSuspended: boolean;
  settings: {
    account: AccountSettingsViewData;
    privacy: PrivacySettingsFormValues;
    profile: ProfileSettingsViewData;
    safety: SafetySettingsViewData;
  };
}
