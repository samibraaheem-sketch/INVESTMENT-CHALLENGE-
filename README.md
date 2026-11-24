# The Investment Challenge

A solo, ~10–15 minute training game for incubation managers and university
entrepreneurship club managers, built from the **Certified Incubation
Manager · Investment Module** deck. Five 100-point challenges (Funding
Match, Investor Detective, Startup Selection, Due Diligence Hunt, Pitch
Deck Rescue), 3 questions each (15 total, 500 points), a live countdown
and progress bar, immediate feedback, and a single shared, public
leaderboard.

Stack: **React + TypeScript + Tailwind CSS** (Vite), **Supabase**
(Postgres + RLS + RPC, no custom backend server), deployed on **Vercel**.

## How scoring and anti-cheat actually work

This is the part worth reading before you touch anything.

The browser is never trusted with the score. There is no answer key in the
JavaScript bundle, and the leaderboard table cannot be written to directly
by anyone — not even with a valid API key. Instead:

1. **`start_game_session(session_id, player_name)`** — called once, when a
   player clicks "Start Game." The server stamps a start time; this is the
   clock the 20-minute hard limit is measured against, not anything the
   browser reports.
2. **`submit_answer(session_id, question_id, answer)`** — called once per
   question (15 total across the 5 challenges, 3 each). The function looks up the
   correct answer in `question_answer_key`, a table the browser has **no
   grant to read at all**, grades the answer, and records it. The first
   answer recorded for a given question is the one that counts forever —
   resubmitting, or editing the request in devtools, cannot change it.
3. **`finish_game_session(session_id)`** — called once, at the end. It
   computes the final score as `SUM(points)` over the server's own graded
   records for that session (never a number the client sends), and the
   completion time from the server's own clock. It refuses to finish early
   unless every question has been answered — *unless* the 20-minute hard
   limit has already elapsed, in which case it finishes gracefully with
   whatever was genuinely answered. This is the **only** function allowed
   to write to the `leaderboard` table.

Row Level Security is deny-by-default on every table except a read-only
policy on `leaderboard`. `anon` and `authenticated` have **no** `INSERT`,
`UPDATE` or `DELETE` grant on anything — all writes happen inside
`SECURITY DEFINER` functions owned by `postgres`, which bypass RLS by
design (the standard, supported Supabase pattern for this). So:

- Editing the page or calling the leaderboard endpoint directly cannot
  insert a forged score — permission denied, verified against a live
  Postgres instance.
- Reading `question_answer_key` directly is refused the same way.
- A session cannot be "finished" with more points than it actually earned.

**What this does *not* defend against:** since the 15 questions are fixed
content (not drawn from a larger bank), a sufficiently motivated player
could play once just to read the correct-answer reveals, then play again
for a clean score. That is a content-size tradeoff, not a hole in the
write path — the leaderboard still only ever reflects server-graded
answers, never a client-asserted number. If this matters for your
audience, the fix is a larger item bank with random per-session sampling,
which the schema supports (just add more rows to `question_answer_key`
and sample `N` per challenge in `submit_answer`/the app).

This was all verified directly against a real local Postgres instance
(RLS denial, grading correctness, duplicate-submission locking,
incomplete-session rejection, and four sessions finishing **concurrently**
with correct score/tie-break ordering) — see "What was tested" below.

## Project layout

```
src/
  data/challenges.ts   Question text & options shown to players (no answers)
  lib/gameApi.ts        Thin wrapper around the 3 RPC calls + leaderboard read
  lib/supabase.ts        Supabase client (env-var driven)
  hooks/useGameState.ts  Game state machine + localStorage progress-only persistence
  components/            Welcome, ChallengeIntro, QuestionCard, GameHeader,
                          Results, Leaderboard, AdminLeaderboard, Finishing
supabase/schema.sql       Full DB schema: tables, RLS, grading functions, answer key
```

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough).
2. Open **SQL Editor** → paste the entire contents of `supabase/schema.sql` → **Run**.
   It's idempotent (safe to re-run) and seeds the full 37-item answer key.
3. Then paste and run `supabase/migrations/0002_trim_to_15_questions.sql`.
   This is what actually makes the game show 15 questions (3 per
   challenge, 100 pts each) instead of the full 37 — it trims the answer
   key down and rebalances points, without touching any table, RLS
   policy, or function. If you already had a project set up before this
   change, you only need to run this one migration file, not step 2 again.
4. Then paste and run `supabase/migrations/0003_20_minute_time_limit.sql`.
   This tightens the hard time limit from 30 minutes (1800s) to 20
   minutes (1200s) — both the point at which `submit_answer` stops
   accepting new answers and the point at which `finish_game_session`
   will finish an incomplete session early. Pure function/constraint
   logic, no data is deleted. Run migrations 0002 and 0003 in order on
   an existing project; both are safe to re-run.
5. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **Publishable key** (Supabase's current name for the old "anon
     public" key — same purpose, safe to ship to the browser, every
     access still goes through RLS). Never the **secret key**
     (the renamed `service_role` key) — that one must never reach the
     browser.
6. (Optional but recommended) In **Database → Replication**, enable
   realtime on the `leaderboard` table so the leaderboard updates live for
   everyone without waiting for the 15-second poll fallback.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The publishable key is safe to ship to the browser by design (that's what
RLS is for) — but it still belongs in an env var, not hardcoded, so it can
differ between local/staging/production without a code change.

```bash
npm install
npm run dev
```

Open the printed local URL, enter a name, and play through. Append
`?leaderboard` to the URL for a dedicated, read-only organizer view of the
full ranking (e.g. `http://localhost:5173/?leaderboard`) — project it on a
screen at a demo day.

## 3. Deploy to Vercel

```bash
npm i -g vercel   # if you don't have it
vercel
```

Or via the Vercel dashboard: **New Project → import this repo**. Vercel
auto-detects Vite. Before the first deploy, add the two env vars under
**Project Settings → Environment Variables** (Production, Preview, and
Development):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Then `vercel --prod` (or push to the connected branch). You'll get one
public URL — that's the link to hand to every participant. Everyone plays
the same URL independently and lands on the same shared leaderboard.

**Important:** Vite bakes `VITE_*` env vars into the build at *build time*,
not at request time. If you add or change these in the Vercel dashboard
*after* a deploy already happened, that existing deployment still has the
old (or missing) values — you must trigger a new deploy (**Deployments →
⋯ → Redeploy**, or push a commit) for the change to take effect. If you
ever see the welcome screen show a red "Game unavailable right now"
banner with the Start Game button disabled, this is almost always the
cause: the env vars either aren't set on Vercel, or were set after the
last build.

## What was tested

Docker wasn't available in the environment this was built in, so a real
Supabase CLI stack (which needs it) couldn't be spun up directly. Instead,
the schema was validated against an actual local Postgres 16 instance with
`anon`/`authenticated` roles created to mirror Supabase's own, which is
where the security properties above were actually exercised and proven,
not just asserted:

- `anon` denied read on `question_answer_key`, `game_sessions`, `game_answers`.
- `anon` denied direct `INSERT` into `leaderboard` (the exact "forged score" attack this was built to stop).
- A full honest playthrough via the RPC functions scores exactly 500/500, idempotently (finishing twice doesn't double-insert).
- Answering incorrectly scores 0 for that item; resubmitting the same question with the "now correct" value does **not** retroactively earn points — the first recorded result is final.
- Finishing with fewer than all 15 questions answered is rejected — unless the 20-minute server clock has elapsed, in which case it succeeds with the partial score.
- **Four simulated players finishing concurrently** (`500/500`, `500/500`, `400/500`, `160/500`, overlapping writes, no deadlocks) landed in the correct order, with the two tied-500 scores broken correctly by faster completion time.

The React app itself was then exercised end-to-end (via Playwright,
headless Chromium) against a small local mock of the Supabase REST surface
backed by that same verified Postgres database — not a mockup of the UI in
isolation, but the real grading path:

- Full 15-question playthroughs at both a **laptop viewport (1440×900)** and a **mobile viewport (iPhone 13 emulation)** — both reach `500/500`, "Investment Champion," finishing on exactly the 15th answer (verified after the 37→15 question-bank migration, including a simulated foreign-key conflict from pre-existing test data to prove the migration runs cleanly against a non-empty database).
- **Two simultaneous players, one on each viewport**, finishing at the same time — both land correctly on the one shared leaderboard.
- Refreshing mid-question resumes at the same question with progress intact (resume state only, never the score).
- A simulated dropped connection mid-answer shows a plain "Connection problem" message and recovers cleanly on the next click — no raw error text, no stuck UI.
- A simulated failure of the *final* score submission (twice, so the automatic retry also fails) shows a clear error with a "Try again" button, and recovers fully on manual retry.
- The countdown timer ticks live once a second even if the player isn't interacting, independent of the server-side 20-minute enforcement in `finish_game_session`.

What this setup could **not** cover without your actual Supabase project:
Realtime websocket delivery (the mock has no Realtime server, so this was
verified by code review + the polling/manual-refresh fallback, not a live
socket), and true multi-device testing over the public internet. Once you
deploy with real credentials, it's worth a quick manual check with two
phones/laptops open to the same URL at once to confirm Realtime pushes
leaderboard updates instantly rather than waiting for the 15s poll.

## Game content & scoring

- 5 challenges × 3 questions × 100 points = **500 points total**, roughly 10–15 minutes
  of play, hard-capped at 20 minutes (the game auto-finishes with whatever
  was answered if the clock runs out).
- 450–500: **Investment Champion** · 350–449: **Investment Ready** ·
  250–349: **Rising Incubator Manager** · below 250: **Needs More Practice**.
- All scenario content, terminology, funding stages, the nine investor
  lenses, the ten startup-selection criteria, the due-diligence checklist
  and the ten pitch-deck sections are drawn from the source "Certified
  Incubation Manager · Investment Module" deck. The specific startup
  vignettes (GreenCart, etc.) are illustrative wrappers written for the
  game; no MENA market figures or statistics were invented.

## Admin / organizer view

`https://your-deployed-url/?leaderboard` renders a full, read-only
ranking with no game UI — safe to leave open on a projector during a demo
day. It cannot be used to edit scores; it's the same read-only query every
player's results screen uses.
