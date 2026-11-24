import { useCallback, useEffect, useRef, useState } from 'react'
import Welcome from './components/Welcome'
import ChallengeIntro from './components/ChallengeIntro'
import QuestionCard from './components/QuestionCard'
import GameHeader from './components/GameHeader'
import Finishing from './components/Finishing'
import Results from './components/Results'
import AdminLeaderboard from './components/AdminLeaderboard'
import { useGameState } from './hooks/useGameState'
import { STEPS, CHALLENGES } from './data/challenges'
import { finishGameSession } from './lib/gameApi'
import { toFriendlyMessage } from './lib/errors'

function GameApp() {
  const {
    state,
    secondsRemaining,
    liveScore,
    beginGame,
    markIntroShown,
    recordAnswer,
    advanceStep,
    goToFinishing,
    setFinishResult,
    restart,
  } = useGameState()

  const finishInFlight = useRef(false)
  const [finishError, setFinishError] = useState<string | null>(null)

  const currentStep = STEPS[state.stepIndex]
  const atLastStep = state.stepIndex >= STEPS.length

  // Hard 20-minute cutoff: once time is up, force the finishing flow regardless
  // of how many questions remain, so the game always ends gracefully.
  useEffect(() => {
    if (state.phase === 'welcome' || state.phase === 'results' || state.phase === 'finishing') return
    if (secondsRemaining <= 0) {
      goToFinishing()
    }
  }, [secondsRemaining, state.phase, goToFinishing])

  useEffect(() => {
    if (atLastStep && state.phase !== 'finishing' && state.phase !== 'results') {
      goToFinishing()
    }
  }, [atLastStep, state.phase, goToFinishing])

  const attemptFinishRef = useRef<(isRetry: boolean) => void>(() => {})

  const attemptFinish = useCallback(
    (isRetry: boolean) => {
      if (finishInFlight.current) return
      finishInFlight.current = true
      setFinishError(null)
      finishGameSession(state.sessionId)
        .then((result) => setFinishResult(result))
        .catch((err) => {
          finishInFlight.current = false
          if (!isRetry) {
            // One automatic retry handles a flaky connection gracefully
            // rather than stranding the player on a spinner right away.
            setTimeout(() => attemptFinishRef.current(true), 2000)
          } else {
            setFinishError(toFriendlyMessage(err, 'Could not submit your final score. Please check your connection.'))
          }
        })
    },
    [state.sessionId, setFinishResult]
  )

  useEffect(() => {
    attemptFinishRef.current = attemptFinish
  }, [attemptFinish])

  useEffect(() => {
    if (state.phase !== 'finishing' || finishInFlight.current || finishError) return
    attemptFinish(false)
  }, [state.phase, finishError, attemptFinish])

  if (state.phase === 'welcome') {
    return <Welcome onStart={beginGame} />
  }

  if (state.phase === 'finishing') {
    return <Finishing error={finishError} onRetry={() => attemptFinish(false)} />
  }

  if (state.phase === 'results' && state.finishResult) {
    return <Results result={state.finishResult} onRestart={restart} />
  }

  if (atLastStep || !currentStep) {
    return <Finishing error={finishError} onRetry={() => attemptFinish(false)} />
  }

  const challenge = currentStep.challenge
  const showIntro = state.phase === 'challenge-intro' && state.lastIntroShownFor !== currentStep.challengeIndex

  return (
    <div className="min-h-screen">
      {!showIntro && (
        <GameHeader
          playerName={state.playerName}
          challengeIndex={currentStep.challengeIndex}
          challengeTitle={challenge.title}
          stepIndex={state.stepIndex}
          liveScore={liveScore}
          secondsRemaining={secondsRemaining}
        />
      )}

      {showIntro ? (
        <ChallengeIntro challenge={challenge} onContinue={() => markIntroShown(currentStep.challengeIndex)} />
      ) : (
        <QuestionCard
          key={currentStep.item.id}
          sessionId={state.sessionId}
          step={currentStep}
          questionNumberInChallenge={
            CHALLENGES[currentStep.challengeIndex].groups
              .flatMap((g) => g.items)
              .findIndex((i) => i.id === currentStep.item.id) + 1
          }
          questionsInChallenge={CHALLENGES[currentStep.challengeIndex].groups.flatMap((g) => g.items).length}
          onAnswered={(questionId, result) => {
            recordAnswer(questionId, result)
            const nextStep = STEPS[state.stepIndex + 1]
            const enteringNewChallenge = !nextStep || nextStep.challengeIndex !== currentStep.challengeIndex
            advanceStep(enteringNewChallenge && nextStep ? 'challenge-intro' : 'question')
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  const isAdminView = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('leaderboard')
  if (isAdminView) return <AdminLeaderboard />
  return <GameApp />
}
