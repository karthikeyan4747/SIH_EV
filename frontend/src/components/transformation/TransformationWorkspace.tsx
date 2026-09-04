import { createPortal } from 'react-dom'
import { useMemo, useState, useEffect } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Download,
  FileJson,
  FileText,
  Link,
  Mic,
  MonitorPlay,
  Network,
  Layers,
  PictureInPicture,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import { exportArtifact, type ExportFormat } from '../../lib/export/documentExport'

import { NewSourceBatch } from '../ev/NewSourceBatch'
import { ContentDNAStructure } from '../dna/ContentDNAStructure'
import { SemanticLineageGraphVisualizer } from '../dna/SemanticLineageGraphVisualizer'
import type { DNASectionKey } from '../dna/dnaData'
import { DNAInspector } from '../dna/DNAInspector'
import { getDNANodes } from '../dna/dnaData'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { DragInput } from '../ui/DragInput'

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'

import { analyzeSourceIntegrity, listWorkflows, saveWorkflow, getAvailableModels } from '../../lib/api/client'
import type { WorkflowTemplate, ModelListResponse } from '../../lib/api/client'
import { ConflictResolutionPanel } from '../dna/ConflictResolutionPanel'
import { DNASkeleton, IntegritySkeleton, OutputsSkeleton } from '../ui/Skeleton'

import type {
  IntegrityClaim,
  SourceIntegrity,
} from '../../types/transformation'

import type {
  ContentDNAPatch,
  RawContent,
  SourceType,
} from '../../types/content'

import type { Transformation } from '../../types/transformation'

function getConflictReason(description: string): string {
  const text = description.toLowerCase()

  if (text.includes("time") || text.includes("date")) {
    return "These claims refer to different reporting periods, so they are kept separate rather than treated as a conflict."
  }

  if (text.includes("location") || text.includes("scope")) {
    return "These claims refer to different geographic locations or scopes, so they are kept separate rather than treated as a conflict."
  }

  if (text.includes("unit") || text.includes("measurement")) {
    return "The sources report different measurements, so the claims are not treated as conflicting."
  }

  return "The sources refer to the same claim context but report different values, so the system flags the claim for review."
}

export type GenerationConfig = {
  audience: string
  tone: string
  language: string
  detail: string
  objective: string
  style: string
  slides?: number
  model?: string
}

interface TransformationWorkspaceProps {
  transformation: Transformation
  busy: boolean
  saveState: 'saved' | 'dirty' | 'saving' | 'error'
  onTexts: (drafts: { title: string; text: string }[]) => void
  onFiles: (files: File[]) => void
  onUrl: (url: string, title: string) => void
  onUnsupported: (
    sourceType: SourceType,
    title: string,
    note: string,
  ) => void
  onPatch: (changes: ContentDNAPatch) => Promise<void>
  onRename: (title: string) => void
  onRemoveSource: (sourceId: string) => void
  onGenerateOutputs: (
    types: string[],
    generationConfig: GenerationConfig,
  ) => void
  onRestoreVersion: (version: number) => void
  onConflictResolved: (transformation: Transformation) => void
  onDeleteOutput?: (outputId: string) => void
}



export function TransformationWorkspace({
  transformation,
  busy,
  saveState,
  onTexts,
  onFiles,
  onUrl,
  onUnsupported,
  onPatch,
  onRename,
  onRemoveSource,
  onGenerateOutputs,
  onRestoreVersion,
  onConflictResolved,
  onDeleteOutput,
}: TransformationWorkspaceProps) {
  const [dnaOpen, setDnaOpen] = useState(
    Boolean(transformation.content_dna),
  )

  const [integrity, setIntegrity] = useState<SourceIntegrity | null>(
    transformation.source_integrity ?? null,
  )

  const [integrityLoading, setIntegrityLoading] = useState(false)
  const [integrityError, setIntegrityError] = useState('')
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null)

  useEffect(() => {
    if (transformation.source_integrity) {
      setIntegrity(transformation.source_integrity)
    } else {
      setIntegrity(null)
    }
  }, [transformation.id, transformation.source_integrity])

  useEffect(() => {
    // Auto-run source integrity when multiple sources exist and not yet analyzed
    if (
      transformation.sources.length >= 2 &&
      !transformation.source_integrity &&
      !integrity &&
      !integrityLoading
    ) {
      void runSourceIntegrity()
    }
  }, [transformation.id, transformation.sources.length])

  const [dnaChangedPrompt, setDnaChangedPrompt] = useState<{
    open: boolean
    reason: string
  } | null>(null)

  const [showRawClaims, setShowRawClaims] =
    useState(false)

  const [graphViewMode, setGraphViewMode] =
    useState<'lineage' | 'helix'>('lineage')

  const [selectedNode, setSelectedNode] =
    useState<DNASectionKey | null>(null)

  const dna = transformation.content_dna

  const metrics = useMemo(
    () => (dna ? getDNANodes(dna) : []),
    [dna],
  )

  const dimensions = metrics.filter(
    (node) => !node.empty,
  ).length

  const elements = metrics.reduce(
    (total, node) => total + node.count,
    0,
  )

  function selectNode(key: DNASectionKey) {
    setSelectedNode(key)
    setDnaOpen(true)
  }

  async function handlePatch(changes: any) {
    await onPatch(changes)
    if (transformation.outputs && transformation.outputs.length > 0) {
      setDnaChangedPrompt({
        open: true,
        reason: 'Semantic Lineage Graph was modified in the Lineage Inspector',
      })
    }
  }

  async function runSourceIntegrity() {
    if (!transformation.sources.length) {
      setIntegrityError(
        'Add at least one source before running Source Integrity.',
      )
      return
    }

    try {
      setIntegrityLoading(true)
      setIntegrityError('')

      const result = await analyzeSourceIntegrity(transformation.id)
      setIntegrity(result)
    } catch (error) {
      console.error('Failed to analyze source integrity:', error)
      setIntegrityError(
        error instanceof Error
          ? error.message
          : 'Failed to analyze source integrity.',
      )
    } finally {
      setIntegrityLoading(false)
    }
  }

  return (
    <section className="transformation-workspace page-enter">
      <div className="transformation-header">
        <div>
          <span className="eyebrow eyebrow-left">
            <span className="eyebrow-dot" /> TRANSFORMATION
          </span>

<DragInput
              as="input"
              input={{
                className: "transformation-title",
                value: transformation.title,
                'aria-label': "Transformation title",
                onChange: (event) =>
                  onRename(event.target.value),
              }}
            />

          <p>
            Inputs become one isolated workspace. Semantic Lineage Graph
            stays attached here.
          </p>
        </div>

        <div className="transformation-status">
          <span
            className={`save-feedback save-${saveState}`}
          >
            {saveState === 'saving'
              ? 'Saving...'
              : saveState === 'dirty'
                ? 'Unsaved changes'
                : saveState === 'error'
                  ? 'Save failed'
                  : 'Workspace saved'}
          </span>

          <Badge>
            {transformation.sources.length} source
            {transformation.sources.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </div>

      <Card className="inputs-panel">
        <div className="workspace-panel-heading">
          <div>
            <span className="panel-kicker">
              <FileText size={14} /> INPUTS
            </span>

            <p>
              Add relevant text, files, URLs, or future media
              inputs to this transformation.
            </p>
          </div>

          <span className="input-count">
            {transformation.sources.length} attached
          </span>
        </div>

        {transformation.sources.length > 0 && (
          <div className="attached-sources">
            {transformation.sources.map((source) => (
              <SourceRow
                key={source.source_id}
                source={source}
                onRemove={() =>
                  onRemoveSource(source.source_id)
                }
              />
            ))}
          </div>
        )}

        <NewSourceBatch
          busy={busy}
          onTexts={onTexts}
          onFiles={onFiles}
          onUrl={onUrl}
          onUnsupported={onUnsupported}
        />
      </Card>

      <div className="flow-divider">
        <span>INPUTS</span>
        <span />
        <Sparkles size={14} />
        <span>SEMANTIC LINEAGE GRAPH</span>
        <span />
        <span className="future-flow">OUTPUTS</span>
      </div>

      {dna ? (
        <Card
          className={`embedded-dna ${dnaOpen ? 'expanded' : 'collapsed'
            }`}
        >
          <button
            className="dna-collapse-header"
            onClick={() => setDnaOpen(!dnaOpen)}
            aria-expanded={dnaOpen}
          >
            <span className="dna-collapse-title">
              <span className="dna-mini-mark">*</span>

              <span>
                <strong>SEMANTIC LINEAGE GRAPH</strong>
                <small>
                  Canonical structured knowledge graph & lineage for this
                  transformation
                </small>
              </span>
            </span>

            <span className="dna-collapse-meta">
              <Badge>{dimensions}/8 semantic nodes</Badge>
              <Badge>{elements} elements</Badge>

              {dnaOpen ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </span>
          </button>

          {dnaOpen && (
            <div className="embedded-dna-body">
              {/* 1. Full-Width Top Bar across both columns */}
              <div
                className="embedded-dna-toolbar"
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  borderBottom: '1px solid var(--border)',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Visual Mode:
                  </span>
                  <button
                    type="button"
                    onClick={() => setGraphViewMode('lineage')}
                    style={{
                      background:
                        graphViewMode === 'lineage'
                          ? 'rgba(56, 189, 248, 0.2)'
                          : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${
                        graphViewMode === 'lineage'
                          ? '#38bdf8'
                          : 'rgba(255, 255, 255, 0.1)'
                      }`,
                      color: graphViewMode === 'lineage' ? '#38bdf8' : '#94a3b8',
                      padding: '6px 14px',
                      borderRadius: '7px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Network size={14} />
                    <span>⚡ Interactive Lineage Graph</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGraphViewMode('helix')}
                    style={{
                      background:
                        graphViewMode === 'helix'
                          ? 'rgba(56, 189, 248, 0.2)'
                          : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${
                        graphViewMode === 'helix'
                          ? '#38bdf8'
                          : 'rgba(255, 255, 255, 0.1)'
                      }`,
                      color: graphViewMode === 'helix' ? '#38bdf8' : '#94a3b8',
                      padding: '6px 14px',
                      borderRadius: '7px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Layers size={14} />
                    <span>🧬 Helix Blueprint</span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge>{dimensions}/8 semantic nodes</Badge>
                  <Badge>{elements} elements</Badge>
                </div>
              </div>

              {/* 2. Left Column: Visual Structure (Lineage Graph or Helix) */}
              <div
                className="compact-structure"
                style={{
                  minWidth: 0,
                  borderRight: '1px solid var(--border)',
                  overflow: 'visible',
                }}
              >
                {graphViewMode === 'lineage' ? (
                  <SemanticLineageGraphVisualizer
                    transformation={transformation}
                    selectedSectionKey={selectedNode}
                    onSelectSection={selectNode}
                  />
                ) : (
                  <ContentDNAStructure
                    dna={dna}
                    selectedNode={selectedNode}
                    onSelectNode={selectNode}
                  />
                )}
              </div>

              {/* 3. Right Column: Data Inspector */}
              <div className="compact-inspector" style={{ minWidth: 0 }}>
                <DNAInspector
                  dna={dna}
                  selectedNode={selectedNode}
                  saveState={saveState}
                  onPatch={handlePatch}
                />
              </div>
            </div>
          )}
        </Card>
      ) : busy ? (
        <Card className="embedded-dna">
          <div className="workspace-panel-heading compact-heading" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span className="panel-kicker"><Sparkles size={14} /> CONSTRUCTING SEMANTIC LINEAGE GRAPH...</span>
          </div>
          <DNASkeleton />
        </Card>
      ) : (
        <Card className="dna-empty">
          <div className="dna-mini-mark">*</div>

          <div>
            <strong>SEMANTIC LINEAGE GRAPH</strong>

            <p>
              Add source material to construct the semantic lineage
              graph for this transformation.
            </p>
          </div>

          <Badge>Waiting for input</Badge>
        </Card>
      )}

      <Card className="integrity-panel">
        <div className="workspace-panel-heading compact-heading">
          <div>
            <span className="panel-kicker">
              <ShieldCheck size={14} /> SOURCE INTEGRITY
            </span>
            <p>
              Cross-source semantic verification, discrepancy detection, and grounded fact provenance.
            </p>
          </div>

          <Badge>
            {integrity
              ? `${integrity.conflicts.length} ${integrity.conflicts.length === 1 ? 'conflict' : 'conflicts'}`
              : 'Not analyzed'}
          </Badge>
        </div>

        <div className="integrity-toolbar">
          <div className="source-verification-heading">
            <strong>Source verification</strong>
            <span>
              Semantically compares facts across all sources to surface contradictions while corroborating verified claims.
            </span>
          </div>

          <Button
            variant="primary"
            disabled={integrityLoading || !transformation.sources.length}
            onClick={() => void runSourceIntegrity()}
          >
            <ShieldCheck size={15} />
            {integrityLoading ? 'Analyzing...' : 'Run Source Integrity'}
          </Button>
        </div>

        {integrityError && (
          <div className="integrity-error" role="alert">
            <AlertTriangle size={15} />
            <span>{integrityError}</span>
          </div>
        )}

        {integrityLoading ? (
          <div className="integrity-results">
            <IntegritySkeleton />
          </div>
        ) : integrity ? (
          <div className="integrity-results">
            {/* 1. Overall Integrity Status Banner */}
            {integrity.conflicts.length > 0 ? (
              <div className="integrity-status-banner conflict-banner">
                <AlertTriangle size={20} className="banner-icon-alert" />
                <div className="banner-text">
                  <strong>{integrity.conflicts.length} Source {integrity.conflicts.length === 1 ? 'Conflict' : 'Conflicts'} Detected</strong>
                  <p>Disagreements were identified across sources. Review the conflict cards below to select the authoritative values.</p>
                </div>
              </div>
            ) : (
              <div className="integrity-status-banner verified-banner">
                <CheckCircle2 size={20} className="banner-icon-success" />
                <div className="banner-text">
                  <strong>Source Integrity Fully Verified</strong>
                  <p>All extracted claims corroborate consistently across sources with zero conflicting assertions.</p>
                </div>
              </div>
            )}

            {/* 2. Structured Metric Summary Cards */}
            <div className="integrity-metrics-grid">
              <div className={`metric-stat-card ${integrity.conflicts.length > 0 ? 'stat-conflict' : ''}`}>
                <span className="stat-label">Conflicts</span>
                <strong className="stat-number">{integrity.conflicts.length}</strong>
                <small>{integrity.conflicts.length > 0 ? 'Requires resolution' : 'Zero disputes'}</small>
              </div>

              <div className="metric-stat-card stat-corroborated">
                <span className="stat-label">Corroborated Facts</span>
                <strong className="stat-number">
                  {integrity.claims.filter((c) => c.status === 'corroborated').length}
                </strong>
                <small>Cross-source verified</small>
              </div>

              <div className="metric-stat-card stat-supported">
                <span className="stat-label">Supported Facts</span>
                <strong className="stat-number">
                  {integrity.claims.filter((c) => c.status === 'supported').length}
                </strong>
                <small>Evidence-backed</small>
              </div>

              <div className="metric-stat-card stat-total">
                <span className="stat-label">Total Claims</span>
                <strong className="stat-number">{integrity.claims.length}</strong>
                <small>Analyzed internally</small>
              </div>
            </div>

            {/* 3. Conflict Resolution Cards */}
            {integrity.conflicts.length > 0 && (
              <ConflictResolutionPanel
                transformationId={transformation.id}
                conflicts={integrity.conflicts}
                claims={integrity.claims}
                onResolved={(updated) => {
                  setIntegrity(updated.source_integrity ?? null)
                  onConflictResolved(updated)
                  if (updated.outputs && updated.outputs.length > 0) {
                    setDnaChangedPrompt({
                      open: true,
                      reason: 'Conflicted wrong data resolved and purged from Content DNA',
                    })
                  }
                }}
              />
            )}

            {/* 4. Collapsible Raw Claims Inspector */}
            {integrity.claims.length > 0 && (
              <div className="raw-claims-drawer">
                <button
                  type="button"
                  className="raw-claims-toggle"
                  onClick={() => setShowRawClaims((prev) => !prev)}
                >
                  <span>
                    <strong>Inspect Full Claims Database</strong>
                    <small style={{ marginLeft: '6px', opacity: 0.7 }}>
                      ({integrity.claims.length} total extracted claims with citation metadata)
                    </small>
                  </span>
                  {showRawClaims ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showRawClaims && (
                  <div className="integrity-claim-list">
                    {integrity.claims.map((claim) => (
                      <IntegrityClaimCard
                        key={claim.claim_id}
                        claim={claim}
                        expanded={expandedClaim === claim.claim_id}
                        onToggle={() =>
                          setExpandedClaim((current) =>
                            current === claim.claim_id
                              ? null
                              : claim.claim_id,
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Card>

      <WorkspaceOutputs
        transformation={transformation}
        busy={busy}
        onGenerateOutputs={onGenerateOutputs}
        onRestoreVersion={onRestoreVersion}
        onDeleteOutput={onDeleteOutput}
        dnaChangedPrompt={dnaChangedPrompt}
        onDismissDnaChangedPrompt={() => setDnaChangedPrompt(null)}
      />
    </section>
  )
}

function SourceRow({
  source,
  onRemove,
}: {
  source: RawContent
  onRemove: () => void
}) {
  const unsupported =
    source.metadata.status === 'unsupported'

  const Icon =
    source.source_type === 'url'
      ? Link
      : source.source_type === 'youtube' ||
        source.source_type === 'video'
        ? MonitorPlay
        : source.source_type === 'image'
          ? PictureInPicture
          : source.source_type === 'audio'
            ? Mic
            : FileText

  return (
    <div
      className={`attached-source ${unsupported ? 'source-unsupported' : ''
        }`}
    >
      <span className="source-type-icon">
        <Icon size={16} />
      </span>

      <div className="attached-source-copy">
        <strong>{source.title}</strong>

        <small>
          {source.source_type.toUpperCase()} ·{' '}
          {unsupported
            ? 'Processing not available'
            : 'Processed'}
        </small>
      </div>

      <span
        className={`processed-status ${unsupported ? 'unsupported-status' : ''
          }`}
      >
        <span />
        {unsupported ? 'Unavailable' : 'Processed'}
      </span>

      <button
        className="remove-source"
        aria-label={`Remove ${source.title}`}
        onClick={onRemove}
      >
        <X size={15} />
      </button>
    </div>
  )
}

function ArtifactDownloadDropdown({
  artifactType,
  artifactContent,
  docTitle,
}: {
  artifactType: string
  artifactContent: string
  docTitle: string
}) {
  const [open, setOpen] = useState(false)
  const isPresentation =
    artifactType.toLowerCase().includes('presentation') ||
    artifactType.toLowerCase().includes('slide')

  const handleExport = (format: ExportFormat) => {
    exportArtifact(artifactType, artifactContent, docTitle, format)
    setOpen(false)
  }

  return (
    <div className="download-dropdown-wrapper">
      <button
        type="button"
        className="btn-download-primary"
        title="Download as PDF (Default format)"
        onClick={() => handleExport('pdf')}
      >
        <Download size={14} />
        Download PDF
      </button>
      <button
        type="button"
        className="btn-download-toggle"
        title="Choose format (PDF, DOCX, TXT, MD, PPT)"
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="download-menu-dropdown">
          <button
            type="button"
            className="download-option default-option"
            onClick={() => handleExport('pdf')}
          >
            <span className="option-icon">📄</span>
            <div className="option-text">
              <strong>PDF Document (.pdf)</strong>
              <small>Default · Styled print-ready document</small>
            </div>
          </button>

          <button
            type="button"
            className="download-option"
            onClick={() => handleExport('docx')}
          >
            <span className="option-icon">📝</span>
            <div className="option-text">
              <strong>Word Document (.docx)</strong>
              <small>Formatted for MS Word & Google Docs</small>
            </div>
          </button>

          <button
            type="button"
            className="download-option"
            onClick={() => handleExport('txt')}
          >
            <span className="option-icon">📋</span>
            <div className="option-text">
              <strong>Plain Text (.txt)</strong>
              <small>Clean unformatted plain text</small>
            </div>
          </button>

          <button
            type="button"
            className="download-option"
            onClick={() => handleExport('md')}
          >
            <span className="option-icon">📑</span>
            <div className="option-text">
              <strong>Markdown (.md)</strong>
              <small>Raw structured Markdown file</small>
            </div>
          </button>

          {isPresentation && (
            <button
              type="button"
              className="download-option"
              onClick={() => handleExport('ppt')}
            >
              <span className="option-icon">📊</span>
              <div className="option-text">
                <strong>PowerPoint (.pptx)</strong>
                <small>Widescreen slides with speaker notes</small>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function WorkspaceOutputs({
  transformation,
  busy,
  onGenerateOutputs,
  onRestoreVersion,
  onDeleteOutput,
  dnaChangedPrompt,
  onDismissDnaChangedPrompt,
}: {
  transformation: Transformation
  busy: boolean
  onGenerateOutputs: (
    types: string[],
    generationConfig: GenerationConfig,
  ) => void
  onRestoreVersion: (version: number) => void
  onDeleteOutput?: (outputId: string) => void
  dnaChangedPrompt?: { open: boolean; reason: string } | null
  onDismissDnaChangedPrompt?: () => void
}) {
  const [isUpdatingOutputs, setIsUpdatingOutputs] = useState(false)
  const [selected, setSelected] = useState([
    'executive_summary',
    'linkedin',
  ])

  const [generationConfig, setGenerationConfig] =
    useState<GenerationConfig>({
      audience: 'General Public',
      tone: 'Professional',
      language: 'English',
      detail: 'Balanced',
      objective: 'Inform',
      style: 'Corporate',
      slides: 7,
    })

  const [workflows, setWorkflows] = useState<
    WorkflowTemplate[]
  >([])

  const [selectedWorkflow, setSelectedWorkflow] =
    useState<string>('custom')

  const [workflowLoading, setWorkflowLoading] =
    useState(true)

  const [showSaveWorkflow, setShowSaveWorkflow] =
    useState(false)

  const [customWorkflowName, setCustomWorkflowName] =
    useState('')

  const options = [
    ['executive_summary', 'Executive Summary'],
    ['advisory', 'Advisory'],
    ['linkedin', 'LinkedIn'],
    ['twitter', 'X / Twitter'],
    ['presentation', 'Presentation'],
    ['video', 'Video'],
    ['infographic', 'Infographic'],
  ]

  function toggle(type: string) {
    setSelected((items) =>
      items.includes(type)
        ? items.filter((item) => item !== type)
        : [...items, type],
    )
  }

  function updateGenerationConfig(
    key: keyof GenerationConfig,
    value: string | number,
  ) {
    setGenerationConfig((current) => ({
      ...current,
      [key]: value,
    }))

    if (selectedWorkflow !== 'custom') {
      setSelectedWorkflow('custom')
    }
  }

  function download(
    filename: string,
    content: string,
    type = 'text/plain',
  ) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()

    URL.revokeObjectURL(url)
  }

  const [modelData, setModelData] = useState<ModelListResponse | null>(null)

  useEffect(() => {
    let isMounted = true
    listWorkflows()
      .then((data) => {
        if (isMounted) setWorkflows(data)
      })
      .catch((error) => {
        console.error('Failed to load workflows:', error)
      })
      .finally(() => {
        if (isMounted) setWorkflowLoading(false)
      })

    getAvailableModels()
      .then((data) => {
        if (isMounted) {
          setModelData(data)
          if (!generationConfig.model && data.active_model) {
            setGenerationConfig((curr) => ({ ...curr, model: data.active_model }))
          }
        }
      })
      .catch((err) => console.debug('Failed to load models in workspace:', err))

    return () => {
      isMounted = false
    }
  }, [])

  function updateGenerationConfigFromWorkflow(
    config: Record<string, string>,
  ) {
    setGenerationConfig((current) => ({
      ...current,
      audience:
        config.audience ?? current.audience,
      tone:
        config.tone ?? current.tone,
      language:
        config.language ?? current.language,
      detail:
        config.detail ?? current.detail,
      objective:
        config.objective ?? current.objective,
      style:
        config.style ?? current.style,
    }))
  }

  async function saveCustomWorkflow() {
    const name = customWorkflowName.trim()

    if (!name) {
      return
    }

    const workflowId =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') ||
      `custom_${Date.now()}`

    try {
      const workflow = await saveWorkflow({
        id: workflowId,
        name,
        description: 'Custom operator workflow.',
        output_types: selected,
        generation_config: generationConfig,
      })

      setWorkflows((current) => [
        ...current.filter(
          (item) => item.id !== workflow.id,
        ),
        workflow,
      ])

      setSelectedWorkflow(workflow.id)
      setShowSaveWorkflow(false)
      setCustomWorkflowName('')
    } catch (error) {
      console.error(
        'Failed to save custom workflow:',
        error,
      )
    }
  }

  function exportBundle() {
    download(
      `${transformation.title || 'ev-transformation'}.json`,
      JSON.stringify(
        {
          id: transformation.id,
          title: transformation.title,
          dnaVersion: transformation.versions.length,
          contentDNA:
            transformation.content_dna,
          outputs: transformation.outputs,
          generationConfig,
          workflow:
            selectedWorkflow,
        },
        null,
        2,
      ),
      'application/json',
    )
  }

  function applyWorkflow(
    workflowId: string,
  ) {
    setSelectedWorkflow(workflowId)

    if (workflowId === 'custom') {
      return
    }

    const workflow = workflows.find(
      (item) => item.id === workflowId,
    )

    if (!workflow) {
      return
    }

    setSelected(workflow.output_types)

    updateGenerationConfigFromWorkflow(
      workflow.generation_config,
    )
  }

  async function handleRegenerateOutputsWithUpdatedDNA() {
    if (!transformation.outputs.length) return
    setIsUpdatingOutputs(true)
    try {
      const types = transformation.outputs
        .filter((o) => !o.structure_id)
        .map((o) => o.type)
      const uniqueTypes = Array.from(new Set(types))
      if (uniqueTypes.length > 0) {
        onGenerateOutputs(uniqueTypes, generationConfig)
      }
      onDismissDnaChangedPrompt?.()
    } finally {
      setIsUpdatingOutputs(false)
    }
  }

  return (
    <div className="workspace-lower-grid">
      <Card className="outputs-panel">
        <div className="workspace-panel-heading compact-heading">
          <div>
            <span className="panel-kicker">
              <BookOpen size={14} /> OUTPUTS
            </span>

            <p>
              Generate and export verified artifacts from the current
              Semantic Lineage Graph.
            </p>
          </div>

          <Badge>
            {transformation.outputs.length} artifacts
          </Badge>
        </div>

        {dnaChangedPrompt?.open && transformation.outputs.length > 0 && (
          <div
            className="dna-changed-banner"
            role="alert"
            style={{
              margin: '16px 0',
              padding: '16px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35), 0 0 16px rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <RefreshCw size={18} className={isUpdatingOutputs ? 'spin' : ''} />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '13px', color: '#f8fafc', marginBottom: '2px' }}>
                  Semantic Lineage Graph Updated — Synchronize Outputs?
                </strong>
                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                  {dnaChangedPrompt.reason}. You have <strong>{transformation.outputs.length}</strong> generated output{transformation.outputs.length === 1 ? '' : 's'}. Would you like to update your outputs with the resolved facts?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Button
                variant="secondary"
                onClick={() => onDismissDnaChangedPrompt?.()}
                disabled={isUpdatingOutputs}
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                Keep Existing
              </Button>
              <Button
                variant="primary"
                disabled={isUpdatingOutputs}
                onClick={() => void handleRegenerateOutputsWithUpdatedDNA()}
                style={{
                  fontSize: '11px',
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  borderColor: '#38bdf8',
                }}
              >
                <Sparkles size={12} style={{ marginRight: '6px' }} />
                {isUpdatingOutputs ? 'Regenerating Outputs...' : 'Update All Outputs'}
              </Button>
            </div>
          </div>
        )}

        <div
          style={{
            padding: '16px 0',
            borderBottom:
              '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: '#a7b0b8',
              marginBottom: '5px',
            }}
          >
            WORKFLOW
          </div>

          <div
            style={{
              fontSize: '12px',
              color: '#737d86',
              marginBottom: '10px',
            }}
          >
            Configure outputs and generation settings
            with one reusable workflow.
          </div>

          <select
            className="workflow-select"
            value={selectedWorkflow}
            disabled={workflowLoading}
            onChange={(event) =>
              applyWorkflow(event.target.value)
            }
          >
            <option value="custom">
              Custom Workflow
            </option>

            {workflows.map((workflow) => (
              <option
                key={workflow.id}
                value={workflow.id}
              >
                {workflow.name}
              </option>
            ))}
          </select>

          <div className="workflow-custom-row">
            <div className="workflow-custom-copy">
              <strong>Custom workflow</strong>
              <span>Save the current outputs and generation settings for reuse.</span>
            </div>

            <button
              type="button"
              className="workflow-save-button"
              onClick={() => setShowSaveWorkflow(true)}
            >
              <Sparkles size={14} />
              Save workflow
            </button>
          </div>

          {selectedWorkflow !== 'custom' && (
            <div
              style={{
                marginTop: '9px',
                fontSize: '11px',
                color: '#737d86',
              }}
            >
              {workflows.find(
                (workflow) =>
                  workflow.id ===
                  selectedWorkflow,
              )?.description}
            </div>
          )}
        </div>

        <div className="generation-grid">
          <InlineGenerationSelect
            label="AI Engine & Tokens"
            value={generationConfig.model || modelData?.active_model || ''}
            options={
              (modelData?.models || []).length > 0
                ? (modelData?.models || []).map((m) => {
                    const tokenStr =
                      m.provider === 'local'
                        ? '∞ Local'
                        : m.remaining_daily_tokens != null
                        ? `${(m.remaining_daily_tokens / 1000).toFixed(0)}k left`
                        : 'Active'
                    return {
                      value: m.id,
                      label: `${m.name} (${tokenStr})`,
                    }
                  })
                : [{ label: 'Default Engine', value: '' }]
            }
            onChange={(value) =>
              updateGenerationConfig(
                'model',
                value,
              )
            }
          />

          <InlineGenerationSelect
            label="Target Audience"
            value={generationConfig.audience}
            options={[
              'General Public',
              'Technical Team',
              'Executives',
              'Government Officials',
              'Students',
              'Researchers',
            ]}
            onChange={(value) =>
              updateGenerationConfig(
                'audience',
                value,
              )
            }
          />

          <InlineGenerationSelect
            label="Tone"
            value={generationConfig.tone}
            options={[
              'Professional',
              'Formal',
              'Technical',
              'Persuasive',
              'Neutral',
              'Urgent',
            ]}
            onChange={(value) =>
              updateGenerationConfig(
                'tone',
                value,
              )
            }
          />

          <InlineGenerationSelect
            label="Language"
            value={generationConfig.language}
            options={[
              'English',
              'Hindi',
              'Bengali',
              'Telugu',
              'Marathi',
              'Tamil',
              'Gujarati',
              'Urdu',
              'Kannada',
              'Odia',
              'Malayalam',
              'Punjabi',
              'Assamese',
              'Maithili',
              'Sanskrit',
              'Konkani',
              'Nepali',
              'Sindhi',
              'Kashmiri',
              'Manipuri',
              'Bodo',
              'Dogri',
              'Santali',
            ]}
            onChange={(value) =>
              updateGenerationConfig(
                'language',
                value,
              )
            }
          />

          <InlineGenerationSelect
            label="Level of Detail"
            value={generationConfig.detail}
            options={[
              'Concise',
              'Balanced',
              'Detailed',
              'Comprehensive',
            ]}
            onChange={(value) =>
              updateGenerationConfig(
                'detail',
                value,
              )
            }
          />

          <InlineGenerationSelect
            label="Communication Objective"
            value={generationConfig.objective}
            options={[
              'Inform',
              'Persuade',
              'Summarize',
              'Warn',
              'Educate',
              'Announce',
            ]}
            onChange={(value) =>
              updateGenerationConfig(
                'objective',
                value,
              )
            }
          />

          <InlineGenerationSelect
            label="Content Style"
            value={generationConfig.style}
            options={[
              'Corporate',
              'Academic',
              'Social Media',
              'Government',
              'Technical',
              'News',
            ]}
            onChange={(value) =>
              updateGenerationConfig(
                'style',
                value,
              )
            }
          />
        </div>

        <div className="output-controls">
          {options.map(([type, label]) => (
            <button
              key={type}
              className={
                selected.includes(type)
                  ? 'selected'
                  : ''
              }
              onClick={() => {
                toggle(type)

                if (
                  selectedWorkflow !==
                  'custom'
                ) {
                  setSelectedWorkflow(
                    'custom',
                  )
                }
              }}
            >
              {label}
            </button>
          ))}

          <Button
            variant="primary"
            disabled={
              busy ||
              (!transformation.content_dna && !transformation.sources.length)
            }
            onClick={() =>
              onGenerateOutputs(
                selected.length ? selected : ['executive_summary'],
                generationConfig,
              )
            }
          >
            <Sparkles size={15} />
            {selectedWorkflow !== 'custom'
              ? 'Run Workflow'
              : 'Generate'}
          </Button>

          <Button
            variant="ghost"
            disabled={
              !transformation.outputs.length
            }
            onClick={exportBundle}
          >
            <FileJson size={15} />
            Export JSON
          </Button>
        </div>

        {selected.includes('presentation') && (
          <div className="slide-count-slider-panel">
            <div className="slide-slider-header">
              <div>
                <strong>Presentation Slides</strong>
                <p>Select number of slides to generate (1–10)</p>
              </div>
              <span className="slide-count-indicator">
                {generationConfig.slides || 7} {((generationConfig.slides || 7) === 1) ? 'Slide' : 'Slides'}
              </span>
            </div>
            <div className="slide-slider-container">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={generationConfig.slides || 7}
                onChange={(e) =>
                  updateGenerationConfig('slides', parseInt(e.target.value, 10))
                }
                className="slide-slider-input"
              />
              <div className="slide-slider-marks">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
                <span>7</span>
                <span>8</span>
                <span>9</span>
                <span>10</span>
              </div>
            </div>
          </div>
        )}

        {busy && (
          <div style={{ marginBottom: '18px' }}>
            <div className="workspace-panel-heading compact-heading" style={{ marginBottom: '10px' }}>
              <span className="panel-kicker"><Sparkles size={14} /> GENERATING OUTPUTS...</span>
            </div>
            <OutputsSkeleton />
          </div>
        )}

        {transformation.outputs.length ? (
          <div className="artifact-list">
            {transformation.outputs.map(
              (artifact) => (
                <article
                  className="artifact-card"
                  key={artifact.id}
                >
                  <div>
                    <strong>
                      {artifact.type.replaceAll(
                        '_',
                        ' ',
                      )}
                    </strong>

                    <small>
                      DNA v
                      {
                        artifact.dna_version
                      }
                    </small>
                  </div>

                  <pre>
                    {artifact.content}
                  </pre>

                  <div className="artifact-actions">
                    <button
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          artifact.content,
                        )
                      }
                      title="Copy content to clipboard"
                    >
                      <Clipboard
                        size={14}
                      />
                      Copy
                    </button>

                    <ArtifactDownloadDropdown
                      artifactType={artifact.type}
                      artifactContent={artifact.content}
                      docTitle={transformation.title}
                    />

                    {onDeleteOutput && (
                      <button
                        className="btn-delete-artifact"
                        title="Delete this output"
                        onClick={() => onDeleteOutput(artifact.id)}
                      >
                        <Trash2
                          size={14}
                        />
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          <p className="panel-empty-copy">
            Choose one or more output formats to
            generate your first artifact.
          </p>
        )}
      </Card>

      <Card className="versions-panel">
        <div className="workspace-panel-heading compact-heading">
          <div>
            <span className="panel-kicker">
              <RotateCcw size={14} /> VERSION HISTORY
            </span>

            <p>
              Versions are created on source processing
              and saved DNA edits.
            </p>
          </div>

          <Badge>
            {transformation.versions.length}{' '}
            versions
          </Badge>
        </div>

        {transformation.versions.length ? (
          <div className="version-list">
            {[...transformation.versions]
              .reverse()
              .map((version) => (
                <button
                  key={version.version}
                  onClick={() =>
                    onRestoreVersion(
                      version.version,
                    )
                  }
                >
                  <span>
                    DNA v{version.version}
                  </span>

                  <small>
                    {version.note ||
                      'Saved version'}
                  </small>
                </button>
              ))}
          </div>
        ) : (
          <p className="panel-empty-copy">
            DNA versions will appear after
            processing or saving changes.
          </p>
        )}
      </Card>

      {showSaveWorkflow &&
        createPortal(
          <div
            className="workflow-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowSaveWorkflow(false)
                setCustomWorkflowName('')
              }
            }}
          >
            <div
              className="workflow-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-workflow-title"
            >
              <div className="workflow-modal-header">
                <div>
                  <h3 id="save-workflow-title">
                    Save Custom Workflow
                  </h3>

                  <p>
                    Save the current outputs and generation settings
                    as a reusable workflow.
                  </p>
                </div>

                <button
                  type="button"
                  className="workflow-modal-close"
                  aria-label="Close"
                  onClick={() => {
                    setShowSaveWorkflow(false)
                    setCustomWorkflowName('')
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <label className="workflow-modal-field">
                <span>Workflow name</span>

                 <DragInput
                   as="input"
                   input={{
                     className: "workflow-name-input",
                     value: customWorkflowName,
                     onChange: (event) =>
                       setCustomWorkflowName(event.target.value),
                     placeholder: "e.g. Student Awareness Campaign",
                      autoFocus: true,
                     onKeyDown: (event) => {
                       if (
                         event.key === 'Enter' &&
                         customWorkflowName.trim()
                       ) {
                         void saveCustomWorkflow()
                       }

                       if (event.key === 'Escape') {
                         setShowSaveWorkflow(false)
                         setCustomWorkflowName('')
                       }
                     },
                   }}
                  />
               </label>

              <div className="workflow-modal-preview">
                <span>
                  {selected.length} output
                  {selected.length === 1 ? '' : 's'}
                </span>
                <span>·</span>
                <span>{generationConfig.language}</span>
                <span>·</span>
                <span>{generationConfig.audience}</span>
              </div>

              <div className="workflow-modal-actions">
                <button
                  type="button"
                  className="workflow-cancel-button"
                  onClick={() => {
                    setShowSaveWorkflow(false)
                    setCustomWorkflowName('')
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="workflow-save-confirm-button"
                  disabled={!customWorkflowName.trim()}
                  onClick={() => void saveCustomWorkflow()}
                >
                  Save Workflow
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function InlineGenerationSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: (string | { label: string; value: string })[]
  onChange: (value: string) => void
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#737d86',
        }}
      >
        {label}
      </span>

      <div
        style={{
          position: 'relative',
          width: '100%',
        }}
      >
        <select
          className="generation-select"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          style={{
            width: '100%',
            height: '38px',
            padding: '0 32px 0 11px',
            appearance: 'none',
            WebkitAppearance: 'none',
            background: '#10161a',
            color: '#d7dde1',
            border:
              '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            outline: 'none',
            fontSize: '12px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          {options.map((option) => {
            const optVal = typeof option === 'string' ? option : option.value
            const optLbl = typeof option === 'string' ? option : option.label
            return (
              <option
                key={optVal}
                value={optVal}
                style={{
                  backgroundColor:
                    '#10161a',
                  color: '#d7dde1',
                }}
              >
                {optLbl}
              </option>
            )
          })}
        </select>

        <ChevronDown
          size={14}
          style={{
            position: 'absolute',
            right: '11px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#737d86',
            pointerEvents: 'none',
          }}
        />
      </div>
    </label>
  )
}

function IntegrityClaimCard({
  claim,
  expanded,
  onToggle,
}: {
  claim: IntegrityClaim
  expanded: boolean
  onToggle: () => void
}) {
  const isConflict =
    claim.status === 'conflict'

  const isCorroborated =
    claim.status === 'corroborated'

  return (
    <article
      className={`integrity-claim-card ${isConflict
        ? 'integrity-claim-conflict'
        : ''
        }`}
    >
      <button
        type="button"
        className="integrity-claim-header"
        onClick={onToggle}
      >
        <div className="integrity-status-icon">
          {isConflict ? (
            <AlertTriangle size={16} />
          ) : isCorroborated ? (
            <CheckCircle2 size={16} />
          ) : (
            <ShieldCheck size={16} />
          )}
        </div>

        <div className="integrity-claim-main">
          <strong>
            {claim.subject}
            {' '}
            {claim.predicate.replaceAll(
              '_',
              ' ',
            )}
          </strong>

          <span>
            {String(claim.value ?? 'Unknown')}
            {claim.unit
              ? ` ${claim.unit}`
              : ''}
          </span>
        </div>

        <div className="integrity-claim-meta">
          <span
            className={`integrity-status integrity-status-${claim.status}`}
          >
            {claim.status}
          </span>

          {expanded ? (
            <ChevronDown size={15} />
          ) : (
            <ChevronRight size={15} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="integrity-claim-details">
          <div className="integrity-detail-row">
            <span>Claim</span>
            <strong>
              {claim.claim_key.replaceAll(
                '_',
                ' ',
              )}
            </strong>
          </div>

          {claim.time && (
            <div className="integrity-detail-row">
              <span>Time</span>
              <strong>
                {claim.time}
              </strong>
            </div>
          )}

          {claim.location && (
            <div className="integrity-detail-row">
              <span>Location</span>
              <strong>
                {claim.location}
              </strong>
            </div>
          )}

          <div className="integrity-conflict-reason">
            <span>Why this conflict occurred</span>
            <p>{getConflictReason(`Conflicting values detected for ${claim.unit || claim.subject}: ${String(claim.value ?? 'unknown')}`)}</p>
          </div>

          <div className="integrity-evidence-heading">
            Evidence
          </div>

          {claim.evidence.length ? (
            claim.evidence.map(
              (evidence, index) => (
                <div
                  className="integrity-evidence"
                  key={`${claim.claim_id}-evidence-${index}`}
                >
                  <div className="integrity-evidence-source">
                    <strong>
                      {evidence.source_reference}
                    </strong>

                    {evidence.page !== null && (
                      <span>
                        Page {evidence.page}
                      </span>
                    )}

                    {evidence.section && (
                      <span>
                        {evidence.section}
                      </span>
                    )}
                  </div>

                  <blockquote>
                    {evidence.supporting_excerpt}
                  </blockquote>

                  {evidence.timestamp && (
                    <small>
                      Timestamp:{' '}
                      {evidence.timestamp}
                    </small>
                  )}
                </div>
              ),
            )
          ) : (
            <p className="integrity-no-evidence">
              No supporting evidence was attached
              to this claim.
            </p>
          )}
        </div>
      )}
    </article>
  )
}