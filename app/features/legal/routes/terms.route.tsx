import { PublicShell } from "~/components/layout/public-shell/public-shell";
import { Badge } from "~/components/ui/badge/badge";

export function meta() {
  return [{ title: "Terms | Askora" }];
}

export default function TermsRoute() {
  return (
    <PublicShell>
      <div className="mx-auto grid max-w-5xl gap-7 py-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="flex h-fit flex-col gap-4 rounded-3xl border bg-card p-6 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-card)]">
          <p className="font-medium text-foreground">Beta policy</p>
          <p>
            A practical placeholder for invite-controlled beta use. Final
            counsel-approved legal copy is still required and is not provided by
            the app.
          </p>
        </aside>
        <article className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
          <header className="border-b bg-secondary/70 p-6 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Service rules</Badge>
              <Badge variant="secondary">Noindex beta</Badge>
            </div>
            <h1 className="font-serif text-5xl font-extrabold leading-tight text-foreground">
              Terms
            </h1>
          </header>
          <div className="divide-y text-sm leading-7">
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Beta access
              </h2>
              <p className="text-muted-foreground">
                The final Terms of Service must be completed before any
                external beta. This placeholder captures the product
                requirements that accounts are invite-controlled, users must be
                at least 16 unless a stricter local requirement applies, and
                users under 13 are prohibited.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Content boundaries
              </h2>
              <p className="text-muted-foreground">
                Content involving harassment, hate, threats, doxxing, spam,
                scams, illegal activity, impersonation, or explicit sexual
                content is not allowed in the MVP.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Gemini connection
              </h2>
              <p className="text-muted-foreground">
                The optional question-generation feature requires the profile
                owner to supply a Gemini API key they are authorized to use. By
                connecting it and acknowledging the disclosure, the owner asks
                Askora to submit the disclosed profile, preference, topic, and
                published-answer context to Google's Gemini API through that
                owner's project. Google's terms, data-use rules, pricing,
                quotas, and account restrictions apply to that provider use.
              </p>
              <p className="text-muted-foreground">
                Owners must not share a key they do not control or use the
                feature to evade Google or Askora limits. They can disconnect
                Gemini at any time, which removes the stored encrypted
                credential from the active database record.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Generated content
              </h2>
              <p className="text-muted-foreground">
                Generated questions enter the owner's private inbox for review;
                they are not published automatically. Provider and Askora
                safety checks reduce risk but do not guarantee accuracy,
                suitability, or originality. The owner remains responsible for
                deciding whether to answer, edit public wording, publish, or
                delete a generated question and must follow the same content
                boundaries that apply to all Askora content.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Account lifecycle
              </h2>
              <p className="text-muted-foreground">
                Users can hide their public profile, request account deletion,
                and cancel that request during the grace period. Deletion
                cleanup is designed to anonymize account identity rather than
                remove safety and moderation records needed to operate the
                service.
              </p>
            </section>
            <section className="flex flex-col gap-3 p-6 sm:p-7">
              <h2 className="text-base font-semibold text-foreground">
                Reports and enforcement
              </h2>
              <p className="text-muted-foreground">
                Reports, moderation actions, suspensions, hidden profiles, and
                removed public content may be retained as audit records. Final
                policy must define appeal, notice, and retention requirements
                before launch.
              </p>
            </section>
          </div>
        </article>
      </div>
    </PublicShell>
  );
}
