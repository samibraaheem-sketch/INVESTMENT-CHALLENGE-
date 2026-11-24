export interface PerformanceCategory {
  label: string
  message: string
  color: string
}

export function getPerformanceCategory(score: number): PerformanceCategory {
  if (score >= 450) {
    return {
      label: 'Investment Champion',
      message: "Outstanding. You read startups, stages and documents the way an investor would — you're ready to mentor others through this.",
      color: 'text-gold-400',
    }
  }
  if (score >= 350) {
    return {
      label: 'Investment Ready',
      message: 'Strong work. You have a solid grip on the funding landscape and investor mindset, with a few gaps worth a second look.',
      color: 'text-emerald-400',
    }
  }
  if (score >= 250) {
    return {
      label: 'Rising Incubator Manager',
      message: "You've got the basics down. Revisit the module's sections on investor criteria and due diligence to sharpen your judgment.",
      color: 'text-sky-400',
    }
  }
  return {
    label: 'Needs More Practice',
    message: 'A good start. Go back through the Investment Module — especially the funding stages and the ten selection criteria — and try again.',
    color: 'text-rose-400',
  }
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
