DO $security$
DECLARE
  table_name text;
  server_only_tables text[] := ARRAY[
    'accounts',
    'admin_actions',
    'answer_like_notifications',
    'blocks',
    'events',
    'follows',
    'invite_codes',
    'likes',
    'muted_phrases',
    'notifications',
    'pinned_answers',
    'profiles',
    'questions',
    'rate_limits',
    'reports',
    'sessions',
    'thread_items',
    'threads',
    'username_reservations',
    'users',
    'verifications',
    'waitlist_entries'
  ];
BEGIN
  FOREACH table_name IN ARRAY server_only_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
      table_name
    );
  END LOOP;
END
$security$;
