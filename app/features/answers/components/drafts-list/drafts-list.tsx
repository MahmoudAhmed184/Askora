import { FileText, PencilLine } from "lucide-react";
import { Link, useLocation } from "react-router";

import { EmptyState } from "~/components/shared/empty-state/empty-state";
import { Button } from "~/components/ui/button/button";
import type { DraftAnswerView } from "~/features/answers/types/answers.types";
import { formatMediumDateTime } from "~/lib/date-format";

interface DraftsListProps {
  drafts: DraftAnswerView[];
}

export function DraftsList({ drafts }: DraftsListProps) {
  const location = useLocation();

  if (drafts.length === 0) {
    return (
      <EmptyState
        action={
          <Button asChild variant="outline">
            <Link to="/inbox">Open inbox</Link>
          </Button>
        }
        description="Saved answer drafts will appear here."
        icon={<FileText aria-hidden="true" />}
        title="No drafts"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {drafts.map((draft) => (
        <article
          className="flex flex-col gap-4 rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] transition-[border-color] duration-[250ms] ease-[ease] hover:border-border-strong"
          key={draft.questionPublicId}
        >
          <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <FileText aria-hidden="true" className="size-4 shrink-0" />
                <time dateTime={draft.updatedAt}>
                  Updated {formatDate(draft.updatedAt)}
                </time>
              </div>
              <p className="break-words font-serif text-xl font-bold italic leading-8 text-foreground">
                {draft.questionText}
              </p>
            </div>
            <Button asChild className="shrink-0" size="sm" variant="outline">
              <Link
                to={createAnswerHref({
                  location,
                  questionPublicId: draft.questionPublicId,
                })}
              >
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
  return formatMediumDateTime(value);
}

function createAnswerHref({
  location,
  questionPublicId,
}: {
  location: {
    hash: string;
    pathname: string;
    search: string;
  };
  questionPublicId: string;
}) {
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const params = new URLSearchParams({ returnTo });

  return `/answer/${questionPublicId}?${params.toString()}`;
}
