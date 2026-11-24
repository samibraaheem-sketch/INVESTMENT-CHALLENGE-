import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { startGameSession } from '../lib/gameApi'
import { toFriendlyMessage } from '../lib/errors'
import { supabaseConfigured } from '../lib/supabase'

interface Props {
  onStart: (sessionId: string, playerName: string) => void
}

export default function Welcome({ onStart }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError('Please enter your name to start.')
      return
    }
    if (trimmed.length > 40) {
      setError('Please use a shorter name (40 characters max).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const sessionId = uuidv4()
      await startGameSession(sessionId, trimmed)
      onStart(sessionId, trimmed)
    } catch (err) {
      setError(toFriendlyMessage(err, 'Could not start the game. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-navy-700 bg-navy-900/80 p-6 shadow-2xl sm:p-10">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-gold-400">
          Certified Incubation Manager · Investment Module
        </p>
        <h1 className="mb-3 text-center text-3xl font-bold text-white sm:text-4xl">The Investment Challenge</h1>
        <p className="mb-6 text-center text-sm leading-relaxed text-slate-300 sm:text-base">
          Five quick challenges on funding stages, the investor mindset, selecting startups, due diligence and
          pitch decks. Play solo, get instant feedback, and land on the shared leaderboard — about 10–15 minutes,
          30 minutes max.
        </p>

        {!supabaseConfigured && (
          <div
            role="alert"
            className="mb-6 rounded-lg border-2 border-rose-500 bg-rose-500/10 p-4 text-sm text-rose-200"
          >
            <p className="mb-1 font-bold">⚠ Game unavailable right now</p>
            <p className="leading-relaxed">
              This deployment isn't connected to its server yet, so the game can't start or be graded. If you're the
              organizer: set <code className="rounded bg-navy-950/60 px-1 py-0.5">VITE_SUPABASE_URL</code> and{' '}
              <code className="rounded bg-navy-950/60 px-1 py-0.5">VITE_SUPABASE_PUBLISHABLE_KEY</code> in your
              Vercel project's environment variables, then redeploy (see the README) — Vite bakes these in at build
              time, so adding them alone isn't enough, the project needs to rebuild.
            </p>
          </div>
        )}

        <ul className="mb-6 space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gold-400">●</span>
            <span>5 challenges, 100 points each — 500 points total.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gold-400">●</span>
            <span>Immediate feedback after every answer, with a running score and progress bar.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-gold-400">●</span>
            <span>No sign-up — just your name. Your final score goes on a public leaderboard.</span>
          </li>
        </ul>

        <form onSubmit={handleStart} className="space-y-3">
          <label htmlFor="player-name" className="block text-sm font-medium text-slate-200">
            Your name
          </label>
          <input
            id="player-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam Ibrahim"
            maxLength={40}
            autoFocus
            className="w-full rounded-lg border border-navy-700 bg-navy-800 px-4 py-3 text-base text-white placeholder-slate-500 outline-none ring-gold-500 focus:border-gold-500 focus:ring-2"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || !supabaseConfigured}
            className="w-full rounded-lg bg-gold-500 px-4 py-3 text-base font-semibold text-navy-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {!supabaseConfigured ? 'Game unavailable' : loading ? 'Starting…' : 'Start Game'}
          </button>
        </form>
      </div>
    </div>
  )
}
