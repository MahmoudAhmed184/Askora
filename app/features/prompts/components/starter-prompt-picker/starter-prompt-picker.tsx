import { Sparkles } from "lucide-react";
import { Form } from "react-router";

import { Button } from "~/components/ui/button/button";
import type { StarterPromptCategory } from "~/features/prompts/starter-prompts";
import { cn } from "~/lib/utils";

interface StarterPromptPickerProps {
  categories: readonly StarterPromptCategory[];
  disabled: boolean;
}

export function StarterPromptPicker({
  categories,
  disabled,
}: StarterPromptPickerProps) {
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
            <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {category.prompts.map((prompt, index) => (
                <Form
                  className={cn(
                    "group flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3.5 text-card-foreground transition-[background-color,border-color,box-shadow,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-primary hover:bg-secondary/60 hover:shadow-[0_8px_20px_var(--accent-glow)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-h-36 sm:flex-col sm:items-start sm:gap-4",
                    index < 2 ? "sm:min-h-32" : "",
                  )}
                  data-testid={`starter-prompt-card-${prompt.id}`}
                  key={prompt.id}
                  method="post"
                >
                  <p className="line-clamp-3 min-w-0 text-sm font-semibold leading-6 text-foreground/85 transition-colors group-hover:text-primary sm:line-clamp-4">
                    {prompt.text}
                  </p>
                  <input name="promptId" type="hidden" value={prompt.id} />
                  <Button
                    aria-label={`Use starter prompt: ${prompt.text}`}
                    className="shrink-0 justify-center sm:w-full"
                    disabled={disabled}
                    size="sm"
                    type="submit"
                  >
                    <Sparkles data-icon="inline-start" />
                    Use prompt
                  </Button>
                </Form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
