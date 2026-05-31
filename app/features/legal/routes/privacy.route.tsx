import { PublicShell } from "~/components/app/public-shell";

export function meta() {
  return [{ title: "Privacy | qna-platform" }];
}

export default function PrivacyRoute() {
  return (
    <PublicShell>
      <div className="grid gap-8 py-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
          <p className="font-medium text-foreground">Beta policy</p>
          <p>
            A concise placeholder for the external beta privacy stance. Final
            counsel-approved legal copy is still required and is not provided by
            the app.
          </p>
        </aside>
        <article className="flex max-w-3xl flex-col gap-8">
          <header className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              Privacy stance
            </p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Privacy
            </h1>
          </header>
          <div className="divide-y border-y text-sm leading-7">
            <section className="flex flex-col gap-3 py-5">
              <h2 className="text-base font-semibold text-foreground">
                Anonymous to people
              </h2>
              <p className="text-muted-foreground">
                Anonymous questions are anonymous to the recipient and public
                viewers, not anonymous to the platform. The service may store
                limited safety metadata to prevent abuse and support reports.
              </p>
            </section>
            <section className="flex flex-col gap-3 py-5">
              <h2 className="text-base font-semibold text-foreground">
                Retention during beta
              </h2>
              <p className="text-muted-foreground">
                The MVP should avoid long-term raw IP storage, retain normal
                anonymous safety metadata for about 30 days, and retain
                report-linked safety metadata for about 180 days during beta.
              </p>
            </section>
            <section className="flex flex-col gap-3 py-5">
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
            <section className="flex flex-col gap-3 py-5">
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
