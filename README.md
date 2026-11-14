# Sapience

Any YouTube lecture, turned into an interactive lesson. Team CodeCrushers, VentureX E-Summit '26 (PS3).

The source of truth is [`SAPIENCE_IMPLEMENTATION_PLAN.md`](./SAPIENCE_IMPLEMENTATION_PLAN.md). This README tracks setup, status and anything that differs from the plan.

## Status

| Phase | State |
|---|---|
| 0: Setup and spike | Not started. Needs accounts and keys (see below). `pnpm spike` expects `scripts/spike/run.ts`, which Phase 0 creates. |
| 1: Foundation, auth, schema | **Code complete.** `pnpm test:rls` passes on the local stack. Still needs a deployed preview. |
| 2: Lesson pipeline and lesson screen | **Code complete.** The job loop (dispatch → claim → run → fail/requeue) is verified locally. A full video lesson hasn't been built against a real video yet. |
| 3: Checkpoints and tutor | **Code complete.** Grading, the tutor (streaming, fallback, persistence) and "Check my understanding" are verified against live Gemini on the local stack. The clip path ("What's on the board?") needs a real video. |
| 4: Revision, search, recap | **Code complete.** Concepts, FSRS revision, AI search, recap and the due badge in the nav are verified on the local stack. |
| 5: Dashboard, settings, library, polish | **Code complete.** Settings, Library, featured lessons, Turnstile, the Section 10 states, the E2E test and the pipeline integration test pass locally. Still needs: a deployed preview, real featured lessons, and the production checks below. |
| 7: Study features | **Code complete.** Flashcards, adaptive quiz, weak spots with timestamps, saved moments, the pause check-in, study rooms (codes, QR, goals, classmates' progress) and the study calendar with Google Calendar sync. Typecheck, lint, unit, RLS and E2E tests pass on the local stack. Needs `supabase db push` and a check with a real video (see Phase 7 notes). |
| 6 (P1) | **Code complete for the hackathon.** Exam sheet, bring your own key (checked live with Gemini), add all key terms, admin usage page, personal notes and bookmarks, library filters and dashboard stats, and share link are verified locally. Whole-lecture questions (Gemini agentic video mode) are deferred. |

## Stack

Next.js 16 (App Router, Turbopack, Cache Components), React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui (Radix), Supabase (`@supabase/ssr`), AI SDK 7, Zod 4, Vitest, Playwright. Node ≥ 22, pnpm.

## Getting started

```bash
pnpm install
cp .env.example .env.local        # fill in values, see below
pnpm db:start                     # local Supabase (needs Docker)
pnpm db:reset                     # apply migrations + seed.sql
pnpm exec supabase status         # copy API URL, publishable key and secret key into .env.local
pnpm db:types                     # regenerate src/types/database.ts from the real schema
pnpm dev
```

The server validates its environment at boot (`src/instrumentation.ts` → `src/env.ts`) and refuses to start if a required value is missing. With the default setup A it needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `YOUTUBE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` and `INTERNAL_JOB_SECRET` (32+ characters: `openssl rand -hex 32`).

### Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
| `pnpm lint` | ESLint (Next core-web-vitals + TypeScript) |
| `pnpm test` | Unit tests (`tests/unit`) |
| `pnpm test:rls` | Tests that need the **local** Supabase stack: RLS and the job functions (`tests/rls`), and the lesson pipeline with a mock model (`tests/integration`). Refuses non-local URLs. |
| `pnpm test:e2e` | The Playwright end-to-end test (`tests/e2e`), on the local stack. See below. |
| `pnpm db:start` / `db:stop` / `db:reset` / `db:types` | Supabase CLI |

### End-to-end test

`pnpm test:e2e` signs in as a guest, opens the seeded fixture lesson, answers a checkpoint wrong, saves it, checks the recap, makes the concept due (a local-only test helper), reviews it as Good, and checks the due date moved forward. It calls no AI endpoint.

It needs the local stack with `seed.sql` applied, and `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SECRET_KEY` in the environment (Playwright doesn't read `.env.local`). By default it builds and starts a production server on port 3517, so it never touches `pnpm dev` on 3000. To reuse a server you started, set `E2E_BASE_URL=http://localhost:3517`. To use an installed browser instead of `pnpm exec playwright install chromium`, set `PLAYWRIGHT_CHANNEL=msedge` or `chrome`.

## Manual setup still required

Nothing external is connected yet. Each of these needs a person with the account:

1. **Docker Desktop**, for the local Supabase stack (`pnpm db:start`, `pnpm test:rls`, `pnpm test:e2e`).
2. **Supabase project** (free plan). Link it with `pnpm exec supabase link`, then `pnpm exec supabase db push`. In Auth settings, enable **Anonymous sign-ins** and **Manual linking**, and add `https://<prod-domain>/auth/callback` and `http://localhost:3000/auth/callback` to the redirect URLs.
3. **Google OAuth client** (Google Cloud → Credentials → Web client).
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` and, for local, `http://127.0.0.1:54321/auth/v1/callback`.
   - Put the client ID and secret into Supabase Auth → Google.
   - For local, export `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` before `pnpm db:start`.
4. **YouTube Data API v3 key**, restricted to that API.
5. **Gemini API key** from Google AI Studio (free tier, no billing).
6. **Vercel project.** Set the env vars from `.env.example`, and enable "Protection Bypass for Automation" (job dispatch, Phase 2).
7. **Turnstile (optional, recommended for production).** Create a widget in Cloudflare → Turnstile (mode "Managed", add the production domain and `localhost`). Put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and in Supabase → Authentication → Attack Protection enable CAPTCHA protection with provider Turnstile and the **secret** key. Set both together: once Supabase captcha is on, every sign-in, sign-up and guest sign-in without a token is rejected.
8. **Featured lessons.** Add real public, embeddable lectures to `src/config/featured.ts`, then open each once in its language to build it. Only `ready` ones are shown.

## Phase 1 notes and deviations

- **Cache Components is on** (the Next 16.4 default from `create-next-app`). Anything that reads cookies or `searchParams` renders inside `<Suspense>`, so pages ship a static shell and stream the user-specific parts. `/app` waits for a server-side `getClaims()` check (`AuthGate` in `src/app/app/layout.tsx`) before rendering, in addition to the redirect in `src/proxy.ts`.
- **CSP is a header, without nonces** (`next.config.ts`). Nonce-based CSP forces dynamic rendering and is incompatible with Partial Prerendering. So `script-src` allows `'unsafe-inline'`, as the Next.js CSP guide recommends for this case. Experimental SRI is the upgrade path if a stricter policy is needed.
- **`src/types/database.ts` is hand-written** in the `supabase gen types` format, because the local stack couldn't run. Regenerate it with `pnpm db:types` as soon as Docker is available.
- **SQL was verified without Docker.** The migrations and `seed.sql` were applied to PGlite (Postgres 17 compiled to WASM) with a stand-in for Supabase's `auth` schema and roles. SQL-level checks then confirmed:
  - two users plus a guest can't read or write each other's rows;
  - none of them can read server-only tables or execute the service-role functions;
  - `consume_quota` stops at its limit;
  - the fixture lesson saves through `save_full_lesson`.

  `pnpm test:rls` covers the same ground through the real Supabase API and **has not been run yet**.
- **Extra functions:**
  - `mark_chapters_failed(lesson_id, positions[])` keeps chapter counters correct when a chapter job gives up.
  - `refresh_lesson_counters` is an internal helper.

  Both are service-role only, like the four functions in Section 7.3.
- **Lesson completion rule:** a lesson is `ready` once every chapter is ready or failed and at least one is ready. It is `failed` if every chapter failed.
- **Seed fixture:** one hand-written 3-chapter lesson with `source = 'fixture'`. It uses the placeholder video ID `FIXTURE0001`, so the player will report the video as unavailable. Before the Phase 5 E2E test, replace it with a real public, embeddable lecture of at least 10 minutes.
- **Guest upgrade** (`/signup` while signed in as a guest) calls `updateUser({ email, password })`. If the project requires email verification before a password can be added to an anonymous user, it falls back to linking the email first. The user then sets a password from Settings. Google upgrade uses `linkIdentity`.
- **Navigation** has Home, Library and Revision; Settings is in the account menu.
- **The dashboard paste box is disabled.** It says lesson building isn't connected yet; that comes in Phase 2. The continue-learning list and due-review count are real queries, empty until those features exist.
- **Turnstile** was added in Phase 5 (see below).

## Design

- **Direction:** a dark lecture hall. Near-black slate and chalk-white type on a graphite ramp (no hue), with one highlighter-yellow accent (`--brand`, `#F5CF4A` dark / `#C08F00` light). The accent is spent only on the checkpoint diamond, the playhead, progress, the current selection and focus. Primary buttons are chalk on dark, ink on light. Dark is the default theme; light and "match my device" are in the account menu.
- **Type:** Geist for everything, Geist Mono for timestamps, counts and figures. No serif.
- **Signature:** the yellow checkpoint diamond (on the chapter timeline, the logo tile and every checkpoint) and mono timestamp chips.
- **App shell:** inset, icon-collapsible sidebar (Efferd `app-shell-4`); the sidebar folds to icons on lesson pages. Pages open with `PageHeader` (`src/components/layout/page-header.tsx`).
- **Marketing:** a React Bits `GradientWaves` shader (graphite swells with highlighter-yellow crests) behind the hero and a live lesson window that plays once; React Bits `Threads` behind the closing call to action and the sign-in panel.
- Tokens live in `src/app/globals.css`, including the lecture-board colours (`--board`, `--chalk`) and the easing curves (`--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`).

### Icons

[Material Symbols](https://fonts.google.com/icons) (Rounded, weight 400) via `@material-symbols-svg/react`. Every icon is re-exported from `src/components/icons.ts`. Import from there, never from the package directly, so the set stays in one style. Icons render at 18px (`size-4.5`) in the colour of the text beside them.

`components.json` still says `"iconLibrary": "lucide"` because the shadcn CLI has no Material option. Any component added with `shadcn add` will import `lucide-react`. Swap those imports for `@/components/icons` and don't install lucide.

### Motion

- Animation is used to explain something (the landing-page lesson preview) or to give feedback: buttons scale to 0.97 when pressed, accordions and the stepper move with `--ease-out`.
- Shared helpers in `src/components/motion/`: `MorphText` (a button label blurs into its next state), `Reveal` (marketing sections rise in once on scroll), `CountUp` (figures tween once). Selected surfaces morph between items with Motion `layoutId` (sidebar nav, `MorphTabsList` in `src/components/ui/morph-tabs.tsx`).
- Each page has one entrance: the `.enter` class (fade, 8px rise, blur) with a `--i` stagger.
- UI transitions stay under 300ms, nothing loops, and hover effects are limited to `@media (hover: hover)`.
- With `prefers-reduced-motion`, the preview jumps straight to its end state and the stepper fades instead of sliding.

### Component sources

Both registries are set up in `components.json`. Each component was installed with the shadcn CLI and then adapted to these tokens.

| Where | Component | Source |
| --- | --- | --- |
| Signed-in shell | `src/components/layout/app-sidebar.tsx`, `src/app/app/layout.tsx` | Efferd `@efferd/app-shell-4` (shadcn `sidebar`) |
| Landing hero shader | `src/components/reactbits/gradient-waves.tsx` | ReactBits `@react-bits/GradientWaves-TS-TW` |
| CTA and sign-in shader | `src/components/reactbits/threads.tsx` | ReactBits `@react-bits/Threads-TS-TW` |
| Landing features | `src/components/efferd/feature-section.tsx` | Efferd `@efferd/features-6` |
| Sign-in / sign-up | `src/app/(auth)/layout.tsx` | Efferd `@efferd/auth-2` |
| Closing call to action | `src/components/efferd/cta-section.tsx` | Efferd `@efferd/cta-4` |
| Onboarding, three questions | Stepper (`src/components/reactbits/stepper.tsx`) | [ReactBits](https://reactbits.dev) `@react-bits/Stepper-TS-TW` |
| Landing page FAQ | `src/components/efferd/faqs-section.tsx` | [Efferd](https://efferd.com) `@efferd/faqs-7` |
| Public-page footer | `src/components/efferd/site-footer.tsx` | Efferd `@efferd/footer-1` |
| 404 page | `src/app/not-found.tsx` with `full-width-divider.tsx` | Efferd `@efferd/not-found-1` |

Design rules follow Anthropic's frontend-design skill, Emil Kowalski's [design-engineering skill](https://emilkowal.ski/skill) and [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky (@heydamir), CC BY 4.0.

## Phases 2–4 notes and deviations

- **Migrations.** `20261113000004_jobs.sql` adds the job functions (claim with an advisory lock and a concurrency cap, requeue, fail with retries, save outline/batches). It is applied locally only. Push it to the remote project with `pnpm exec supabase db push`.
- **Capacity errors fall back.** A rate limit (429) *and* an overloaded model (503 `UNAVAILABLE` / "high demand", 529) move to the next model in the chain. When the whole chain is busy, jobs requeue with backoff and the student sees "Waiting for free AI capacity". Gemini returned "high demand" 503s often during testing.
- **Tutor timeouts.** The SDK's first-chunk timer only starts once the response begins, and an overloaded model held a connection open for 150 s. The tutor therefore enforces its own first-text deadline per attempt (15 s with a clip, 30 s without), then cancels the attempt and tries the next model.
- **No prompts in logs.** `streamText` would log the whole failed request by default, including the student's question and the lecture text. The tutor records only a safe error code in `ai_calls`.
- **Prompt injection.** Every untrusted text placed into a prompt (lecture index, notes, pasted text, the question, transcripts) goes through `fence()` in `src/lib/ai/context-packet.ts`, so it can't close its own delimiter tag.
- **FSRS.** `ts-fsrs` v6 deprecates `fsrs()`. Revision uses `DefaultScheduler({ version: "FSRS-7", desiredRetention: 0.9, enableFuzz: false })` (`src/config/revision.ts`). Cards are stored as JSON with ISO dates and revived before each review. A newly saved concept is first due a day later.
- **Explanations stay hidden.** Saving a checkpoint concept fills in its explanation only if the student has already attempted that question, because the explanation reveals the answer.
- **Search.** Times and snippets always come from the lesson. The model only picks segment or key-moment IDs (`c{chapter}s{n}`, `c{chapter}m{n}`), and any ID it invents is dropped.

## Phase 5 notes and deviations

- **No new migration.** Settings, Library and account deletion use existing tables and RLS policies. Account deletion uses the admin API and only ever deletes the caller; every user table cascades from `auth.users`.
- **Featured lessons** come from `src/config/featured.ts` (empty until real lectures are chosen). Lessons with `source = 'fixture'` are listed too, labelled "Test fixture"; they only exist where `seed.sql` ran (the local stack), since `supabase db push` doesn't run seeds.
- **Library "opened" lessons.** Opening a lesson now records a `lesson_progress` row at 0:00 (never overwriting a saved position), so a lesson shows in Continue learning and the Library before anything plays.
- **Turnstile** renders invisibly and runs only when an auth form is submitted, so pages that never sign anyone in don't load Cloudflare. A challenge appears only when Cloudflare asks for one.
- **E2E deviation.** The plan's test plays the video to a checkpoint. The fixture's placeholder video can't play, so the test opens the checkpoint from the chapter list (auto-pause turned off in Settings). Auto-pause timing is covered by the unit tests for `crossedCheckpoint`; check it by hand with a real video.
- **Touch targets.** The small `xs`/`sm` buttons keep their look but get an invisible 44 px hit area on touch screens.
- **Phone header.** Below 640 px the wordmark shows only its diamond so Home, Library and Revision fit at 375 px.

## Phase 6 (P1) notes

- **New migration** `20261114000001_byok.sql`: `create_lesson` and `restart_lesson` take `p_byok_user_id`, and a trigger lets chapter jobs inherit it only while the outline job that creates them is running (so a later chapter retry by someone else never spends the first student's key). Push it with `pnpm exec supabase db push`.
- **Bring your own key.** Set `BYOK_ENCRYPTION_KEY` to enable Settings → "Your own AI key". The key is checked with one small call, stored AES-256-GCM encrypted, and only its last 4 characters ever reach the browser. Requests run on it through an `AsyncLocalStorage` scope in `src/lib/ai/provider.ts`, so the key never sits on a `ModelSpec`, a log line or a response. With a key, the student's tutor, search, checks and lesson builds skip Sapience's daily limits, and a busy personal key never falls back to the app's key. `ai_calls.byok` records which calls used one. Never change `BYOK_ENCRYPTION_KEY` once keys are stored.
- **Exam sheet** at `/app/lesson/<id>/sheet?lang=…` (linked from the lesson header and the recap): overview, formulas, checkpoints you missed on the first try (with answers, since you've attempted them), notes by chapter, your own notes and saved concepts. Print or "Save as PDF" gives ink on paper even from dark mode.
- **Add all key terms** (recap) saves up to 40 key terms as concepts. Their answer side is the chapter summary, which the lesson already shows.
- **Admin usage** at `/app/admin/usage` for emails in `ADMIN_EMAILS` (others get the 404 page): calls, success rate, tokens and model time by kind, model and lesson, from `ai_calls`.
- **Notes and bookmarks**: the lesson's "Mine" tab. They're private (RLS) and appear on the exam sheet.
- **Share** copies `/app/lesson/<id>?lang=…`. A signed-out recipient goes to sign-in, and "Try a lesson without an account" now returns them to that lesson.

## Phase 7 notes: study features

New migration `20261115000001_study_features.sql`. Push it with `pnpm exec supabase db push`. It adds `weak_spots`, `quiz_sessions` and `lesson_flashcards` (both server-only), `study_rooms`, `room_members`, `room_goals`, `room_goal_checks`, `study_events`, `calendar_feeds`, and `lesson_progress.furthest_seconds`. It also adds the room functions (`create_room`, `join_room`, `rotate_room_code`, `room_progress`, `room_activity`, `video_peers`) and the `quiz` and `flashcards` AI call kinds.

### Where things live (so the lesson screen stays calm)

- **Sidebar:** Study (Home, Library, Revision, Calendar) and Together (Study rooms).
- **Lesson study panel:** four tabs, each with at most two views:
  - Notes: chapter notes · find in lecture
  - Tutor
  - Practice: Check yourself (quiz) · Flashcards
  - Mine: weak spots · notes & moments
- **Under the player:** one slim row with Save moment (or press B), Mark as confusing, and classmates on this lecture. While you revise weak spots it shows that playlist. During a break it shows the countdown. The pause check-in appears just below it.
- **Timeline:** weak spots are tinted red on the chapter track, and saved moments are small dots under it.

### Features

- **Flashcards** (Practice → Flashcards), for one chapter or the whole lecture. Each chapter's deck is generated once (lite model, up to 3 chapters per call) and shared by everyone, like the lesson. Making missing decks counts as one AI request.
  - If the AI is busy, a basic deck is built from key terms and formulas. It isn't saved, so the next try gets a full deck.
  - Studying: Space flips, ← is "still learning", → is "know it". The still-learning cards come back for a second round, and any of them can be saved for spaced revision.
- **Check yourself** (adaptive quiz), rules in `src/lib/quiz/engine.ts`. Topics are chapters. A topic starts at level 2 of 4 (Recall, Understand, Apply, Challenge).
  - Right answer: the next question is one level harder. Right at level 4: the topic is solid.
  - Wrong answer: an easier question on the same idea, written to address the mistake.
  - A topic ends after three misses ("rewatch"), and never straight after a single miss.
  - A whole-lecture quiz takes up to 6 chapters, weak ones first.
  - The state is server-side (`quiz_sessions`), so the browser can't choose its level. Questions are `questions` rows with source `quiz`, graded by the same `gradeAttempt`.
  - Each question is grounded in a lecture-index segment (only IDs from the index are accepted), so a wrong answer becomes a weak spot with an exact time range.
  - The next question is written while you read the explanation. Each question counts as one AI request.
- **Weak spots** (Mine → Weak spots) come from four signals: wrong checkpoints, wrong quiz answers, doubts raised at a pause, and "Mark as confusing".
  - They're grouped by chapter, ranked (marked 3, checkpoint or quiz 2, doubt 1), and their ranges merged. Each topic lists its timestamps.
  - "Revise all" or "Rewatch" plays only those ranges back to back. "Quiz me on this" starts a chapter quiz. "Got it now" resolves the topic, and a solid quiz topic resolves that chapter's quiz and checkpoint spots.
- **Saved moments** are the existing bookmarks (`notes.kind = 'bookmark'`), now with an optional label and saved from under the player.
- **Pause check-in.** About a second after you pause (not when a checkpoint pauses the video, and not in the last 5 seconds), Sapience asks why:
  - **Doubt:** the tutor answers your question, or explains the last minute, and that part becomes a weak spot.
  - **Distracted:** rewind 30 s. From the third time in a sitting it suggests a 5-minute break with a timer.
  - **Taking notes:** opens the note box at that time.
  - **Need a break:** saves your spot, offers the timer, and can add "Finish this lecture" to your calendar (in an hour, tonight or tomorrow) with an "Add to Google Calendar" link.
  - Turn it off for one lecture from the card, or everywhere in Settings ("Ask why I paused").
- **Study rooms** (`/app/rooms`). Create a room and share its 6-character code (no look-alike characters), the invite link, or a QR code. Join by typing the code, opening the link, or scanning with your phone's camera app or the in-app scanner (`jsqr`; `Permissions-Policy` now allows `camera=(self)`).
  - Goals: watch a lecture or anything custom, with an optional due date. Lecture goals show each member's progress from the furthest point they actually played (seeking ahead doesn't count) and are done at 90% or when ticked.
  - The room page also shows who's studying now (active in the last 2 minutes) and an activity feed.
  - In a lesson, classmates on the same lecture appear under the player: how far each got and chapters finished.
  - Owners can issue a new code, remove members and delete the room. Up to 50 members per room and 20 rooms per owner.
  - Rooms read only what `room_progress` and `video_peers` expose: positions on goal lectures and on the lecture you're watching. Nobody sees another student's answers, notes or weak spots.
- **Calendar** (`/app/calendar`): plan study sessions linked to a lecture and timestamp. The month view also shows room goal due dates and how many revision concepts are due each day.
  - **Google Calendar sync** works through a private iCalendar subscription URL (`/api/calendar/feed/<token>.ics`; in Google Calendar: Settings → Add calendar → From URL). Each session also has a one-click "Add to Google Calendar" link.
  - Why not Google sign-in: the Calendar API needs the sensitive `calendar.events` scope, Google's app verification and stored refresh tokens. The feed needs none of that.
  - Google re-reads subscribed calendars every few hours, so changes aren't instant.
  - The feed URL must be public: set `NEXT_PUBLIC_APP_URL` to the deployed domain (the dialog warns when it's localhost).
  - "Reset link" replaces the token.

### Local stack note

The local database's migration history doesn't list `20261114000001_byok.sql` even though its changes are applied, so `supabase migration up` stops on it. The study-features migration was applied locally with `psql`. `pnpm db:reset` rebuilds the local database cleanly but wipes local data. `tests/rls/study.test.ts` and `tests/rls/rooms.test.ts` cover the new tables.

### Still to check by hand, with a real video

- [ ] Pause the video yourself → the check-in appears; a checkpoint pause doesn't trigger it
- [ ] Doubt → the tutor answers and a red range appears on the timeline
- [ ] Quiz: right answers climb levels, and a wrong one brings an easier follow-up
- [ ] Flashcards for the whole lecture
- [ ] Revise all plays only the weak ranges
- [ ] Two accounts in a room see each other under the player
- [ ] Scan the room QR code with a phone
- [ ] Subscribe to the feed in Google Calendar from the deployed domain

## Measured numbers

_Filled in by the Phase 0 spike (Section 5.5): free-tier rate limits, fps behaviour on YouTube URLs, outline/chapter/full-pass wall time and tokens, tutor time-to-first-token._

## Manual test checklist (beyond the E2E test)

- [ ] Email sign-up → onboarding → dashboard; sign out; sign in again
- [ ] Google sign-in (local and production domain)
- [ ] "Try without an account" → dashboard shows the guest banner → `/signup` upgrades the same user
- [ ] Signed-out `/app` redirects to `/login?next=/app`, and signing in returns to `/app`
- [ ] Light and dark themes; 375 px width; keyboard focus visible everywhere
- [ ] Lesson: the video pauses at a checkpoint; a wrong answer → Explain differently → the tutor answers with chips; Continue resumes
- [ ] With "Pause for checkpoint questions" off, checkpoints open from the diamond in the chapter list
- [ ] Tutor: Stop, Retry and Edit question; New chat; the conversation survives a reload; "Check my understanding" under long answers
- [ ] Search: matches show as you type; Ask finds a passage from a question in another language
- [ ] Save for revision (checkpoint, tutor answer, chapter) → `/app/revision` the next day → rate → the interval matches the button
- [ ] With a real video: the video pauses at the end of a chapter for its checkpoint
- [ ] Settings: change preferences and reload; set a password; delete tutor history; delete a test account
- [ ] Library: remove a saved concept; it disappears from revision too
- [ ] With Turnstile configured: guest, email sign-in and sign-up all pass the check
