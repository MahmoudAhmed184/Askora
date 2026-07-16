import { ArrowLeft, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  data,
  Link,
  redirect,
  useActionData,
  useNavigate,
} from "react-router";

import { Button } from "~/components/ui/button/button";
import { UnavailableState } from "~/components/shared/unavailable-state/unavailable-state";
import { AnswerEditor } from "~/features/answers/components/answer-editor";
import {
  handleAnswerSubmission,
  loadAnswerEditor,
  type AnswerActionResult,
} from "~/features/answers/services/answer.service.server";
import {
  isSessionSuspended,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/services/auth.service.server";

import type { Route } from "./+types/answer.route";

interface AnswerRouteActionData {
  answer: AnswerActionResult;
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const result = await loadAnswerEditor({
    questionPublicId: params.questionId,
    session,
  });

  if (result.status === "not_found") {
    return data(
      {
        status: "not_found" as const,
      },
      { status: 404 },
    );
  }

  return {
    closeHref: getAnswerEditorCloseHref(request),
    status: "found" as const,
    editor: result.editor,
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const result = await handleAnswerSubmission({
    formData: await request.formData(),
    questionPublicId: params.questionId,
    session,
  });

  if (result.status === "published") {
    return redirect(result.redirectTo);
  }

  return data<AnswerRouteActionData>(
    { answer: result },
    { status: getAnswerActionResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Answer | qna-platform" }];
}

export default function AnswerRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);

  if (loaderData.status === "not_found") {
    return (
      <UnavailableState
        action={
          <Button asChild variant="outline">
            <Link to="/inbox">
              <ArrowLeft data-icon="inline-start" />
              Back to inbox
            </Link>
          </Button>
        }
        description="This question is not available for answering. It may have been removed or already handled."
        title="Question not found"
      />
    );
  }

  const { closeHref, editor: editorData, isSuspended } = loaderData;

  function canClose() {
    return (
      !isDirty ||
      window.confirm("Discard this answer? Unsaved changes will be lost.")
    );
  }

  function requestClose() {
    if (canClose()) {
      void navigate(closeHref);
    }
  }

  const editor = (
    <div className="relative flex min-h-0 w-full max-w-[53rem]">
      <Button
        asChild
        className="absolute right-3 top-3 z-10"
        size="icon"
        variant="ghost"
      >
        <Link
          aria-label="Dismiss answer editor"
          onClick={(event) => {
            if (!canClose()) {
              event.preventDefault();
            }
          }}
          to={closeHref}
        >
          <X aria-hidden="true" />
        </Link>
      </Button>
      <AnswerEditor
        actionResult={actionData?.answer}
        disabled={isSuspended}
        editor={editorData}
        key={editorData.question.publicId}
        onDirtyChange={setIsDirty}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pb-28 sm:pt-10">
      <Link
        aria-label="Dismiss answer editor"
        className="absolute inset-0 bg-background/92"
        onClick={(event) => {
          if (!canClose()) {
            event.preventDefault();
          }
        }}
        to={closeHref}
      />
      <AnswerRouteDialog onRequestClose={requestClose}>
        {editor}
      </AnswerRouteDialog>
    </div>
  );
}

function AnswerRouteDialog({
  children,
  onRequestClose,
}: {
  children: ReactNode;
  onRequestClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog === null) {
      return;
    }

    if (typeof dialog.showModal === "function") {
      if (dialog.open) {
        dialog.close();
      }

      dialog.showModal();
      dialog.setAttribute("aria-modal", "true");

      return () => {
        if (dialog.open) {
          dialog.close();
        }
      };
    }

    const restoreBackground = makeDialogBackgroundInert(dialog);
    dialog.setAttribute("aria-modal", "true");
    focusFirstDialogControl(dialog);

    return () => {
      restoreBackground();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onRequestClose();
      return;
    }

    if (
      event.key === "Tab" &&
      typeof dialogRef.current?.showModal !== "function"
    ) {
      trapDialogTabKey(event);
    }
  }

  return (
    <dialog
      aria-labelledby="answer-editor-title"
      className="fixed inset-0 z-10 m-auto max-h-[calc(100svh_-_9rem_-_env(safe-area-inset-bottom))] w-full max-w-[53rem] overflow-hidden border-0 bg-transparent p-0 backdrop:bg-background/88 open:flex sm:max-h-[calc(100svh_-_9rem)]"
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onKeyDown={handleKeyDown}
      open
      ref={dialogRef}
    >
      {children}
    </dialog>
  );
}

function makeDialogBackgroundInert(dialog: HTMLDialogElement) {
  const changedElements: {
    element: HTMLElement;
    wasInert: boolean;
  }[] = [];
  let current: HTMLElement = dialog;

  while (
    current.parentElement !== null &&
    current.parentElement !== document.body
  ) {
    for (const sibling of current.parentElement.children) {
      if (sibling instanceof HTMLElement && sibling !== current) {
        changedElements.push({ element: sibling, wasInert: sibling.inert });
        sibling.inert = true;
      }
    }

    current = current.parentElement;
  }

  return () => {
    for (const { element, wasInert } of changedElements) {
      element.inert = wasInert;
    }
  };
}

function focusFirstDialogControl(dialog: HTMLDialogElement) {
  dialog
    .querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
    )
    ?.focus();
}

function trapDialogTabKey(event: KeyboardEvent<HTMLDialogElement>) {
  const controls = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
    ),
  );
  const first = controls[0];
  const last = controls.at(-1);

  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function getAnswerEditorCloseHref(request: Request) {
  const returnTo = new URL(request.url).searchParams.get("returnTo");

  if (
    returnTo === null ||
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//")
  ) {
    return "/inbox";
  }

  return returnTo;
}

function getAnswerActionResponseStatus(result: AnswerActionResult) {
  switch (result.status) {
    case "draft_saved":
      return 200;
    case "published":
      return 303;
    case "invalid":
      return 400;
    case "denied":
      if (result.reason === "not_found") {
        return 404;
      }

      if (result.reason === "closed") {
        return 409;
      }

      if (result.reason === "thread_full") {
        return 409;
      }

      return 403;
  }
}
