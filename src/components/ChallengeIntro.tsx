import type { ChallengeDef } from '../data/challenges'

interface Props {
  challenge: ChallengeDef
  onContinue: () => void
}

export default function ChallengeIntro({ challenge, onContinue }: Props) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-navy-700 bg-navy-900/80 p-6 text-center shadow-2xl sm:p-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-400">
          Challenge {challenge.index} of 5 · 100 points
        </p>
        <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">{challenge.title}</h2>
        <p className="mb-5 text-sm font-medium text-slate-300 sm:text-base">{challenge.tagline}</p>
        <p className="mb-7 text-sm leading-relaxed text-slate-400 sm:text-base">{challenge.instructions}</p>
        <button
          onClick={onContinue}
          className="w-full rounded-lg bg-gold-500 px-4 py-3 text-base font-semibold text-navy-950 transition hover:bg-gold-400"
        >
          Start this challenge
        </button>
      </div>
    </div>
  )
}
