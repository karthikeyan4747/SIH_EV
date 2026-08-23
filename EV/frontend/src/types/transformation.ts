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
  outputs: Artifact[]
  structures: Structure[]
  versions: DNAVersion[]
  status: 'empty' | 'processing' | 'ready' | 'error'
}
