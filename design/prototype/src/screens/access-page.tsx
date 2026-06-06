import * as React from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link,
  LogIn,
  Mail,
  Send,
  ShieldCheck,
} from "lucide-react";

import { GeminiNotification } from "../components/notifications/gemini-notification";
import { usePrototypeToast } from "../components/use-prototype-toast";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";

type AccessView = "home" | "login" | "setup" | "share" | "legal";
type LegalView = "terms" | "privacy";

const accessViews = [
  { value: "home", label: "Home" },
  { value: "login", label: "Login" },
  { value: "setup", label: "Setup" },
  { value: "share", label: "Share" },
  { value: "legal", label: "Legal" },
] as const satisfies readonly { label: string; value: AccessView }[];

const legalViews = [
  { value: "terms", label: "Terms" },
  { value: "privacy", label: "Privacy" },
] as const satisfies readonly { label: string; value: LegalView }[];

const reservedNames = new Set(["admin", "feed", "login", "settings"]);

export function AccessPage() {
  const [activeView, setActiveView] = React.useState<AccessView>("home");
  const [legalView, setLegalView] = React.useState<LegalView>("terms");
  const [waitlistEmail, setWaitlistEmail] = React.useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = React.useState(false);
  const [inviteCode, setInviteCode] = React.useState("MAYA-BETA-42");
  const [magicEmail, setMagicEmail] = React.useState("");
  const [magicSent, setMagicSent] = React.useState(false);
  const [username, setUsername] = React.useState("mayachen");
  const [displayName, setDisplayName] = React.useState("Maya Chen");
  const [bio, setBio] = React.useState(
    "Study, career, and internet life questions. I answer the ones that can help others.",
  );
  const [acceptedTerms, setAcceptedTerms] = React.useState(true);
  const [setupStatus, setSetupStatus] = React.useState<
    { tone: "danger" | "success"; message: string } | null
  >(null);
  const { toast, triggerToast } = usePrototypeToast();

  const usernameStatus = getUsernameStatus(username);

  function submitWaitlist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!waitlistEmail.includes("@")) {
      triggerToast("Enter an email address for the waitlist.", "danger");
      return;
    }

    setWaitlistSubmitted(true);
    triggerToast("Waitlist request recorded.");
  }

  function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!magicEmail.includes("@")) {
      triggerToast("Enter the email for your magic link.", "danger");
      return;
    }

    setMagicSent(true);
    triggerToast("Magic link sent.");
  }

  function completeSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (usernameStatus.tone === "danger") {
      setSetupStatus({
        message: usernameStatus.message,
        tone: "danger",
      });
      return;
    }

    if (!displayName.trim()) {
      setSetupStatus({
        message: "Display name is required.",
        tone: "danger",
      });
      return;
    }

    if (!acceptedTerms) {
      setSetupStatus({
        message: "Confirm the age and Terms requirement before continuing.",
        tone: "danger",
      });
      return;
    }

    setSetupStatus({
      message: "Profile setup complete. Share screen unlocked.",
      tone: "success",
    });
    setActiveView("share");
    triggerToast("Setup saved.");
  }

  return (
    <div className="gemini-profile">
      <main className="gemini-app-shell" role="main">
        <AccessHeader activeView={activeView} onActiveViewChange={setActiveView} />

        {activeView === "home" ? (
          <HomeWaitlist
            onEmailChange={setWaitlistEmail}
            onSubmit={submitWaitlist}
            submitted={waitlistSubmitted}
            waitlistEmail={waitlistEmail}
          />
        ) : null}

        {activeView === "login" ? (
          <LoginPanel
            inviteCode={inviteCode}
            magicEmail={magicEmail}
            magicSent={magicSent}
            onInviteCodeChange={setInviteCode}
            onMagicEmailChange={setMagicEmail}
            onSendMagicLink={sendMagicLink}
            onToast={triggerToast}
          />
        ) : null}

        {activeView === "setup" ? (
          <SetupPanel
            acceptedTerms={acceptedTerms}
            bio={bio}
            displayName={displayName}
            onAcceptedTermsChange={setAcceptedTerms}
            onBioChange={setBio}
            onDisplayNameChange={setDisplayName}
            onSubmit={completeSetup}
            onUsernameChange={setUsername}
            setupStatus={setupStatus}
            username={username}
            usernameStatus={usernameStatus}
          />
        ) : null}

        {activeView === "share" ? (
          <SharePanel onToast={triggerToast} username={username} />
        ) : null}

        {activeView === "legal" ? (
          <LegalPanel legalView={legalView} onLegalViewChange={setLegalView} />
        ) : null}
      </main>

      <GeminiNotification
        message={toast?.message ?? ""}
        open={Boolean(toast)}
        tone={toast?.tone ?? "success"}
      />
    </div>
  );
}

function AccessHeader({
  activeView,
  onActiveViewChange,
}: {
  activeView: AccessView;
  onActiveViewChange: (view: AccessView) => void;
}) {
  return (
    <section className="gemini-profile-header-container">
      <div className="gemini-cover-banner">
        <div className="gemini-grid-overlay" />
      </div>

      <div className="gemini-profile-body-inner">
        <div className="gemini-profile-meta-top">
          <div className="gemini-avatar-wrapper">
            <div aria-label="Q&A beta" className="gemini-profile-avatar">
              QA
            </div>
          </div>

          <div className="gemini-profile-info">
            <h1 className="gemini-profile-name">Beta Entry</h1>
            <p className="gemini-profile-handle">
              invite gate · setup · share · legal
            </p>
            <p className="gemini-profile-bio">
              Static access states for the prototype. Login, setup, share, and
              legal live together here outside the logged-in navigation.
            </p>
          </div>
        </div>

        <nav
          aria-label="Access prototype sections"
          className="gemini-profile-stats"
        >
          {accessViews.map((view) => (
            <button
              aria-current={view.value === activeView ? "page" : undefined}
              className={cn(
                "gemini-stat-pill transition-colors",
                view.value === activeView && "border-primary bg-primary/10",
              )}
              key={view.value}
              onClick={() => {
                onActiveViewChange(view.value);
              }}
              type="button"
            >
              <strong>{view.label}</strong>
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}

function HomeWaitlist({
  onEmailChange,
  onSubmit,
  submitted,
  waitlistEmail,
}: {
  onEmailChange: (email: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitted: boolean;
  waitlistEmail: string;
}) {
  return (
    <div className="gemini-layout-columns">
      <section className="gemini-content-card">
        <Badge variant="violet">Invite-only beta</Badge>
        <h2 className="mt-4 max-w-3xl font-serif text-4xl font-extrabold leading-tight text-foreground">
          One public link for questions you choose to answer.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          Creators share a profile URL, visitors ask with low friction, and the
          owner publishes only the answers they want on public threads.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <LoopStep label="Share" text="Post your @username URL anywhere." />
          <LoopStep label="Receive" text="Questions land privately first." />
          <LoopStep label="Publish" text="Answers create readable threads." />
        </div>
      </section>

      <form
        aria-label="Request beta access"
        className="gemini-content-card gemini-rail-card"
        onSubmit={onSubmit}
      >
        <h2 className="gemini-rail-title">Request access</h2>
        <p className="gemini-rail-copy">
          The form records interest. It does not imply instant access.
        </p>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="waitlist-email">Email</FieldLabel>
            <Input
              autoComplete="email"
              id="waitlist-email"
              onChange={(event) => {
                onEmailChange(event.target.value);
              }}
              placeholder="you@example.com"
              type="email"
              value={waitlistEmail}
            />
          </Field>
          <Button type="submit">
            <Send data-icon="inline-start" />
            Request access
          </Button>
          {submitted ? (
            <InlineStatus tone="success">
              Waitlist submitted. Admins can invite or dismiss this request.
            </InlineStatus>
          ) : null}
        </FieldGroup>
      </form>
    </div>
  );
}

function LoopStep({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-[0.625rem] border border-border bg-secondary p-4">
      <p className="font-mono text-[0.68rem] font-bold text-primary">{label}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function LoginPanel({
  inviteCode,
  magicEmail,
  magicSent,
  onInviteCodeChange,
  onMagicEmailChange,
  onSendMagicLink,
  onToast,
}: {
  inviteCode: string;
  magicEmail: string;
  magicSent: boolean;
  onInviteCodeChange: (code: string) => void;
  onMagicEmailChange: (email: string) => void;
  onSendMagicLink: (event: React.FormEvent<HTMLFormElement>) => void;
  onToast: (message: string, tone?: "danger" | "success") => void;
}) {
  return (
    <section className="gemini-content-card mx-auto max-w-2xl">
      <div className="mb-5 border-b border-border pb-5">
        <h2 className="gemini-feed-title">Sign in</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Google is primary. Magic link is the email fallback. Invite code is
          validated before profile setup.
        </p>
      </div>

      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="invite-code">Invite code</FieldLabel>
          <Input
            id="invite-code"
            onChange={(event) => {
              onInviteCodeChange(event.target.value);
            }}
            value={inviteCode}
          />
          <FieldDescription>
            Single-use beta invite. Manual approval can use the same state.
          </FieldDescription>
        </Field>

        <Button
          onClick={() => {
            onToast("Google sign-in selected.");
          }}
          type="button"
        >
          <LogIn data-icon="inline-start" />
          Continue with Google
        </Button>

        <Separator />

        <form onSubmit={onSendMagicLink}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="magic-email">Email magic link</FieldLabel>
              <Input
                autoComplete="email"
                id="magic-email"
                onChange={(event) => {
                  onMagicEmailChange(event.target.value);
                }}
                placeholder="you@example.com"
                type="email"
                value={magicEmail}
              />
              <FieldDescription>
                Link expires after the short auth window.
              </FieldDescription>
            </Field>
            <Button type="submit" variant="outline">
              <Mail data-icon="inline-start" />
              Send magic link
            </Button>
          </FieldGroup>
        </form>

        {magicSent ? (
          <InlineStatus tone="success">
            Magic link sent to {magicEmail}. The prototype keeps this as local
            state only.
          </InlineStatus>
        ) : null}
      </FieldGroup>
    </section>
  );
}

function SetupPanel({
  acceptedTerms,
  bio,
  displayName,
  onAcceptedTermsChange,
  onBioChange,
  onDisplayNameChange,
  onSubmit,
  onUsernameChange,
  setupStatus,
  username,
  usernameStatus,
}: {
  acceptedTerms: boolean;
  bio: string;
  displayName: string;
  onAcceptedTermsChange: (accepted: boolean) => void;
  onBioChange: (bio: string) => void;
  onDisplayNameChange: (displayName: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUsernameChange: (username: string) => void;
  setupStatus: { tone: "danger" | "success"; message: string } | null;
  username: string;
  usernameStatus: { tone: "danger" | "success" | "warning"; message: string };
}) {
  return (
    <form
      aria-label="Complete profile setup"
      className="gemini-content-card mx-auto max-w-3xl"
      onSubmit={onSubmit}
    >
      <div className="mb-5 border-b border-border pb-5">
        <h2 className="gemini-feed-title">Complete public identity</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Three fields maximum. Prompt chips live in the ask composer; the
          standalone prompt flow is deferred.
        </p>
      </div>

      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="setup-username">Username</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
              @
            </span>
            <Input
              autoComplete="username"
              className="pl-7"
              id="setup-username"
              onChange={(event) => {
                onUsernameChange(event.target.value);
              }}
              value={username}
            />
          </div>
          <InlineStatus tone={usernameStatus.tone}>
            {usernameStatus.message}
          </InlineStatus>
        </Field>

        <Field>
          <FieldLabel htmlFor="setup-display-name">Display name</FieldLabel>
          <Input
            id="setup-display-name"
            maxLength={50}
            onChange={(event) => {
              onDisplayNameChange(event.target.value);
            }}
            value={displayName}
          />
        </Field>

        <Field>
          <div className="flex items-center justify-between gap-4">
            <FieldLabel htmlFor="setup-bio">Bio</FieldLabel>
            <span
              className={cn(
                "font-mono text-[0.68rem]",
                bio.length > 155 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {bio.length}/160
            </span>
          </div>
          <Textarea
            id="setup-bio"
            maxLength={160}
            onChange={(event) => {
              onBioChange(event.target.value);
            }}
            value={bio}
          />
          <FieldDescription>
            Optional profile copy shown on public profile and link previews.
          </FieldDescription>
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-[0.625rem] border border-border bg-secondary p-3">
          <div>
            <p className="text-sm font-bold text-foreground">
              Confirm age and Terms
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Users must be at least 16. Under 13 is prohibited.
            </p>
          </div>
          <Switch
            aria-label="Confirm age and Terms"
            checked={acceptedTerms}
            onCheckedChange={onAcceptedTermsChange}
          />
        </div>

        {setupStatus ? (
          <InlineStatus tone={setupStatus.tone}>{setupStatus.message}</InlineStatus>
        ) : null}

        <div>
          <Button type="submit">
            <Check data-icon="inline-start" />
            Finish setup
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

function SharePanel({
  onToast,
  username,
}: {
  onToast: (message: string, tone?: "danger" | "success") => void;
  username: string;
}) {
  const profileUrl = `https://qna.example/${username || "mayachen"}`;

  return (
    <section className="gemini-content-card mx-auto max-w-3xl">
      <Badge variant="violet">Setup complete</Badge>
      <h2 className="mt-3 font-serif text-3xl font-extrabold text-foreground">
        Share your profile
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        The first useful beta signal is a profile owner sharing their link and
        receiving a real question.
      </p>
      <div className="mt-5 rounded-[0.625rem] border border-border bg-secondary p-4">
        <p className="break-all font-mono text-sm font-bold text-primary">
          {profileUrl}
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={() => {
            onToast("Profile URL copied.");
          }}
          type="button"
        >
          <Copy data-icon="inline-start" />
          Copy profile URL
        </Button>
        <Button
          onClick={() => {
            onToast("Native share sheet requested.");
          }}
          type="button"
          variant="outline"
        >
          <Link data-icon="inline-start" />
          Share profile
        </Button>
        <Button asChild variant="link">
          <a href="#profile">
            View profile
            <ExternalLink data-icon="inline-end" />
          </a>
        </Button>
      </div>
    </section>
  );
}

function LegalPanel({
  legalView,
  onLegalViewChange,
}: {
  legalView: LegalView;
  onLegalViewChange: (view: LegalView) => void;
}) {
  return (
    <div className="gemini-layout-columns">
      <aside className="gemini-content-card gemini-rail-card">
        <h2 className="gemini-rail-title">Legal presentation</h2>
        <div className="flex flex-col gap-2">
          {legalViews.map((view) => (
            <button
              aria-pressed={view.value === legalView}
              className={cn(
                "rounded-[0.625rem] border border-border bg-secondary px-3 py-2 text-left text-sm font-bold transition-colors hover:border-primary/40",
                view.value === legalView && "border-primary bg-primary/10",
              )}
              key={view.value}
              onClick={() => {
                onLegalViewChange(view.value);
              }}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </div>
        <InlineStatus className="mt-4" tone="warning">
          Public profile and thread pages include noindex during beta. No sitemap
          is shipped until indexing becomes deliberate.
        </InlineStatus>
      </aside>

      <section className="gemini-content-card">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <ShieldCheck data-icon="inline-start" />
            Beta legal placeholder
          </Badge>
          <Badge variant="secondary">Noindex</Badge>
        </div>
        {legalView === "terms" ? (
          <>
            <h2 className="font-serif text-3xl font-extrabold text-foreground">
              Terms presentation
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              Terms cover accounts, age requirements, anonymous questions,
              creator controls, reports, moderation decisions, and the invite
              beta lifecycle. The prototype shows placement and state, not final
              legal copy.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-serif text-3xl font-extrabold text-foreground">
              Privacy presentation
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              Privacy copy explains that anonymous means anonymous to the
              recipient and public viewers, not to the platform. Safety metadata
              uses limited retention and report-linked retention windows.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function InlineStatus({
  children,
  className,
  tone = "success",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "danger" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-[0.625rem] border px-3.5 py-3 text-sm leading-6",
        tone === "success" && "border-success/25 bg-success/10 text-foreground",
        tone === "warning" && "border-warning/30 bg-warning/10 text-foreground",
        tone === "danger" &&
          "border-destructive/25 bg-destructive/10 text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

function getUsernameStatus(username: string) {
  const trimmed = username.trim();

  if (!/^[a-z0-9_]{3,30}$/.test(trimmed)) {
    return {
      message: "Use 3 to 30 lowercase letters, numbers, or underscores.",
      tone: "danger" as const,
    };
  }

  if (reservedNames.has(trimmed)) {
    return {
      message: "This username is reserved for a system route.",
      tone: "danger" as const,
    };
  }

  if (trimmed === "maya") {
    return {
      message: "This username is recently released and reserved for 90 days.",
      tone: "warning" as const,
    };
  }

  return {
    message: "Username is available.",
    tone: "success" as const,
  };
}
