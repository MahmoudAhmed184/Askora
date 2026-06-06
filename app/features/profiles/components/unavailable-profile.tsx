interface UnavailableProfileProps {
  username: string;
}

export function UnavailableProfile({ username }: UnavailableProfileProps) {
  return (
    <section className="mx-auto flex min-h-[50svh] max-w-xl flex-col justify-center gap-3 py-10">
      <p className="break-all text-sm font-medium text-muted-foreground">
        @{username}
      </p>
      <h1 className="font-serif text-4xl font-bold leading-tight text-primary">
        This profile is unavailable
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        The username may be reserved, deactivated, or no longer accepting a
        public profile page.
      </p>
    </section>
  );
}
