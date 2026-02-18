# Small Group Connect

Mobile-first app (iOS, Android, web) for connecting small group members. Features: announcements, snack sign-up, discussion topic + Bible text, birthdays, prayer requests, Bible verse memory.

## Stack

- **Web**: Next.js + shadcn (nature theme) in `apps/api` — login and dashboard at `/`
- **Mobile**: Expo (React Native) in `apps/expo` (iOS/Android; Expo web still built for optional use)
- **API**: Next.js on Vercel in `apps/api` — same app serves web UI and `/api/*` routes
- **Auth**: Clerk
- **Database**: Postgres (Neon or Vercel Postgres recommended), Drizzle ORM

## Setup

**Node:** Use **Node 20.19.4 or later** (`node -v`). Expo/React Native and some npm packages require it; older Node (e.g. 20.13) will show `EBADENGINE` warnings. Easiest: install LTS from [nodejs.org](https://nodejs.org). With [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20`.

### 1. Postgres + Clerk projects

1. Create a Postgres database (recommended: [Neon](https://neon.tech) or Vercel Postgres).
2. Copy the Postgres connection string.
3. Create a Clerk app and configure your domain(s), then copy API keys from the Clerk Dashboard.
4. In `apps/api`, copy `.env.example` to `.env.local` and set:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   (You can use `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING` instead of `DATABASE_URL`.)
5. In `apps/expo`, copy `.env.example` to `.env` and set:
   - `EXPO_PUBLIC_API_URL` (e.g. `http://localhost:3001` for local)
   - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

Check connectivity and run migrations:

```bash
cd apps/api
npm run db:check
npm run db:migrate
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

Open the app and sign in with Clerk.

## Design (shadcn + nature theme)

The app uses the **nature** theme from [tweakcn](https://tweakcn.com/r/themes/nature.json): sage/green primary, warm neutrals, Montserrat/Merriweather. It’s applied in:

- **apps/api**: Tailwind + CSS variables in `src/app/globals.css`; shadcn is set up here for any Next.js pages.
- **apps/expo**: Design tokens in `apps/expo/src/theme.ts`; all screens use these for colors and type.

To add shadcn components or change the theme, run the CLI **from apps/api** (so Next.js is detected), not from the repo root:

```bash
cd apps/api
npx shadcn@latest add button
# or re-apply the nature theme:
npx shadcn@latest add https://tweakcn.com/r/themes/nature.json
```

## Scripts

| Command         | Description                  |
|-----------------|------------------------------|
| `npm run dev:api`   | Start Next.js API (port 3001) |
| `npm run dev:expo`  | Start Expo dev server        |
| `npm run build:api` | Build API for Vercel         |
| `npm run db:check -w api` | Verify database connectivity |
| `npm run build -w mobile` | Build Expo web (static export) |

## Web deployment (Vercel)

One Vercel project serves both the **API** and the **web app** (Expo web) at the same URL.

1. Create a Vercel project linked to this repo.
2. **Project Settings → General**: set **Root Directory** to `apps/api` (required; otherwise you get 404).
3. **Environment variables**: Copy `.env.vercel.example` to `.env.vercel`, fill in your values (`DATABASE_URL` or `POSTGRES_URL`, Clerk keys, and `EXPO_PUBLIC_API_URL` = your Vercel URL). Then in Vercel → **Settings → Environment Variables → Import**, upload your `.env.vercel` file. (`.env.vercel` is gitignored.)
4. Deploy. The build runs the Expo web export, copies it into the API app, then builds Next.js. Visiting `/` redirects to the web app; `/api/*` routes are the API.

**If you see 404 NOT_FOUND:** Set **Root Directory** to `apps/api`, then redeploy.

**If you still see the API page instead of the web app:**

1. **Check the build log** (Vercel → Deployments → latest → Building). You should see:
   - `Building Expo web...`
   - `Copying Expo web build to api/public...`
   If those lines are missing or there’s an error before them, the Expo web build didn’t run or failed (so `public/index.html` is missing and `/` can’t show the app).

2. **Install from repo root** so the Expo app has its dependencies. In **Settings → General**, set **Install Command** to:
   ```bash
   cd ../.. && npm install
   ```
   (With Root Directory `apps/api`, this runs install from the monorepo root so `apps/expo` can build.)

3. **Env vars for the Expo build** must be set in Vercel (Production): `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Without them, `expo export --platform web` can fail.

4. **Redeploy** after changing settings (and clear build cache if needed).

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
  api/       Next.js API (Clerk Auth + Postgres, Drizzle)
  expo/      Expo app (React Native + web), EAS Build config in eas.json
```
