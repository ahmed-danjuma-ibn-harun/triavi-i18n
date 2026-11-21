# Triavi Localization

The annotator workspace is a Next.js app designed for Vercel. It reads the patient-facing English catalog from `en_strings.json`, stores translation records in Supabase, and keeps the 94-language catalog and existing JSON data files in the repository as importable seed data.

## Deploy to Vercel

1. Import the repository in Vercel and set the project **Root Directory** to `Triavi_translations`.
2. Create a Supabase table by running [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor.
3. Add these environment variables to the Vercel project:

   - `SUPABASE_URL` — the project URL from Supabase project settings.
   - `SUPABASE_SECRET_KEY` — the Supabase server-side secret key (or legacy `SUPABASE_SERVICE_ROLE_KEY`). Keep it private; it must never use a `NEXT_PUBLIC_` prefix.
   - `APP_URL` — the deployed Vercel origin, such as `https://triavi-translations.vercel.app`.
   - `SUPER_ADMIN_EMAILS` — comma-separated email addresses allowed to manage annotators and view activity.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM` — use the SMTP settings already configured for the Triavi emails.

4. Add one row to `public.annotators` for each approved translator, setting exactly one assigned language code, for example:

   ```sql
   insert into public.annotators (email, display_name, language)
   values ('translator@example.com', 'Translator Name', 'es');
   ```

   The language must match a code in `languages.json`. The login page sends one-time links only to enabled email addresses on this allowlist. Update `language` to reassign someone or set `enabled = false` to remove access; the app checks the assignment on every request.

   Every super-admin email must also have an enabled row in `annotators` with a valid assigned language, and must appear in `SUPER_ADMIN_EMAILS`. After changing `schema.sql`, rerun it in the Supabase SQL Editor; the statements are safe to rerun and create the translation activity table used by the admin dashboard.

5. Deploy. In Vercel, the production filesystem is read-only, so Supabase must be configured before annotators save work.

## Import existing translations

Install dependencies, put the Supabase URL and server secret key in `.env.local`, then run:

```bash
npm install
npm run seed:supabase
```

The seed script upserts every `data/*.json` catalog. Running it again updates those language/key records from the local JSON files.

## Local development

Copy `.env.example` to `.env.local`, fill in the Supabase and SMTP settings above, and start the app:

```bash
npm install
npm run dev
```

Open http://localhost:3000. When Supabase variables are absent in development, the app reads and writes local `data/<language>.json` files instead.

## Updating patient screen strings

The current patient UI source lives in `../triavi-frontend/lib/i18n/en.ts`. Refresh the source strings and sections with:

```bash
python parse_en.py
```

Refresh the ten translated patient catalogs shipped by the frontend (`es`, `zh-Hans`, `vi`, `ar`, `ur`, `ig`, `yo`, `ha`, `ff`, and `pcm`) with:

```bash
python parse_en.py --sync-locales
```

After changing the local catalogs, run `npm run seed:supabase` to update the same language/key records in Supabase.

## Data model

`public.translations` stores one JSONB annotation record per language and key. The app uses the Supabase service role only in server routes; row-level security is enabled and no public policies are created. Each record retains the English source, translation, reviewer, timestamp, and review status.

Authentication uses the existing Triavi data-room and clinical-review email style and SMTP setup. One-time links expire after 15 minutes; their hashes are stored in Supabase, and links are consumed only after the person clicks **Continue** on the sign-in page. Session cookies are HTTP-only and revoked on logout. Each API request verifies the active allowlist row and language assignment, so a translator cannot access another language by changing the request URL.

Super-admins see the team console for invitations, language assignments, access toggles, and saved translation activity. Annotators only see their assigned translation workspace and save action. Existing repository translation JSON is loaded as a fallback and merged with Supabase records, with Supabase taking precedence. The light/dark theme choice is stored in the browser.
