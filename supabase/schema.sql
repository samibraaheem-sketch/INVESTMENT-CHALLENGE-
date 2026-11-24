-- ============================================================================
-- The Investment Challenge — Supabase schema
-- ============================================================================
-- SECURITY MODEL (read this before changing anything)
--
-- The game is graded on the server, not the browser. The browser never
-- receives a correct-answer key and never computes the score that gets
-- saved. Instead:
--
--   1. start_game_session()  - server mints a session row and a server
--                               timestamp (the game clock starts here).
--   2. submit_answer()       - for EVERY question, the browser sends the
--                               player's raw choice. This function looks the
--                               correct answer up in `question_answer_key`
--                               (a table the browser can never read) and
--                               records whether it was right and how many
--                               points it is worth. The first answer for a
--                               given question is the one that counts -
--                               resubmitting cannot change it.
--   3. finish_game_session() - refuses to finish early unless every question
--                               has been answered OR the 30-minute hard time
--                               limit has elapsed (so a timeout still ends
--                               gracefully with whatever was answered), then
--                               computes the final score as SUM(points) over
--                               the *server's own* records, and the
--                               completion time from the server's own clock.
--                               Only this function is allowed to write to
--                               `leaderboard`.
--
-- Because of this, a player cannot change their score by editing the page,
-- calling the API directly, or tampering with localStorage — the only two
-- numbers that ever reach the leaderboard (score, completion_time_seconds)
-- are computed from data the server itself recorded.
--
-- Run this whole file once in the Supabase SQL editor (or via the CLI:
-- `supabase db push` / `psql ... -f supabase/schema.sql`) on a fresh
-- project. It is written to be re-run safely (DROP ... IF EXISTS guards).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

drop table if exists public.leaderboard cascade;
drop table if exists public.game_answers cascade;
drop table if exists public.game_sessions cascade;
drop table if exists public.question_answer_key cascade;

create table public.game_sessions (
  id uuid primary key,
  player_name text not null check (char_length(trim(player_name)) between 1 and 40),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  submitted boolean not null default false
);

create table public.question_answer_key (
  question_id text primary key,
  challenge text not null,
  correct_answer jsonb not null,
  points integer not null check (points > 0),
  explanation text not null
);

create table public.game_answers (
  id bigserial primary key,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  question_id text not null references public.question_answer_key(question_id),
  is_correct boolean not null,
  points_awarded integer not null,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create table public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.game_sessions(id),
  player_name text not null check (char_length(trim(player_name)) between 1 and 40),
  score integer not null check (score >= 0 and score <= 500),
  completion_time_seconds integer not null check (completion_time_seconds > 0 and completion_time_seconds <= 1800),
  created_at timestamptz not null default now()
);

create index leaderboard_rank_idx on public.leaderboard (score desc, completion_time_seconds asc, created_at asc);
create index game_answers_session_idx on public.game_answers (session_id);

-- ----------------------------------------------------------------------------
-- Row Level Security — deny-by-default on everything except a public,
-- read-only view of the leaderboard. All writes go through the SECURITY
-- DEFINER functions below, which run as the table owner (postgres) and
-- therefore bypass RLS; the API roles (anon/authenticated) are never
-- granted INSERT/UPDATE/DELETE on any table directly.
-- ----------------------------------------------------------------------------

alter table public.game_sessions enable row level security;
alter table public.question_answer_key enable row level security;
alter table public.game_answers enable row level security;
alter table public.leaderboard enable row level security;

revoke all on public.game_sessions from anon, authenticated;
revoke all on public.question_answer_key from anon, authenticated;
revoke all on public.game_answers from anon, authenticated;
revoke all on public.leaderboard from anon, authenticated;

grant select on public.leaderboard to anon, authenticated;

create policy "leaderboard is publicly readable"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

-- No policies at all are created for game_sessions, question_answer_key, or
-- game_answers, and no table privileges are granted on them to anon /
-- authenticated. With RLS enabled and zero policies, every row is denied to
-- those roles for every operation. This is intentional, not an omission.

-- ----------------------------------------------------------------------------
-- Functions (the only way the browser can touch game state)
-- ----------------------------------------------------------------------------

-- Starts (or resumes) a session. The browser proposes a session id (a v4
-- uuid it generates when the player clicks "Start"); the server owns the
-- clock from here on. Resuming after a refresh returns the original
-- started_at rather than resetting it, so the timer can't be rolled back
-- by reloading the page.
create or replace function public.start_game_session(p_session_id uuid, p_player_name text)
returns table (session_id uuid, started_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_player_name);
begin
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'invalid player name';
  end if;

  insert into public.game_sessions (id, player_name)
  values (p_session_id, v_name)
  on conflict (id) do nothing;

  return query
  select gs.id, gs.started_at
  from public.game_sessions gs
  where gs.id = p_session_id;
end;
$$;

-- Grades one answer. Returns whether it was correct, the points it earned,
-- and the explanation text — but never the identity of the correct option
-- beyond what the player can already infer from being told right/wrong,
-- except via correct_answer which is only revealed for THAT question AFTER
-- an attempt has been recorded. Re-submitting the same question_id simply
-- replays the first recorded result; it cannot change the score.
create or replace function public.submit_answer(p_session_id uuid, p_question_id text, p_answer jsonb)
returns table (is_correct boolean, points_awarded integer, explanation text, correct_answer jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions;
  v_key public.question_answer_key;
  v_is_correct boolean;
  v_points integer;
  v_existing public.game_answers;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if v_session is null then
    raise exception 'unknown session';
  end if;
  if v_session.submitted then
    raise exception 'session already finished';
  end if;
  if now() - v_session.started_at > interval '1800 seconds' then
    raise exception 'time limit exceeded';
  end if;

  select * into v_existing from public.game_answers
  where session_id = p_session_id and question_id = p_question_id;

  if v_existing is not null then
    select qak.explanation, qak.correct_answer into explanation, correct_answer
    from public.question_answer_key qak where qak.question_id = p_question_id;
    is_correct := v_existing.is_correct;
    points_awarded := v_existing.points_awarded;
    return next;
    return;
  end if;

  select * into v_key from public.question_answer_key where question_id = p_question_id;
  if v_key is null then
    raise exception 'unknown question';
  end if;

  v_is_correct := (p_answer = v_key.correct_answer);
  v_points := case when v_is_correct then v_key.points else 0 end;

  insert into public.game_answers (session_id, question_id, is_correct, points_awarded)
  values (p_session_id, p_question_id, v_is_correct, v_points)
  on conflict (session_id, question_id) do nothing;

  is_correct := v_is_correct;
  points_awarded := v_points;
  explanation := v_key.explanation;
  correct_answer := v_key.correct_answer;
  return next;
end;
$$;

-- Finishes a session: refuses unless every question in the answer key has
-- been answered, then writes the leaderboard row using ONLY server-derived
-- numbers (sum of recorded points; server clock for elapsed time). Safe to
-- call more than once (idempotent on session_id).
create or replace function public.finish_game_session(p_session_id uuid)
returns table (
  out_rank integer,
  out_score integer,
  out_completion_time_seconds integer,
  out_player_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions;
  v_total_questions integer;
  v_answered_questions integer;
  v_score integer;
  v_elapsed integer;
  v_existing public.leaderboard;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if v_session is null then
    raise exception 'unknown session';
  end if;

  select * into v_existing from public.leaderboard where session_id = p_session_id;
  if v_existing is not null then
    select count(*) into out_rank from public.leaderboard lb
    where lb.score > v_existing.score
       or (lb.score = v_existing.score and lb.completion_time_seconds < v_existing.completion_time_seconds);
    out_rank := out_rank + 1;
    out_score := v_existing.score;
    out_completion_time_seconds := v_existing.completion_time_seconds;
    out_player_name := v_existing.player_name;
    return next;
    return;
  end if;

  select count(*) into v_total_questions from public.question_answer_key;
  select count(*) into v_answered_questions from public.game_answers where session_id = p_session_id;

  if v_answered_questions < v_total_questions and (now() - v_session.started_at) < interval '1800 seconds' then
    raise exception 'session incomplete: % of % questions answered', v_answered_questions, v_total_questions;
  end if;

  select coalesce(sum(points_awarded), 0) into v_score
  from public.game_answers where session_id = p_session_id;

  v_elapsed := greatest(1, least(1800, extract(epoch from (now() - v_session.started_at))::integer));

  update public.game_sessions
  set submitted = true, finished_at = now()
  where id = p_session_id;

  insert into public.leaderboard (session_id, player_name, score, completion_time_seconds)
  values (p_session_id, v_session.player_name, v_score, v_elapsed)
  on conflict (session_id) do nothing;

  select count(*) into out_rank from public.leaderboard lb
  where lb.score > v_score
     or (lb.score = v_score and lb.completion_time_seconds < v_elapsed);
  out_rank := out_rank + 1;
  out_score := v_score;
  out_completion_time_seconds := v_elapsed;
  out_player_name := v_session.player_name;
  return next;
end;
$$;

grant execute on function public.start_game_session(uuid, text) to anon, authenticated;
grant execute on function public.submit_answer(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.finish_game_session(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Answer key — the 37 graded items across the 5 challenges (100 pts each
-- challenge, 500 total). Content and terminology follow the "Certified
-- Incubation Manager · Investment Module" source deck; see src/data in the
-- app for the exact question text/options shown to players. Nothing here
-- is reachable by the browser (see REVOKE above).
-- ----------------------------------------------------------------------------

insert into public.question_answer_key (question_id, challenge, correct_answer, points, explanation) values
-- Challenge 1: Funding Match (10 items, 10 pts each = 100)
('fm1_stage', 'funding_match', '"pre_seed"', 10, 'Pre-seed money takes the idea beyond its first phase into a viable product — typically friends, family and individual investors.'),
('fm1_source', 'funding_match', '"bootstrapping"', 10, 'Personal savings and support from people close to the founders is bootstrapping.'),
('fm2_stage', 'funding_match', '"seed"', 10, 'Seed funding is for scaling the product and expanding the team.'),
('fm2_source', 'funding_match', '"angel"', 10, 'Angel investors — high-net-worth individuals investing their own money, often with mentorship — are typical seed-stage money.'),
('fm3_stage', 'funding_match', '"series_a"', 10, 'Series A follows proven potential and traction, funding product development, marketing and more customers.'),
('fm3_source', 'funding_match', '"vc"', 10, 'Venture capital firms usually lead the round at Series A.'),
('fm4_stage', 'funding_match', '"series_b_plus"', 10, 'Series B+ funds continued growth through later rounds (B, C, D and on).'),
('fm4_source', 'funding_match', '"pe"', 10, 'At this stage, larger VCs, private equity and sometimes corporate investors are typical.'),
('fm5_stage', 'funding_match', '"seed"', 10, 'The module lists crowdfunding as a funding type that sometimes appears at the Seed stage.'),
('fm5_source', 'funding_match', '"crowdfunding"', 10, 'Many individuals giving small amounts through an online platform is crowdfunding.'),

-- Challenge 2: Investor Detective (10 items, 10 pts each = 100)
('id1_lens', 'investor_detective', '"traction"', 10, 'Paying customers and renewal rates are evidence of traction.'),
('id1_sw', 'investor_detective', '"strength"', 10, '200 paying customers with an 85% monthly renewal rate is a strength.'),
('id2_lens', 'investor_detective', '"founding_team"', 10, 'Founders'' relevant experience and track record is assessed under the founding team lens.'),
('id2_sw', 'investor_detective', '"strength"', 10, 'Ten years of combined, relevant experience leading teams is a strength.'),
('id3_lens', 'investor_detective', '"financial_health"', 10, 'Whether the numbers work per sale or customer is financial health and unit economics.'),
('id3_sw', 'investor_detective', '"weakness"', 10, 'Losing money on every order is a unit-economics weakness.'),
('id4_lens', 'investor_detective', '"competitive_advantage"', 10, 'What sets a startup apart from competitors is its competitive advantage.'),
('id4_sw', 'investor_detective', '"weakness"', 10, 'Larger, lower-priced competitors already dominating the market is a weakness.'),
('id5_lens', 'investor_detective', '"scalability"', 10, 'Whether the business can grow into new markets or segments is scalability.'),
('id5_sw', 'investor_detective', '"weakness"', 10, 'Being confined to one neighborhood with no expansion plan is a scalability weakness.'),

-- Challenge 3: Startup Selection (8 items; decisions 15 pts, flags 10 pts = 100)
('ss1_decision', 'startup_selection', '"admit"', 15, 'Strong problem fit, full founder commitment, a complementary team and basic market research — admit, even with a revenue model still to sharpen.'),
('ss1_flag', 'startup_selection', '"initial_revenue_model"', 10, 'The one soft spot in an otherwise strong application is the still-vague initial revenue model.'),
('ss2_decision', 'startup_selection', '"decline"', 15, 'A founder still working another job full time, combined with rejecting mentor feedback outright, are deal-breakers at screening.'),
('ss2_flag', 'startup_selection', '"founders_commitment"', 10, 'Founders'' commitment — are they fully committed and ready to put in the time and effort — is the clearest red flag here.'),
('ss3_decision', 'startup_selection', '"decline"', 15, 'A startup that is already profitable and scaling on its own does not need the incubator''s mentoring or facilities — admitting it uses resources a startup that needs the program could have had.'),
('ss3_flag', 'startup_selection', '"need_for_incubator_support"', 10, 'Need for incubator support — will it genuinely use and benefit from the program — is the deciding criterion.'),
('ss4_decision', 'startup_selection', '"admit_conditions"', 15, 'A promising idea with a coachable solo founder can be admitted on the condition that a complementary co-founder or hire and basic market research follow.'),
('ss4_flag', 'startup_selection', '"team_strength"', 10, 'The lack of a complementary skill mix on the team is the main condition to attach.'),

-- Challenge 4: Due Diligence Hunt (5 items, 20 pts each = 100)
('dd_legal', 'due_diligence', '"tax_card"', 20, 'The commercial register, tax card and latest tax document belong in the Legal section of the data room — the tax documents are missing here.'),
('dd_hr', 'due_diligence', '"org_chart_salaries"', 20, 'The HR section calls for employment agreements, founders'' CVs and LinkedIn, and the org chart and salaries — the org chart and salaries is missing here.'),
('dd_fin', 'due_diligence', '"audited_financials"', 20, 'The Financials section calls for audited financials to date, bank statements and reconciliations, and financial statements — the audited financials are missing here.'),
('dd_balance', 'due_diligence', '"75000"', 20, 'Assets = Liabilities + Shareholders'' equity, so equity = $120,000 - $45,000 = $75,000.'),
('dd_cashflow', 'due_diligence', '"paper_profit_not_cash"', 20, 'Profit on paper is not cash in the bank — revenue invoiced on credit has not been collected yet, so the cash is not actually there.'),

-- Challenge 5: Pitch Deck Rescue (4 items, 25 pts each = 100)
('pd_missing1', 'pitch_deck', '"business_model"', 25, 'A deck with no business model section never explains the revenue streams and pricing behind the idea.'),
('pd_missing2', 'pitch_deck', '"traction"', 25, 'A deck with no traction section gives the investor no achievements, customers or feedback to anchor the claims in.'),
('pd_dont1', 'pitch_deck', '"overvalue"', 25, 'Claiming a $50M valuation with no revenue is overvaluing the startup.'),
('pd_dont2', 'pitch_deck', '"claims_without_data"', 25, 'Asking the investor to "trust us" instead of showing numbers is making claims without data or evidence.');
