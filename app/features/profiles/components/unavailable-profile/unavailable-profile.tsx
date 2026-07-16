import { UnavailableState } from "~/components/shared/unavailable-state/unavailable-state";

interface UnavailableProfileProps {
  username: string;
}

export function UnavailableProfile({ username }: UnavailableProfileProps) {
  return (
    <UnavailableState
      description="The username may be reserved, deactivated, or no longer accepting a public profile page."
      meta={`@${username}`}
      title="This profile is unavailable"
    />
  );
}
