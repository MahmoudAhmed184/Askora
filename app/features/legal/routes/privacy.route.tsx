import { PublicShell } from "~/components/layout/public-shell/public-shell";
import { Badge } from "~/components/ui/badge/badge";

export function meta() {
  return [{ title: "Privacy | Askora" }];
}

export default function PrivacyRoute() {
  return (
    <PublicShell>
      <div className="mx-auto grid max-w-5xl gap-7 py-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex h-fit flex-col gap-4 rounded-3xl border bg-card p-6 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-card)]">
          <p className="font-medium text-foreground">Beta policy</p>
          <p>
            A concise placeholder for the external beta privacy stance. Final
            counsel-approved legal copy is still required and is not provided by
            the app.
          </p>
        </aside>
        <article className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
          <header className="border-b bg-secondary/70 p-6 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Privacy stance</Badge>
              <Badge variant="secondary">Limited retention</Badge>
            </div>
            <h1 className="font-serif text-5xl font-extrabold leading-tight text-foreground">
              Privacy
            </h1>
          </header>
          <div className="divide-y text-sm leading-7">
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Anonymous to people
              </h2>
              <p className="text-muted-foreground">
                Anonymous questions are anonymous to the recipient and public
                viewers, not anonymous to the platform. The service may store
                limited safety metadata to prevent abuse and support reports.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Retention during beta
              </h2>
              <p className="text-muted-foreground">
                The MVP should avoid long-term raw IP storage, retain normal
                anonymous safety metadata for about 30 days, and retain
                report-linked safety metadata for about 180 days during beta.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Gemini question generation
              </h2>
              <p className="text-muted-foreground">
                Question generation is optional and uses the profile owner's
                Gemini API key. When the owner generates a batch, Askora sends
                Google the selected topic, language and style; the owner's
                public display name and bio; private saved interests; and a
                bounded selection of the owner's pinned and recent published
                question-and-answer pairs. Askora does not send private inbox
                questions, drafts, deleted content, reports, blocks, safety
                fingerprints, or moderation records.
              </p>
              <p className="text-muted-foreground">
                Google processes that request through the owner's Gemini
                project and account under Google's applicable Gemini API terms
                and data-use policies. The owner is responsible for the Google
                account, project, quota, and key they connect.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Generation storage and disclosure
              </h2>
              <p className="text-muted-foreground">
                Askora stores the connected key encrypted with authenticated,
                versioned encryption; the owner's model preference, interests,
                and disclosure acknowledgement; validated final questions; and
                minimal batch metadata such as language, style, count, model,
                and token totals. Askora does not store the prompt, serialized
                personalization context, raw Gemini response, or raw provider
                error body.
              </p>
              <p className="text-muted-foreground">
                Generated provenance is private to the profile owner. Public
                visitors, other signed-in users, crawlers, public page data,
                metadata, and client analytics do not receive the Generated
                marker or internal batch, model, and token metadata.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Generation deletion
              </h2>
              <p className="text-muted-foreground">
                Disconnecting Gemini immediately clears the encrypted
                credential fields. Preferences and already-created questions
                remain until changed or deleted through their normal controls.
                Generated questions follow the same inbox, draft, publication,
                and deletion lifecycle as other questions. Account deletion
                cleanup removes question-generation settings, credentials,
                generated questions, and batch records. Historical backups
                follow the platform's existing backup and retention policy.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Account deletion
              </h2>
              <p className="text-muted-foreground">
                A deletion request hides the public profile immediately and
                starts a grace period. Cleanup anonymizes account and profile
                identity, unlinks sessions and providers, and may keep limited
                question safety metadata and moderation records where needed for
                abuse prevention.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Reports and minors
              </h2>
              <p className="text-muted-foreground">
                Reports can include submitted content, account references, and
                moderation notes. The product requirement is that users must be
                at least 16 unless a stricter local requirement applies, and
                users under 13 are not allowed.
              </p>
            </section>
          </div>
        </article>
      </div>
    </PublicShell>
  );
}
