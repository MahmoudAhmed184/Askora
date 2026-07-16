import { AppearanceSettingsForm } from "~/features/settings/components/appearance-settings-form";

export function meta() {
  return [{ title: "Appearance settings | qna-platform" }];
}

export default function AppearanceSettingsRoute() {
  return <AppearanceSettingsForm />;
}
