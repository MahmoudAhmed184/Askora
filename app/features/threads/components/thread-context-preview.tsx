import type {
  CompactThreadContextPreview,
} from "~/features/threads/follow-up.server";

interface ThreadContextPreviewProps {
  context: CompactThreadContextPreview;
}

export function ThreadContextPreview({ context }: ThreadContextPreviewProps) {
  return (
    <section
      aria-labelledby="thread-context-title"
      className="flex flex-col gap-5 rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]"
    >
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
      <div className="border-y border-dashed py-4">
        {context.items.map((item, index) => (
          <article className="mb-4 last:mb-0" key={item.publicId}>
            {item.questionText === undefined ? null : (
              <ThreadContextEvent
                body={item.questionText}
                kind={index === 0 ? "Question" : "Follow-up"}
              />
            )}
            <ThreadContextEvent body={item.answerText} kind="Answer" />
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

function ThreadContextEvent({ body, kind }: { body: string; kind: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 font-mono text-[0.68rem] font-bold text-primary">
        {kind}
      </div>
      <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">
        {body}
      </p>
    </div>
  );
}
