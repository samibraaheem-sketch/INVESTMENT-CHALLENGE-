-- ============================================================================
-- Migration 0002 — trim the question bank to 15 questions (3 per challenge)
-- ============================================================================
-- This is a DATA-ONLY migration. It does not touch any table definition,
-- index, RLS policy, grant, or function (start_game_session, submit_answer,
-- finish_game_session are all untouched, byte-for-byte). It only:
--
--   1. Clears existing game_sessions/game_answers/leaderboard rows. These
--      are all test rows created while building and verifying this app
--      (names like "Prod Regression Check", "Connection Verify", etc.) —
--      there are no real players yet. This step also has to happen first:
--      game_answers.question_id has a foreign key into
--      question_answer_key, so the 22 rows step 2 removes can't be deleted
--      while old test answers still reference them.
--      IF YOU HAVE REAL PLAYER DATA YOU WANT TO KEEP, STOP HERE — do not
--      run this file, and ask for a version scoped to just the 22 rows
--      below instead.
--   2. Deletes the 22 question_answer_key rows that are no longer part of
--      the 15-question game (their question_id is simply not shown by the
--      app anymore).
--   3. Updates the `points` column on the 15 kept rows so each challenge's
--      3 questions sum to exactly 100 (34 + 33 + 33), 500 total — the
--      correct_answer and explanation text for every kept row is untouched.
--
-- Why this is needed at all: finish_game_session() requires every row in
-- question_answer_key to be answered before a session can finish (unless
-- the 30-minute hard limit has elapsed). With all 37 rows still present,
-- a player who only answers the 15 questions the app now shows would never
-- be able to finish normally — the game would stall until the hard time
-- limit. This migration is what makes "15 questions, 100 pts/challenge,
-- finishes normally" actually true in play, not just in the UI.
--
-- Safe to run once in the Supabase SQL editor. Re-running it is harmless
-- (the DELETEs are no-ops the second time, the UPDATEs just reapply the
-- same values).
-- ============================================================================

delete from public.leaderboard;
delete from public.game_answers;
delete from public.game_sessions;

delete from public.question_answer_key
where question_id in (
  'fm1_source', 'fm2_stage', 'fm3_source', 'fm4_stage', 'fm4_source', 'fm5_stage', 'fm5_source',
  'id2_lens', 'id2_sw', 'id3_sw', 'id4_lens', 'id4_sw', 'id5_lens', 'id5_sw',
  'ss1_flag', 'ss2_decision', 'ss2_flag', 'ss3_flag', 'ss4_flag',
  'dd_legal', 'dd_hr',
  'pd_missing2'
);

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

-- Verification: should print exactly 15 rows and a total of 500.
select challenge, count(*) as questions, sum(points) as challenge_points
from public.question_answer_key
group by challenge
order by min(question_id);
