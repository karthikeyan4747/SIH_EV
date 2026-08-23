import { Compass, FileSearch, FileText, Fingerprint, Lightbulb, ListChecks, ListPlus, Network } from 'lucide-react'
import type { ContentDNA } from '../../types/content'

export type DNASectionKey = keyof ContentDNA
export interface DNANodeData { key: DNASectionKey; label: string; icon: typeof Fingerprint; count: number; empty: boolean }

const definitions: { key: DNASectionKey; label: string; icon: typeof Fingerprint; fields: string[] }[] = [
  { key: 'identity', label: 'Identity', icon: Fingerprint, fields: ['title', 'content_type', 'source_description'] },
  { key: 'overview', label: 'Overview', icon: FileText, fields: ['summary', 'purpose'] },
  { key: 'entities', label: 'Entities', icon: Network, fields: ['people', 'organizations', 'locations', 'technologies'] },
  { key: 'facts', label: 'Facts', icon: ListChecks, fields: ['claims', 'statistics', 'dates', 'events'] },
  { key: 'findings', label: 'Findings', icon: Lightbulb, fields: ['key_findings', 'risks', 'opportunities', 'implications'] },
  { key: 'recommendations', label: 'Recommendations', icon: ListPlus, fields: ['recommendations'] },
  { key: 'context', label: 'Context', icon: Compass, fields: ['target_audience', 'tone', 'communication_objective'] },
  { key: 'evidence', label: 'Evidence', icon: FileSearch, fields: ['source_reference', 'supporting_excerpt'] },
]

export function getDNANodes(dna: ContentDNA): DNANodeData[] {
  return definitions.map(({ key, label, icon, fields }) => {
    const section = dna[key] as Record<string, string | string[]>
    const count = fields.reduce((total, field) => {
      const value = section[field]
      return total + (Array.isArray(value) ? value.length : value ? 1 : 0)
    }, 0)
    return { key, label, icon, count, empty: count === 0 }
  })
}
