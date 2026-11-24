interface Props {
  error: string | null
  onRetry: () => void
}

export default function Finishing({ error, onRetry }: Props) {
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-sm text-sm text-rose-400">{error}</p>
        <button
          onClick={onRetry}
          className="rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-gold-400"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy-700 border-t-gold-500" />
      <p className="text-slate-300">Submitting your final score…</p>
    </div>
  )
}
