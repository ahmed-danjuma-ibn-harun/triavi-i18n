create table if not exists public.translations (
  language text not null,
  key text not null,
  entry jsonb not null,
  primary key (language, key)
);

create table if not exists public.annotators (
  email text primary key,
  display_name text not null,
  language text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.annotator_login_links (
  token_hash text primary key,
  email text not null references public.annotators(email) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists annotator_login_links_email_idx on public.annotator_login_links(email);

create table if not exists public.annotator_sessions (
  token_hash text primary key,
  email text not null references public.annotators(email) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists annotator_sessions_email_idx on public.annotator_sessions(email);

alter table public.translations enable row level security;
alter table public.annotators enable row level security;
alter table public.annotator_login_links enable row level security;
alter table public.annotator_sessions enable row level security;

-- The app uses its server-only service role key. Do not add public read/write
-- policies to these tables. Assign one language per email, for example:
-- insert into public.annotators (email, display_name, language)
-- values ('translator@example.com', 'Translator Name', 'es');
