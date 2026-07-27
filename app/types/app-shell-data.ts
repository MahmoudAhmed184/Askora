export interface AppShellData {
  session: {
    profile: {
      username: string;
      displayName: string;
    };
  };
  profileHref: string;
  unreadNotificationCount: number;
}

export interface UnreadNotificationCountData {
  profileHref: string;
  unreadNotificationCount: number;
}
