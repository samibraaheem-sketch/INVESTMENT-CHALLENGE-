import { useState } from 'react'
import type { FlatStep } from '../data/challenges'
import { submitAnswer, type AnswerResult } from '../lib/gameApi'
import { toFriendlyMessage } from '../lib/errors'

interface Props {
  sessionId: string
  step: FlatStep
  questionNumberInChallenge: number
  questionsInChallenge: number
  onAnswered: (questionId: string, result: AnswerResult) => void
}

export default function QuestionCard({
  sessionId,
  step,
  questionNumberInChallenge,
  questionsInChallenge,
  onAnswered,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { item, group } = step

  async function handleSelect(value: string) {
    if (result || submitting) return
    setSelected(value)
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitAnswer(sessionId, item.id, value)
      setResult(res)
    } catch (err) {
      setError(toFriendlyMessage(err, 'Could not submit your answer. Check your connection and try again.'))
      setSelected(null)
    } finally {
      setSubmitting(false)
    }
  }

  function handleContinue() {
    if (!result) return
    onAnswered(item.id, result)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      {group.heading && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-400">{group.heading}</p>
      )}
      <div className="mb-5 rounded-xl border border-navy-700 bg-navy-900/60 p-4 text-sm leading-relaxed text-slate-200 sm:text-base">
        {group.scenario}
      </div>

      <p className="mb-1 text-xs text-slate-500">
        Question {questionNumberInChallenge} of {questionsInChallenge} in this challenge · {item.points} pts
      </p>
      <h3 className="mb-4 text-lg font-semibold text-white sm:text-xl">{item.prompt}</h3>

      <div className="space-y-2">
        {item.options.map((opt) => {
          const isSelected = selected === opt.value
          const isCorrectAnswer = result && result.correctAnswer === opt.value
          let classes =
            'w-full rounded-lg border px-4 py-3 text-left text-sm sm:text-base transition disabled:cursor-default'
          if (!result) {
            classes += isSelected
              ? ' border-gold-500 bg-navy-800 text-white'
              : ' border-navy-700 bg-navy-900/40 text-slate-200 hover:border-gold-500/60 hover:bg-navy-800'
          } else if (isCorrectAnswer) {
            classes += ' border-emerald-500 bg-emerald-500/10 text-emerald-300'
          } else if (isSelected) {
            classes += ' border-rose-500 bg-rose-500/10 text-rose-300'
          } else {
            classes += ' border-navy-700 bg-navy-900/20 text-slate-500'
          }
          return (
            <button
              key={opt.value}
              type="button"
              data-value={opt.value}
              data-testid="answer-option"
              disabled={Boolean(result) || submitting}
              onClick={() => handleSelect(opt.value)}
              className={classes}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      {result && (
        <div
          className={`mt-5 rounded-xl border p-4 text-sm sm:text-base ${
            result.isCorrect
              ? 'border-emerald-600 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-600 bg-rose-500/10 text-rose-200'
          }`}
        >
          <p className="mb-1 font-semibold">
            {result.isCorrect ? `Correct · +${result.pointsAwarded} pts` : 'Not quite · +0 pts'}
          </p>
          <p className="leading-relaxed opacity-90">{result.explanation}</p>
        </div>
      )}

      {result && (
        <button
          data-testid="continue-button"
          onClick={handleContinue}
          className="mt-5 w-full rounded-lg bg-gold-500 px-4 py-3 text-base font-semibold text-navy-950 transition hover:bg-gold-400"
        >
          Continue
        </button>
      )}

      {submitting && <p className="mt-3 text-sm text-slate-400">Checking…</p>}
    </div>
  )
}
