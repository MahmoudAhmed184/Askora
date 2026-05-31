import { Bell } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/components/ui/button";

interface NotificationBellProps {
  unreadCount: number;
}

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  const visibleCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Button asChild size="icon" variant="ghost">
      <Link
        aria-label={
          unreadCount > 0
            ? `${visibleCount} unread notifications`
            : "Notifications"
        }
        className="relative"
        to="/dashboard/notifications"
      >
        <Bell data-icon="inline-start" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-center text-[0.6875rem] font-semibold leading-5 text-primary-foreground">
            {visibleCount}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
