import { useEffect, useState } from 'react'
import { currentAudibilityIssue, subscribeAudibility, type AudibilityIssue } from '../audio/audibility'

/** The live "you probably can't hear this" verdict, or null when all is well. */
export function useAudibility(): AudibilityIssue | null {
  const [issue, setIssue] = useState<AudibilityIssue | null>(currentAudibilityIssue)
  useEffect(() => subscribeAudibility(setIssue), [])
  return issue
}
