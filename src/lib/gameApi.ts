import { supabase, supabaseConfigured } from './supabase'

export interface AnswerResult {
  isCorrect: boolean
  pointsAwarded: number
  explanation: string
  correctAnswer: unknown
}

export interface FinishResult {
  rank: number
  score: number
  completionTimeSeconds: number
  playerName: string
}

export interface LeaderboardRow {
  player_name: string
  score: number
  completion_time_seconds: number
  created_at: string
}

class GameApiError extends Error {}

function assertConfigured() {
  if (!supabaseConfigured) {
    throw new GameApiError(
      'The leaderboard is not connected yet. Ask the organizer to configure Supabase (see README) — your answers are still being scored locally.'
    )
  }
}

export async function startGameSession(sessionId: string, playerName: string): Promise<string> {
  assertConfigured()
  const { data, error } = await supabase.rpc('start_game_session', {
    p_session_id: sessionId,
    p_player_name: playerName,
  })
  if (error) throw new GameApiError(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return row?.started_at ?? new Date().toISOString()
}

export async function submitAnswer(
  sessionId: string,
  questionId: string,
  answer: unknown
): Promise<AnswerResult> {
  assertConfigured()
  const { data, error } = await supabase.rpc('submit_answer', {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_answer: answer,
  })
  if (error) throw new GameApiError(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return {
    isCorrect: row.is_correct,
    pointsAwarded: row.points_awarded,
    explanation: row.explanation,
    correctAnswer: row.correct_answer,
  }
}

export async function finishGameSession(sessionId: string): Promise<FinishResult> {
  assertConfigured()
  const { data, error } = await supabase.rpc('finish_game_session', {
    p_session_id: sessionId,
  })
  if (error) throw new GameApiError(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return {
    rank: row.out_rank,
    score: row.out_score,
    completionTimeSeconds: row.out_completion_time_seconds,
    playerName: row.out_player_name,
  }
}

export async function fetchLeaderboard(limit?: number): Promise<LeaderboardRow[]> {
  if (!supabaseConfigured) return []
  let query = supabase
    .from('leaderboard')
    .select('player_name, score, completion_time_seconds, created_at')
    .order('score', { ascending: false })
    .order('completion_time_seconds', { ascending: true })
    .order('created_at', { ascending: true })
  if (limit) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw new GameApiError(error.message)
  return data ?? []
}

export function subscribeLeaderboard(onChange: () => void): () => void {
  if (!supabaseConfigured) return () => {}
  const channel = supabase
    .channel('leaderboard-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leaderboard' }, onChange)
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
