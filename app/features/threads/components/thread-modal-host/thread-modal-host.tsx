import { useLocation, useNavigate } from "react-router";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import { PublicThreadModalContent } from "~/features/threads/components/public-thread";
import {
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
          className="top-0 block h-svh max-h-none w-full max-w-3xl translate-y-0 overflow-y-scroll overscroll-contain border-0 bg-transparent p-2 pb-[calc(6rem+env(safe-area-inset-bottom))] shadow-none sm:p-6 sm:pb-16"
          key={modal.canonicalPath}
          showCloseButton={false}
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
