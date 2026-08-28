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
  PictureInPicture,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'

import { NewSourceBatch } from '../ev/NewSourceBatch'
import { ContentDNAStructure } from '../dna/ContentDNAStructure'
import type { DNASectionKey } from '../dna/dnaData'
import { DNAInspector } from '../dna/DNAInspector'
import { getDNANodes } from '../dna/dnaData'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'

import { analyzeSourceIntegrity } from '../../lib/api/client'

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
}

type WorkflowTemplate = {
  id: string
  name: string
  description: string
  output_types: string[]
  generation_config: Record<string, string>
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
}: TransformationWorkspaceProps) {
  const [dnaOpen, setDnaOpen] = useState(
    Boolean(transformation.content_dna),
  )

  const [integrity, setIntegrity] =
    useState<SourceIntegrity | null>(null)

  const [integrityLoading, setIntegrityLoading] =
    useState(false)

  const [integrityError, setIntegrityError] =
    useState('')

  const [expandedClaim, setExpandedClaim] =
    useState<string | null>(null)

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

          <input
            className="transformation-title"
            value={transformation.title}
            aria-label="Transformation title"
            onChange={(event) =>
              onRename(event.target.value)
            }
          />

          <p>
            Inputs become one isolated workspace. Content DNA
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
        <span>CONTENT DNA</span>
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
                <strong>CONTENT DNA</strong>
                <small>
                  Canonical structured understanding for this
                  transformation
                </small>
              </span>
            </span>

            <span className="dna-collapse-meta">
              <Badge>{dimensions}/8 dimensions</Badge>
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
              <div className="compact-structure">
                <ContentDNAStructure
                  dna={dna}
                  selectedNode={selectedNode}
                  onSelectNode={selectNode}
                />
              </div>

              <DNAInspector
                dna={dna}
                selectedNode={selectedNode}
                saveState={saveState}
                onPatch={onPatch}
              />
            </div>
          )}
        </Card>
      ) : (
        <Card className="dna-empty">
          <div className="dna-mini-mark">*</div>

          <div>
            <strong>CONTENT DNA</strong>

            <p>
              Add source material to build the structured
              understanding for this transformation.
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
              Compare claims across sources, detect genuine conflicts, and inspect
              the evidence behind each claim.
            </p>
          </div>

          <Badge>
            {integrity
              ? `${integrity.claims.length} claims`
              : 'Not analyzed'}
          </Badge>
        </div>

        <div className="integrity-toolbar">
          <div className="source-verification-heading">
            <strong>Source verification</strong>
            <span>
              Same facts are corroborated while differences in time or location are kept separate.
            </span>
          </div>

          <Button
            variant="primary"
            disabled={!transformation.sources.length}
            loading={integrityLoading}
            loadingLabel="Analyzing..."
            onClick={() => void runSourceIntegrity()}
          >
            <ShieldCheck size={15} />
            Run Source Integrity
          </Button>
        </div>

        {integrityError && (
          <div className="integrity-error" role="alert">
            <AlertTriangle size={15} />
            <span>{integrityError}</span>
          </div>
        )}

        {integrity && (
          <div className="integrity-results">
            <div className="integrity-summary">
              <span>
                <strong>{integrity.conflicts.length}</strong> conflicts
              </span>
            </div>

            {integrity.claims.length ? (
              <div className="integrity-claim-list">
                {integrity.claims.map((claim) => (
                  <IntegrityClaimCard
                    key={claim.claim_id}
                    claim={claim}
                    conflict={integrity.conflicts.find((conflict) =>
                      conflict.claim_ids.includes(claim.claim_id)
                    )}
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
            ) : (
              <p className="panel-empty-copy">
                No claims were extracted from the current sources.
              </p>
            )}

            {integrity.conflicts.length > 0 && (
              <div className="integrity-conflicts">
                <div className="integrity-evidence-heading">
                  Conflicts requiring review
                </div>
                {integrity.conflicts.map((conflict) => (
                  <div className="integrity-conflict-row" key={conflict.conflict_id}>
                    <div>
                      <strong>{conflict.description}</strong>
                      <small>
                        Status: {conflict.status}
                      </small>
                    </div>
                    <Badge>{conflict.claim_ids.length} claims</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <WorkspaceOutputs
        transformation={transformation}
        busy={busy}
        onGenerateOutputs={onGenerateOutputs}
        onRestoreVersion={onRestoreVersion}
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

function WorkspaceOutputs({
  transformation,
  busy,
  onGenerateOutputs,
  onRestoreVersion,
}: {
  transformation: Transformation
  busy: boolean
  onGenerateOutputs: (
    types: string[],
    generationConfig: GenerationConfig,
  ) => void
  onRestoreVersion: (version: number) => void
}) {
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
    })

  const [workflows, setWorkflows] = useState<
    WorkflowTemplate[]
  >([])

  const [selectedWorkflow, setSelectedWorkflow] =
    useState<string>('custom')

  const [workflowLoading, setWorkflowLoading] =
    useState(false)

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
    value: string,
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

  function downloadBinary(filename: string, content: Uint8Array, type: string) {
    const blob = new Blob([content.buffer.slice(0) as ArrayBuffer], { type })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()

    URL.revokeObjectURL(url)
  }

  function xmlEscape(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;')
  }

  function cleanSlideLine(value: string) {
    return value
      .replace(/^#{1,6}\s*/, '')
      .replace(/^[-*]\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/\*\*/g, '')
      .trim()
  }

  function buildPresentationSlides(content: string) {
    const slides: { title: string; bullets: string[] }[] = []
    let currentSlide: { title: string; bullets: string[] } | null = null

    function finishSlide() {
      if (!currentSlide) return

      const titleLineIndex = currentSlide.bullets.findIndex((line) =>
        /^title\s*:/i.test(line),
      )

      if (titleLineIndex >= 0) {
        currentSlide.title = currentSlide.bullets[titleLineIndex]
          .replace(/^title\s*:\s*/i, '')
          .trim() || currentSlide.title
        currentSlide.bullets.splice(titleLineIndex, 1)
      }

      slides.push({
        title: currentSlide.title,
        bullets: currentSlide.bullets.filter(Boolean),
      })
    }

    for (const rawLine of content.replaceAll('\r\n', '\n').split('\n')) {
      const headingMatch = rawLine.match(
        /^\s*(?:#{1,6}\s*)?(?:\*\*)?slide\s*(\d+)\s*(?::|-|\.|\u2013)?\s*(.*?)(?:\*\*)?\s*$/i,
      )

      if (headingMatch) {
        finishSlide()

        const slideNumber = headingMatch[1]
        const title = cleanSlideLine(headingMatch[2] || '') || `Slide ${slideNumber}`

        currentSlide = {
          title,
          bullets: [],
        }

        continue
      }

      if (currentSlide) {
        const line = cleanSlideLine(rawLine)
        if (line) currentSlide.bullets.push(line)
      }
    }

    finishSlide()

    if (slides.length) {
      return slides
    }

    const headingBlocks = content
      .replaceAll('\r\n', '\n')
      .split(/\n(?=#{1,3}\s+)/)
      .map((block) => block.trim())
      .filter(Boolean)

    if (headingBlocks.length > 1) {
      return headingBlocks.map((block, index) => {
        const lines = block.split('\n').map(cleanSlideLine).filter(Boolean)
        return {
          title: lines[0] || `Slide ${index + 1}`,
          bullets: lines.slice(1),
        }
      })
    }

    const lines = content.split('\n').map(cleanSlideLine).filter(Boolean)
    const chunkSize = 6

    for (let index = 0; index < Math.max(lines.length, 1); index += chunkSize) {
      const chunk = lines.slice(index, index + chunkSize)
      slides.push({
        title: index === 0 ? 'Presentation Overview' : `Slide ${slides.length + 1}`,
        bullets: chunk,
      })
    }

    return slides.length ? slides : [{ title: 'Presentation', bullets: ['No generated content available.'] }]
  }

  function crc32(data: Uint8Array) {
    let crc = 0xffffffff

    for (const byte of data) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
      }
    }

    return (crc ^ 0xffffffff) >>> 0
  }

  function createZip(files: { name: string; content: string }[]) {
    const encoder = new TextEncoder()
    const chunks: Uint8Array[] = []
    const centralDirectory: Uint8Array[] = []
    let offset = 0
    const now = new Date()
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

    function write16(view: DataView, position: number, value: number) {
      view.setUint16(position, value, true)
    }

    function write32(view: DataView, position: number, value: number) {
      view.setUint32(position, value, true)
    }

    for (const file of files) {
      const nameBytes = encoder.encode(file.name)
      const contentBytes = encoder.encode(file.content)
      const crc = crc32(contentBytes)
      const localHeader = new Uint8Array(30 + nameBytes.length)
      const localView = new DataView(localHeader.buffer)

      write32(localView, 0, 0x04034b50)
      write16(localView, 4, 20)
      write16(localView, 6, 0)
      write16(localView, 8, 0)
      write16(localView, 10, dosTime)
      write16(localView, 12, dosDate)
      write32(localView, 14, crc)
      write32(localView, 18, contentBytes.length)
      write32(localView, 22, contentBytes.length)
      write16(localView, 26, nameBytes.length)
      write16(localView, 28, 0)
      localHeader.set(nameBytes, 30)
      chunks.push(localHeader, contentBytes)

      const centralHeader = new Uint8Array(46 + nameBytes.length)
      const centralView = new DataView(centralHeader.buffer)

      write32(centralView, 0, 0x02014b50)
      write16(centralView, 4, 20)
      write16(centralView, 6, 20)
      write16(centralView, 8, 0)
      write16(centralView, 10, 0)
      write16(centralView, 12, dosTime)
      write16(centralView, 14, dosDate)
      write32(centralView, 16, crc)
      write32(centralView, 20, contentBytes.length)
      write32(centralView, 24, contentBytes.length)
      write16(centralView, 28, nameBytes.length)
      write16(centralView, 30, 0)
      write16(centralView, 32, 0)
      write16(centralView, 34, 0)
      write16(centralView, 36, 0)
      write32(centralView, 38, 0)
      write32(centralView, 42, offset)
      centralHeader.set(nameBytes, 46)
      centralDirectory.push(centralHeader)

      offset += localHeader.length + contentBytes.length
    }

    const centralOffset = offset
    const centralSize = centralDirectory.reduce((total, chunk) => total + chunk.length, 0)
    const endRecord = new Uint8Array(22)
    const endView = new DataView(endRecord.buffer)

    write32(endView, 0, 0x06054b50)
    write16(endView, 4, 0)
    write16(endView, 6, 0)
    write16(endView, 8, files.length)
    write16(endView, 10, files.length)
    write32(endView, 12, centralSize)
    write32(endView, 16, centralOffset)
    write16(endView, 20, 0)

    const allChunks = [...chunks, ...centralDirectory, endRecord]
    const totalLength = allChunks.reduce((total, chunk) => total + chunk.length, 0)
    const zip = new Uint8Array(totalLength)
    let cursor = 0

    for (const chunk of allChunks) {
      zip.set(chunk, cursor)
      cursor += chunk.length
    }

    return zip
  }

  function slideXml(slide: { title: string; bullets: string[] }, index: number) {
    const bulletRuns = slide.bullets.length
      ? slide.bullets.map((bullet) => `
        <a:p>
          <a:pPr lvl="0"><a:buChar char="•"/></a:pPr>
          <a:r><a:rPr lang="en-US" sz="2200"/><a:t>${xmlEscape(bullet)}</a:t></a:r>
          <a:endParaRPr lang="en-US" sz="2200"/>
        </a:p>
      `).join('')
      : '<a:p><a:r><a:rPr lang="en-US" sz="2200"/><a:t></a:t></a:r></a:p>'

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${index === 0 ? 'F4FAF9' : 'FFFFFF'}"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="609600" y="457200"/><a:ext cx="7924800" cy="838200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="3400" b="1"><a:solidFill><a:srgbClr val="17212F"/></a:solidFill></a:rPr><a:t>${xmlEscape(slide.title)}</a:t></a:r><a:endParaRPr lang="en-US" sz="3400"/></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="762000" y="1600200"/><a:ext cx="7620000" cy="4572000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${bulletRuns}</p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Footer"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="609600" y="6350000"/><a:ext cx="7924800" cy="304800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1100"><a:solidFill><a:srgbClr val="667386"/></a:solidFill></a:rPr><a:t>EV Workspace / Slide ${index + 1}</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`
  }

  function downloadPpt(filename: string, content: string) {
    const slides = buildPresentationSlides(content)
    const slideIds = slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join('')
    const presentationRelationships = slides.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('')
    const slideContentTypes = slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')
    const files = [
      {
        name: '[Content_Types].xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slideContentTypes}</Types>`,
      },
      {
        name: '_rels/.rels',
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
      },
      {
        name: 'ppt/presentation.xml',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="9144000" cy="6858000" type="screen4x3"/><p:notesSz cx="6858000" cy="9144000"/><p:sldIdLst>${slideIds}</p:sldIdLst></p:presentation>`,
      },
      {
        name: 'ppt/_rels/presentation.xml.rels',
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presentationRelationships}</Relationships>`,
      },
      ...slides.map((slide, index) => ({
        name: `ppt/slides/slide${index + 1}.xml`,
        content: slideXml(slide, index),
      })),
    ]

    downloadBinary(filename, createZip(files), 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  }

  function escapePdfText(value: string) {
    return value
      .replaceAll('\\', '\\\\')
      .replaceAll('(', '\\(')
      .replaceAll(')', '\\)')
      .replaceAll('\r', '')
  }

  function wrapPdfText(text: string, maxCharacters = 86) {
    const lines: string[] = []

    for (const rawLine of text.split('\n')) {
      const words = rawLine.trimEnd().split(/\s+/).filter(Boolean)

      if (!words.length) {
        lines.push('')
        continue
      }

      let line = ''

      for (const word of words) {
        const nextLine = line ? `${line} ${word}` : word

        if (nextLine.length > maxCharacters) {
          if (line) lines.push(line)
          line = word
        } else {
          line = nextLine
        }
      }

      if (line) lines.push(line)
    }

    return lines
  }

  function downloadPdf(filename: string, title: string, content: string, dnaVersion: number) {
    const pageWidth = 612
    const pageHeight = 792
    const margin = 54
    const lineHeight = 15
    const contentLines = wrapPdfText(content)
    const pages: string[][] = []
    let currentPage: string[] = []
    let currentY = pageHeight - 138

    for (const line of contentLines) {
      if (currentY < margin) {
        pages.push(currentPage)
        currentPage = []
        currentY = pageHeight - 82
      }

      currentPage.push(line)
      currentY -= lineHeight
    }

    pages.push(currentPage)

    const objects: string[] = []
    const pageObjectIds: number[] = []

    objects.push('<< /Type /Catalog /Pages 2 0 R >>')
    objects.push('PAGES_PLACEHOLDER')
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

    pages.forEach((pageLines, index) => {
      const pageNumber = index + 1
      const streamParts = [
        'BT',
        '/F1 18 Tf',
        '54 742 Td',
        `(${escapePdfText(title)}) Tj`,
        '/F1 9 Tf',
        '0 -22 Td',
        `(DNA v${dnaVersion} / Page ${pageNumber} of ${pages.length}) Tj`,
        '/F1 11 Tf',
        `0 ${index === 0 ? '-44' : '-20'} Td`,
      ]

      pageLines.forEach((line, lineIndex) => {
        if (lineIndex > 0) streamParts.push(`0 -${lineHeight} Td`)
        streamParts.push(`(${escapePdfText(line)}) Tj`)
      })

      streamParts.push('ET')

      const stream = streamParts.join('\n')
      const pageObjectId = objects.length + 1
      const contentObjectId = pageObjectId + 1

      pageObjectIds.push(pageObjectId)
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`)
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    })

    objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`

    const pdfParts = ['%PDF-1.4\n']
    const offsets: number[] = [0]

    objects.forEach((object, index) => {
      offsets.push(pdfParts.join('').length)
      pdfParts.push(`${index + 1} 0 obj\n${object}\nendobj\n`)
    })

    const xrefOffset = pdfParts.join('').length
    pdfParts.push(`xref\n0 ${objects.length + 1}\n`)
    pdfParts.push('0000000000 65535 f \n')
    offsets.slice(1).forEach((offset) => {
      pdfParts.push(`${String(offset).padStart(10, '0')} 00000 n \n`)
    })
    pdfParts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

    download(filename, pdfParts.join(''), 'application/pdf')
  }

  async function loadWorkflows() {
    try {
      setWorkflowLoading(true)

      const response = await fetch(
        'http://127.0.0.1:8000/api/v1/transformations/workflows',
      )

      if (!response.ok) {
        throw new Error('Failed to load workflows')
      }

      const data =
        (await response.json()) as WorkflowTemplate[]

      setWorkflows(data)
    } catch (error) {
      console.error(
        'Failed to load workflows:',
        error,
      )
    } finally {
      setWorkflowLoading(false)
    }
  }

  useEffect(() => {
    void loadWorkflows()
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

    const payload = {
      id: workflowId,
      name,
      description:
        'Custom operator workflow.',
      output_types: selected,
      generation_config: generationConfig,
    }

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/api/v1/transformations/workflows',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        const message = await response.text()

        throw new Error(
          message || 'Failed to save workflow',
        )
      }

      const workflow =
        (await response.json()) as WorkflowTemplate

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


  return (
    <div className="workspace-lower-grid">
      <Card className="outputs-panel">
        <div className="workspace-panel-heading compact-heading">
          <div>
            <span className="panel-kicker">
              <BookOpen size={14} /> OUTPUTS
            </span>

            <p>
              Generate and export artifacts from the current
              Content DNA version.
            </p>
          </div>

          <Badge>
            {transformation.outputs.length} artifacts
          </Badge>
        </div>

        <div
          className="generation-parameters"
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
            loading={busy}
            loadingLabel={selectedWorkflow !== 'custom' ? 'Running Workflow...' : 'Generating...'}
            disabled={
              !transformation.content_dna ||
              !selected.length
            }
            onClick={() =>
              onGenerateOutputs(
                selected,
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
                    >
                      <Clipboard
                        size={14}
                      />
                      Copy
                    </button>

                    <button
                      onClick={() =>
                        downloadPdf(
                          `${artifact.type}-dna-v${artifact.dna_version}.pdf`,
                          artifact.type.replaceAll('_', ' '),
                          artifact.content,
                          artifact.dna_version,
                        )
                      }
                    >
                      <Download
                        size={14}
                      />
                      Download PDF
                    </button>

                    {artifact.type === 'presentation' && (
                      <button
                        onClick={() =>
                          downloadPpt(
                            `${artifact.type}-dna-v${artifact.dna_version}.pptx`,
                            artifact.content,
                          )
                        }
                      >
                        <FileText
                          size={14}
                        />
                        Download PPT
                      </button>
                    )}
                  </div>
                </article>
              ),
            )}
          </div>
        ) : null}
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
                  type="button"
                  title={`Restore DNA v${version.version}`}
                  aria-label={`Restore DNA version ${version.version}`}
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

                  <em>Restore</em>
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

                <input
                  className="workflow-name-input"
                  value={customWorkflowName}
                  onChange={(event) =>
                    setCustomWorkflowName(event.target.value)
                  }
                  placeholder="e.g. Student Awareness Campaign"
                  autoFocus
                  onKeyDown={(event) => {
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
  options: string[]
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
          {options.map((option) => (
            <option
              key={option}
              value={option}
              style={{
                backgroundColor:
                  '#10161a',
                color: '#d7dde1',
              }}
            >
              {option}
            </option>
          ))}
        </select>

        <ChevronDown
          size={13}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform:
              'translateY(-50%)',
            pointerEvents: 'none',
            color: '#737d86',
          }}
        />
      </div>
    </label>
  )
}

function IntegrityClaimCard({
  claim,
  conflict,
  expanded,
  onToggle,
}: {
  claim: IntegrityClaim
  conflict?: {
    conflict_id: string
    claim_key: string
    description: string
    claim_ids: string[]
    status: string
  }
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
          <div className="integrity-detail-grid">
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
          </div>

          {isConflict && conflict && (
            <div className="integrity-conflict-reason">
              <span>Why this conflict occurred</span>
              <p>{getConflictReason(conflict.description)}</p>
            </div>
          )}

          <section className="integrity-evidence-section">
            <div className="integrity-evidence-heading">
              <span>Evidence</span>
              <small>{claim.evidence.length} source{claim.evidence.length === 1 ? '' : 's'}</small>
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
          </section>
        </div>
      )}
    </article>
  )
}
