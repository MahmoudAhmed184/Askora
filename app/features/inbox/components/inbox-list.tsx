import { Link } from "react-router";

import { EmptyState } from "~/components/app/empty-state";
import { Button } from "~/components/ui/button";
import {
  FilteredQuestionCard,
  QuestionCard,
} from "~/features/inbox/components/question-card";
import type {
  InboxFolder,
  InboxQuestionView,
} from "~/features/inbox/inbox.loader.server";

interface InboxListProps {
  disabled: boolean;
  folder: InboxFolder;
  questions: InboxQuestionView[];
}

export function InboxList({ disabled, folder, questions }: InboxListProps) {
  if (questions.length === 0) {
    return <InboxEmptyState folder={folder} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.map((question) =>
        folder === "filtered" ? (
          <FilteredQuestionCard
            disabled={disabled}
            key={question.publicId}
            question={question}
          />
        ) : (
          <QuestionCard
            disabled={disabled}
            key={question.publicId}
            question={question}
          />
        ),
      )}
    </div>
  );
}

function InboxEmptyState({ folder }: { folder: InboxFolder }) {
  if (folder === "filtered") {
    return (
      <EmptyState
        action={
          <Button asChild variant="outline">
            <Link to="/dashboard/inbox">Open inbox</Link>
          </Button>
        }
        description="Filtered questions from muted phrases and safety checks will appear here."
        title="No filtered questions"
      />
    );
  }

  return (
    <EmptyState
      action={
        <Button asChild variant="outline">
          <Link to="/dashboard/filtered">Open filtered</Link>
        </Button>
      }
      description="New private questions that need attention will appear here."
      title="No inbox questions"
    />
  );
}
