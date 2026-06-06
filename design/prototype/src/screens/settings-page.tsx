import * as React from "react";
import {
  Ban,
  Eye,
  EyeOff,
  Lock,
  MessageCircle,
  MessageCircleOff,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";

import { GeminiNotification } from "../components/notifications/gemini-notification";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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

type SettingsSection = "profile" | "privacy" | "safety" | "account";
type AccountLifecycle = "active" | "deactivated" | "pending-deletion" | "deleted";

type ToastState = {
  message: string;
  tone: "danger" | "success";
};

type SettingsSectionDefinition = {
  description: string;
  icon: LucideIcon;
  label: string;
  value: SettingsSection;
};

const settingsSections = [
  {
    description:
      "Manage your public identity, handle, bio, and profile image source.",
    icon: User,
    label: "Profile",
    value: "profile",
  },
  {
    description:
      "Set ask permissions, follow-up defaults, and public count visibility.",
    icon: Lock,
    label: "Privacy",
    value: "privacy",
  },
  {
    description: "Manage question intake, muted phrases, and blocked senders.",
    icon: Shield,
    label: "Safety",
    value: "safety",
  },
  {
    description: "Control profile availability and account deletion.",
    icon: Settings2,
    label: "Account",
    value: "account",
  },
] as const satisfies readonly SettingsSectionDefinition[];

export function SettingsPage() {
  const [activeSection, setActiveSection] =
    React.useState<SettingsSection>("profile");
  const [bio, setBio] = React.useState(
    "Study, career, and internet life questions. I answer the ones that can help others.",
  );
  const [avatarSource, setAvatarSource] = React.useState<"fallback" | "google">(
    "google",
  );
  const [allowAnonymous, setAllowAnonymous] = React.useState(true);
  const [showFollowerCounts, setShowFollowerCounts] = React.useState(true);
  const [showReactionCounts, setShowReactionCounts] = React.useState(true);
  const [acceptQuestions, setAcceptQuestions] = React.useState(true);
  const [newPhrase, setNewPhrase] = React.useState("");
  const [phrases, setPhrases] = React.useState([
    { id: "promo-code", label: "promo code", meta: "Added May 15, 2026" },
    {
      id: "follow-for-follow",
      label: "follow for follow",
      meta: "Added Apr 3, 2026",
    },
  ]);
  const [blockedSenders, setBlockedSenders] = React.useState([
    {
      id: "jordan-park",
      label: "Jordan Park (@jordanp)",
      meta: "Account · Blocked March 10, 2026",
    },
    {
      id: "anon-feb",
      label: "Anonymous sender",
      meta: "Anonymous signal · Blocked February 2, 2026",
    },
  ]);
  const [deactivateToken, setDeactivateToken] = React.useState("");
  const [deleteToken, setDeleteToken] = React.useState("");
  const [accountLifecycle, setAccountLifecycle] =
    React.useState<AccountLifecycle>("active");
  const [toast, setToast] = React.useState<ToastState | null>(null);

  React.useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  const activeSectionDefinition =
    settingsSections.find((section) => section.value === activeSection) ??
    settingsSections[0];

  function triggerToast(message: string, tone: ToastState["tone"] = "success") {
    setToast({ message, tone });
  }

  function addPhrase() {
    const trimmedPhrase = newPhrase.trim();

    if (!trimmedPhrase) {
      return;
    }

    setPhrases((current) => [
      ...current,
      {
        id: `${trimmedPhrase.toLowerCase().replaceAll(" ", "-")}-${Date.now()}`,
        label: trimmedPhrase,
        meta: "Added just now",
      },
    ]);
    setNewPhrase("");
    triggerToast("Muted phrase added.");
  }

  return (
    <div className="min-h-svh bg-background pb-32 text-foreground">
      <main className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-5">
        <header className="mb-8">
          <p className="mb-1.5 font-mono text-[0.68rem] font-bold uppercase text-primary">
            Your account
          </p>
          <h1 className="font-serif text-[2rem] font-extrabold leading-none tracking-tight text-foreground sm:text-[2.6rem]">
            Settings
          </h1>
        </header>

        <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
          <nav
            aria-label="Settings navigation"
            className="md:sticky md:top-6"
          >
            <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1.5 shadow-[0_4px_20px_oklch(0.16_0.035_295_/_0.06)] md:flex-col md:gap-0 md:rounded-[1.25rem] md:p-2">
              <div className="hidden px-3 pb-1.5 pt-2 font-mono text-[0.62rem] font-bold uppercase text-muted-foreground md:block">
                Sections
              </div>
              {settingsSections.map((section) => {
                const Icon = section.icon;
                const isActive = section.value === activeSection;

                return (
                  <button
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[0.78rem] font-bold text-muted-foreground transition-colors md:w-full md:justify-start md:rounded-xl md:text-[0.84rem]",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-secondary hover:text-foreground",
                    )}
                    key={section.value}
                    onClick={() => {
                      setActiveSection(section.value);
                    }}
                    type="button"
                  >
                    <Icon className="hidden md:block" data-icon="inline-start" />
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b border-border bg-secondary px-5 py-5 sm:px-7">
              <CardTitle>{activeSectionDefinition.label}</CardTitle>
              <CardDescription>
                {activeSectionDefinition.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-7">
              {activeSection === "profile" ? (
                <ProfileSettings
                  avatarSource={avatarSource}
                  bio={bio}
                  onAvatarSourceChange={setAvatarSource}
                  onBioChange={setBio}
                  onToast={triggerToast}
                />
              ) : null}

              {activeSection === "privacy" ? (
                <PrivacySettings
                  allowAnonymous={allowAnonymous}
                  onAllowAnonymousChange={setAllowAnonymous}
                  onShowFollowerCountsChange={setShowFollowerCounts}
                  onShowReactionCountsChange={setShowReactionCounts}
                  onToast={triggerToast}
                  showFollowerCounts={showFollowerCounts}
                  showReactionCounts={showReactionCounts}
                />
              ) : null}

              {activeSection === "safety" ? (
                <SafetySettings
                  acceptQuestions={acceptQuestions}
                  blockedSenders={blockedSenders}
                  newPhrase={newPhrase}
                  onAcceptQuestionsChange={setAcceptQuestions}
                  onAddPhrase={addPhrase}
                  onBlockedSendersChange={setBlockedSenders}
                  onNewPhraseChange={setNewPhrase}
                  onPhrasesChange={setPhrases}
                  onToast={triggerToast}
                  phrases={phrases}
                />
              ) : null}

              {activeSection === "account" ? (
                <AccountSettings
                  accountLifecycle={accountLifecycle}
                  deactivateToken={deactivateToken}
                  deleteToken={deleteToken}
                  onAccountLifecycleChange={setAccountLifecycle}
                  onDeactivateTokenChange={setDeactivateToken}
                  onDeleteTokenChange={setDeleteToken}
                  onToast={triggerToast}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>

      <GeminiNotification
        message={toast?.message ?? ""}
        open={Boolean(toast)}
        tone={toast?.tone ?? "success"}
      />
    </div>
  );
}

type ProfileSettingsProps = {
  avatarSource: "fallback" | "google";
  bio: string;
  onAvatarSourceChange: (source: "fallback" | "google") => void;
  onBioChange: (bio: string) => void;
  onToast: (message: string, tone?: ToastState["tone"]) => void;
};

function ProfileSettings({
  avatarSource,
  bio,
  onAvatarSourceChange,
  onBioChange,
  onToast,
}: ProfileSettingsProps) {
  const bioTone =
    bio.length > 155 ? "text-destructive" : bio.length > 130 ? "text-warning" : "";

  return (
    <FieldGroup className="gap-7">
      <Field>
        <FieldLabel htmlFor="settings-username">Username</FieldLabel>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            @
          </span>
          <Input
            autoComplete="username"
            className="pl-7"
            defaultValue="mayachen"
            id="settings-username"
          />
        </div>
        <FieldDescription>
          Lowercase letters, numbers, and underscores only. Previous usernames
          redirect and stay reserved for 90 days.
        </FieldDescription>
      </Field>

      <div className="flex items-start gap-2 rounded-[0.625rem] border border-primary/20 bg-primary/10 px-3 py-2.5 text-xs leading-5 text-primary">
        <RefreshCw className="mt-0.5" data-icon="inline-start" />
        <span>
          Username changes reopen on July 1, 2026. Display name, bio, and
          avatar can still be saved.
        </span>
      </div>

      <Field>
        <FieldLabel htmlFor="settings-display-name">Display name</FieldLabel>
        <Input
          defaultValue="Maya Chen"
          id="settings-display-name"
          maxLength={50}
        />
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-4">
          <FieldLabel htmlFor="settings-bio">Bio</FieldLabel>
          <span className={cn("font-mono text-[0.68rem] text-muted-foreground", bioTone)}>
            {bio.length}/160
          </span>
        </div>
        <Textarea
          id="settings-bio"
          maxLength={160}
          onChange={(event) => {
            onBioChange(event.target.value);
          }}
          value={bio}
        />
        <FieldDescription>
          Optional public copy shown on your profile and link previews.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Profile image</FieldLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          <AvatarOption
            checked={avatarSource === "google"}
            label="Google"
            meta="Google account photo"
            onChange={() => {
              onAvatarSourceChange("google");
            }}
            value="G"
          />
          <AvatarOption
            checked={avatarSource === "fallback"}
            label="Initials"
            meta="Generated initials"
            onChange={() => {
              onAvatarSourceChange("fallback");
            }}
            value="MC"
          />
        </div>
      </Field>

      <div>
        <Button
          onClick={() => {
            onToast("Profile saved.");
          }}
          type="button"
        >
          Save profile
        </Button>
      </div>
    </FieldGroup>
  );
}

function AvatarOption({
  checked,
  label,
  meta,
  onChange,
  value,
}: {
  checked: boolean;
  label: string;
  meta: string;
  onChange: () => void;
  value: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-[0.625rem] border bg-background p-3 transition-colors",
        checked ? "border-primary bg-primary/10" : "border-border",
      )}
    >
      <input
        checked={checked}
        className="accent-primary"
        name="avatar-source"
        onChange={onChange}
        type="radio"
      />
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary font-serif text-sm font-bold text-primary">
        {value}
      </span>
      <span className="min-w-0">
        <strong className="block text-sm font-bold text-foreground">
          {label}
        </strong>
        <span className="block text-xs text-muted-foreground">{meta}</span>
      </span>
    </label>
  );
}

type PrivacySettingsProps = {
  allowAnonymous: boolean;
  onAllowAnonymousChange: (checked: boolean) => void;
  onShowFollowerCountsChange: (checked: boolean) => void;
  onShowReactionCountsChange: (checked: boolean) => void;
  onToast: (message: string, tone?: ToastState["tone"]) => void;
  showFollowerCounts: boolean;
  showReactionCounts: boolean;
};

function PrivacySettings({
  allowAnonymous,
  onAllowAnonymousChange,
  onShowFollowerCountsChange,
  onShowReactionCountsChange,
  onToast,
  showFollowerCounts,
  showReactionCounts,
}: PrivacySettingsProps) {
  return (
    <div className="flex flex-col gap-7">
      <SettingsSection
        description="Decide who can send new questions and how follow-up threads open."
        icon={MessageCircle}
        title="Question intake"
      >
        <ToggleRow
          checked={allowAnonymous}
          description="Hide the asker's public identity from you and viewers. Platform safety checks still apply."
          onCheckedChange={onAllowAnonymousChange}
          title="Anonymous questions"
        />

        <Field>
          <FieldLabel htmlFor="settings-ask-permission">Who can ask</FieldLabel>
          <NativeSelect id="settings-ask-permission">
            <option>Everyone</option>
            <option>Logged-in users</option>
            <option>Followers only</option>
            <option>No one</option>
          </NativeSelect>
          <FieldDescription>
            Controls the ask box on your public profile.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-followups">
            Follow-up default
          </FieldLabel>
          <NativeSelect id="settings-followups">
            <option>Anyone in the thread</option>
            <option>Logged-in users</option>
            <option>Original asker only</option>
            <option>No follow-ups</option>
          </NativeSelect>
          <FieldDescription>
            Default access for follow-up questions on published answers.
          </FieldDescription>
        </Field>
      </SettingsSection>

      <Separator />

      <SettingsSection
        description="Choose which totals appear publicly. Follower lists stay private."
        icon={Eye}
        title="Public counts"
      >
        <ToggleRow
          checked={showFollowerCounts}
          description="Show totals on your public profile without exposing follower lists."
          onCheckedChange={onShowFollowerCountsChange}
          title="Follower and following counts"
        />
        <ToggleRow
          checked={showReactionCounts}
          description="Show like totals on profiles, feed items, and threads."
          onCheckedChange={onShowReactionCountsChange}
          title="Reaction counts"
        />
      </SettingsSection>

      <div>
        <Button
          onClick={() => {
            onToast("Privacy settings saved.");
          }}
          type="button"
        >
          Save privacy
        </Button>
      </div>
    </div>
  );
}

type SafetySettingsProps = {
  acceptQuestions: boolean;
  blockedSenders: readonly { id: string; label: string; meta: string }[];
  newPhrase: string;
  onAcceptQuestionsChange: (checked: boolean) => void;
  onAddPhrase: () => void;
  onBlockedSendersChange: (
    senders: { id: string; label: string; meta: string }[],
  ) => void;
  onNewPhraseChange: (phrase: string) => void;
  onPhrasesChange: (
    phrases: { id: string; label: string; meta: string }[],
  ) => void;
  onToast: (message: string, tone?: ToastState["tone"]) => void;
  phrases: readonly { id: string; label: string; meta: string }[];
};

function SafetySettings({
  acceptQuestions,
  blockedSenders,
  newPhrase,
  onAcceptQuestionsChange,
  onAddPhrase,
  onBlockedSendersChange,
  onNewPhraseChange,
  onPhrasesChange,
  onToast,
  phrases,
}: SafetySettingsProps) {
  return (
    <div className="flex flex-col gap-7">
      <SettingsSection
        description="Pause new questions without changing existing inbox items or threads."
        icon={Shield}
        title="Intake gate"
      >
        <ToggleRow
          checked={acceptQuestions}
          description="When off, visitors see a simple unavailable message in the ask box."
          onCheckedChange={onAcceptQuestionsChange}
          title="Accept new questions"
        />
        <div>
          <Button
            onClick={() => {
              onToast("Safety settings saved.");
            }}
            type="button"
          >
            Save safety
          </Button>
        </div>
      </SettingsSection>

      <Separator />

      <SettingsSection
        description="Matches skip the inbox and land in Filtered for review."
        icon={MessageCircleOff}
        title="Muted phrases"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            maxLength={100}
            onChange={(event) => {
              onNewPhraseChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onAddPhrase();
              }
            }}
            placeholder="Word or phrase to filter"
            value={newPhrase}
          />
          <Button onClick={onAddPhrase} type="button" variant="outline">
            <Plus data-icon="inline-start" />
            Add
          </Button>
        </div>

        <SettingsList
          emptyLabel="No muted phrases."
          items={phrases}
          onRemove={(id) => {
            onPhrasesChange(phrases.filter((phrase) => phrase.id !== id));
            onToast("Muted phrase removed.");
          }}
          removeLabel="Remove"
        />
      </SettingsSection>

      <Separator />

      <SettingsSection
        description="Review account and anonymous signal blocks created from private questions."
        icon={Ban}
        title="Blocked senders"
      >
        <SettingsList
          emptyLabel="No blocked senders."
          items={blockedSenders}
          onRemove={(id) => {
            onBlockedSendersChange(
              blockedSenders.filter((sender) => sender.id !== id),
            );
            onToast("Sender unblocked.");
          }}
          removeLabel="Unblock"
        />
      </SettingsSection>
    </div>
  );
}

type AccountSettingsProps = {
  accountLifecycle: AccountLifecycle;
  deactivateToken: string;
  deleteToken: string;
  onAccountLifecycleChange: (state: AccountLifecycle) => void;
  onDeactivateTokenChange: (token: string) => void;
  onDeleteTokenChange: (token: string) => void;
  onToast: (message: string, tone?: ToastState["tone"]) => void;
};

function AccountSettings({
  accountLifecycle,
  deactivateToken,
  deleteToken,
  onAccountLifecycleChange,
  onDeactivateTokenChange,
  onDeleteTokenChange,
  onToast,
}: AccountSettingsProps) {
  const isDeleted = accountLifecycle === "deleted";
  const isPendingDeletion = accountLifecycle === "pending-deletion";
  const isDeactivated = accountLifecycle === "deactivated";
  const canRequestDeletion =
    accountLifecycle === "active" || accountLifecycle === "deactivated";

  function reactivateProfile() {
    onAccountLifecycleChange("active");
    onDeactivateTokenChange("");
    onDeleteTokenChange("");
    onToast("Profile reactivated.");
  }

  function deactivateProfile() {
    onAccountLifecycleChange("deactivated");
    onDeactivateTokenChange("");
    onToast("Profile deactivated.");
  }

  function requestDeletion() {
    onAccountLifecycleChange("pending-deletion");
    onDeleteTokenChange("");
    onToast("Account deletion requested.", "danger");
  }

  function cancelDeletion() {
    onAccountLifecycleChange("active");
    onDeleteTokenChange("");
    onDeactivateTokenChange("");
    onToast("Deletion request cancelled.");
  }

  return (
    <div className="flex flex-col gap-7">
      <SettingsSection
        description="Hide your public profile and threads without deleting your account."
        icon={EyeOff}
        title="Profile availability"
      >
        {accountLifecycle === "active" ? (
          <>
            <StatePanel
              description="@mayachen is visible on public profile and thread pages."
              title="Profile is public"
              tone="success"
            />

            <Field>
              <FieldLabel htmlFor="settings-deactivate-confirm">
                Type DEACTIVATE to confirm
              </FieldLabel>
              <Input
                autoComplete="off"
                id="settings-deactivate-confirm"
                onChange={(event) => {
                  onDeactivateTokenChange(event.target.value);
                }}
                placeholder="DEACTIVATE"
                value={deactivateToken}
              />
              <FieldDescription>
                Your profile and public threads become unavailable. You can
                reactivate from account settings.
              </FieldDescription>
              <div>
                <Button
                  disabled={deactivateToken !== "DEACTIVATE"}
                  onClick={deactivateProfile}
                  type="button"
                  variant="outline"
                >
                  Deactivate profile
                </Button>
              </div>
            </Field>
          </>
        ) : null}

        {isDeactivated ? (
          <div className="flex flex-col gap-4">
            <StatePanel
              description="@mayachen is hidden. Existing public thread URLs show an unavailable state until reactivation."
              title="Profile is deactivated"
              tone="warning"
            />
            <Button
              onClick={reactivateProfile}
              type="button"
            >
              Reactivate profile
            </Button>
          </div>
        ) : null}

        {isPendingDeletion ? (
          <StatePanel
            description="Deletion is pending until June 15, 2026. The profile is hidden during the cancellation window."
            title="Profile hidden by pending deletion"
            tone="warning"
          />
        ) : null}

        {isDeleted ? (
          <StatePanel
            description="The account cleanup has completed. Profile, inbox, and settings actions are unavailable in this state."
            title="Account deletion completed"
            tone="danger"
          />
        ) : null}
      </SettingsSection>

      <Separator className="bg-destructive/25" />

      <SettingsSection
        description="Request deletion with a 14-day cancellation window."
        icon={Trash2}
        title="Account deletion"
        tone="danger"
      >
        {canRequestDeletion ? (
          <>
            <StatePanel
              description="Requesting deletion hides your profile immediately and starts the 14-day grace period."
              title="No deletion request"
            />

            <Field>
              <FieldLabel htmlFor="settings-delete-confirm">
                Type DELETE to confirm
              </FieldLabel>
              <Input
                autoComplete="off"
                id="settings-delete-confirm"
                onChange={(event) => {
                  onDeleteTokenChange(event.target.value);
                }}
                placeholder="DELETE"
                value={deleteToken}
              />
              <FieldDescription>
                During the grace period, your profile stays hidden. Cleanup
                anonymizes identity after the window ends.
              </FieldDescription>
              <div>
                <Button
                  disabled={deleteToken !== "DELETE"}
                  onClick={requestDeletion}
                  type="button"
                  variant="destructive"
                >
                  Request account deletion
                </Button>
              </div>
            </Field>
          </>
        ) : null}

        {isPendingDeletion ? (
          <div className="flex flex-col gap-4">
            <StatePanel
              description="Deletion is scheduled for June 15, 2026. Cancelling restores the account to active visibility controls."
              title="Deletion pending"
              tone="warning"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={cancelDeletion} type="button" variant="outline">
                Cancel deletion request
              </Button>
              <Button
                onClick={() => {
                  onAccountLifecycleChange("deleted");
                  onToast("Completed deletion state previewed.", "danger");
                }}
                type="button"
                variant="destructive"
              >
                Preview completed deletion
              </Button>
            </div>
          </div>
        ) : null}

        {isDeleted ? (
          <div className="flex flex-col gap-4">
            <StatePanel
              description="Deletion is complete. This terminal prototype state shows the locked post-cleanup screen."
              title="Deleted account"
              tone="danger"
            />
            <Button
              disabled
              type="button"
              variant="destructive"
            >
              Account removed
            </Button>
          </div>
        ) : null}
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  children,
  description,
  icon: Icon,
  title,
  tone = "default",
}: {
  children: React.ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
  tone?: "danger" | "default";
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn(
            "mt-0.5",
            tone === "danger" ? "text-destructive" : "text-muted-foreground",
          )}
          data-icon="inline-start"
        />
        <div>
          <h3
            className={cn(
              "text-sm font-bold text-foreground",
              tone === "danger" && "text-destructive",
            )}
          >
            {title}
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  checked,
  description,
  onCheckedChange,
  title,
}: {
  checked: boolean;
  description: string;
  onCheckedChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[0.625rem] border border-border bg-secondary p-3">
      <div className="min-w-0">
        <strong className="block text-sm font-bold text-foreground">
          {title}
        </strong>
        <span className="block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </div>
      <Switch
        aria-label={title}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-10 w-full min-w-0 rounded-[0.625rem] border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25",
        className,
      )}
      {...props}
    />
  );
}

function SettingsList({
  emptyLabel,
  items,
  onRemove,
  removeLabel,
}: {
  emptyLabel: string;
  items: readonly { id: string; label: string; meta: string }[];
  onRemove: (id: string) => void;
  removeLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[0.625rem] border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li
          className="flex items-center justify-between gap-3 rounded-[0.625rem] border border-border bg-secondary px-3 py-2.5"
          key={item.id}
        >
          <div className="min-w-0">
            <strong className="block truncate text-sm font-bold text-foreground">
              {item.label}
            </strong>
            <span className="block truncate text-xs text-muted-foreground">
              {item.meta}
            </span>
          </div>
          <Button
            onClick={() => {
              onRemove(item.id);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {removeLabel}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function StatePanel({
  description,
  title,
  tone = "default",
}: {
  description: string;
  title: string;
  tone?: "danger" | "default" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-[0.625rem] border border-border bg-secondary px-3.5 py-3",
        tone === "success" && "border-success/30 bg-success/10",
        tone === "warning" && "border-warning/30 bg-warning/10",
        tone === "danger" && "border-destructive/30 bg-destructive/10",
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground">
        <span
          className={cn(
            "size-2 rounded-full bg-muted-foreground",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "danger" && "bg-destructive",
          )}
        />
        {title}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
