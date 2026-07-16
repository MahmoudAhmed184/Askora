import {
  index,
  layout,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

export default [
  index("features/home/routes/home.route.tsx"),
  route("login", "features/auth/routes/login.route.tsx"),
  route("setup", "features/profile-setup/routes/setup.route.tsx"),
  route("setup/share", "features/profile-setup/routes/setup.share.route.tsx"),
  route(
    "setup/username-availability",
    "features/profile-setup/routes/username-availability.route.ts",
  ),
  layout("features/app-shell/routes/app-layout.route.tsx", [
    route("feed", "features/social/routes/feed.route.tsx"),
    route("inbox", "features/inbox/routes/inbox.route.tsx"),
    route("prompts", "features/prompts/routes/prompts.route.tsx"),
    route("drafts", "features/answers/routes/drafts.route.tsx"),
    route("notifications", "features/notifications/routes/notifications.route.tsx"),
    route("likes", "features/social/routes/like.action.route.ts"),
    route("follows", "features/social/routes/follow.action.route.ts"),
    route("answer/:questionId", "features/answers/routes/answer.route.tsx"),
    route(
      "answers/:threadItemPublicId/actions",
      "features/answers/routes/published-answer-actions.route.ts",
    ),
    route("filtered", "features/inbox/routes/filtered.route.tsx"),
    route("settings", "features/settings/routes/settings-layout.route.tsx", [
      route("profile", "features/settings/routes/profile.route.tsx"),
      route("privacy", "features/settings/routes/privacy.route.tsx"),
      route("safety", "features/settings/routes/safety.route.tsx"),
      route("appearance", "features/settings/routes/appearance.route.tsx"),
      route("account", "features/settings/routes/account.route.tsx"),
    ]),
  ]),
  route("admin", "features/admin/routes/admin.route.tsx"),
  route(
    "admin/reports/:reportId",
    "features/admin/routes/admin.reports.$reportId.route.tsx",
  ),
  route("terms", "features/legal/routes/terms.route.tsx"),
  route("privacy", "features/legal/routes/privacy.route.tsx"),
  route("api/avatar", "features/profiles/routes/avatar.route.ts"),
  route("api/auth/*", "features/auth/routes/auth.$.route.ts"),
  route(
    ":username/a/:threadPublicId/follow-ups",
    "features/threads/routes/follow-up.route.tsx",
  ),
  route(
    ":username/a/:threadPublicId",
    "features/threads/routes/public-thread.route.tsx",
  ),
  route(":username", "features/profiles/routes/public-profile.route.tsx"),
  route(
    ":username/questions",
    "features/profiles/routes/public-profile.questions.route.ts",
  ),
] satisfies RouteConfig;
