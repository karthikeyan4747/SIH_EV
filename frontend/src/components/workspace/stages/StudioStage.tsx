import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera,
  Check,
  Clipboard,
  FileText,
  Sparkles,
  Trash2,
  Upload,
  X,
  Bookmark,
  ChevronDown,
  Video,
  Share2,
  Hash,
  ShieldAlert,
  BarChart3,
  Presentation,
  ArrowRight,
  Layers,
} from 'lucide-react'
import type { Transformation } from '../../../types/transformation'
import {
  generateFromTemplate,
  getAvailableModels,
  listWorkflows,
  type ModelListResponse,
  type WorkflowTemplate,
} from '../../../lib/api/client'
import { OutputsSkeleton } from '../../ui/Skeleton'
import { WorkflowSaveModal } from '../WorkflowSaveModal'
import { DocumentPdfViewer } from '../DocumentPdfViewer'
import { SlideDeckViewer } from '../SlideDeckViewer'
import { ArtifactDownloadDropdown } from '../ArtifactDownloadDropdown'

export type GenerationConfig = {
  audience: string
  tone: string
  language: string
  detail: string
  objective: string
  style: string
  prompt?: string
  slides?: number
  model?: string
}

const INDIAN_LANGUAGES = [
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
]

const AUDIENCES = [
  'General Public',
  'Technical Team',
  'Executives',
  'Government Officials',
  'Students',
  'Researchers',
]

const TONES = [
  'Professional',
  'Formal',
  'Technical',
  'Persuasive',
  'Neutral',
  'Urgent',
]

const DETAILS = [
  'Concise',
  'Balanced',
  'Detailed',
  'Comprehensive',
]

const OBJECTIVES = [
  'Inform',
  'Persuade',
  'Summarize',
  'Warn',
  'Educate',
  'Announce',
  'Decision Support',
]

const STYLES = [
  'Corporate',
  'Academic',
  'Social Media',
  'Government',
  'Technical',
  'News',
]

interface StudioStageProps {
  transformation: Transformation
  busy: boolean
  onGenerateOutputs: (types: string[], config: GenerationConfig) => void
  onDeleteOutput?: (outputId: string) => void
  onTransformationUpdated?: (updated: Transformation) => void
}

export function StudioStage({
  transformation,
  busy,
  onGenerateOutputs,
  onDeleteOutput,
  onTransformationUpdated,
}: StudioStageProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    'executive_summary',
    'presentation',
  ])

  const [config, setConfig] = useState<GenerationConfig>({
    audience: 'Executives',
    tone: 'Professional',
    language: 'English',
    detail: 'Balanced',
    objective: 'Decision Support',
    style: 'Corporate',
    slides: 7,
    model: '',
  })

  // Workflows
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('custom')
  const [workflowLoading, setWorkflowLoading] = useState(true)
  const [showSaveWorkflowModal, setShowSaveWorkflowModal] = useState(false)

  // Models
  const [modelData, setModelData] = useState<ModelListResponse | null>(null)

  // Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateMode, setTemplateMode] = useState<'file' | 'text'>('file')
  const [templateFileBase64, setTemplateFileBase64] = useState<string | null>(null)
  const [templateFileName, setTemplateFileName] = useState('')
  const [templateFileType, setTemplateFileType] = useState<'pdf' | 'docx' | 'image' | 'text' | null>(null)
  const [templateText, setTemplateText] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templatePrompt, setTemplatePrompt] = useState('')
  const [templateGenerating, setTemplateGenerating] = useState(false)
  const [templateError, setTemplateError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    listWorkflows()
      .then((data) => {
        if (isMounted) setWorkflows(data)
      })
      .catch((err) => console.error('Failed to load workflows:', err))
      .finally(() => {
        if (isMounted) setWorkflowLoading(false)
      })

    getAvailableModels()
      .then((data) => {
        if (isMounted) {
          setModelData(data)
          if (!config.model && data.active_model) {
            setConfig((curr) => ({ ...curr, model: data.active_model }))
          }
        }
      })
      .catch((err) => console.debug('Failed to load models:', err))

    return () => {
      isMounted = false
    }
  }, [])

  const applyWorkflow = (workflowId: string) => {
    setSelectedWorkflow(workflowId)
    if (workflowId === 'custom') return

    const wf = workflows.find((w) => w.id === workflowId)
    if (!wf) return

    if (wf.output_types && wf.output_types.length > 0) {
      setSelectedTypes(wf.output_types)
    }

    if (wf.generation_config) {
      setConfig((curr) => ({
        ...curr,
        audience: wf.generation_config.audience ?? curr.audience,
        tone: wf.generation_config.tone ?? curr.tone,
        language: wf.generation_config.language ?? curr.language,
        detail: wf.generation_config.detail ?? curr.detail,
        objective: wf.generation_config.objective ?? curr.objective,
        style: wf.generation_config.style ?? curr.style,
        slides: wf.generation_config.slides ?? curr.slides,
        model: wf.generation_config.model ?? curr.model,
      }))
    }
  }

  const outputOptions = [
    {
      id: 'video',
      label: 'Video',
      desc: 'Complete video package including script, storyboard, scene descriptions, narration text, subtitles and visual recommendations.',
      icon: Video,
    },
    {
      id: 'linkedin',
      label: 'LinkedIn Post',
      desc: 'Professional LinkedIn post suitable for publication.',
      icon: Share2,
    },
    {
      id: 'twitter',
      label: 'Twitter/X Post',
      desc: 'Platform-optimized tweets or tweet threads.',
      icon: Hash,
    },
    {
      id: 'advisory',
      label: 'Advisory',
      desc: 'Structured advisory document.',
      icon: ShieldAlert,
    },
    {
      id: 'infographic',
      label: 'Infographic',
      desc: 'Infographic content, layout recommendations and key messaging.',
      icon: BarChart3,
    },
    {
      id: 'executive_summary',
      label: 'Executive Summary',
      desc: 'Concise executive briefing.',
      icon: FileText,
    },
    {
      id: 'presentation',
      label: 'Presentation',
      desc: 'Presentation slides and speaker notes.',
      icon: Presentation,
    },
  ]

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => {
      const updated = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
      if (selectedWorkflow !== 'custom') {
        setSelectedWorkflow('custom')
      }
      return updated
    })
  }

  const handleParamChange = (key: keyof GenerationConfig, val: any) => {
    setConfig((curr) => ({ ...curr, [key]: val }))
    if (selectedWorkflow !== 'custom') {
      setSelectedWorkflow('custom')
    }
  }

  const handleTemplateFileUpload = (file: File) => {
    const fn = file.name.toLowerCase()
    let detectedType: 'pdf' | 'docx' | 'image' | 'text' | null = null

    if (file.type === 'application/pdf' || fn.endsWith('.pdf')) {
      detectedType = 'pdf'
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword' ||
      fn.endsWith('.docx') ||
      fn.endsWith('.doc')
    ) {
      detectedType = 'docx'
    } else if (file.type.startsWith('image/')) {
      detectedType = 'image'
    } else if (file.type.startsWith('text/') || fn.endsWith('.txt') || fn.endsWith('.md')) {
      detectedType = 'text'
    } else {
      setTemplateError('Please upload a PDF (.pdf), Word Document (.docx), or image file.')
      return
    }

    setTemplateError('')
    setTemplateFileName(file.name)
    setTemplateFileType(detectedType)

    const reader = new FileReader()
    reader.onload = (e) => {
      setTemplateFileBase64(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleClearTemplateFile = () => {
    setTemplateFileBase64(null)
    setTemplateFileName('')
    setTemplateFileType(null)
  }

  const handleRunTemplateCloner = async () => {
    if (templateMode === 'file' && !templateFileBase64) {
      setTemplateError('Please upload a reference document first.')
      return
    }
    if (templateMode === 'text' && !templateText.trim()) {
      setTemplateError('Please paste template structure text.')
      return
    }

    setTemplateGenerating(true)
    setTemplateError('')

    try {
      const updated = await generateFromTemplate(transformation.id, {
        template_file_base64: templateMode === 'file' ? (templateFileBase64 || undefined) : undefined,
        template_file_name: templateMode === 'file' ? (templateFileName || undefined) : undefined,
        template_image_base64: (templateMode === 'file' && templateFileType === 'image') ? (templateFileBase64 || undefined) : undefined,
        template_text: templateMode === 'text' ? (templateText.trim() || undefined) : undefined,
        template_name: templateName.trim() || templateFileName || 'Reference Template Clone',
        generation_config: {
          ...config,
          ...(templatePrompt.trim() ? { objective: templatePrompt.trim() } : {}),
        },
      })
      onTransformationUpdated?.(updated)
      setShowTemplateModal(false)
      setTemplateFileBase64(null)
      setTemplateFileName('')
      setTemplateText('')
      setTemplateName('')
      setTemplatePrompt('')
    } catch (err: any) {
      setTemplateError(err?.message || 'Failed to clone template.')
    } finally {
      setTemplateGenerating(false)
    }
  }

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="studio-stage-container">
      {/* Universal Template-Based Generation - Core Novelty Workstation */}
      <section id="template-cloner-workbench" className="template-cloner-workbench tactile-card">
        {/* Header & Core Novelty Value Proposition */}
        <div className="workbench-header">
          <div className="workbench-title-area">
            <div className="workbench-core-badge">
              <Layers size={14} />
              <span>CORE NOVELTY · UNIVERSAL TEMPLATE-BASED GENERATION</span>
            </div>
            <h3>Reference Document & Structural Template Cloner</h3>
            <p>
              Generating deliverables from scratch is time-consuming and resource-intensive. Upload any pre-existing document (PDF, Word, or screenshot) to deterministically extract its layout hierarchy, section structures, and formatting—then synthesize your publication in the exact same format, grounded strictly in your Content DNA.
            </p>
          </div>

          <div className="workbench-pills-row">
            <span className="workbench-pill">
              <Check size={12} /> Deterministic Layout Extraction
            </span>
            <span className="workbench-pill">
              <Check size={12} /> Section & Hierarchy Replication
            </span>
            <span className="workbench-pill">
              <Check size={12} /> Grounded Strictly in Content DNA
            </span>
            <span className="workbench-pill">
              <Check size={12} /> Zero Manual Redesign
            </span>
          </div>
        </div>

        {/* Interactive Workspace Grid */}
        <div className="workbench-interactive-grid">
          {/* Left Column: Reference Ingestion (Dropzone / Text Area) */}
          <div className="workbench-input-pane">
            <div className="workbench-mode-tabs">
              <button
                type="button"
                className={`workbench-tab ${templateMode === 'file' ? 'active' : ''}`}
                onClick={() => setTemplateMode('file')}
              >
                <Upload size={14} />
                <span>Upload Reference Document (PDF / DOCX / Image)</span>
              </button>
              <button
                type="button"
                className={`workbench-tab ${templateMode === 'text' ? 'active' : ''}`}
                onClick={() => setTemplateMode('text')}
              >
                <FileText size={14} />
                <span>Paste Layout Text / Markdown</span>
              </button>
            </div>

            {templateMode === 'file' ? (
              <div
                className={`workbench-dropzone ${templateFileBase64 ? 'has-file' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleTemplateFileUpload(e.dataTransfer.files[0])
                  }
                }}
              >
                <input
                  type="file"
                  id="template-workbench-file-input"
                  className="workbench-file-input"
                  accept=".pdf,.docx,.doc,image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleTemplateFileUpload(e.target.files[0])
                    }
                  }}
                />
                {templateFileName ? (
                  <div className="workbench-file-card">
                    <div className="file-card-icon">
                      <FileText size={32} />
                    </div>
                    <div className="file-card-meta">
                      <div className="file-card-title-row">
                        <strong className="file-name">{templateFileName}</strong>
                        <span className="file-type-pill">{templateFileType?.toUpperCase() || 'DOCUMENT'}</span>
                      </div>
                      <span className="file-status">Blueprint ready for deterministic layout extraction</span>
                    </div>
                    <button
                      type="button"
                      className="file-change-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleClearTemplateFile()
                      }}
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <label htmlFor="template-workbench-file-input" className="dropzone-label">
                    <div className="dropzone-icon-circle">
                      <Upload size={28} />
                    </div>
                    <strong className="dropzone-prompt">Drop reference document here or click to browse</strong>
                    <span className="dropzone-sub">Upload an existing report, memo, briefing sheet, or template</span>
                    <div className="dropzone-supported-tags">
                      <span>PDF Documents</span>
                      <span>Word (.docx)</span>
                      <span>Layout Screenshots (PNG, JPG)</span>
                    </div>
                  </label>
                )}
              </div>
            ) : (
              <div className="workbench-textarea-container">
                <textarea
                  className="workbench-textarea"
                  rows={8}
                  placeholder={`Paste reference template structure or markdown layout...
Example:
# [Report Title]
## Executive Summary (3 bullet points)
## Market Comparison Table [Quarter | Metric | Variance]
## Strategic Recommendations & Callouts`}
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Right Column: Template Configuration & Synthesis Action */}
          <div className="workbench-config-pane">
            <div className="workbench-fields">
              <div className="workbench-field">
                <label htmlFor="workbench-template-name">
                  <span>Deliverable Identifier / Name</span>
                  <small>Output title for cloned deliverable</small>
                </label>
                <input
                  id="workbench-template-name"
                  type="text"
                  className="workbench-input"
                  placeholder="e.g. Q4 Executive Board Brief, Global Clinical Review"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>

              <div className="workbench-field">
                <label htmlFor="workbench-template-prompt">
                  <span>Focus Objective & Persona Alignment <small>(Optional)</small></span>
                  <small>Prioritize specific Content DNA dimensions</small>
                </label>
                <input
                  id="workbench-template-prompt"
                  type="text"
                  className="workbench-input"
                  placeholder="e.g. Focus on financial comparison, executive takeaways, and risk metrics"
                  value={templatePrompt}
                  onChange={(e) => setTemplatePrompt(e.target.value)}
                />
              </div>
            </div>

            {templateError && (
              <div className="workbench-error-banner" role="alert">
                <ShieldAlert size={14} />
                <span>{templateError}</span>
              </div>
            )}

            <div className="workbench-action-footer">
              <button
                type="button"
                className="workbench-clone-btn primary"
                onClick={handleRunTemplateCloner}
                disabled={templateGenerating}
              >
                <Camera size={18} />
                <span>
                  {templateGenerating
                    ? 'Extracting Layout & Synthesizing Deliverable...'
                    : 'Clone Reference Template & Synthesize Deliverable'}
                </span>
                {!templateGenerating && <ArrowRight size={16} />}
              </button>
              <span className="workbench-guarantee-note">
                Strict Zero-Hallucination: Generated output is verified against your source Content DNA.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Studio Two-Column Grid */}
      <div className="studio-main-grid">
        {/* Left Column: Configuration Deck */}
        <section className="studio-controls-deck tactile-card">
          {/* Custom Workflow Preset Bar */}
          <div className="workflow-preset-section">
            <div className="workflow-preset-header">
              <div className="preset-label-wrap">
                <Bookmark size={13} />
                <span className="preset-label">WORKFLOW PRESET</span>
              </div>
              <button
                type="button"
                className="btn-save-workflow-trigger"
                onClick={() => setShowSaveWorkflowModal(true)}
                title="Save active configuration as a reusable preset"
              >
                <Sparkles size={12} />
                <span>Save Workflow</span>
              </button>
            </div>

            <div className="workflow-select-wrap">
              <select
                className="workflow-dropdown-select"
                value={selectedWorkflow}
                disabled={workflowLoading}
                onChange={(e) => applyWorkflow(e.target.value)}
              >
                <option value="custom">Custom Configuration</option>
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-chevron" />
            </div>

            {selectedWorkflow !== 'custom' && (
              <p className="workflow-desc-callout">
                {workflows.find((w) => w.id === selectedWorkflow)?.description || 'Preset configuration applied.'}
              </p>
            )}
          </div>

          <div className="deck-divider" />

          {/* Step 1: Format Selection */}
          <div className="deck-section-title">
            <span className="deck-step-tag">Step 1</span>
            <h4>Select Deliverable Formats</h4>
          </div>

          <div className="deliverable-types-grid">
            {outputOptions.map((opt) => {
              const isChecked = selectedTypes.includes(opt.id)
              const Icon = opt.icon
              return (
                <div
                  key={opt.id}
                  className={`type-selection-card ${isChecked ? 'selected' : ''}`}
                  onClick={() => toggleType(opt.id)}
                >
                  <div className="type-check-box">
                    {isChecked && <Check size={12} />}
                  </div>
                  <div className="type-info">
                    <div className="type-label-row">
                      <Icon size={14} className="type-label-icon" />
                      <strong>{opt.label}</strong>
                    </div>
                    <p>{opt.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Slide Count Slider (Only when presentation is selected) */}
          {selectedTypes.includes('presentation') && (
            <div className="slides-stepper-box tactile-card">
              <div className="stepper-header">
                <span className="stepper-label">Number of Presentation Slides (1–15)</span>
                <strong className="stepper-count">{config.slides || 7} Slides</strong>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={config.slides || 7}
                onChange={(e) => handleParamChange('slides', Number(e.target.value))}
                className="slides-range-slider"
              />
              <div className="slides-presets-row">
                <span className="presets-label">Presets:</span>
                {[
                  { count: 3, label: '3 (Exec)' },
                  { count: 5, label: '5 (Standard)' },
                  { count: 7, label: '7 (Briefing)' },
                  { count: 10, label: '10 (Deep Dive)' },
                  { count: 12, label: '12 (Full)' },
                ].map((p) => (
                  <button
                    key={p.count}
                    type="button"
                    className={`btn-slide-preset ${config.slides === p.count ? 'active' : ''}`}
                    onClick={() => handleParamChange('slides', p.count)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="deck-divider" />

          {/* Step 2: All 7 Parameters */}
          <div className="deck-section-title">
            <span className="deck-step-tag">Step 2</span>
            <h4>Generation & Persona Parameters (7 Controls)</h4>
          </div>

          <div className="parameters-grid">
            {/* 1. AI Engine & Token Balance */}
            <div className="param-field full-width">
              <label>AI Model Engine & Daily Quota</label>
              <div className="custom-select-wrap">
                <select
                  value={config.model || modelData?.active_model || ''}
                  onChange={(e) => handleParamChange('model', e.target.value)}
                >
                  {(modelData?.models || []).length > 0 ? (
                    modelData!.models.map((m) => {
                      const tokenStr =
                        m.provider === 'local'
                          ? '∞ Local'
                          : m.remaining_daily_tokens != null
                          ? `${(m.remaining_daily_tokens / 1000).toFixed(0)}k left`
                          : 'Active'
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name} ({tokenStr})
                        </option>
                      )
                    })
                  ) : (
                    <option value="">Default AI Engine</option>
                  )}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* 2. Target Audience */}
            <div className="param-field">
              <label>Target Audience</label>
              <div className="custom-select-wrap">
                <select
                  value={config.audience}
                  onChange={(e) => handleParamChange('audience', e.target.value)}
                >
                  {AUDIENCES.map((aud) => (
                    <option key={aud} value={aud}>
                      {aud}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* 3. Communication Tone */}
            <div className="param-field">
              <label>Communication Tone</label>
              <div className="custom-select-wrap">
                <select
                  value={config.tone}
                  onChange={(e) => handleParamChange('tone', e.target.value)}
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* 4. Language (Indian Languages Only) */}
            <div className="param-field">
              <label>Language (Indian Languages)</label>
              <div className="custom-select-wrap">
                <select
                  value={config.language}
                  onChange={(e) => handleParamChange('language', e.target.value)}
                >
                  {INDIAN_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* 5. Level of Detail */}
            <div className="param-field">
              <label>Level of Detail</label>
              <div className="custom-select-wrap">
                <select
                  value={config.detail}
                  onChange={(e) => handleParamChange('detail', e.target.value)}
                >
                  {DETAILS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* 6. Communication Objective */}
            <div className="param-field">
              <label>Communication Objective</label>
              <div className="custom-select-wrap">
                <select
                  value={config.objective}
                  onChange={(e) => handleParamChange('objective', e.target.value)}
                >
                  {OBJECTIVES.map((obj) => (
                    <option key={obj} value={obj}>
                      {obj}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* 7. Content Style */}
            <div className="param-field">
              <label>Content Style</label>
              <div className="custom-select-wrap">
                <select
                  value={config.style}
                  onChange={(e) => handleParamChange('style', e.target.value)}
                >
                  {STYLES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
            </div>

            {/* Custom Steering Prompt / Focus Directive */}
            <div className="steering-prompt-section" style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <label htmlFor="deck-steering-prompt" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Focus Prompt / Steering Instructions <small style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</small>
                </label>
              </div>
              <textarea
                id="deck-steering-prompt"
                rows={2}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
                placeholder="e.g. 'Only make a post about the CEO\'s opinion', 'Focus solely on risk indicators and market impact'"
                value={config.prompt || ''}
                onChange={(e) => handleParamChange('prompt', e.target.value)}
              />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Content DNA guarantees zero hallucination while steering directly to your custom prompt.
              </span>
            </div>

            {/* Action: Generate Deliverables */}
            <div className="deck-action-footer" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="generate-deliverables-btn"
                style={{ width: '100%', padding: '12px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                disabled={busy || selectedTypes.length === 0}
                onClick={() => onGenerateOutputs(selectedTypes, config)}
              >
                <Sparkles size={15} />
                <span>
                  {busy
                    ? 'Generating Deliverables...'
                    : selectedWorkflow !== 'custom'
                    ? `Run Workflow (${selectedTypes.length})`
                    : `Generate Deliverables (${selectedTypes.length})`}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Generated Deliverables Library */}
        <section className="studio-artifacts-deck tactile-card">
          <div className="deliverables-deck-header">
            <div className="deck-header-info">
              <div className="deck-header-title-row">
                <h4>Generated Deliverables</h4>
                <span className="deliverables-count-chip">
                  {transformation.outputs.length} {transformation.outputs.length === 1 ? 'Deliverable' : 'Deliverables'}
                </span>
              </div>
              <p>
                Verified publications presented in print-ready PDF format grounded in synthesized Content DNA.
              </p>
            </div>
          </div>

          {busy && (
            <div className="studio-generating-banner">
              <OutputsSkeleton />
            </div>
          )}

          {transformation.outputs.length === 0 && !busy ? (
            <div className="studio-empty-deliverables">
              <div className="empty-deliverables-icon-box">
                <FileText size={26} />
              </div>
              <h4>No deliverables generated yet</h4>
              <p>
                Configure your deliverable formats and persona parameters on the left, then click{' '}
                <strong>"Generate Deliverables"</strong> to produce verified publications.
              </p>
              <div className="empty-deliverables-steps">
                <div className="empty-step-item">
                  <span className="empty-step-num">1</span>
                  <span>Select formats (e.g. Executive Summary, Presentation)</span>
                </div>
                <div className="empty-step-item">
                  <span className="empty-step-num">2</span>
                  <span>Set tone, detail level, and target audience</span>
                </div>
                <div className="empty-step-item">
                  <span className="empty-step-num">3</span>
                  <span>Generate output or clone from a reference template</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="artifacts-stream">
              {transformation.outputs.map((artifact) => {
                const isTemplateClone = artifact.type === 'template_clone'
                const displayTitle = isTemplateClone
                  ? (artifact.metadata as any)?.template_name || 'Cloned Layout Deliverable'
                  : artifact.type === 'video'
                  ? 'Video Production Blueprint & Package'
                  : artifact.type === 'linkedin'
                  ? 'Professional LinkedIn Post'
                  : artifact.type === 'twitter'
                  ? 'Platform-Optimized Twitter/X Post'
                  : artifact.type === 'advisory'
                  ? 'Structured Strategic Advisory'
                  : artifact.type === 'infographic'
                  ? 'Infographic Design Specification'
                  : artifact.type === 'executive_summary'
                  ? 'Concise Executive Briefing'
                  : artifact.type === 'presentation'
                  ? 'Executive Presentation Slides & Notes'
                  : artifact.type.replaceAll('_', ' ')

                const pillLabel = isTemplateClone
                  ? 'TEMPLATE CLONE'
                  : artifact.type === 'video'
                  ? 'VIDEO PACKAGE'
                  : artifact.type === 'linkedin'
                  ? 'LINKEDIN POST'
                  : artifact.type === 'twitter'
                  ? 'TWITTER / X'
                  : artifact.type === 'advisory'
                  ? 'ADVISORY'
                  : artifact.type === 'infographic'
                  ? 'INFOGRAPHIC'
                  : artifact.type === 'executive_summary'
                  ? 'EXEC SUMMARY'
                  : artifact.type === 'presentation'
                  ? 'PRESENTATION'
                  : artifact.type.replaceAll('_', ' ').toUpperCase()

                return (
                  <article key={artifact.id} className="deliverable-card tactile-card">
                    {/* Header Bar */}
                    <div className="deliverable-card-header">
                      <div className="header-left">
                        <span className="deliverable-type-pill">{pillLabel}</span>
                        <strong className="deliverable-title">{displayTitle}</strong>
                      </div>

                      <div className="header-right">
                        <span className="deliverable-version-tag">DNA v{artifact.dna_version}</span>
                        {onDeleteOutput && (
                          <button
                            type="button"
                            className="btn-icon-danger"
                            onClick={() => onDeleteOutput(artifact.id)}
                            title="Delete this deliverable"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Viewport: Interactive Slide Deck for Presentation, Document PDF for others */}
                    <div className="deliverable-pdf-container">
                      {artifact.type === 'presentation' ? (
                        <SlideDeckViewer
                          title={transformation.title}
                          content={artifact.content}
                          artifactType={artifact.type}
                        />
                      ) : (
                        <DocumentPdfViewer
                          title={transformation.title}
                          content={artifact.content}
                          artifactType={artifact.type}
                        />
                      )}
                    </div>

                    {/* Action Bar with Multi-Format Downloader */}
                    <div className="deliverable-footer-actions">
                      <button
                        type="button"
                        className="export-btn"
                        onClick={() => handleCopy(artifact.id, artifact.content)}
                        title="Copy text to clipboard"
                      >
                        {copiedId === artifact.id ? <Check size={13} /> : <Clipboard size={13} />}
                        <span>{copiedId === artifact.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      <ArtifactDownloadDropdown
                        artifactType={artifact.type}
                        artifactContent={artifact.content}
                        docTitle={transformation.title}
                      />
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Workflow Save Modal */}
      <WorkflowSaveModal
        open={showSaveWorkflowModal}
        onClose={() => setShowSaveWorkflowModal(false)}
        outputTypes={selectedTypes}
        generationConfig={config}
        onSave={(newWf) => {
          setWorkflows((prev) => [...prev.filter((w) => w.id !== newWf.id), newWf])
          setSelectedWorkflow(newWf.id)
        }}
      />

      {/* Template Cloner Modal */}
      {showTemplateModal && createPortal(
        <div className="template-modal-backdrop" onClick={() => setShowTemplateModal(false)}>
          <div className="template-modal-card tactile-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Clone Custom Document Template</h3>
                <p>Provide a reference document layout to replicate its exact structure deterministically.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowTemplateModal(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-tabs">
              <button
                type="button"
                className={`modal-tab ${templateMode === 'file' ? 'active' : ''}`}
                onClick={() => setTemplateMode('file')}
              >
                <Upload size={14} />
                <span>Upload Document (PDF / DOCX / Image)</span>
              </button>
              <button
                type="button"
                className={`modal-tab ${templateMode === 'text' ? 'active' : ''}`}
                onClick={() => setTemplateMode('text')}
              >
                <FileText size={14} />
                <span>Paste Template Text</span>
              </button>
            </div>

            {templateError && (
              <div className="modal-error-banner" role="alert">
                {templateError}
              </div>
            )}

            {templateMode === 'file' ? (
              <div className="modal-file-dropzone">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleTemplateFileUpload(e.target.files[0])
                    }
                  }}
                />
                {templateFileName ? (
                  <div className="file-chosen-preview">
                    <FileText size={24} />
                    <strong>{templateFileName}</strong>
                    <span>Ready for layout extraction</span>
                  </div>
                ) : (
                  <div className="dropzone-hint">
                    <Upload size={24} />
                    <strong>Choose a PDF, DOCX, or screenshot</strong>
                    <p>EV will extract headings, styles, and section layouts to map into Content DNA.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="modal-textarea-wrap">
                <textarea
                  rows={6}
                  placeholder="Paste reference template text or markdown layout structure..."
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                />
              </div>
            )}

            <div className="modal-field">
              <label>Template Identifier</label>
              <input
                type="text"
                placeholder="e.g. Q4 Executive Board Brief"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="modal-field">
              <label>Focus Objective / Prompt (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Focus on financial comparison, executive takeaways, and risk metrics"
                value={templatePrompt}
                onChange={(e) => setTemplatePrompt(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowTemplateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-generate-template primary"
                onClick={handleRunTemplateCloner}
                disabled={templateGenerating}
              >
                <Sparkles size={14} />
                <span>{templateGenerating ? 'Extracting & Generating...' : 'Clone & Synthesize'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
