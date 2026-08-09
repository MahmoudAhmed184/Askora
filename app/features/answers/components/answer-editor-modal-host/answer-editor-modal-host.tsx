import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { UnavailableState } from "~/components/shared/unavailable-state/unavailable-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import { Button } from "~/components/ui/button/button";
import {
  AnswerEditor,
  type AnswerEditorHandle,
} from "~/features/answers/components/answer-editor";
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
  const editorRef = useRef<AnswerEditorHandle>(null);
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
    }

    previousModalRef.current = modal;
  }, [location.search, modal]);

  const finishClose = useCallback(() => {
    void navigate(closeTo, {
      defaultShouldRevalidate: false,
      preventScrollReset: true,
      replace: true,
    });
  }, [closeTo, navigate]);

  function requestClose() {
    if (editorRef.current?.saveDraftBeforeClose()) {
      return;
    }

    finishClose();
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
          className="max-h-[calc(100svh-2rem)] w-[calc(100%-1rem)] max-w-[44rem] overflow-hidden border-0 bg-transparent p-0 shadow-none sm:w-[calc(100%-3rem)]"
          key={modal.questionPublicId}
          overlayClassName="bg-background/20 backdrop-blur-[2px]"
        >
          <DialogTitle className="sr-only">Answer editor</DialogTitle>
          <DialogDescription className="sr-only">
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
              onDraftSavedBeforeClose={finishClose}
              ref={editorRef}
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
