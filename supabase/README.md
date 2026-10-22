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
