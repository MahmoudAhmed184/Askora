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
            legal copy should replace this before launch.
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
          </div>
        </article>
      </div>
    </PublicShell>
  );
}
