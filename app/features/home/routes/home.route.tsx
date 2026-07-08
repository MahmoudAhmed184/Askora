import {
  ArrowRight,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
} from "react-router";

import {
  ActionToast,
  type ActionToastTone,
} from "~/components/shared/action-toast/action-toast";
import { PublicShell } from "~/components/layout/public-shell/public-shell";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field/field";
import { Input } from "~/components/ui/input/input";
import { getAuthProviderStatus } from "~/lib/config.server";
import { getCurrentSessionSummaryFromContext } from "~/features/auth/services/auth.service.server";
import { parseFormData } from "~/lib/zod-form";
import { submitWaitlistEntry } from "~/features/home/services/waitlist.service.server";
import { waitlistSubmissionSchema } from "~/features/home/validations/waitlist.validations";
import type { Route } from "./+types/home.route";

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

export function loader({ context }: Route.LoaderArgs) {
  const session = getCurrentSessionSummaryFromContext(context);

  if (session.status === "authenticated") {
    return redirect(
      session.profileStatus === "complete" ? "/feed" : "/setup",
    );
  }

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
  const waitlistToast = getWaitlistToast({
    databaseConfigured: loaderData.auth.databaseConfigured,
    result: actionData?.waitlist,
  });

  return (
    <PublicShell>
      <ActionToast
        message={waitlistToast?.message}
        tone={waitlistToast?.tone ?? "info"}
        trigger={waitlistToast?.trigger}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1fr)] lg:items-center">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Invite-only beta</Badge>
              <Badge variant="outline">Private questions first</Badge>
            </div>
            <div className="flex flex-col gap-4">
              <h1 className="max-w-3xl font-serif text-4xl font-extrabold leading-tight text-foreground sm:text-5xl lg:text-[3.7rem]">
                One public link for questions worth answering.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground">
                Receive questions privately, choose what becomes public, and
                turn the best answers into readable threads without opening a
                full social inbox.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="px-6">
                <Link to="/login">
                  Request or sign in
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild className="px-6" variant="outline">
                <Link to="/privacy">Read privacy stance</Link>
              </Button>
            </div>
            <FlowRail />
          </div>

          <LandingPreview />
        </section>

        <section className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
          <div className="px-1 py-3 sm:px-0 lg:py-8">
            <Badge variant="secondary">How it works</Badge>
            <h2 className="mt-4 max-w-2xl font-serif text-3xl font-extrabold leading-tight text-foreground">
              A profile, an inbox, and public threads only when you choose.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              Q&A Platform keeps the intake small: no public discovery feed, no
              anonymous identity reveal for visitors, and no published answer
              unless the profile owner decides it should exist.
            </p>
          </div>

          <WaitlistForm disabled={!loaderData.auth.databaseConfigured} />
        </section>
      </div>
    </PublicShell>
  );
}

function getWaitlistToast({
  databaseConfigured,
  result,
}: {
  databaseConfigured: boolean;
  result: WaitlistActionData["waitlist"] | undefined;
}):
  | {
      message: string;
      tone: ActionToastTone;
      trigger: unknown;
    }
  | undefined {
  if (result !== undefined) {
    return {
      message: result.message,
      tone: result.status === "submitted" ? "success" : "error",
      trigger: result,
    };
  }

  if (!databaseConfigured) {
    return {
      message: "Waitlist storage is disabled until the database is configured.",
      tone: "warning",
      trigger: "waitlist-disabled",
    };
  }

  return undefined;
}

function FlowRail() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card/70 p-2 shadow-[0_6px_20px_oklch(0.17_0.035_292_/_0.05)] sm:w-fit sm:flex-row sm:rounded-full">
      <FlowStep icon={<Sparkles data-icon="inline-start" />} label="Ask" />
      <FlowStep icon={<ShieldCheck data-icon="inline-start" />} label="Review" />
      <FlowStep icon={<MessageCircle data-icon="inline-start" />} label="Thread" />
    </div>
  );
}

function FlowStep({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-foreground">
      {icon}
      {label}
    </span>
  );
}

function LandingPreview() {
  return (
    <div className="flex flex-col gap-4">
      <section className="relative overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
        <div
          aria-hidden="true"
          className="relative z-0 h-32 bg-[linear-gradient(135deg,oklch(0.70_0.13_310),oklch(0.50_0.15_295))] sm:h-40"
        >
          <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(to_right,var(--primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--primary)_1px,transparent_1px)] [background-size:20px_20px]" />
        </div>
        <div className="absolute left-6 top-32 z-20 flex size-24 -translate-y-1/2 items-center justify-center rounded-full border-4 border-card bg-secondary font-serif text-3xl font-extrabold text-primary shadow-[0_8px_22px_oklch(0.17_0.035_292_/_0.16)] sm:left-7 sm:top-40">
          QA
        </div>
        <div className="relative z-10 p-6 pt-14 sm:p-7 sm:pt-16">
          <div className="min-w-0 pl-28 sm:pl-32">
            <h2 className="truncate font-serif text-3xl font-extrabold text-foreground">
              Maya Chen
            </h2>
            <p className="font-mono text-xs text-muted-foreground">
              @mayachen
            </p>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Notes on studying, quiet ambition, and internet life. Ask direct
            questions. I answer the useful ones.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">142 answers</Badge>
            <Badge variant="secondary">2.4k followers</Badge>
            <Badge variant="secondary">18k reactions</Badge>
          </div>
        </div>
      </section>

      <article className="rounded-3xl border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary">New question</Badge>
          <span className="font-mono text-[0.68rem] text-muted-foreground">
            private
          </span>
        </div>
        <p className="mt-4 font-serif text-xl font-bold italic leading-8 text-foreground">
          "What changed your mind recently?"
        </p>
        <div className="mt-5 border-t border-dashed pt-4">
          <Button className="w-full justify-center">
            <MessageCircle data-icon="inline-start" />
            Answer privately
          </Button>
        </div>
      </article>
    </div>
  );
}

function WaitlistForm({
  disabled,
}: {
  disabled: boolean;
}) {
  return (
    <Form
      aria-label="Request beta access"
      className="rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] sm:p-7"
      method="post"
    >
      <header className="mb-5 border-b pb-5">
        <h2 className="text-base font-bold text-foreground">Request access</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The form records interest. It does not imply instant access.
        </p>
      </header>
      <FieldGroup>
        <Field data-disabled={disabled ? true : undefined}>
          <FieldLabel htmlFor="waitlist-email">Email</FieldLabel>
          <div className="flex flex-col gap-3">
            <Input
              aria-describedby="waitlist-description"
              disabled={disabled}
              id="waitlist-email"
              inputMode="email"
              name="email"
              placeholder="you@example.com"
              type="email"
            />
            <PendingButton
              className="w-full"
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
        </Field>
      </FieldGroup>
    </Form>
  );
}
