import { EmptyState } from "~/components/app/empty-state";

export function PublicAnswerList() {
  return (
    <section aria-labelledby="published-answers-title" className="pt-2">
      <EmptyState
        description="Answered questions will appear here once this profile publishes them."
        title="No public answers yet"
      />
    </section>
  );
}
