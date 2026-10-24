# Supabase setup

**Schema.** Paste `migrations/0001_init.sql` into Dashboard > SQL Editor and run it, or run `supabase db push` from a linked project. It is safe to re-run.

**Auth config.** Either set these in the Dashboard:
- Authentication > URL Configuration: Site URL = `site_url`, Redirect URLs = each entry of `uri_allow_list`.
- Authentication > Sign In / Providers > Email: enabled, Confirm email off (`mailer_autoconfirm: true`), Allow new users to sign up = on (`disable_signup: false`) until your account exists.

Or send the JSON (without `_note`) to the Management API, reading the token from `.env`. This assumes `.env` names them `SUPABASE_API_KEY` and `SUPABASE_PROJECT_REF`; check yours (the project ref is `aajyivhjsnltjzusnxaq`):

```sh
set -a; . ./.env; set +a; jq 'del(._note)' supabase/auth-config.json | curl -X PATCH "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" -H "Authorization: Bearer $SUPABASE_API_KEY" -H "Content-Type: application/json" -d @-
```

**Single user.** Once your account exists, set `disable_signup: true` (Dashboard toggle or a PATCH with just that key) so nobody else can sign up.

## Garmin sync

A daily GitHub Action (`.github/workflows/garmin-sync.yml`, 05:00 UTC) copies the last 3 days of Garmin sleep, body battery, training readiness, resting HR, HRV and menstrual data into `health_daily`. Values you entered by hand in the app are never overwritten. It uses the unofficial `garminconnect` library, so it can break when Garmin changes things.

1. **Schema.** Run `migrations/0003_health.sql` in the SQL Editor (safe to re-run).
2. **GitHub secrets** (Settings > Secrets and variables > Actions > Secrets): `GARMIN_EMAIL`, `GARMIN_PASSWORD`, `GARMIN_TOKENS` (step 3), `SUPABASE_EMAIL`, `SUPABASE_PASSWORD` (your app login). The variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are already set for Deploy. Use the same email and password you sign in to the app with.
3. **One-time Garmin login** (handles the MFA code), in Git Bash on Windows from the repo root:

   ```sh
   py -3.12 -m venv .venv && source .venv/Scripts/activate && pip install -r scripts/requirements-garmin.txt
   python scripts/garmin_login.py
   ```

   Paste the printed string as the `GARMIN_TOKENS` secret. Don't commit or share it: it gives access to your Garmin account. Repeat this step if the sync starts failing at login.
4. **Run it.** Actions > Garmin sync > Run workflow. The log only shows counts and `ok`/`failed`.
5. **Backfill:** Actions → Garmin sync → Run workflow → days: 180 (one-time, ~6 months). It takes a few minutes; the daily run goes back to 3 days.

**When it fails**, the Action exits red and writes the error type to `garmin_status`; the app then shows "Garmin sync failed: log manually" and you can log period and sleep in the check-in.

**`failed: no Garmin data`** means every Garmin endpoint returned nothing or errored for every day (watch not synced, or Garmin changed its API). Nothing is written to `health_daily`; `garmin_status` gets `last_error: no data`. The counts line above it (`sleep a/N, body_battery b/N, ...`) shows which data types arrived.
