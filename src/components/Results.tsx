import type { FinishResult } from '../lib/gameApi'
import { getPerformanceCategory, formatTime } from '../lib/scoring'
import { TOTAL_POINTS } from '../data/challenges'
import Leaderboard from './Leaderboard'

interface Props {
  result: FinishResult
  onRestart: () => void
}

export default function Results({ result, onRestart }: Props) {
  const category = getPerformanceCategory(result.score)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-8 rounded-2xl border border-navy-700 bg-navy-900/80 p-6 text-center shadow-2xl sm:p-10">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
          {result.playerName} · finished in {formatTime(result.completionTimeSeconds)}
        </p>
        <p className="mb-4 text-5xl font-extrabold text-white sm:text-6xl">
          {result.score}
          <span className="text-2xl font-medium text-slate-400"> / {TOTAL_POINTS}</span>
        </p>
        <p className={`mb-3 text-xl font-bold sm:text-2xl ${category.color}`}>{category.label}</p>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">{category.message}</p>
        <p className="mt-4 text-sm text-slate-400">You ranked #{result.rank} at the moment you finished.</p>

        <button
          onClick={onRestart}
          className="mt-6 w-full rounded-lg bg-gold-500 px-4 py-3 text-base font-semibold text-navy-950 transition hover:bg-gold-400"
        >
          Play again
        </button>
      </div>

      <Leaderboard highlightName={result.playerName} />
    </div>
  )
}
