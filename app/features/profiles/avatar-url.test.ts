import { describe, expect, it } from "vitest";

import {
  getAvatarImageSource,
  isAllowedProxiedAvatarUrl,
} from "~/features/profiles/avatar-url";

const googleAvatarUrl =
  "https://lh3.googleusercontent.com/a/ACg8ocIVrWHnyKsZGGZrxpIR8fiKduMaw3vKa-cNU7f6XOi4e1jFHcA=s96-c";

describe("avatar URL helpers", () => {
  it("rewrites Google account avatars to the same-origin proxy", () => {
    expect(getAvatarImageSource(googleAvatarUrl)).toBe(
      `/api/avatar?src=${encodeURIComponent(googleAvatarUrl)}`,
    );
  });

  it("leaves non-Google avatars unchanged", () => {
    const customAvatarUrl = "https://cdn.example.com/avatar.png";

    expect(getAvatarImageSource(customAvatarUrl)).toBe(customAvatarUrl);
  });

  it("allows only HTTPS Google account avatar URLs to be proxied", () => {
    expect(isAllowedProxiedAvatarUrl(googleAvatarUrl)).toBe(true);
    expect(isAllowedProxiedAvatarUrl("http://lh3.googleusercontent.com/a/id")).toBe(
      false,
    );
    expect(isAllowedProxiedAvatarUrl("https://lh3.googleusercontent.com/not-a/id")).toBe(
      false,
    );
    expect(isAllowedProxiedAvatarUrl("https://example.com/a/id")).toBe(false);
    expect(isAllowedProxiedAvatarUrl("not a url")).toBe(false);
  });
});
