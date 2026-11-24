import { formatTime } from '../lib/scoring'
import { TOTAL_QUESTIONS } from '../data/challenges'

interface Props {
  playerName: string
  challengeIndex: number
  challengeTitle: string
  stepIndex: number
  liveScore: number
  secondsRemaining: number
}

export default function GameHeader({
  playerName,
  challengeIndex,
  challengeTitle,
  stepIndex,
  liveScore,
  secondsRemaining,
}: Props) {
  const progressPct = Math.min(100, Math.round((stepIndex / TOTAL_QUESTIONS) * 100))
  const low = secondsRemaining <= 180

  return (
    <div className="sticky top-0 z-10 border-b border-navy-700 bg-navy-950/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-white">{playerName}</span>
          <span className="truncate text-slate-400">
            Challenge {challengeIndex + 1} of 5 · {challengeTitle}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-semibold text-gold-400">{liveScore} pts</div>
            <div className="text-slate-400">score so far</div>
          </div>
          <div className={`text-right font-mono ${low ? 'text-rose-400' : 'text-slate-200'}`}>
            <div className="font-semibold">{formatTime(secondsRemaining)}</div>
            <div className="text-slate-400">left</div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-2 max-w-3xl">
        <div className="h-2 w-full overflow-hidden rounded-full bg-navy-800">
          <div
            className="h-full rounded-full bg-gold-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
