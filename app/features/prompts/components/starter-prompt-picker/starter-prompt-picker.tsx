import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Form, useFetcher, useLocation, useNavigate } from "react-router";

import { PendingButton } from "~/components/shared/pending-button/pending-button";
import { Button } from "~/components/ui/button/button";
import type { StarterPromptCategory } from "~/features/prompts/starter-prompts";
import type { StarterPromptActionResult } from "~/features/prompts/services/starter-prompts.service.server";
import {
  createAnswerModalLink,
  getAnswerModalFocusReturnId,
} from "~/features/answers/answer-modal";
import { cn } from "~/lib/utils";

interface StarterPromptPickerProps {
  categories: readonly StarterPromptCategory[];
  disabled: boolean;
}

export function StarterPromptPicker({
  categories,
  disabled,
}: StarterPromptPickerProps) {
  const fetcher = useFetcher<{ starterPrompt: StarterPromptActionResult }>();
  const location = useLocation();
  const navigate = useNavigate();
  const navigatedQuestionRef = useRef<string | undefined>(undefined);
  const [activePromptId, setActivePromptId] = useState<string | undefined>();

  useEffect(() => {
    const result = fetcher.data?.starterPrompt;

    if (
      result?.status !== "created" ||
      navigatedQuestionRef.current === result.questionPublicId
    ) {
      return;
    }

    navigatedQuestionRef.current = result.questionPublicId;
    const answerLink = createAnswerModalLink({
      location,
      questionPublicId: result.questionPublicId,
    });

    void navigate(answerLink.to, {
      defaultShouldRevalidate: false,
      mask: answerLink.mask,
      preventScrollReset: true,
    });
  }, [fetcher.data, location, navigate]);

  const isSubmitting = fetcher.state !== "idle";

  return (
    <section
      aria-label="Starter prompt picker"
      className="flex flex-col gap-6"
      data-testid="starter-prompt-picker"
    >
      <nav
        aria-label="Starter prompt categories"
        className="flex flex-wrap gap-2 rounded-3xl border bg-card/92 p-2 text-card-foreground shadow-[var(--shadow-card)]"
      >
        {categories.map((category) => (
          <Button asChild key={category.id} size="sm" variant="secondary">
            <a
              data-testid={`starter-prompt-category-${category.id}`}
              href={`#starter-prompts-${category.id}`}
            >
              {category.label}
            </a>
          </Button>
        ))}
      </nav>

      <div className="flex flex-col gap-6">
        {categories.map((category) => (
          <section
            aria-labelledby={`starter-prompts-${category.id}-heading`}
            className="scroll-mt-5 overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]"
            id={`starter-prompts-${category.id}`}
            key={category.id}
          >
            <header className="flex items-center justify-between gap-4 border-b bg-secondary px-5 py-4">
              <h2
                className="font-serif text-xl font-extrabold leading-tight text-foreground"
                id={`starter-prompts-${category.id}-heading`}
              >
                {category.label}
              </h2>
              <span className="rounded-full border bg-card px-2.5 py-1 font-mono text-[0.68rem] font-bold text-muted-foreground">
                {category.prompts.length} prompts
              </span>
            </header>
            <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
              {category.prompts.map((prompt, index) => (
                <Form
                  className={cn(
                    "flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3.5 text-card-foreground sm:min-h-36 sm:flex-col sm:items-start sm:gap-4",
                    index < 2 ? "sm:min-h-32" : "",
                  )}
                  data-testid={`starter-prompt-card-${prompt.id}`}
                  key={prompt.id}
                  method="post"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    formData.set("submissionMode", "contextual");
                    const promptId = formData.get("promptId");
                    setActivePromptId(
                      typeof promptId === "string" ? promptId : undefined,
                    );
                    void fetcher.submit(formData, {
                      action: "/prompts",
                      method: "post",
                    });
                  }}
                >
                  <p className="line-clamp-3 min-w-0 text-sm font-semibold leading-6 text-foreground/85 sm:line-clamp-4">
                    {prompt.text}
                  </p>
                  <input name="promptId" type="hidden" value={prompt.id} />
                  <PendingButton
                    aria-label={`Use starter prompt: ${prompt.text}`}
                    className="shrink-0 justify-center sm:w-full"
                    disabled={disabled || isSubmitting}
                    id={
                      activePromptId === prompt.id &&
                      fetcher.data?.starterPrompt.status === "created"
                        ? getAnswerModalFocusReturnId({
                            questionId: fetcher.data.starterPrompt.questionPublicId,
                          })
                        : undefined
                    }
                    pending={isSubmitting}
                    pendingName="promptId"
                    pendingText="Creating…"
                    pendingValue={prompt.id}
                    size="sm"
                    type="submit"
                  >
                    <Sparkles data-icon="inline-start" />
                    Use prompt
                  </PendingButton>
                </Form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
