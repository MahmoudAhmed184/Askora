import { PublicShell } from "~/components/app/public-shell";

export function meta() {
  return [{ title: "Terms | qna-platform" }];
}

export default function TermsRoute() {
  return (
    <PublicShell>
      <div className="grid gap-8 py-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
          <p className="font-medium text-foreground">Beta policy</p>
          <p>
            A practical placeholder for invite-controlled beta use. Final legal
            copy should replace this before launch.
          </p>
        </aside>
        <article className="flex max-w-3xl flex-col gap-8">
          <header className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              Service rules
            </p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Terms
            </h1>
          </header>
          <div className="divide-y border-y text-sm leading-7">
            <section className="flex flex-col gap-3 py-5">
              <h2 className="text-base font-semibold text-foreground">
                Beta access
              </h2>
              <p className="text-muted-foreground">
                The final Terms of Service must be completed before any
                external beta. This placeholder captures the product
                requirements that accounts are invite-controlled, users must be
                at least 16, and users under 13 are prohibited.
              </p>
            </section>
            <section className="flex flex-col gap-3 py-5">
              <h2 className="text-base font-semibold text-foreground">
                Content boundaries
              </h2>
              <p className="text-muted-foreground">
                Content involving harassment, hate, threats, doxxing, spam,
                scams, illegal activity, impersonation, or explicit sexual
                content is not allowed in the MVP.
              </p>
            </section>
          </div>
        </article>
      </div>
    </PublicShell>
  );
}
