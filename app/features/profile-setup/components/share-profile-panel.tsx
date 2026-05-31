import { Check, Clipboard, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface ShareProfilePanelProps {
  canonicalUrl: string;
  displayName: string;
}

type ShareStatus = "idle" | "copied" | "unavailable";

export function ShareProfilePanel({
  canonicalUrl,
  displayName,
}: ShareProfilePanelProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");

  async function copyProfileUrl() {
    if (!hasClipboard()) {
      setStatus("unavailable");
      return;
    }

    await navigator.clipboard.writeText(canonicalUrl);
    setStatus("copied");
  }

  async function shareProfileUrl() {
    if (hasNativeShare()) {
      await navigator.share({
        title: `${displayName} on Q&A Platform`,
        url: canonicalUrl,
      });
      return;
    }

    await copyProfileUrl();
  }

  return (
    <section aria-labelledby="share-profile-heading" className="border-y py-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Public profile URL
        </p>
        <h1
          className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl"
          id="share-profile-heading"
        >
          Your profile is ready to share.
        </h1>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label="Profile URL"
          className="font-mono text-sm"
          readOnly
          value={canonicalUrl}
        />
        <div className="flex gap-2">
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => {
              void copyProfileUrl();
            }}
            type="button"
            variant="secondary"
          >
            {status === "copied" ? (
              <Check data-icon="inline-start" />
            ) : (
              <Clipboard data-icon="inline-start" />
            )}
            Copy
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => {
              void shareProfileUrl();
            }}
            type="button"
          >
            <Share2 data-icon="inline-start" />
            Share
          </Button>
        </div>
      </div>

      <ShareMessage status={status} />
    </section>
  );
}

function ShareMessage({ status }: { status: ShareStatus }) {
  if (status === "idle") {
    return (
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        This canonical URL is reserved for your profile.
      </p>
    );
  }

  if (status === "copied") {
    return (
      <p className="mt-4 text-sm leading-6 text-foreground" role="status">
        Profile URL copied.
      </p>
    );
  }

  return (
    <p className="mt-4 text-sm leading-6 text-destructive" role="status">
      Copy is unavailable in this browser.
    </p>
  );
}

function hasClipboard() {
  return (
    typeof navigator !== "undefined" &&
    "clipboard" in navigator &&
    typeof navigator.clipboard.writeText === "function"
  );
}

function hasNativeShare() {
  return (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    typeof navigator.share === "function"
  );
}
