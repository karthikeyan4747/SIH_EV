import type { ContentDNA } from '../types/content'

export interface DNAChangeset {
  isBaseline: boolean
  changeSummary: string
  note?: string
  addedFacts: string[]
  removedFacts: string[]
  summaryChanged: boolean
  oldSummary?: string
  newSummary?: string
  purposeChanged: boolean
  oldPurpose?: string
  newPurpose?: string
  toneChanged?: { from: string; to: string }
  audienceChanged?: { from: string; to: string }
  addedEntities: string[]
  removedEntities: string[]
  addedFindings: string[]
  removedFindings: string[]
  hasDifferences: boolean
}

function getAllFacts(facts?: ContentDNA['facts']): string[] {
  if (!facts) return []
  return [
    ...(facts.claims || []),
    ...(facts.statistics || []),
    ...(facts.dates || []),
    ...(facts.events || []),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
}

function getAllFindings(findings?: ContentDNA['findings']): string[] {
  if (!findings) return []
  return [
    ...(findings.key_findings || []),
    ...(findings.risks || []),
    ...(findings.opportunities || []),
    ...(findings.implications || []),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
}

function getAllEntities(entities?: ContentDNA['entities']): string[] {
  if (!entities) return []
  return [
    ...(entities.people || []),
    ...(entities.organizations || []),
    ...(entities.locations || []),
    ...(entities.technologies || []),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
}

export function computeDNAChanges(
  current: ContentDNA | null | undefined,
  previous?: ContentDNA | null | undefined,
  note?: string
): DNAChangeset {
  if (!previous || !previous.overview) {
    const facts = getAllFacts(current?.facts)
    const entities = getAllEntities(current?.entities)
    return {
      isBaseline: true,
      changeSummary: `Initial baseline: ${facts.length} facts, ${entities.length} entities established from sources.`,
      note: note || 'Initial ingestion baseline',
      addedFacts: facts.slice(0, 4),
      removedFacts: [],
      summaryChanged: false,
      purposeChanged: false,
      addedEntities: entities.slice(0, 6),
      removedEntities: [],
      addedFindings: getAllFindings(current?.findings).slice(0, 3),
      removedFindings: [],
      hasDifferences: true,
    }
  }

  // Compare facts
  const prevFacts = getAllFacts(previous.facts)
  const currFacts = getAllFacts(current?.facts)
  const addedFacts = currFacts.filter((f) => !prevFacts.includes(f))
  const removedFacts = prevFacts.filter((f) => !currFacts.includes(f))

  // Compare findings
  const prevFindings = getAllFindings(previous.findings)
  const currFindings = getAllFindings(current?.findings)
  const addedFindings = currFindings.filter((f) => !prevFindings.includes(f))
  const removedFindings = prevFindings.filter((f) => !currFindings.includes(f))

  // Compare entities
  const prevEntities = getAllEntities(previous.entities)
  const currEntities = getAllEntities(current?.entities)
  const addedEntities = currEntities.filter((e) => !prevEntities.includes(e))
  const removedEntities = prevEntities.filter((e) => !currEntities.includes(e))

  // Compare overview
  const summaryChanged =
    (current?.overview?.summary || '').trim() !== (previous.overview?.summary || '').trim()
  const purposeChanged =
    (current?.overview?.purpose || '').trim() !== (previous.overview?.purpose || '').trim()

  // Compare context
  let toneChanged: { from: string; to: string } | undefined
  if (
    current?.context?.tone &&
    previous.context?.tone &&
    current.context.tone.trim().toLowerCase() !== previous.context.tone.trim().toLowerCase()
  ) {
    toneChanged = { from: previous.context.tone, to: current.context.tone }
  }

  let audienceChanged: { from: string; to: string } | undefined
  if (
    current?.context?.target_audience &&
    previous.context?.target_audience &&
    current.context.target_audience.trim().toLowerCase() !==
      previous.context.target_audience.trim().toLowerCase()
  ) {
    audienceChanged = {
      from: previous.context.target_audience,
      to: current.context.target_audience,
    }
  }

  const parts: string[] = []
  if (addedFacts.length > 0) parts.push(`+${addedFacts.length} fact${addedFacts.length > 1 ? 's' : ''}`)
  if (removedFacts.length > 0) parts.push(`-${removedFacts.length} fact${removedFacts.length > 1 ? 's' : ''}`)
  if (summaryChanged) parts.push('overview updated')
  if (purposeChanged) parts.push('purpose revised')
  if (toneChanged) parts.push(`tone updated to ${toneChanged.to}`)
  if (addedEntities.length > 0) parts.push(`+${addedEntities.length} entit${addedEntities.length > 1 ? 'ies' : 'y'}`)
  if (addedFindings.length > 0) parts.push(`+${addedFindings.length} finding${addedFindings.length > 1 ? 's' : ''}`)

  const hasDifferences =
    addedFacts.length > 0 ||
    removedFacts.length > 0 ||
    summaryChanged ||
    purposeChanged ||
    Boolean(toneChanged) ||
    Boolean(audienceChanged) ||
    addedEntities.length > 0 ||
    removedEntities.length > 0 ||
    addedFindings.length > 0 ||
    removedFindings.length > 0

  const changeSummary =
    parts.length > 0
      ? parts.join(', ')
      : note || 'State rollback / baseline resync (no content variations)'

  return {
    isBaseline: false,
    changeSummary,
    note,
    addedFacts,
    removedFacts,
    summaryChanged,
    oldSummary: previous.overview?.summary,
    newSummary: current?.overview?.summary,
    purposeChanged,
    oldPurpose: previous.overview?.purpose,
    newPurpose: current?.overview?.purpose,
    toneChanged,
    audienceChanged,
    addedEntities,
    removedEntities,
    addedFindings,
    removedFindings,
    hasDifferences,
  }
}
