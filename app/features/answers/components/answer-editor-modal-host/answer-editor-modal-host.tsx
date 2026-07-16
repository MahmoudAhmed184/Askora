import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { UnavailableState } from "~/components/shared/unavailable-state/unavailable-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import { Button } from "~/components/ui/button/button";
import { AnswerEditor } from "~/features/answers/components/answer-editor";
import type { AnswerModalData } from "~/features/answers/services/answer-modal.service.server";
import {
  getAnswerModalFocusReturnId,
  getAnswerModalParams,
  removeAnswerModalSearchParams,
} from "~/features/answers/answer-modal";

interface AnswerEditorModalHostProps {
  modal: AnswerModalData | undefined;
}

export function AnswerEditorModalHost({ modal }: AnswerEditorModalHostProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const previousModalRef = useRef<AnswerModalData | undefined>(undefined);
  const scrollPositionRef = useRef(0);
  const closeTo = removeAnswerModalSearchParams(location);

  useEffect(() => {
    if (modal !== undefined && previousModalRef.current === undefined) {
      scrollPositionRef.current = window.scrollY;
    }

    if (modal === undefined && previousModalRef.current !== undefined) {
      const focusReturnId = getAnswerModalFocusReturnIdFromLocation(
        previousModalRef.current,
        location.search,
      );
      window.requestAnimationFrame(() => {
        restoreScrollPosition(scrollPositionRef.current);
        document.getElementById(focusReturnId)?.focus();
      });
      setIsDirty(false);
    }

    previousModalRef.current = modal;
  }, [location.search, modal]);

  function requestClose() {
    if (
      isDirty &&
      !window.confirm("Discard this answer? Unsaved changes will be lost.")
    ) {
      return;
    }

    void navigate(closeTo, {
      defaultShouldRevalidate: false,
      preventScrollReset: true,
      replace: true,
    });
  }

  return (
    <Dialog
      open={modal !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          requestClose();
        }
      }}
    >
      {modal === undefined ? null : (
        <DialogContent
          aria-describedby="answer-editor-modal-description"
          aria-labelledby="answer-editor-modal-title"
          className="max-h-[calc(100svh-2rem)] w-[calc(100%-1rem)] max-w-[53rem] overflow-hidden border-0 bg-transparent p-0 shadow-none sm:w-[calc(100%-3rem)]"
          closeLabel="Close answer editor"
          key={modal.questionPublicId}
          overlayClassName="bg-background/20 backdrop-blur-[2px]"
          showCloseButton
        >
          <DialogTitle className="sr-only" id="answer-editor-modal-title">
            Answer editor
          </DialogTitle>
          <DialogDescription
            className="sr-only"
            id="answer-editor-modal-description"
          >
            Edit and publish an answer without leaving the current page.
          </DialogDescription>
          {modal.status === "not_found" ? (
            <UnavailableState
              action={
                <Button asChild variant="outline">
                  <Link to={closeTo}>
                    <ArrowLeft data-icon="inline-start" />
                    Back to current page
                  </Link>
                </Button>
              }
              description="This question is not available for answering. It may have been removed or already handled."
              meta={modal.questionPublicId}
              title="Question not found"
            />
          ) : (
            <AnswerEditor
              action={modal.canonicalPath}
              disabled={modal.isSuspended}
              editor={modal.editor}
              onDirtyChange={setIsDirty}
            />
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

function getAnswerModalFocusReturnIdFromLocation(
  modal: AnswerModalData,
  search: string,
) {
  const params = getAnswerModalParams(new URLSearchParams(search));

  return params === undefined
    ? modal.focusReturnId
    : getAnswerModalFocusReturnId(params);
}

function restoreScrollPosition(scrollPosition: number) {
  try {
    window.scrollTo(0, scrollPosition);
  } catch {
    // jsdom does not implement scrolling; browsers do.
  }
}
