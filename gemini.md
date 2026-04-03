# Gemini Development Guide

## Build & Development Commands
- **Full Dev Environment**: `npm run dev` (Runs both server and web concurrently)
- **Backend Only**: `npm run dev:server` (Starts `src/server.ts` with tsx watch)
- **Frontend Only**: `npm run dev:web` (Starts Vite dev server in `web/` folder)
- **Production Build**: `npm run build` (Compiles TypeScript in the root)
- **Frontend Build**: `cd web && npm run build`
- **Backend Deployment**: `npm run deploy` (Builds Docker image, pushes to GCR, and deploys to Cloud Run)

## Infrastructure & Redis
- **Provision Redis VM (GCP)**: `./scripts/deploy-redis.sh` (Allocates e2-micro instance on project `redditkeeperprod`)
- **Run Redis (on VM)**: Use `scripts/docker-compose.redis.yml` on the compute instance with `sudo docker compose up -d`.
- **Redis Connection**: Always check `REDIS_URL` in `.env`. Must start with `redis://`.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, BullMQ (Queueing), ioredis (Redis Client).
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Lucide Icons.
- **Marketing Site**: Astro, Tailwind CSS (in `marketing/`).
- **Analytics**: PostHog (Cloud).
- **Database/Auth**: Firebase (Firestore, Admin Auth, Storage).
- **AI**: Google Vertex AI / AI Studio (Gemini 2.0 Flash).

## Project Structure
- `src/`: Backend source code.
- `src/server.ts`: Main entry point and API route definitions.
- `src/reddit/`: Logic for interacting with Reddit and tree building.
- `src/server/discovery/`: Orchestration logic for Research/Discovery features.
- `web/`: Frontend React application.
- `scripts/`: Operational and deployment scripts.

## Rate Limiting (CRITICAL)
Always adhere to these limits to prevent service interruption:
- **Global API**: Managed via `rateLimiter.ts`. Anonymous users are capped at 15 req/min (increased from 5 to prevent false positives). Logged-in users have dynamic limits based on their plan (Free: 25, Beta: 40, Pro: 60).
- **Reddit/HN Syncing**: Strictly limited to 1 thread per second (`concurrency: 1`) in workers to avoid IP bans.
- **Thread IDs**: All stored threads use an MD5 hash of their URL as the primary Firestore ID to ensure consistent replacement of placeholders.

## Conventions & Rules
- **Queue Configuration**: BullMQ workers in `src/server.ts` use a `sharedConnectionConfig`.
- **Performance**: High-frequency intervals for `stalledInterval` (30s) and `drainDelay` (5s) are preferred when using the self-hosted Redis on GCP.
- **Security**: Never commit `.env` or `service-account.json`. Sensitive files are listed in `.gitignore`.
- **Surgical Edits**: Maintain existing functional logic (state mutations, event listeners) when refactoring. Always preserve rate-limiting middleware and worker concurrency settings.
- **Simplicity**: Favor simpler, readable code over complex abstractions.

## Architecture & Code Organization
- **Component Directory**: React components are located in `web/src/components`. Large feature sets (like Discovery) should have their own subdirectories.
- **Common Components**: If a component is used in 3+ places (e.g., `AuthButton`, `Skeleton`, `ThemeToggle`), it should be treated as a common component. Reuse existing styles and logic instead of duplicating.
- **File Splitting**: 
  - **Backend**: Avoid bloating `server.ts`. Move specific business logic to `src/server/` modules (like `ai.ts`, `firestore.ts`, `discovery/`).
  - **Frontend**: Break down massive components (e.g., `FolderDetail.tsx`) into smaller, focused sub-components. If a component exceeds 600 lines, it's a candidate for splitting.
- **Styles**: Keep CSS files adjacent to their components (`Component.tsx` + `Component.css`). Use Tailwind for utility-first styling.
- **Naming Conventions**:
  - Components: `PascalCase.tsx`
  - Logic/Utils: `camelCase.ts`
  - Constants: `SCREAMING_SNAKE_CASE`
## Features
### Discovery Workshop (Research Stepper 2.0)
- **Architecture**: A progressive 3-stage 'True Stepper' flow managed via `currentStep` (0, 1, 2) in `DiscoveryWorkbench.tsx`.
- **Stages**:
    - **Step 0 (Selection)**: Forced horizontal 3-column grid (`ResearchModeCards.tsx`) for mode choice.
    - **Step 1 (Context)**: Guided input framework (`DiscoveryInput.tsx`) with problem/audience focus.
    - **Step 2 (Results)**: Intelligence summary (`DiscoverySuccessView`) and interactive thread grid (`ResultGrid`).
- **Navigation Console**: Standardized top-right buttons ('Go Back' / 'New Research') providing a stable anchor across search stages.
- **Empty States**: `DiscoveryWorkflowGuide.tsx` provides visual onboarding when history is empty.
- **Loading UX**: `DiscoveryLoadingState.tsx` cycles through descriptive AI status messages to keep users engaged.

### Folder Management
- **Simplification**: Folder creation is restricted to 'Name Only' to reduce friction.
- **Onboarding**: Empty folders feature direct CTAs to the Discovery Workshop.

### Gated Registration & Verification
- **Invite Gating**: All new accounts require a valid code from the `invite_codes` collection.
- **Waitlist**: Users without a code can request access via a Formspark-integrated overlay in `LoginView.tsx`.
- **Verification Gate**: New users are redirected to `VerificationGate.tsx` until `emailVerified` is true. Status is automatically polled or manually refreshed.
- **Admin Portal**: A secure dashboard at `/admin` for authorized users (configured via `ADMIN_EMAILS`).
    - **Overview**: Real-time platform metrics and daily activity trends.
    - **User Management**: Tier management and usage tracking for all registered users.
    - **Beta Tokens**: UI-driven generation and tracking of multi-use invite codes.
    - **Waitlist**: Centralized management of Beta access requests.
    - **System Queues**: Real-time monitoring of BullMQ background workers (Sync, Granular, Analysis).

### Analytics (PostHog)
- **React App** (`web/`): Initialized in `web/src/lib/posthog.ts`, imported in `main.tsx`. SPA pageviews tracked via `useEffect` on `location.pathname` in `App.tsx`. Users identified by Firebase UID on login.
- **Marketing Site** (`marketing/`): Initialized via inline `<script>` in `Layout.astro` with auto pageview capture.
- **Env Vars**:
  - Web app: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` (in `web/.env`)
  - Marketing: `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST` (in `marketing/.env`)
  - Both projects share the same PostHog project key. Host defaults to `https://us.i.posthog.com`.
