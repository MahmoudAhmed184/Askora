import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";

import { serverEnv } from "~/lib/env.server";

export function createClient(request: Request) {
  const supabaseUrl = serverEnv.VITE_SUPABASE_URL;
  const publishableKey = serverEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (supabaseUrl === undefined || publishableKey === undefined) {
    throw new Error("Supabase URL and publishable key are not configured");
  }

  const headers = new Headers();
  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          headers.append(
            "Set-Cookie",
            serializeCookieHeader(name, value, options),
          );
        }
      },
    },
  });

  return { headers, supabase };
}
