# ShufflePro

## Run locally

1. Create a Supabase project.
2. In Supabase, enable the Email provider under **Authentication → Providers**.
3. Add `http://localhost:5173` to **Authentication → URL Configuration → Redirect URLs**. Set the Site URL to the local URL for local testing.
4. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project's API settings. The anon/publishable key is intended for browser use; never put a `service_role` key in this app.
5. Install dependencies and start the development server:

   ```sh
   npm install
   npm run dev
   ```

The app supports email/password registration and sign-in, email confirmation, password-reset links, and password updates from recovery links. Supabase Auth stores and verifies credentials; the app never stores passwords. For production email delivery, configure a custom SMTP provider in Supabase.

Player lists, court assignments, and lock settings are still stored in the browser's local storage, scoped to the signed-in Supabase user on that browser. They are not uploaded to Supabase.
