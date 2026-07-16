import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import { PublicThreadModalContent } from "~/features/threads/components/public-thread";
import {
  getThreadModalFocusReturnId,
  getThreadModalParams,
  removeThreadModalSearchParams,
  type ThreadModalData,
} from "~/features/threads/thread-modal";

interface ThreadModalHostProps {
  modal: ThreadModalData | undefined;
}

export function ThreadModalHost({ modal }: ThreadModalHostProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const closeTo = removeThreadModalSearchParams(location);
  const previousModalRef = useRef<ThreadModalData | undefined>(undefined);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    if (modal !== undefined && previousModalRef.current === undefined) {
      scrollPositionRef.current = window.scrollY;
    }

    if (modal === undefined && previousModalRef.current !== undefined) {
      const focusReturnId = getThreadModalFocusReturnIdFromLocation(
        previousModalRef.current,
        location,
      );
      window.requestAnimationFrame(() => {
        try {
          window.scrollTo(0, scrollPositionRef.current);
        } catch {
          // jsdom does not implement scrolling; browsers do.
        }
        document.getElementById(focusReturnId)?.focus();
      });
    }

    previousModalRef.current = modal;
  }, [location, modal]);

  return (
    <Dialog
      open={modal !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          void navigate(closeTo, {
            defaultShouldRevalidate: false,
            preventScrollReset: true,
            replace: true,
          });
        }
      }}
    >
      {modal === undefined ? null : (
        <DialogContent
          aria-describedby="thread-modal-description"
          aria-labelledby="thread-modal-title"
          className="top-0 block h-svh max-h-none w-[calc(100%-1rem)] max-w-3xl translate-y-0 overflow-y-scroll overscroll-contain border-0 bg-transparent p-2 pb-[calc(6rem+env(safe-area-inset-bottom))] shadow-none sm:w-[calc(100%-3rem)] sm:p-6 sm:pb-16"
          key={modal.canonicalPath}
          overlayClassName="bg-background/20 backdrop-blur-[2px]"
        >
          <DialogTitle className="sr-only" id="thread-modal-title">
            Public thread
          </DialogTitle>
          <DialogDescription className="sr-only" id="thread-modal-description">
            Published answers and follow-up state for this public thread.
          </DialogDescription>
          <PublicThreadModalContent page={modal.page} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function getThreadModalFocusReturnIdFromLocation(
  modal: ThreadModalData,
  location: { search: string },
) {
  const params = getThreadModalParams(new URLSearchParams(location.search));

  if (params !== undefined) {
    return getThreadModalFocusReturnId(params);
  }

  const canonicalPath = modal.canonicalPath;
  const match = /^\/([^/]+)\/a\/([^/#?]+)/.exec(canonicalPath);

  return match === null
    ? ""
    : getThreadModalFocusReturnId({
        threadPublicId: decodeURIComponent(match[2] ?? ""),
        username: decodeURIComponent(match[1] ?? ""),
      });
}
