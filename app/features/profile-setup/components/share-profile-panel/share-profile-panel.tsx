import { Check, Clipboard, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";

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
      toast.error("Copy is unavailable in this browser.", {
        id: "profile-url-copy-unavailable",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setStatus("copied");
      toast.success("Profile URL copied.", { id: "profile-url-copied" });
    } catch {
      setStatus("unavailable");
      toast.error("Copy is unavailable in this browser.", {
        id: "profile-url-copy-unavailable",
      });
    }
  }

  async function shareProfileUrl() {
    if (hasNativeShare()) {
      try {
        await navigator.share({
          title: `${displayName} on Q&A Platform`,
          url: canonicalUrl,
        });
        toast.success("Native share sheet requested.", {
          id: "profile-url-native-share",
        });
      } catch (error) {
        if (!isAbortError(error)) {
          toast.error("Share is unavailable in this browser.", {
            id: "profile-url-native-share-unavailable",
          });
        }
      }
      return;
    }

    await copyProfileUrl();
  }

  return (
    <section
      aria-labelledby="share-profile-heading"
      className="rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] sm:p-7"
    >
      <div className="flex flex-col gap-2">
        <div>
          <Badge variant="secondary">Setup complete</Badge>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Public profile URL
        </p>
        <h1
          className="max-w-2xl font-serif text-3xl font-bold leading-tight text-primary sm:text-4xl"
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
    </section>
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
