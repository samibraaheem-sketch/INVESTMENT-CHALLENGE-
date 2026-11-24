import Leaderboard from './Leaderboard'

export default function AdminLeaderboard() {
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold-400">
          The Investment Challenge
        </p>
        <h1 className="mb-6 text-2xl font-bold text-white sm:text-3xl">Organizer leaderboard</h1>
        <Leaderboard />
        <p className="mt-6 text-xs text-slate-500">
          This view is read-only — scores can only be written by the server-side grading functions, never edited
          here or by players.
        </p>
      </div>
    </div>
  )
}
