-- ============================================================================
-- Migration 0002 — trim the question bank to 15 questions (3 per challenge)
-- ============================================================================
-- This is a DATA-ONLY migration. It does not touch any table definition,
-- index, RLS policy, grant, or function (start_game_session, submit_answer,
-- finish_game_session are all untouched, byte-for-byte).
--
-- It is surgical: it preserves every existing game_sessions and leaderboard
-- row unconditionally, and only removes the specific game_answers rows that
-- reference the 22 question_ids being retired — nothing else is touched.
--
-- It runs as a single explicit transaction. Two guard checks (step 0b and
-- step 6) RAISE EXCEPTION and roll back the entire migration — no partial
-- changes — if the data isn't in the exact shape this migration expects:
--   - before touching points: all 15 question_ids this migration keeps
--     must already exist in question_answer_key.
--   - after every change: the table must contain exactly 15 rows, each
--     challenge exactly 3 questions summing to 100 points, 500 overall.
--
-- Why any of this is needed: finish_game_session() requires every row in
-- question_answer_key to be answered before a session can finish (unless
-- the 20-minute hard limit has elapsed). With all 37 rows still present,
-- a player who only answers the 15 questions the app now shows would
-- never be able to finish normally. This migration is what makes "15
-- questions, 100 pts/challenge, finishes normally" actually true in play,
-- not just in the UI — without discarding anything already recorded.
--
-- Safe to re-run: every statement is scoped by question_id/value, so
-- running this twice reapplies the same end state rather than erroring
-- or double-deleting.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Step 0a — inspect the actual foreign key before changing anything.
-- Read this output first. It confirms (a) game_answers.question_id really
-- does reference question_answer_key.question_id, and (b) its ON DELETE
-- behavior, which is why step 2 has to run before step 3 can succeed.
-- Expect: constraint_type = FOREIGN KEY, delete_rule = NO ACTION.
-- ----------------------------------------------------------------------------

select
  tc.constraint_name,
  tc.table_name as referencing_table,
  kcu.column_name as referencing_column,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
join information_schema.referential_constraints rc
  on tc.constraint_name = rc.constraint_name and tc.table_schema = rc.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name = 'game_answers';

-- ----------------------------------------------------------------------------
-- Step 0b — guard: every one of the 15 question_ids this migration is
-- about to rebalance must already exist. Aborts (rolls back the whole
-- transaction) rather than silently updating 14 rows if one is missing.
-- ----------------------------------------------------------------------------

do $$
declare
  v_missing_count integer;
  v_missing_ids text;
begin
  select count(*), string_agg(expected.question_id, ', ')
  into v_missing_count, v_missing_ids
  from (
    values
      ('fm1_stage'), ('fm2_source'), ('fm3_stage'),
      ('id1_lens'), ('id1_sw'), ('id3_lens'),
      ('ss1_decision'), ('ss3_decision'), ('ss4_decision'),
      ('dd_fin'), ('dd_balance'), ('dd_cashflow'),
      ('pd_missing1'), ('pd_dont1'), ('pd_dont2')
  ) as expected(question_id)
  where not exists (
    select 1 from public.question_answer_key qak where qak.question_id = expected.question_id
  );

  if v_missing_count > 0 then
    raise exception 'Aborting: % of the 15 retained question_ids are missing from question_answer_key before the point update: %', v_missing_count, v_missing_ids;
  end if;

  raise notice 'Guard passed: all 15 retained question_ids exist.';
end $$;

-- ----------------------------------------------------------------------------
-- Step 1 — informational only: how many existing answers reference a
-- question_id about to be retired. This is exactly how many game_answers
-- rows step 2 will remove — every other row (every answer to one of the
-- 15 kept questions, every game_session, every leaderboard row) is
-- completely unaffected by this migration.
-- ----------------------------------------------------------------------------

select count(*) as answers_to_be_removed
from public.game_answers
where question_id in (
  'fm1_source', 'fm2_stage', 'fm3_source', 'fm4_stage', 'fm4_source', 'fm5_stage', 'fm5_source',
  'id2_lens', 'id2_sw', 'id3_sw', 'id4_lens', 'id4_sw', 'id5_lens', 'id5_sw',
  'ss1_flag', 'ss2_decision', 'ss2_flag', 'ss3_flag', 'ss4_flag',
  'dd_legal', 'dd_hr',
  'pd_missing2'
);

-- ----------------------------------------------------------------------------
-- Step 2 — delete ONLY the game_answers rows that reference one of the 22
-- retired question_ids. This is the minimum necessary to satisfy the
-- foreign key in step 3 below; it does not touch any answer to a kept
-- question, any game_sessions row, or any leaderboard row. A session that
-- already finished keeps its stored leaderboard score regardless (that
-- score was computed once, at finish time, and is not recalculated from
-- game_answers afterwards).
-- ----------------------------------------------------------------------------

delete from public.game_answers
where question_id in (
  'fm1_source', 'fm2_stage', 'fm3_source', 'fm4_stage', 'fm4_source', 'fm5_stage', 'fm5_source',
  'id2_lens', 'id2_sw', 'id3_sw', 'id4_lens', 'id4_sw', 'id5_lens', 'id5_sw',
  'ss1_flag', 'ss2_decision', 'ss2_flag', 'ss3_flag', 'ss4_flag',
  'dd_legal', 'dd_hr',
  'pd_missing2'
);

-- ----------------------------------------------------------------------------
-- Step 3 — now safe to remove the 22 retired question_answer_key rows
-- (no remaining game_answers row references them, so the foreign key
-- constraint from step 0a is satisfied).
-- ----------------------------------------------------------------------------

delete from public.question_answer_key
where question_id in (
  'fm1_source', 'fm2_stage', 'fm3_source', 'fm4_stage', 'fm4_source', 'fm5_stage', 'fm5_source',
  'id2_lens', 'id2_sw', 'id3_sw', 'id4_lens', 'id4_sw', 'id5_lens', 'id5_sw',
  'ss1_flag', 'ss2_decision', 'ss2_flag', 'ss3_flag', 'ss4_flag',
  'dd_legal', 'dd_hr',
  'pd_missing2'
);

-- ----------------------------------------------------------------------------
-- Step 4 — rebalance points on the 15 kept rows so each challenge sums to
-- exactly 100 (34 + 33 + 33), 500 overall. correct_answer and explanation
-- text for every kept row are untouched.
-- ----------------------------------------------------------------------------

update public.question_answer_key set points = 34 where question_id = 'fm1_stage';
update public.question_answer_key set points = 33 where question_id = 'fm2_source';
update public.question_answer_key set points = 33 where question_id = 'fm3_stage';

update public.question_answer_key set points = 34 where question_id = 'id1_lens';
update public.question_answer_key set points = 33 where question_id = 'id1_sw';
update public.question_answer_key set points = 33 where question_id = 'id3_lens';

update public.question_answer_key set points = 34 where question_id = 'ss1_decision';
update public.question_answer_key set points = 33 where question_id = 'ss3_decision';
update public.question_answer_key set points = 33 where question_id = 'ss4_decision';

update public.question_answer_key set points = 34 where question_id = 'dd_fin';
update public.question_answer_key set points = 33 where question_id = 'dd_balance';
update public.question_answer_key set points = 33 where question_id = 'dd_cashflow';

update public.question_answer_key set points = 34 where question_id = 'pd_missing1';
update public.question_answer_key set points = 33 where question_id = 'pd_dont1';
update public.question_answer_key set points = 33 where question_id = 'pd_dont2';

-- ----------------------------------------------------------------------------
-- Step 5 — verification display. Expect exactly 5 rows, each with
-- questions = 3 and challenge_points = 100, and the single-row check to
-- read total_questions = 15 and total_points = 500.
-- ----------------------------------------------------------------------------

select challenge, count(*) as questions, sum(points) as challenge_points
from public.question_answer_key
group by challenge
order by min(question_id);

select count(*) as total_questions, sum(points) as total_points
from public.question_answer_key;

-- ----------------------------------------------------------------------------
-- Step 6 — guard: hard assertion on the same numbers step 5 just
-- displayed. Aborts (rolls back the whole transaction, including the
-- deletes and point updates above) if anything is off by even one
-- question or one point.
-- ----------------------------------------------------------------------------

do $$
declare
  v_total_count integer;
  v_total_points integer;
  v_bad_challenge_count integer;
begin
  select count(*), coalesce(sum(points), 0) into v_total_count, v_total_points
  from public.question_answer_key;

  if v_total_count is distinct from 15 then
    raise exception 'Aborting: expected exactly 15 questions after the update, found %.', v_total_count;
  end if;

  if v_total_points is distinct from 500 then
    raise exception 'Aborting: expected total points to equal 500, found %.', v_total_points;
  end if;

  select count(*) into v_bad_challenge_count
  from (
    select challenge, count(*) as q, sum(points) as p
    from public.question_answer_key
    group by challenge
  ) per_challenge
  where q is distinct from 3 or p is distinct from 100;

  if v_bad_challenge_count > 0 then
    raise exception 'Aborting: % challenge(s) do not have exactly 3 questions summing to 100 points.', v_bad_challenge_count;
  end if;

  raise notice 'Verification passed: 5 challenges, 3 questions each, 100 points each, 500 total.';
end $$;

-- ----------------------------------------------------------------------------
-- Step 7 — verification that nothing else was touched. Compare these
-- counts to what you see in the Supabase table editor before running this
-- file — they must be identical before and after.
-- ----------------------------------------------------------------------------

select
  (select count(*) from public.game_sessions) as game_sessions_count,
  (select count(*) from public.leaderboard) as leaderboard_count;

commit;
