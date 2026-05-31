import { FileText, PencilLine } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "~/components/app/empty-state";
import { Button } from "~/components/ui/button";
import type { DraftAnswerView } from "~/features/answers/answer.server";

interface DraftsListProps {
  drafts: DraftAnswerView[];
}

export function DraftsList({ drafts }: DraftsListProps) {
  if (drafts.length === 0) {
    return (
      <EmptyState
        action={
          <Button asChild variant="outline">
            <Link to="/dashboard/inbox">Open inbox</Link>
          </Button>
        }
        description="Saved answer drafts will appear here."
        title="No drafts"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {drafts.map((draft) => (
        <article
          className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
          key={draft.questionPublicId}
        >
          <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText aria-hidden="true" className="size-4 shrink-0" />
                <time dateTime={draft.updatedAt}>
                  Updated {formatDate(draft.updatedAt)}
                </time>
              </div>
              <p className="break-words text-base font-medium leading-7">
                {draft.questionText}
              </p>
            </div>
            <Button asChild className="shrink-0" size="sm" variant="outline">
              <Link to={`/dashboard/answer/${draft.questionPublicId}`}>
                <PencilLine data-icon="inline-start" />
                Continue
              </Link>
            </Button>
          </header>

          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
            {draft.answerPreview}
          </p>
        </article>
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
