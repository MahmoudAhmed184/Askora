export interface AdminHeroStat {
  value: string | number;
  label: string;
}

interface AdminHeroProps {
  stats: readonly AdminHeroStat[];
  title?: string;
}

export function AdminHero({ stats, title = "Moderation Queue" }: AdminHeroProps) {
  return (
    <header className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
      <div
        aria-hidden="true"
        className="relative h-32 bg-[image:var(--gradient-brand)] sm:h-44"
      >
        <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(to_right,var(--primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--primary)_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>
      <div className="p-6 pt-0 sm:p-8 sm:pt-0">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative z-10 -mt-14 flex size-24 shrink-0 items-center justify-center rounded-full border-4 border-card bg-secondary font-serif text-3xl font-extrabold text-primary shadow-[var(--shadow-card)] sm:-mt-16 sm:size-28">
            AD
          </div>
          <div className="min-w-0 sm:pt-8">
            <h1 className="font-serif text-4xl font-extrabold leading-tight text-foreground">
              {title}
            </h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              reports · queue · detail · action log
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              User report form plus admin queue and detail states. Severe
              actions require notes before recording.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {stats.map((stat) => (
            <span
              className="rounded-full border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground"
              key={stat.label}
            >
              <strong className="font-mono text-foreground">{stat.value}</strong>{" "}
              {stat.label}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
