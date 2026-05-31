import {
  ArrowRight,
  CheckCircle2,
  EyeOff,
  Mail,
  Link2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { data, Form, Link, useActionData } from "react-router";

import { PublicShell } from "~/components/app/public-shell";
import { PendingButton } from "~/components/app/pending-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { getAuthProviderStatus } from "~/lib/config.server";
import { parseFormData } from "~/lib/zod-form";
import { submitWaitlistEntry } from "~/features/home/waitlist.server";
import { waitlistSubmissionSchema } from "~/features/home/waitlist.schema";
import type { Route } from "./+types/home.route";

const valueProps = [
  {
    icon: Link2,
    title: "One profile link",
    description: "A focused place to receive questions without public discovery.",
  },
  {
    icon: LockKeyhole,
    title: "Private by default",
    description: "Questions stay out of public view unless the recipient answers.",
  },
  {
    icon: ShieldCheck,
    title: "Safety-aware",
    description: "Anonymous to viewers, with platform-side controls planned.",
  },
];

interface WaitlistActionData {
  waitlist:
    | {
        status: "submitted";
        message: string;
      }
    | {
        status: "rate_limited";
        message: string;
        retryAfterSeconds: number;
      }
    | {
        status: "invalid" | "disabled";
        message: string;
      };
}

export function loader() {
  return {
    auth: getAuthProviderStatus(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const auth = getAuthProviderStatus();

  if (!auth.databaseConfigured) {
    return data<WaitlistActionData>(
      {
        waitlist: {
          status: "disabled",
          message: "Request access is unavailable until the database is configured.",
        },
      },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const parsed = parseFormData(waitlistSubmissionSchema, formData);

  if (!parsed.ok) {
    return data<WaitlistActionData>(
      {
        waitlist: {
          status: "invalid",
          message: "Enter a valid email address.",
        },
      },
      { status: 400 },
    );
  }

  const waitlist = await submitWaitlistEntry({
    email: parsed.value.email,
    request,
  });

  return data<WaitlistActionData>(
    { waitlist },
    { status: waitlist.status === "rate_limited" ? 429 : 200 },
  );
}

export function meta() {
  return [{ title: "qna-platform" }];
}

export default function HomeRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <PublicShell>
      <div className="flex flex-col gap-12">
        <section className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.68fr)] lg:items-center">
          <div className="flex max-w-3xl flex-col gap-7">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Invite-only beta</Badge>
              <Badge variant="outline">No public discovery</Badge>
            </div>
            <div className="flex flex-col gap-5">
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.04] text-foreground sm:text-6xl">
                Receive questions privately. Publish only what you answer.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                A focused Q&A profile for creators and friend groups: share one
                link, keep incoming questions private, and answer with intent.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/login">
                  Log in or create profile
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/privacy">Read privacy stance</Link>
              </Button>
            </div>
            <WaitlistForm
              disabled={!loaderData.auth.databaseConfigured}
              result={actionData?.waitlist}
            />
          </div>

          <ProductPreview />
        </section>

        <section
          aria-label="Product principles"
          className="grid border-y sm:grid-cols-3"
        >
          {valueProps.map(({ description, icon: Icon, title }) => (
            <div
              className="flex gap-4 border-b py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"
              key={title}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </PublicShell>
  );
}

function WaitlistForm({
  disabled,
  result,
}: {
  disabled: boolean;
  result: WaitlistActionData["waitlist"] | undefined;
}) {
  return (
    <Form
      aria-label="Request beta access"
      className="max-w-xl border-y py-5"
      method="post"
    >
      <FieldGroup>
        <Field data-disabled={disabled ? true : undefined}>
          <FieldLabel htmlFor="waitlist-email">Request access</FieldLabel>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-describedby="waitlist-description waitlist-message"
              disabled={disabled}
              id="waitlist-email"
              inputMode="email"
              name="email"
              placeholder="you@example.com"
              type="email"
            />
            <PendingButton
              className="sm:w-40"
              disabled={disabled}
              pendingText="Requesting"
              type="submit"
            >
              <Mail data-icon="inline-start" />
              Join waitlist
            </PendingButton>
          </div>
          <FieldDescription id="waitlist-description">
            Invites are reviewed in batches. Joining the waitlist does not
            create an account or grant instant access.
          </FieldDescription>
          <WaitlistMessage disabled={disabled} result={result} />
        </Field>
      </FieldGroup>
    </Form>
  );
}

function WaitlistMessage({
  disabled,
  result,
}: {
  disabled: boolean;
  result: WaitlistActionData["waitlist"] | undefined;
}) {
  if (disabled) {
    return (
      <p className="text-sm leading-6 text-muted-foreground" id="waitlist-message">
        Waitlist storage is disabled until the database is configured.
      </p>
    );
  }

  if (result === undefined) {
    return <span id="waitlist-message" />;
  }

  return (
    <p
      className={
        result.status === "submitted"
          ? "text-sm leading-6 text-foreground"
          : "text-sm leading-6 text-destructive"
      }
      id="waitlist-message"
      role="status"
    >
      {result.message}
    </p>
  );
}

function ProductPreview() {
  return (
    <aside aria-label="Q&A profile preview" className="lg:pl-6">
      <Card className="overflow-hidden border-primary/10 bg-card shadow-sm">
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Public profile
              </p>
              <h2 className="text-2xl font-semibold leading-tight">
                One link, private inbox
              </h2>
            </div>
            <Badge variant="secondary">Beta</Badge>
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-full border bg-background px-3 py-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Link2 aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Shareable profile
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                /yourname
              </p>
            </div>
          </div>
          <div className="mt-5 divide-y">
            <PreviewRow
              icon={<MessageCircle aria-hidden="true" className="size-5" />}
              label="Incoming questions"
              value="Private until answered"
            />
            <PreviewRow
              icon={<EyeOff aria-hidden="true" className="size-5" />}
              label="Public feed"
              value="Only chosen answers"
            />
            <PreviewRow
              icon={<CheckCircle2 aria-hidden="true" className="size-5" />}
              label="Beta access"
              value="Invite controlled"
            />
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-foreground">
              Built for intentional replies.
            </span>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Safety first
            </span>
          </div>
        </div>
      </Card>
    </aside>
  );
}

function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-4">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}
