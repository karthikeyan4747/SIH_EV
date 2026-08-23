export type SourceType = 'text' | 'txt' | 'pdf' | 'docx' | 'pptx' | 'url' | 'youtube' | 'image' | 'video' | 'audio'

export interface RawContent {
  source_id: string
  source_type: SourceType
  title: string
  text: string
  metadata: Record<string, unknown>
}

export interface ContentDNA {
  identity: { title: string; content_type: string; source_description: string }
  overview: { summary: string; purpose: string }
  entities: { people: string[]; organizations: string[]; locations: string[]; technologies: string[] }
  facts: { claims: string[]; statistics: string[]; dates: string[]; events: string[] }
  findings: { key_findings: string[]; risks: string[]; opportunities: string[]; implications: string[] }
  recommendations: { recommendations: string[] }
  context: { target_audience: string; tone: string; communication_objective: string }
  evidence: { source_reference: string; supporting_excerpt: string }
}

export interface SourceRecord {
  source: RawContent
  content_dna: ContentDNA
}

export interface SourceCreatedResponse {
  source_id: string
  source_type: SourceType
  content_dna: ContentDNA
}

export type ContentDNAPatch = Partial<{
  identity: Partial<ContentDNA['identity']>
  overview: Partial<ContentDNA['overview']>
  entities: Partial<ContentDNA['entities']>
  facts: Partial<ContentDNA['facts']>
  findings: Partial<ContentDNA['findings']>
  recommendations: Partial<ContentDNA['recommendations']>
  context: Partial<ContentDNA['context']>
  evidence: Partial<ContentDNA['evidence']>
}>
