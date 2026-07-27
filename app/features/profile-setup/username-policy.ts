export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

const RESERVED_USERNAMES = [
  "login",
  "admin",
  "setup",
  "api",
  "settings",
  "reports",
  "logout",
  "terms",
  "privacy",
  "feed",
  "inbox",
  "notifications",
  "drafts",
  "filtered",
  "likes",
  "follows",
  "answer",
  "answers",
] as const;

const reservedUsernameSet = new Set<string>(RESERVED_USERNAMES);
const usernameCharactersPattern = /^[a-z0-9_]+$/;

export function getUsernamePolicyIssue(username: string) {
  if (username.length < 3 || username.length > 30) {
    return "Use 3 to 30 characters.";
  }

  if (username !== username.toLowerCase()) {
    return "Use lowercase letters only.";
  }

  if (!usernameCharactersPattern.test(username)) {
    return "Use only lowercase letters, numbers, and underscores.";
  }

  if (reservedUsernameSet.has(username)) {
    return "This username is reserved.";
  }

  return undefined;
}

export function isAllowedUsername(username: string) {
  return (
    USERNAME_PATTERN.test(username) &&
    getUsernamePolicyIssue(username) === undefined
  );
}
