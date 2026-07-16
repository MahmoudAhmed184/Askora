import { data } from "react-router";

import type { Route } from "./+types/username-availability.route";
import { getCurrentSessionSummaryFromContext } from "~/features/auth/services/auth.service.server";
import {
  checkUsernameAvailability,
  type UsernameAvailability,
} from "~/features/profile-setup/services/profile-setup.service.server";

export interface UsernameAvailabilityData {
  availability: UsernameAvailability;
  username: string;
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = getCurrentSessionSummaryFromContext(context);
  const username = new URL(request.url).searchParams.get("username") ?? "";

  if (session.status !== "authenticated") {
    return data<UsernameAvailabilityData>(
      { availability: "invalid", username },
      { status: 401 },
    );
  }

  return data<UsernameAvailabilityData>({
    availability: await checkUsernameAvailability(username),
    username,
  });
}
