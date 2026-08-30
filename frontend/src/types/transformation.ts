import type { ContentDNA, RawContent } from './content'

export interface Structure {
  id: string
  name: string
  type: string
  source: 'built_in' | 'custom' | 'reference'
  reference_source_id: string
  status: 'ready' | 'unsupported' | 'error'
  note: string
  sections: { id: string; name: string; description: string; order: number }[]
}

export interface Artifact {
  id: string
  transformation_id: string
  type: string
  structure_id: string
  dna_version: number
  status: 'draft' | 'generated' | 'error'
  content: string
  created_at: string
  updated_at: string
}

export interface DNAVersion {
  version: number
  content_dna: ContentDNA
  note: string
  created_at: string
}

export interface Transformation {
  id: string
  title: string
  created_at: string
  updated_at: string
  sources: RawContent[]
  content_dna: ContentDNA | null
  source_integrity?: SourceIntegrity | null
  outputs: Artifact[]
  structures: Structure[]
  versions: DNAVersion[]
  status: 'empty' | 'processing' | 'ready' | 'error'
}

export interface ClaimEvidence {
  source_id: string
  source_reference: string
  supporting_excerpt: string
  page: number | null
  section: string
  timestamp: string
  frame: string
}

export type ClaimStatus =
  | 'supported'
  | 'corroborated'
  | 'conflict'
  | 'uncertain'

export interface IntegrityClaim {
  claim_id: string
  claim_key: string
  subject: string
  predicate: string
  value: string | number | null
  unit: string
  time: string
  location: string
  scope: string
  source_ids: string[]
  evidence: ClaimEvidence[]
  status: ClaimStatus
}

export interface IntegrityConflict {
  conflict_id: string
  claim_key: string
  description: string
  claim_ids: string[]
  status: 'unresolved' | 'resolved'
}

export interface IntegrityResolution {
  conflict_id: string
  decision: string
  selected_claim_id?: string
  final_value?: string
}

export interface SourceIntegrity {
  claims: IntegrityClaim[]
  conflicts: IntegrityConflict[]
  resolutions: IntegrityResolution[]
}
