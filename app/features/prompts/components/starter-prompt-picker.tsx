import { Sparkles } from "lucide-react";
import { Form } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { StarterPromptCategory } from "~/features/prompts/starter-prompts";

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
      <nav aria-label="Starter prompt categories" className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button asChild key={category.id} size="sm" variant="outline">
            <a
              data-testid={`starter-prompt-category-${category.id}`}
              href={`#starter-prompts-${category.id}`}
            >
              {category.label}
            </a>
          </Button>
        ))}
      </nav>

      <div className="flex flex-col gap-8">
        {categories.map((category) => (
          <section
            aria-labelledby={`starter-prompts-${category.id}-heading`}
            className="flex scroll-mt-5 flex-col gap-3"
            id={`starter-prompts-${category.id}`}
            key={category.id}
          >
            <h2
              className="text-lg font-semibold"
              id={`starter-prompts-${category.id}-heading`}
            >
              {category.label}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {category.prompts.map((prompt) => (
                <Card
                  data-testid={`starter-prompt-card-${prompt.id}`}
                  key={prompt.id}
                >
                  <CardHeader>
                    <CardTitle className="text-base leading-6">
                      {prompt.text}
                    </CardTitle>
                  </CardHeader>
                  <CardFooter>
                    <Form method="post">
                      <input name="promptId" type="hidden" value={prompt.id} />
                      <Button
                        aria-label={`Use starter prompt: ${prompt.text}`}
                        disabled={disabled}
                        size="sm"
                        type="submit"
                      >
                        <Sparkles data-icon="inline-start" />
                        Use prompt
                      </Button>
                    </Form>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
