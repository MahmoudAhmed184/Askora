import { EmptyState } from "~/components/app/empty-state";
import type { PublicPublishedAnswer } from "~/features/answers/answer.server";

interface PublicAnswerListProps {
  answers: PublicPublishedAnswer[];
}

export function PublicAnswerList({ answers }: PublicAnswerListProps) {
  if (answers.length === 0) {
    return (
      <section
        aria-labelledby="published-answers-title"
        className="pt-2"
        id="published-answers"
      >
        <h2 className="sr-only" id="published-answers-title">
          Published answers
        </h2>
        <EmptyState
          description="Answered questions will appear here once this profile publishes them."
          title="No public answers yet"
        />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="published-answers-title"
      className="flex flex-col gap-3 pt-2"
      id="published-answers"
    >
      <h2 className="text-lg font-semibold" id="published-answers-title">
        Published answers
      </h2>
      <div className="flex flex-col gap-3">
        {answers.map((answer) => (
          <article
            className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
            key={answer.publicId}
          >
            {answer.questionTextMode === "hidden" ||
            answer.questionText === null ? undefined : (
              <div className="flex flex-col gap-2 border-b pb-4">
                <p className="whitespace-pre-wrap break-words text-base font-medium leading-7">
                  {answer.questionText}
                </p>
                {answer.asker === undefined ? undefined : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Asked by{" "}
                    <span className="font-medium text-foreground">
                      {answer.asker.displayName}
                    </span>{" "}
                    @{answer.asker.username}
                  </p>
                )}
              </div>
            )}

            <p className="whitespace-pre-wrap break-words text-base leading-7">
              {answer.answerText}
            </p>

            <time
              className="text-sm leading-6 text-muted-foreground"
              dateTime={answer.publishedAt}
            >
              {formatDate(answer.publishedAt)}
            </time>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
