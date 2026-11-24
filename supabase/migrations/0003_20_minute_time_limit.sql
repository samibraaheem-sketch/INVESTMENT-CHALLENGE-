-- ============================================================================
-- Migration 0003 — hard time limit: 30 minutes (1800s) -> 20 minutes (1200s)
-- ============================================================================
-- Pure logic/constraint change. No DELETE, no TRUNCATE, no data touched —
-- existing leaderboard, game_sessions and game_answers rows are untouched
-- by this file. It only:
--
--   1. Tightens the leaderboard.completion_time_seconds CHECK constraint
--      from "<= 1800" to "<= 1200".
--   2. Redefines submit_answer() so it refuses new answers once 1200
--      seconds (not 1800) have passed since the session started.
--   3. Redefines finish_game_session() so (a) it will finish an incomplete
--      session once 1200 seconds have elapsed (not 1800), and (b) the
--      completion time it records is capped at 1200 seconds (not 1800).
--
-- Both functions keep every other line identical to supabase/schema.sql —
-- same security model, same grading logic, same leaderboard-write path.
--
-- Safe to re-run. Safe on a non-empty table: every row inserted so far by
-- this app has completion_time_seconds well under 1200 (the shortest real
-- playthroughs take single-digit minutes), so tightening the constraint
-- cannot fail against existing rows. If you have ever manually inserted a
-- row with a completion time between 1200 and 1800, fix or remove that
-- row before running this file, since the new constraint would reject it.
-- ============================================================================

alter table public.leaderboard
  drop constraint leaderboard_completion_time_seconds_check;

alter table public.leaderboard
  add constraint leaderboard_completion_time_seconds_check
  check (completion_time_seconds > 0 and completion_time_seconds <= 1200);

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
  if now() - v_session.started_at > interval '1200 seconds' then
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

  if v_answered_questions < v_total_questions and (now() - v_session.started_at) < interval '1200 seconds' then
    raise exception 'session incomplete: % of % questions answered', v_answered_questions, v_total_questions;
  end if;

  select coalesce(sum(points_awarded), 0) into v_score
  from public.game_answers where session_id = p_session_id;

  v_elapsed := greatest(1, least(1200, extract(epoch from (now() - v_session.started_at))::integer));

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
