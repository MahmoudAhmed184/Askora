import type { AccountSettingsViewData } from "~/features/settings/types/settings.types";
import type { PrivacySettingsFormValues } from "~/features/settings/types/settings.types";
import type { ProfileSettingsViewData } from "~/features/settings/types/settings.types";
import type { SafetySettingsViewData } from "~/features/settings/types/settings.types";

export interface SettingsRouteContext {
  isSuspended: boolean;
  settings: {
    account: AccountSettingsViewData;
    privacy: PrivacySettingsFormValues;
    profile: ProfileSettingsViewData;
    safety: SafetySettingsViewData;
  };
}
