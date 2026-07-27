import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import { Button } from "~/components/ui/button/button";
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
          className="max-h-[calc(100svh-2rem)] w-[calc(100vw-1.5rem)] max-w-2xl gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none sm:w-[calc(100vw-4rem)]"
          key={modal.canonicalPath}
          overlayClassName="bg-background/70 backdrop-blur-[2px]"
        >
          <DialogTitle className="sr-only">Public thread</DialogTitle>
          <DialogDescription className="sr-only">
            Published answers and follow-up state for this public thread.
          </DialogDescription>
          <DialogClose asChild>
            <Button
              aria-label="Close thread"
              className="absolute right-3 top-3 z-10 size-11 rounded-full bg-card/95 shadow-sm backdrop-blur-sm sm:right-4 sm:top-4"
              size="icon"
              type="button"
              variant="outline"
            >
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
          <div className="max-h-[calc(100svh-2rem)] overflow-y-auto overscroll-contain rounded-3xl">
            <PublicThreadModalContent modal={modal} />
          </div>
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
