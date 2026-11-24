import { useEffect, useState, useCallback } from 'react'
import { fetchLeaderboard, subscribeLeaderboard, type LeaderboardRow } from '../lib/gameApi'
import { formatTime } from '../lib/scoring'
import { toFriendlyMessage } from '../lib/errors'

interface Props {
  highlightName?: string
  compact?: boolean
}

const POLL_MS = 15000

export default function Leaderboard({ highlightName, compact = false }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchLeaderboard(showAll ? undefined : 10)
      setRows(data)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(toFriendlyMessage(err, 'Could not load the leaderboard.'))
    } finally {
      setLoading(false)
    }
  }, [showAll])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const unsubscribe = subscribeLeaderboard(() => load())
    const interval = setInterval(load, POLL_MS)
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [load])

  return (
    <div className={`w-full ${compact ? '' : 'mx-auto max-w-2xl'}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Leaderboard</h3>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500">updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button
            onClick={() => load()}
            className="rounded-md border border-navy-700 px-2 py-1 text-xs text-slate-300 hover:border-gold-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading leaderboard…</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-slate-400">No completed games yet — be the first on the board.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-navy-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy-800 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isMe = highlightName && row.player_name === highlightName
                return (
                  <tr
                    key={`${row.player_name}-${row.created_at}-${i}`}
                    className={`border-t border-navy-800 ${isMe ? 'bg-gold-500/10' : i % 2 === 0 ? 'bg-navy-900/40' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 text-white">
                      {row.player_name}
                      {isMe && <span className="ml-2 text-xs text-gold-400">you</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gold-400">{row.score}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-400">
                      {formatTime(row.completion_time_seconds)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!showAll && rows.length >= 10 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-lg border border-navy-700 px-4 py-2 text-sm text-slate-200 hover:border-gold-500"
        >
          View full ranking
        </button>
      )}
      {showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-3 w-full rounded-lg border border-navy-700 px-4 py-2 text-sm text-slate-200 hover:border-gold-500"
        >
          Show top 10 only
        </button>
      )}
    </div>
  )
}
