import {
  ArrowRight,
  CheckCircle2,
  EyeOff,
  Flag,
  Heart,
  Inbox,
  Link2,
  MessageCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { data, Form, Link, redirect, useActionData } from "react-router";

import { PublicShell } from "~/components/layout/public-shell/public-shell";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert/alert";
import {
  Avatar,
  AvatarFallback,
} from "~/components/ui/avatar/avatar";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card/card";
import { Field, FieldError, FieldLabel } from "~/components/ui/field/field";
import { Input } from "~/components/ui/input/input";
import { Separator } from "~/components/ui/separator/separator";
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
  return [{ title: "Askora" }];
}

export default function HomeRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 sm:gap-24">
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)] lg:items-center">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Invite-only beta</Badge>
            </div>
            <div className="flex flex-col gap-4">
              <h1 className="max-w-2xl font-serif text-4xl font-extrabold leading-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
                One link for people to ask you anything.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Share your profile link anywhere. Questions arrive in a private
                inbox, and only the answers you publish become public threads.
              </p>
            </div>
            <WaitlistForm
              disabled={!loaderData.auth.databaseConfigured}
              result={actionData?.waitlist}
            />
          </div>

          <HeroDemo />
        </section>

        <HowItWorks />

        <TrustPoints />

        <ClosingCallToAction />
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
  const submitted = result?.status === "submitted";
  const errorMessage =
    result !== undefined && result.status !== "submitted"
      ? result.message
      : undefined;

  return (
    <Form
      aria-label="Request beta access"
      className="flex max-w-xl flex-col gap-3"
      id="request-access"
      method="post"
    >
      {submitted ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>You&apos;re on the list.</AlertTitle>
          <AlertDescription>
            Invites go out in batches — we&apos;ll email you when yours is
            ready.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Field data-disabled={disabled ? true : undefined}>
            <FieldLabel className="sr-only" htmlFor="waitlist-email">
              Email
            </FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-describedby="waitlist-note waitlist-error"
                aria-invalid={errorMessage !== undefined || undefined}
                autoComplete="email"
                className="h-11 sm:flex-1"
                disabled={disabled}
                id="waitlist-email"
                inputMode="email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
              <PendingButton
                className="h-11 px-6"
                disabled={disabled}
                pendingText="Requesting…"
                type="submit"
              >
                Request an invite
                <ArrowRight data-icon="inline-end" />
              </PendingButton>
            </div>
            <FieldError id="waitlist-error" message={errorMessage} />
          </Field>
          {disabled ? (
            <Alert variant="warning">
              <AlertDescription>
                Access requests are temporarily unavailable.
              </AlertDescription>
            </Alert>
          ) : null}
        </>
      )}
      <p className="text-sm leading-6 text-muted-foreground" id="waitlist-note">
        Invites are reviewed in batches — joining the waitlist doesn&apos;t
        create an account.{" "}
        <Link
          className="font-semibold text-primary underline-offset-4 hover:underline"
          to="/login"
        >
          Have an invite? Sign in
        </Link>
      </p>
    </Form>
  );
}

function HeroDemo() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      <div className="flex flex-col gap-3">
        <article className="rounded-3xl border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8">
                <AvatarFallback className="text-sm">?</AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold">Anonymous</span>
            </div>
            <Badge variant="outline">
              <EyeOff aria-hidden="true" className="mr-1 size-3" />
              Only you see this
            </Badge>
          </div>
          <p className="mt-3 font-serif text-lg font-bold italic leading-7">
            &ldquo;What changed your mind recently?&rdquo;
          </p>
        </article>

        <div className="flex items-center gap-3 px-4">
          <Separator className="flex-1" />
          <span className="font-mono text-[0.68rem] font-bold uppercase tracking-wide text-primary">
            You publish
          </span>
          <Separator className="flex-1" />
        </div>

        <article className="rounded-3xl border border-primary/25 bg-card p-5 text-card-foreground shadow-[var(--shadow-card-hover)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8">
                <AvatarFallback className="text-sm">M</AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Maya Chen</p>
                <p className="font-mono text-xs text-muted-foreground">
                  @mayachen
                </p>
              </div>
            </div>
            <Badge variant="secondary">Public thread</Badge>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            I used to think a bigger audience meant better questions. A
            smaller room, where people ask because they actually want the
            answer, changed that.
          </p>
          <div className="mt-4 flex items-center gap-4 border-t border-dashed pt-3 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Heart aria-hidden="true" className="size-3.5 text-primary" />
              128
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle aria-hidden="true" className="size-3.5" />
              4 follow-ups
            </span>
          </div>
        </article>
      </div>
    </div>
  );
}

const howItWorksSteps = [
  {
    title: "Share your link",
    description:
      "Put your profile link wherever people already follow you. Anyone can ask — no account needed.",
    icon: <Link2 aria-hidden="true" />,
  },
  {
    title: "Answer in private",
    description:
      "New questions land in an inbox only you can see. Skip, filter, or block anything you don't want.",
    icon: <Inbox aria-hidden="true" />,
  },
  {
    title: "Publish the best",
    description:
      "Turn an answer into a public thread when it's worth reading. Readers can like it and ask follow-ups.",
    icon: <MessageCircle aria-hidden="true" />,
  },
] as const;

function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="flex flex-col gap-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
        <h2
          className="font-serif text-3xl font-extrabold leading-tight text-foreground sm:text-4xl"
          id="how-it-works-heading"
        >
          Questions in private. Answers on your terms.
        </h2>
        <p className="text-base leading-7 text-muted-foreground">
          There is no discovery feed and no pressure to perform. Your profile
          grows from the answers you choose to share.
        </p>
      </div>
      <ol className="grid gap-4 sm:grid-cols-3">
        {howItWorksSteps.map((step, index) => (
          <li className="flex" key={step.title}>
            <Card className="flex w-full flex-col">
              <CardHeader>
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-4">
                    {step.icon}
                  </span>
                  <span className="font-mono text-xs font-bold text-muted-foreground">
                    Step {index + 1}
                  </span>
                </div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

const trustPoints = [
  {
    title: "You control what's public",
    description:
      "Nothing appears on your profile until you decide to publish it. Drafts and skipped questions stay private.",
    icon: <CheckCircle2 aria-hidden="true" />,
  },
  {
    title: "Anonymous, with accountability",
    description:
      "Askers are anonymous to you and to readers — never to the platform. Abuse is traceable and actionable.",
    icon: <EyeOff aria-hidden="true" />,
  },
  {
    title: "Safety tools built in",
    description:
      "Block senders, filter unwanted questions, and report abuse without leaving your inbox.",
    icon: <Flag aria-hidden="true" />,
  },
] as const;

function TrustPoints() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="rounded-3xl border bg-surface p-6 sm:p-10"
    >
      <h2
        className="font-serif text-2xl font-extrabold leading-tight text-foreground sm:text-3xl"
        id="trust-heading"
      >
        Built to feel safe to ask — and safe to answer.
      </h2>
      <div className="mt-8 grid gap-8 sm:grid-cols-3">
        {trustPoints.map((point) => (
          <TrustPoint key={point.title} {...point} />
        ))}
      </div>
    </section>
  );
}

function TrustPoint({
  description,
  icon,
  title,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-4">
        {icon}
      </span>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function ClosingCallToAction() {
  return (
    <section
      aria-labelledby="closing-cta-heading"
      className="flex flex-col items-center gap-5 py-4 text-center"
    >
      <h2
        className="max-w-xl font-serif text-3xl font-extrabold leading-tight text-foreground sm:text-4xl"
        id="closing-cta-heading"
      >
        Open your own question inbox.
      </h2>
      <p className="max-w-lg text-base leading-7 text-muted-foreground">
        Request an invite, claim your username, and share one link.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="px-6" size="lg">
          <a href="#request-access">
            Request an invite
            <ArrowRight data-icon="inline-end" />
          </a>
        </Button>
        <Button asChild className="px-6" size="lg" variant="outline">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    </section>
  );
}
