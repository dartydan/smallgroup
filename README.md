# Small Group Connect

Mobile-first app (iOS, Android, web) for connecting small group members. Features: announcements, snack sign-up, discussion topic + Bible text, birthdays, prayer requests, Bible verse memory.

## Stack

- **Mobile + Web**: Expo (React Native) in `apps/expo`
- **API**: Next.js on Vercel in `apps/api`
- **Auth**: Supabase Auth
- **Database**: Supabase (Postgres), Drizzle ORM

## Setup

**Node:** Use **Node 20.19.4 or later** (`node -v`). Expo/React Native and some npm packages require it; older Node (e.g. 20.13) will show `EBADENGINE` warnings. Easiest: install LTS from [nodejs.org](https://nodejs.org). With [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20`.

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. **Database**: Project Settings → Database → Connection string (URI). Copy it and set `DATABASE_URL` in `apps/api/.env.local`.
3. **API keys**: Project Settings → **API**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`
   - **Publishable key** (new, `sb_publishable_...`) or **anon public** (legacy JWT) → use the **Publishable** key when available; the app accepts either.
4. In `apps/api`, copy `.env.example` to `.env.local` and set:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. In `apps/expo`, copy `.env.example` to `.env` and set:
   - `EXPO_PUBLIC_API_URL` (e.g. `http://localhost:3001` for local)
   - `EXPO_PUBLIC_SUPABASE_URL` (same as API)
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` (same value as API)

Run migrations:

```bash
cd apps/api && npm run db:migrate
```

### 2. Run locally

```bash
# From repo root
npm install

# Terminal 1: API
npm run dev:api

# Terminal 2: Expo (iOS / Android / web)
npm run dev:expo
```

Open the Expo app and sign up with email/password. The first user in the group is an admin.

## Scripts

| Command         | Description                  |
|-----------------|------------------------------|
| `npm run dev:api`   | Start Next.js API (port 3001) |
| `npm run dev:expo`  | Start Expo dev server        |
| `npm run build:api` | Build API for Vercel         |
| `npm run build -w mobile` | Build Expo web (static export) |

## Web deployment (Vercel)

One Vercel project serves both the **API** and the **web app** (Expo web) at the same URL.

1. Create a Vercel project linked to this repo.
2. **Project Settings → General**: set **Root Directory** to `apps/api` (required; otherwise you get 404).
3. **Environment variables**: Copy `.env.vercel.example` to `.env.vercel`, fill in your values (Supabase URL, publishable key, `DATABASE_URL`, and `EXPO_PUBLIC_API_URL` = your Vercel URL). Then in Vercel → **Settings → Environment Variables → Import**, upload your `.env.vercel` file. (`.env.vercel` is gitignored.)
4. Deploy. The build runs the Expo web export, copies it into the API app, then builds Next.js. Visiting `/` redirects to the web app; `/api/*` routes are the API.

**If you see 404 NOT_FOUND:** Set **Root Directory** to `apps/api`, then redeploy.

## App store (EAS Build)

1. Install EAS CLI: `npm i -g eas-cli` and run `eas login`.
2. From `apps/expo`: `eas build --platform all --profile production` (or `--profile preview` for internal).
3. Submit: `eas submit --platform all --profile production` (fill in `eas.json` submit section as needed).

## Security / npm audit

- `npm audit fix --force` already updated **Next.js** to 14.2.35 and **drizzle-kit** to 0.31.x.
- Remaining **high** (Next.js) and **moderate** (esbuild/drizzle-kit) issues are fixed only in Next 15/16 and newer drizzle-kit; upgrading would be a larger change. For a small-group app with limited exposure, staying on 14.x is a reasonable tradeoff until you’re ready to upgrade. Re-run `npm audit` after future dependency updates.

## Project structure

```
apps/
  api/       Next.js API (Supabase Auth + Postgres, Drizzle)
  expo/      Expo app (React Native + web), EAS Build config in eas.json
```
