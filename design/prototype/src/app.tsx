import * as React from "react";

import {
  FloatingPillNav,
  type FloatingPillNavItem,
} from "./components/floating-pill-nav";
import { AdminPage } from "./screens/admin-page";
import { FeedPage } from "./screens/feed-page";
import { InboxPage } from "./screens/inbox-page";
import { NotificationsPage } from "./screens/notifications-page";
import { ProfilePage } from "./screens/profile-page";
import { SettingsPage } from "./screens/settings-page";

const navItems = [
  { value: "feed", label: "Feed" },
  { value: "inbox", label: "Inbox" },
  {
    value: "notifications",
    label: "Notifications",
    mobileLabel: "Alerts",
    hasIndicator: true,
  },
  { value: "profile", label: "Profile" },
  { value: "settings", label: "Settings" },
  {
    value: "admin",
    label: "Admin",
  },
] as const satisfies readonly FloatingPillNavItem[];

export function App() {
  const [activeValue, setActiveValue] = React.useState("feed");

  return (
    <main className="min-h-svh bg-background">
      {activeValue === "feed" ? (
        <FeedPage />
      ) : activeValue === "inbox" ? (
        <InboxPage />
      ) : activeValue === "notifications" ? (
        <NotificationsPage />
      ) : activeValue === "profile" ? (
        <ProfilePage />
      ) : activeValue === "settings" ? (
        <SettingsPage />
      ) : (
        <AdminPage />
      )}

      <FloatingPillNav
        activeValue={activeValue}
        items={navItems}
        onValueChange={setActiveValue}
      />
    </main>
  );
}
