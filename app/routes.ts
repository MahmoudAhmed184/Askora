import {
  index,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

export default [
  index("features/home/routes/home.route.tsx"),
  route("login", "features/auth/routes/login.route.tsx"),
  route("setup", "features/profile-setup/routes/setup.route.tsx"),
  route("setup/share", "features/profile-setup/routes/setup.share.route.tsx"),
  route("dashboard", "features/inbox/routes/dashboard.route.tsx"),
  route("dashboard/feed", "features/social/routes/feed.route.tsx"),
  route("dashboard/inbox", "features/inbox/routes/inbox.route.tsx"),
  route("dashboard/drafts", "features/answers/routes/drafts.route.tsx"),
  route("dashboard/notifications", "features/notifications/routes/notifications.route.tsx"),
  route("dashboard/likes", "features/social/routes/like.action.route.ts"),
  route("dashboard/follows", "features/social/routes/follow.action.route.ts"),
  route("dashboard/answer/:questionId", "features/answers/routes/answer.route.tsx"),
  route(
    "dashboard/answers/:threadItemPublicId/actions",
    "features/answers/routes/published-answer-actions.route.ts",
  ),
  route("dashboard/filtered", "features/inbox/routes/filtered.route.tsx"),
  route("dashboard/settings/profile", "features/settings/routes/profile.route.tsx"),
  route("dashboard/settings/privacy", "features/settings/routes/privacy.route.tsx"),
  route("dashboard/settings/safety", "features/settings/routes/safety.route.tsx"),
  route("admin", "features/admin/routes/admin.route.tsx"),
  route(
    "admin/reports/:reportId",
    "features/admin/routes/admin.reports.$reportId.route.tsx",
  ),
  route("terms", "features/legal/routes/terms.route.tsx"),
  route("privacy", "features/legal/routes/privacy.route.tsx"),
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
