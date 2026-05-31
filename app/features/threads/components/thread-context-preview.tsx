import type {
  CompactThreadContextPreview,
} from "~/features/threads/follow-up.server";

interface ThreadContextPreviewProps {
  context: CompactThreadContextPreview;
}

export function ThreadContextPreview({ context }: ThreadContextPreviewProps) {
  return (
    <section aria-labelledby="thread-context-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold" id="thread-context-title">
          Thread context
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {context.totalVisibleItems} published{" "}
          {context.totalVisibleItems === 1 ? "answer" : "answers"} in this
          thread.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {context.items.map((item) => (
          <article
            className="rounded-lg border bg-card p-4 text-card-foreground"
            key={item.publicId}
          >
            {item.questionText === undefined ? null : (
              <p className="mb-3 whitespace-pre-wrap break-words border-b pb-3 text-sm font-medium leading-6">
                {item.questionText}
              </p>
            )}
            <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
              {item.answerText}
            </p>
          </article>
        ))}
      </div>
      {context.omittedItemCount > 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {context.omittedItemCount} earlier{" "}
          {context.omittedItemCount === 1 ? "answer is" : "answers are"} hidden
          from this preview.
        </p>
      ) : null}
    </section>
  );
}
