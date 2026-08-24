import { useMemo, useState } from 'react'
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
import type {
  ContentDNAPatch,
  RawContent,
  SourceType,
} from '../../types/content'
import type { Transformation } from '../../types/transformation'

export type GenerationConfig = {
  audience: string
  tone: string
  language: string
  detail: string
  objective: string
  style: string
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

  function exportBundle() {
    download(
      `${transformation.title || 'ev-transformation'}.json`,
      JSON.stringify(
        {
          id: transformation.id,
          title: transformation.title,
          dnaVersion: transformation.versions.length,
          contentDNA: transformation.content_dna,
          outputs: transformation.outputs,
          generationConfig,
        },
        null,
        2,
      ),
      'application/json',
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

        {/* GENERATION PARAMETERS */}

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
              updateGenerationConfig('audience', value)
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
              updateGenerationConfig('tone', value)
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
            ]}
            onChange={(value) =>
              updateGenerationConfig('language', value)
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
              updateGenerationConfig('detail', value)
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
              updateGenerationConfig('objective', value)
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
              updateGenerationConfig('style', value)
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
              onClick={() => toggle(type)}
            >
              {label}
            </button>
          ))}

          <Button
            variant="primary"
            disabled={
              !transformation.content_dna ||
              busy ||
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
            Generate
          </Button>

          <Button
            variant="ghost"
            disabled={!transformation.outputs.length}
            onClick={exportBundle}
          >
            <FileJson size={15} />
            Export JSON
          </Button>
        </div>

        {transformation.outputs.length ? (
          <div className="artifact-list">
            {transformation.outputs.map((artifact) => (
              <article
                className="artifact-card"
                key={artifact.id}
              >
                <div>
                  <strong>
                    {artifact.type.replaceAll('_', ' ')}
                  </strong>

                  <small>
                    DNA v{artifact.dna_version}
                  </small>
                </div>

                <pre>{artifact.content}</pre>

                <div className="artifact-actions">
                  <button
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        artifact.content,
                      )
                    }
                  >
                    <Clipboard size={14} />
                    Copy
                  </button>

                  <button
                    onClick={() =>
                      download(
                        `${artifact.type}-dna-v${artifact.dna_version}.md`,
                        artifact.content,
                        'text/markdown',
                      )
                    }
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="panel-empty-copy">
            Choose one or more output formats to generate
            your first artifact.
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
              Versions are created on source processing and
              saved DNA edits.
            </p>
          </div>

          <Badge>
            {transformation.versions.length} versions
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
                    onRestoreVersion(version.version)
                  }
                >
                  <span>
                    DNA v{version.version}
                  </span>

                  <small>
                    {version.note || 'Saved version'}
                  </small>
                </button>
              ))}
          </div>
        ) : (
          <p className="panel-empty-copy">
            DNA versions will appear after processing or
            saving changes.
          </p>
        )}
      </Card>
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
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: '100%',
            height: '38px',
            padding: '0 32px 0 11px',
            appearance: 'none',
            WebkitAppearance: 'none',
            background: '#10161a',
            color: '#d7dde1',
            border: '1px solid rgba(255,255,255,0.08)',
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
                backgroundColor: '#10161a',
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
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#737d86',
          }}
        />
      </div>
    </label>
  )
}