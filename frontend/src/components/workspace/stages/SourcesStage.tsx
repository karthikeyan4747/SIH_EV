import { useState, useRef } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  File as FileIcon,
  FileAudio,
  FileCode,
  FileText,
  FileVideo,
  Globe,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
  X,
} from 'lucide-react'
import type { RawContent, SourceType } from '../../../types/content'
import { NewSourceBatch } from '../../ev/NewSourceBatch'

interface SourcesStageProps {
  sources: RawContent[]
  busy: boolean
  onAddTexts: (sources: { title: string; text: string }[]) => Promise<void>
  onAddFiles: (files: File[]) => Promise<void>
  onAddUrl: (url: string, title?: string) => Promise<void>
  onAddUnsupported: (sourceType: SourceType, title: string, note?: string) => Promise<void>
  onRemoveSource: (sourceId: string) => Promise<void>
  onProceedToDNA: () => void
}

interface SamplePreset {
  id: string
  title: string
  type: SourceType
  chipName: string
  label: string
  badge: string
  metric: string
  description: string
  fullContent: string
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'src-01-thermal-runaway-pdf',
    title: 'Thermal_Runaway_Mitigation_SolidState_v4.2.pdf',
    type: 'pdf',
    chipName: 'PDF Paper',
    label: 'Solid-State Battery R&D Whitepaper (PDF)',
    badge: 'PDF Technical Paper',
    metric: '34 Pages · 4.2 MB',
    description:
      'Electrochemical characterization of lithium sulfide ceramic pouch cells. Confirms zero thermal runaway propagation during nail penetration and 310 Wh/kg lab specific energy.',
    fullContent: `Title: Thermal Runaway Mitigation and Electrochemical Stability in Ceramic Solid-State Cells
Authors: Dr. Elena Vance et al., Apex Mobility Dynamics & Fraunhofer Institute
Publication: Journal of Power Sources & Battery Materials, March 2026

Abstract:
We report the electrochemical characterization of lithium sulfide-doped ceramic solid-state pouch cells engineered for heavy commercial EV deployment. Laboratory calorimetry and thermal runaway testing at 25C and elevated temperatures confirm zero thermal propagation during severe mechanical nail penetration. Internal cell gravimetric energy density reached 310 Wh/kg at 25C with 85% capacity retention across 2,800 full cycles. Current densities up to 15 mA/cm2 were sustained at 45C without dendritic lithium shorting. Direct cold-plate liquid cooling limited core-to-surface thermal gradients to less than 2.5C under continuous 450kW discharge.`,
  },
  {
    id: 'src-02-fleet-procurement-docx',
    title: 'Fleet_Procurement_Spec_Q3_2026.docx',
    type: 'docx',
    chipName: 'DOCX Spec',
    label: 'Commercial Fleet Procurement Spec (DOCX)',
    badge: 'Word Document',
    metric: '8,420 Words · Procurement',
    description:
      'Commercial fleet requirements for 800V DC fast charging (12.4 min 10% to 80% SoC) and Fraunhofer supplier production audit baseline (285 Wh/kg).',
    fullContent: `Commercial Fleet Procurement Specification: Heavy-Duty Electric Van Class 4-6
Organization: Apex Fleet Logistics & Municipal Delivery Consortia
Author: Sarah Chen (Fleet Procurement Director)
Date: June 02, 2026

Operational Requirements:
All incoming commercial chassis must support 800V DC split-bus fast charging capable of achieving 10% to 80% State of Charge in under 15 minutes (target benchmark: 12.4 minutes at 350kW). Target pack production cost must not exceed $84 per kWh at an annualized volume of 100 GWh. Third-party audit results from Fraunhofer pilot batch manufacturing established a baseline gravimetric cell energy density of 285 Wh/kg under production roll-to-roll mechanical tolerances. Total cost of ownership parity against diesel commercial fleets is projected at 26 months.`,
  },
  {
    id: 'src-03-inverter-bench-txt',
    title: 'Powertrain_Silicon_Carbide_Inverter_Bench_Test.txt',
    type: 'txt',
    chipName: 'Dyno TXT',
    label: '800V SiC Inverter Dynamometer Test (TXT)',
    badge: 'Telemetry Log',
    metric: '64 Channels · 120h Dyno',
    description:
      'Apex dynamometer test logs at continuous 450kW load. Demonstrates 99.2% peak DC-to-AC conversion efficiency with 62% reduction in switching losses.',
    fullContent: `Apex Powertrain Validation Lab: Dynamometer Test Protocol 800V-SiC-09
Chief Architect: Marcus Thorne
Date: March 14, 2026

Inverter Dynamometer Test Summary:
Silicon Carbide (SiC) MOSFET inverter modules subjected to 450kW continuous load under simulated WLTP and highway hill-climb drive cycles. Peak DC-to-AC electrical conversion efficiency recorded at 99.2%. Switching energy losses reduced by 62% compared to baseline silicon IGBT inverters. High-frequency CAN-FD bus streamed 500Hz telemetry without packet drop. Thermal dissipation managed within 68C junction temperature using immersion cold plates.`,
  },
  {
    id: 'src-04-iea-benchmark-url',
    title: 'https://iea.org/reports/global-ev-outlook-heavy-duty-commercial-electrification',
    type: 'url',
    chipName: 'IEA Web URL',
    label: 'IEA Global Fleet Electrification Benchmark (Web URL)',
    badge: 'Web Report',
    metric: 'IEA.org · Verified Web',
    description:
      'International Energy Agency global benchmark on heavy-duty commercial fleet electrification and pack-level price targets reaching $84/kWh.',
    fullContent: `IEA Global EV Outlook: Heavy-Duty Commercial Fleet Electrification Benchmark
Published: May 2026

Global battery pack price trajectories indicate pack costs declining below $90/kWh for commercial vehicles by late 2026, with leading solid-state designs targeting $84/kWh. Commercial fleet uptime demands sub-15 minute fast charging to match operational diesel turnaround schedules. Safety standards mandate zero pack-to-pack thermal propagation under UN 38.3 and SAE J2464 test regimes.`,
  },
  {
    id: 'src-05-crash-fem-video',
    title: 'pack_crash_test_simulation_fem.mp4',
    type: 'video',
    chipName: 'Crash Video',
    label: 'FMVSS 305 Dynamic Crash Simulation (Video Telemetry)',
    badge: 'Video Telemetry',
    metric: '4K 60fps · 65 G Decel',
    description:
      'Dynamic finite element crash analysis of FMVSS 305 side-pole impact at 32 km/h. Sustains 65 G peak deceleration with zero battery enclosure breach.',
    fullContent: `Video Telemetry: Non-linear Dynamic Finite Element Crash Analysis (FMVSS 305 Side Pole Impact at 32 km/h).
Simulation Duration: 120 ms.
Deceleration Profile: 65 G peak deceleration sustained.
Structural Integrity: Solid-state battery enclosure maintained zero cell rupture, zero coolant fluid leakage, and 100% mechanical separation between module bulkheads. High-voltage pyrofuse triggered in 1.8 milliseconds.`,
  },
  {
    id: 'src-06-sem-microstructure-img',
    title: 'cell_microstructure_sem_analysis.png',
    type: 'image',
    chipName: 'SEM Image',
    label: 'Ceramic Separator Interface Analysis (SEM Image)',
    badge: 'SEM Micrograph',
    metric: '25,000x · Zeiss SEM',
    description:
      'Scanning electron microscopy at 25,000x magnification verifying dendrite suppression across 2,000 cycles at the ceramic solid-state interface.',
    fullContent: `Microscopy Inspection: Scanning Electron Microscopy (SEM) analysis of ceramic solid-state separator and lithium metal anode interface.
Magnification: 25,000x.
Observations: Uniform solid electrolyte interphase (SEI) formation without micro-crack initiation. Complete suppression of dendritic lithium growth across 2,000 charge cycles.`,
  },
  {
    id: 'src-07-debrief-audio',
    title: 'executive_engineering_debrief_summary.mp3',
    type: 'audio',
    chipName: 'Audio Debrief',
    label: 'Executive Engineering Debrief (Audio Transcript)',
    badge: 'Audio Recording',
    metric: '44.1 kHz · 3m 02s',
    description:
      'Recorded dialogue between Chief Architect Marcus Thorne and Procurement Director Sarah Chen reconciling supplier audit yields with vehicle homologation.',
    fullContent: `Audio Transcription: Executive Engineering Debrief between Marcus Thorne and Sarah Chen.
Recording Date: June 15, 2026.

Marcus Thorne: We have verified 99.2% inverter efficiency on the dynamometer bench, and the 12.4 minute charge time to 80% SoC is solid.
Sarah Chen: What about the cell energy density dispute? The lab paper cites 310 Wh/kg, but Fraunhofer production audit says 285 Wh/kg.
Marcus Thorne: The 310 Wh/kg is hand-assembled lab pouch cell performance. In volume production, separator coating tolerances drop that to 285 Wh/kg. For vehicle homologation and certification, we must adopt 285 Wh/kg to remain compliant.`,
  },
]

export function SourcesStage({
  sources,
  busy,
  onAddTexts,
  onAddFiles,
  onAddUrl,
  onAddUnsupported,
  onRemoveSource,
  onProceedToDNA,
}: SourcesStageProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SAMPLE_PRESETS[0].id)
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'youtube' | 'text'>('upload')
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlTitleInput, setUrlTitleInput] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentPreset =
    SAMPLE_PRESETS.find((p) => p.id === selectedPresetId) || SAMPLE_PRESETS[0]

  const isAlreadyAttached = (presetId: string, presetTitle: string) =>
    sources.some((s) => s.source_id === presetId || s.title === presetTitle)

  const handleIngestPreset = async (preset: SamplePreset) => {
    if (busy) return
    if (preset.type === 'pdf' || preset.type === 'docx') {
      const mime =
        preset.type === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const file = new window.File([preset.fullContent], preset.title, { type: mime })
      await onAddFiles([file])
    } else if (preset.type === 'text' || preset.type === 'txt') {
      await onAddTexts([{ title: preset.title, text: preset.fullContent }])
    } else if (preset.type === 'url') {
      await onAddUrl(preset.title, preset.label)
    } else {
      await onAddUnsupported(preset.type, preset.title, preset.fullContent)
    }
  }

  const handleLoadAllPresets = async () => {
    if (busy) return
    for (const preset of SAMPLE_PRESETS) {
      if (!isAlreadyAttached(preset.id, preset.title)) {
        await handleIngestPreset(preset)
      }
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void onAddFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    await onAddUrl(urlInput.trim(), urlTitleInput.trim() || undefined)
    setUrlInput('')
    setUrlTitleInput('')
  }

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!textContent.trim()) return
    await onAddTexts([
      { title: textTitle.trim() || 'Pasted Text Document', text: textContent.trim() },
    ])
    setTextTitle('')
    setTextContent('')
  }

  const getSourceIcon = (type: string) => {
    const t = type.toLowerCase()
    if (t === 'pdf' || t === 'docx' || t === 'doc') return <FileText size={16} />
    if (t === 'url' || t === 'html' || t === 'web') return <Globe size={16} />
    if (t.includes('youtube') || t.includes('yt')) return <Video size={16} />
    if (t === 'audio' || t === 'mp3' || t === 'wav') return <FileAudio size={16} />
    if (t === 'video' || t === 'mp4') return <FileVideo size={16} />
    if (t === 'txt' || t === 'text' || t === 'json') return <FileCode size={16} />
    return <FileIcon size={16} />
  }

  return (
    <div className="sources-stage-container">
      {/* Main Two-Column Stage Grid */}
      <div className="sources-split-grid">
        {/* Left Column: Multi-Source Ingestion Console */}
        <section className="ingestion-console tactile-card">
          <div className="console-header">
            <div>
              <h3>Add Sources</h3>
              <p>Select predefined inputs or add custom files to build your knowledge base.</p>
            </div>
            <button
              type="button"
              className="batch-trigger-btn"
              onClick={() => setShowBatchModal(true)}
              title="Open multi-file batch staging modal"
            >
              <Layers size={13} />
              <span>Batch Queue</span>
            </button>
          </div>

          {/* ============================================================
              PREDEFINED INPUT SELECTOR (EASY & SIMPLE INPUT SELECTION)
             ============================================================ */}
          <div className="predefined-input-selector" id="tour-preset-selector">
            <div className="preset-selector-top">
              <span className="preset-eyebrow">
                <span className="preset-eyebrow-dot" />
                Select Predefined Input
              </span>
              <button
                type="button"
                className="preset-load-all-btn"
                onClick={handleLoadAllPresets}
                disabled={busy}
                title="Populate all 7 verified engineering inputs at once"
              >
                <Sparkles size={12} />
                <span>Load All 7 Inputs</span>
              </button>
            </div>

            {/* Dropdown Menu */}
            <div className="preset-dropdown-wrap">
              <select
                className="preset-input-select"
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                aria-label="Select an input to load"
              >
                {SAMPLE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick-Select Filter Chips */}
            <div className="preset-chips-scroll">
              {SAMPLE_PRESETS.map((preset) => {
                const active = preset.id === selectedPresetId
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset-chip-btn ${active ? 'active' : ''}`}
                    onClick={() => setSelectedPresetId(preset.id)}
                  >
                    {getSourceIcon(preset.type)}
                    <span>{preset.chipName}</span>
                  </button>
                )
              })}
            </div>

            {/* Selected Input Preview & Action Card */}
            <div className="preset-preview-card">
              <div className="preset-preview-header">
                <span className="preset-badge-tag">{currentPreset.badge}</span>
                <span className="preset-metric-tag">{currentPreset.metric}</span>
              </div>

              <div className="preset-title-row">
                {getSourceIcon(currentPreset.type)}
                <span>{currentPreset.title}</span>
              </div>

              <p className="preset-description-text">{currentPreset.description}</p>

              <div className="preset-action-row">
                {isAlreadyAttached(currentPreset.id, currentPreset.title) ? (
                  <>
                    <span className="preset-status-tag">
                      <CheckCircle2 size={13} />
                      Attached to Knowledge Base
                    </span>
                    <button
                      type="button"
                      className="preset-reingest-btn"
                      onClick={() => void handleIngestPreset(currentPreset)}
                      disabled={busy}
                    >
                      Re-ingest Source
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Ready for deterministic parsing
                    </span>
                    <button
                      type="button"
                      className="btn-load-preset"
                      onClick={() => void handleIngestPreset(currentPreset)}
                      disabled={busy}
                    >
                      <Plus size={13} />
                      <span>Ingest This Input</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section Divider */}
          <div className="input-divider-line">
            <span>Or add custom input manually</span>
          </div>

          {/* Ingestion Tabs */}
          <div className="ingestion-tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <UploadCloud size={14} />
              <span>File Upload</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'url' ? 'active' : ''}`}
              onClick={() => setActiveTab('url')}
            >
              <Globe size={14} />
              <span>Web URL</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
              onClick={() => setActiveTab('youtube')}
            >
              <Video size={14} />
              <span>YouTube Video</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              <FileCode size={14} />
              <span>Raw Text</span>
            </button>
          </div>

          {/* Tab Content 1: File Drop */}
          {activeTab === 'upload' &&
            (busy ? (
              <div className="file-dropzone ingestion-loading-active">
                <div className="ingestion-loader-orb">
                  <Loader2 size={34} className="spin" style={{ color: 'var(--accent-primary)' }} />
                  <div className="orbital-ring" />
                </div>
                <h4>Analyzing Document...</h4>
                <p>Extracting text and organizing facts for your knowledge base.</p>

                <div className="ingestion-progress-track">
                  <div className="ingestion-progress-bar indeterminate" />
                </div>

                <div className="ingestion-pipeline-steps">
                  <span className="step-pill done">
                    <span className="step-indicator" /> Upload & Verify
                  </span>
                  <span className="step-pill active">
                    <span className="step-indicator pulse" /> Processing Content
                  </span>
                  <span className="step-pill">
                    <span className="step-indicator" /> Lineage Graph
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <div
                  className={`file-dropzone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden-file-input"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        void onAddFiles(Array.from(e.target.files))
                      }
                    }}
                  />
                  <div className="dropzone-icon-wrap">
                    <UploadCloud size={28} />
                  </div>
                  <h4>Click to browse or drop documents here</h4>
                  <p>Supports PDF, DOCX, TXT, Markdown, MP3, WAV, and MP4 files</p>
                  <span className="dropzone-badge">Max 256MB per file · Auto-chunked & parsed</span>
                </div>

                <div className="quick-sample-file-row">
                  <span className="quick-fill-label">Or select a sample file:</span>
                  <button
                    type="button"
                    className="quick-file-btn"
                    onClick={() => void handleIngestPreset(SAMPLE_PRESETS[0])}
                  >
                    <FileText size={12} />
                    <span>Attach Sample PDF</span>
                  </button>
                  <button
                    type="button"
                    className="quick-file-btn"
                    onClick={() => void handleIngestPreset(SAMPLE_PRESETS[1])}
                  >
                    <FileText size={12} />
                    <span>Attach Sample DOCX</span>
                  </button>
                </div>
              </div>
            ))}

          {/* Tab Content 2: Web URL */}
          {activeTab === 'url' && (
            <form className="console-form" onSubmit={handleUrlSubmit}>
              <div className="quick-fill-chips">
                <span className="quick-fill-label">Quick URL:</span>
                <button
                  type="button"
                  className="quick-fill-pill"
                  onClick={() => {
                    setUrlInput(SAMPLE_PRESETS[3].title)
                    setUrlTitleInput(SAMPLE_PRESETS[3].label)
                  }}
                >
                  IEA Fleet Outlook Benchmark
                </button>
              </div>

              <div className="form-group">
                <label>Page or Article URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/research-paper"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <div className="form-group">
                <label>Optional Title Override</label>
                <input
                  type="text"
                  placeholder="e.g. Industry Benchmark 2026"
                  value={urlTitleInput}
                  onChange={(e) => setUrlTitleInput(e.target.value)}
                  disabled={busy}
                />
              </div>
              <button
                type="submit"
                className="form-submit-btn primary"
                disabled={busy || !urlInput.trim()}
              >
                {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                <span>{busy ? 'Fetching & Parsing URL...' : 'Fetch & Ingest URL'}</span>
              </button>
            </form>
          )}

          {/* Tab Content 3: YouTube */}
          {activeTab === 'youtube' && (
            <form className="console-form" onSubmit={handleUrlSubmit}>
              <div className="form-group">
                <label>YouTube Video Link</label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <div className="form-group">
                <label>Optional Title</label>
                <input
                  type="text"
                  placeholder="e.g. Keynote Transcript"
                  value={urlTitleInput}
                  onChange={(e) => setUrlTitleInput(e.target.value)}
                  disabled={busy}
                />
              </div>
              <button
                type="submit"
                className="form-submit-btn primary"
                disabled={busy || !urlInput.trim()}
              >
                {busy ? <Loader2 size={15} className="spin" /> : <Video size={15} />}
                <span>{busy ? 'Extracting Video Transcript...' : 'Extract Video Transcript'}</span>
              </button>
            </form>
          )}

          {/* Tab Content 4: Raw Text */}
          {activeTab === 'text' && (
            <form className="console-form" onSubmit={handleTextSubmit}>
              <div className="quick-fill-chips">
                <span className="quick-fill-label">Quick Sample Text:</span>
                <button
                  type="button"
                  className="quick-fill-pill"
                  onClick={() => {
                    setTextTitle('Laboratory Dynamometer Test Logs')
                    setTextContent(SAMPLE_PRESETS[2].fullContent)
                  }}
                >
                  Dyno Test Logs
                </button>
                <button
                  type="button"
                  className="quick-fill-pill"
                  onClick={() => {
                    setTextTitle('Solid-State Calorimetry Summary')
                    setTextContent(SAMPLE_PRESETS[0].fullContent)
                  }}
                >
                  Solid-State Paper
                </button>
              </div>

              <div className="form-group">
                <label>Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Executive Summary Brief"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="form-group">
                <label>Text Content</label>
                <textarea
                  rows={6}
                  placeholder="Paste or type textual source content here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <button
                type="submit"
                className="form-submit-btn primary"
                disabled={busy || !textContent.trim()}
              >
                {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                <span>{busy ? 'Chunking & Ingesting Text...' : 'Add Text Document'}</span>
              </button>
            </form>
          )}
        </section>

        {/* Right Column: Uploaded Sources Library */}
        <section className="sources-library-section tactile-card">
          <div className="library-header">
            <div>
              <h3>Attached Sources ({sources.length})</h3>
              <p>Uploaded documents and media linked to this project.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {busy && (
                <span
                  style={{
                    fontSize: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--accent-text)',
                    fontWeight: 600,
                  }}
                >
                  <Loader2 size={14} className="spin" /> Processing Source...
                </span>
              )}
              {sources.length > 0 && (
                <button
                  type="button"
                  className="proceed-stage-btn primary"
                  onClick={onProceedToDNA}
                  disabled={busy}
                >
                  <span>Proceed to Content DNA</span>
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>

          {sources.length === 0 && !busy ? (
            <div className="sources-empty-state">
              <div className="empty-icon-circle">
                <FileText size={32} />
              </div>
              <h4>No sources attached yet</h4>
              <p>Select a predefined input on the left or upload files to begin knowledge synthesis.</p>
            </div>
          ) : (
            <div className="sources-card-grid">
              {busy && (
                <div className="source-record-card processing-card tactile-card">
                  <div className="source-card-top">
                    <div className="source-icon-badge processing">
                      <Loader2 size={15} className="spin" />
                    </div>
                    <span className="source-type-pill">Ingesting</span>
                  </div>
                  <div className="source-card-content">
                    <h4 className="source-title-text">Processing Document...</h4>
                    <p className="source-snippet">
                      Parsing token stream, indexing semantic entities, and generating Content DNA lineage.
                    </p>
                  </div>
                </div>
              )}

              {sources.map((source) => (
                <div key={source.source_id} className="source-record-card tactile-card">
                  <div className="source-card-top">
                    <div className="source-icon-badge">{getSourceIcon(source.source_type)}</div>
                    <span className="source-type-pill">{source.source_type}</span>
                    <button
                      type="button"
                      className="source-delete-btn"
                      onClick={() => void onRemoveSource(source.source_id)}
                      title="Remove source from project"
                      disabled={busy}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="source-card-content">
                    <h4 className="source-title-text" title={source.title}>
                      {source.title}
                    </h4>
                    <p className="source-snippet">
                      {source.text
                        ? source.text.slice(0, 140) + '...'
                        : 'Source ingested and indexed.'}
                    </p>
                  </div>

                  <div className="source-card-footer">
                    <span className="source-footer-pill">
                      {source.text ? `${source.text.length} chars` : 'Indexed'}
                    </span>
                    {source.metadata && typeof source.metadata === 'object' && (
                      <span className="source-footer-meta">
                        {source.metadata.pages
                          ? `${source.metadata.pages} pages`
                          : source.metadata.author
                          ? String(source.metadata.author)
                          : 'Canonical Source'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Batch Ingestion Modal */}
      {showBatchModal && (
        <div className="batch-modal-overlay">
          <div className="batch-modal-backdrop" onClick={() => setShowBatchModal(false)} />
          <div className="batch-modal-content tactile-card">
            <div className="batch-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                  Multi-Source Batch Staging
                </h3>
              </div>
              <button
                type="button"
                className="close-batch-modal-btn"
                onClick={() => setShowBatchModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="batch-modal-body">
              <NewSourceBatch
                busy={busy}
                onTexts={(drafts) => {
                  void onAddTexts(drafts)
                  setShowBatchModal(false)
                }}
                onFiles={(files) => {
                  void onAddFiles(files)
                  setShowBatchModal(false)
                }}
                onUrl={(url, title) => {
                  void onAddUrl(url, title)
                  setShowBatchModal(false)
                }}
                onUnsupported={(type, title, note) => {
                  void onAddUnsupported(type, title, note)
                  setShowBatchModal(false)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
