REMOVED: The example Edge Functions for sending email (send-email and send-email-smtp) were removed from this repository per project decision.

If you need server-side email sending later, re-add a secured Edge Function and store credentials in Supabase Function secrets or GitHub Actions secrets. Do NOT commit API keys or passwords into source control.
Deploying the notify Edge Function (SendGrid or SMTP)

This repository includes two example Edge Functions under `functions/`:

- `functions/send-email` - example using SendGrid HTTP API (Deno)
- `functions/send-email-smtp` - example using SMTP library in Deno

Both are Deno-based and intended for Supabase Edge Functions or any Deno runtime.

Quick deploy steps (Supabase Functions):

1. Install and login to Supabase CLI
   npm install -g supabase
   supabase login

2. From the repo root, deploy the function directory. Example for SendGrid function:

   REMOVED: send-email and send-email-smtp example Edge Functions were removed per project decision.
   If you need server-side email sending later, add a secure Edge Function and store credentials in Supabase Function secrets or GitHub Actions secrets.


   For the SMTP example:
