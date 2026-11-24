import { useCallback, useEffect, useState } from 'react'
import type { AnswerResult, FinishResult } from '../lib/gameApi'

const STORAGE_KEY = 'investment-challenge:progress:v1'
const HARD_LIMIT_SECONDS = 1200

export type GamePhase = 'welcome' | 'challenge-intro' | 'question' | 'finishing' | 'results'

export interface StoredAnswer {
  questionId: string
  pointsAwarded: number
  isCorrect: boolean
}

export interface GameState {
  phase: GamePhase
  sessionId: string
  playerName: string
  startedAtMs: number
  stepIndex: number
  answers: StoredAnswer[]
  finishResult: FinishResult | null
  lastIntroShownFor: number
}

function emptyState(): GameState {
  return {
    phase: 'welcome',
    sessionId: '',
    playerName: '',
    startedAtMs: 0,
    stepIndex: 0,
    answers: [],
    finishResult: null,
    lastIntroShownFor: -1,
  }
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as GameState
    if (!parsed.sessionId) return emptyState()
    return parsed
  } catch {
    return emptyState()
  }
}

function save(state: GameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — game still works,
    // it just won't survive a refresh. This is only ever used for in-progress
    // UI state, never for the score itself.
  }
}

export function clearStoredProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function useGameState() {
  const [state, setState] = useState<GameState>(() => load())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    save(state)
  }, [state])

  // Ticks once a second so the countdown timer updates live even while the
  // player is just reading a question, not only when they take an action.
  useEffect(() => {
    if (state.phase === 'welcome' || state.phase === 'results') return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [state.phase])

  // Clamped to >= 0: `now` is a state value that only updates once a second
  // (see the ticking effect below), while `startedAtMs` is stamped fresh at
  // the exact moment the player clicks Start Game. If that click happens
  // after `now`'s last tick (e.g. the player spent a few seconds typing
  // their name before starting), `now - startedAtMs` would briefly go
  // negative and inflate the displayed remaining time past the 20-minute
  // cap until the next tick corrects it. Clamping here prevents that.
  const secondsElapsed = state.startedAtMs ? Math.max(0, Math.floor((now - state.startedAtMs) / 1000)) : 0
  const secondsRemaining = Math.max(0, HARD_LIMIT_SECONDS - secondsElapsed)
  const liveScore = state.answers.reduce((sum, a) => sum + a.pointsAwarded, 0)

  const beginGame = useCallback((sessionId: string, playerName: string) => {
    const startedAtMs = Date.now()
    setNow(startedAtMs)
    setState({
      ...emptyState(),
      phase: 'challenge-intro',
      sessionId,
      playerName,
      startedAtMs,
    })
  }, [])

  const markIntroShown = useCallback((challengeIndex: number) => {
    setState((prev) => ({ ...prev, phase: 'question', lastIntroShownFor: challengeIndex }))
  }, [])

  const recordAnswer = useCallback((questionId: string, result: AnswerResult) => {
    setState((prev) => {
      if (prev.answers.some((a) => a.questionId === questionId)) return prev
      return {
        ...prev,
        answers: [...prev.answers, { questionId, pointsAwarded: result.pointsAwarded, isCorrect: result.isCorrect }],
      }
    })
  }, [])

  const advanceStep = useCallback((nextPhase: GamePhase) => {
    setState((prev) => ({ ...prev, stepIndex: prev.stepIndex + 1, phase: nextPhase }))
  }, [])

  const goToFinishing = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'finishing' }))
  }, [])

  const setFinishResult = useCallback((result: FinishResult) => {
    setState((prev) => ({ ...prev, phase: 'results', finishResult: result }))
  }, [])

  const restart = useCallback(() => {
    clearStoredProgress()
    setState(emptyState())
  }, [])

  return {
    state,
    secondsElapsed,
    secondsRemaining,
    liveScore,
    beginGame,
    markIntroShown,
    recordAnswer,
    advanceStep,
    goToFinishing,
    setFinishResult,
    restart,
  }
}

export { HARD_LIMIT_SECONDS }
