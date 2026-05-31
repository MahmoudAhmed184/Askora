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
  route("dashboard/inbox", "features/inbox/routes/inbox.route.tsx"),
  route("dashboard/filtered", "features/inbox/routes/filtered.route.tsx"),
  route("dashboard/settings/profile", "features/settings/routes/profile.route.tsx"),
  route("dashboard/settings/privacy", "features/settings/routes/privacy.route.tsx"),
  route("terms", "features/legal/routes/terms.route.tsx"),
  route("privacy", "features/legal/routes/privacy.route.tsx"),
  route("api/auth/*", "features/auth/routes/auth.$.route.ts"),
  route(":username", "features/profiles/routes/public-profile.route.tsx"),
  route(
    ":username/questions",
    "features/profiles/routes/public-profile.questions.route.ts",
  ),
] satisfies RouteConfig;
