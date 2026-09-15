import { useState, useRef } from 'react'
import {
  ArrowRight,
  FileText,
  Globe,
  Plus,
  Trash2,
  UploadCloud,
  Video,
  Layers,
  FileCode,
  FileAudio,
  FileVideo,
  File,
  X,
  Loader2,
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
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'youtube' | 'text'>('upload')
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlTitleInput, setUrlTitleInput] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculations
  const totalChars = sources.reduce((sum, s) => sum + (s.text?.length || 0), 0)
  const estTokens = Math.round(totalChars * 0.25)
  const estWords = Math.round(totalChars / 5)

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
    await onAddTexts([{ title: textTitle.trim() || 'Pasted Text Document', text: textContent.trim() }])
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
    return <File size={16} />
  }

  return (
    <div className="sources-stage-container">
      {/* Metrics Banner */}
      <div className="sources-telemetry-row tactile-card">
        <div className="telemetry-item">
          <span className="telemetry-label">Ingested Sources</span>
          <strong className="telemetry-value">{sources.length}</strong>
        </div>
        <div className="telemetry-item">
          <span className="telemetry-label">Total Corpus Size</span>
          <strong className="telemetry-value">{(totalChars / 1024).toFixed(1)} KB</strong>
        </div>
        <div className="telemetry-item">
          <span className="telemetry-label">Estimated Tokens</span>
          <strong className="telemetry-value">{estTokens.toLocaleString()}</strong>
        </div>
        <div className="telemetry-item">
          <span className="telemetry-label">Corpus Words</span>
          <strong className="telemetry-value">~{estWords.toLocaleString()}</strong>
        </div>

        {busy && (
          <div className="telemetry-item active-ingest-pulse">
            <span className="telemetry-label">Ingestion Pipeline</span>
            <strong className="telemetry-value active-ingest-text">
              <Loader2 size={15} className="spin" /> Processing Source...
            </strong>
          </div>
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

      {/* Main Two-Column Stage Grid */}
      <div className="sources-split-grid">
        {/* Left Column: Multi-Source Ingestion Console */}
        <section className="ingestion-console tactile-card">
          <div className="console-header">
            <div>
              <h3>Add Source Documents</h3>
              <p>Ingest multi-format unstructured data into the unified canonical layer.</p>
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
          {activeTab === 'upload' && (
            busy ? (
              <div className="file-dropzone ingestion-loading-active">
                <div className="ingestion-loader-orb">
                  <Loader2 size={34} className="spin" style={{ color: 'var(--accent-primary)' }} />
                  <div className="orbital-ring" />
                </div>
                <h4>Ingesting & Analyzing Source Content...</h4>
                <p>Extracting text streams, generating boundary chunks, and synthesizing canonical lineage.</p>

                <div className="ingestion-progress-track">
                  <div className="ingestion-progress-bar indeterminate" />
                </div>

                <div className="ingestion-pipeline-steps">
                  <span className="step-pill done">
                    <span className="step-indicator" /> Upload & Verify
                  </span>
                  <span className="step-pill active">
                    <span className="step-indicator pulse" /> Semantic Chunking
                  </span>
                  <span className="step-pill">
                    <span className="step-indicator" /> Lineage Graph
                  </span>
                </div>
              </div>
            ) : (
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
                <span className="dropzone-badge">Max 256MB per file • Auto-chunked & parsed</span>
              </div>
            )
          )}

          {/* Tab Content 2: Web URL */}
          {activeTab === 'url' && (
            <form className="console-form" onSubmit={handleUrlSubmit}>
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

        {/* Right Column: Ingested Sources Library */}
        <section className="sources-library-section tactile-card">
          <div className="library-header">
            <div>
              <h3>Corpus Library ({sources.length})</h3>
              <p>Active sources synthesized into the canonical knowledge layer.</p>
            </div>
          </div>

          {sources.length === 0 && !busy ? (
            <div className="sources-empty-state">
              <div className="empty-icon-circle">
                <FileText size={32} />
              </div>
              <h4>No sources attached yet</h4>
              <p>Upload files or paste links on the left to begin knowledge synthesis.</p>
            </div>
          ) : (
            <div className="sources-card-grid">
              {busy && (
                <div className="source-record-card processing-card tactile-card">
                  <div className="source-card-top">
                    <div className="source-icon-badge processing">
                      <Loader2 size={15} className="spin" />
                      <span className="type-tag">INGESTING</span>
                    </div>
                    <span className="processing-badge">Active</span>
                  </div>

                  <h4 className="source-card-title shimmer-text">Synthesizing incoming source...</h4>

                  <p className="source-card-snippet">
                    Extracting text streams, token counts, and generating semantic boundary chunks.
                  </p>

                  <div className="source-card-meta">
                    <span className="shimmer-text">Processing tokens & chunks...</span>
                  </div>
                </div>
              )}
              {sources.map((src, index) => (
                <div key={src.source_id} className="source-record-card tactile-card">
                  <div className="source-card-top">
                    <div className="source-icon-badge">
                      {getSourceIcon(src.source_type)}
                      <span className="type-tag">{src.source_type.toUpperCase()}</span>
                    </div>

                    <button
                      type="button"
                      className="source-delete-btn"
                      onClick={() => void onRemoveSource(src.source_id)}
                      title="Remove source"
                      disabled={busy}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <h4 className="source-card-title">{src.title || `Source ${index + 1}`}</h4>

                  <p className="source-card-snippet">
                    {src.text ? src.text.slice(0, 110) + '...' : 'No content preview available'}
                  </p>

                  <div className="source-card-meta">
                    <span>{src.text?.length.toLocaleString() || 0} chars</span>
                    <span>•</span>
                    <span>~{Math.round((src.text?.length || 0) * 0.25)} tokens</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Batch Ingestion Modal */}
      {showBatchModal && (
        <div className="batch-modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="batch-modal-content tactile-card" onClick={(e) => e.stopPropagation()}>
            <div className="batch-modal-header">
              <h3>Batch Ingestion Studio</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowBatchModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <NewSourceBatch
              busy={busy}
              onFiles={async (files) => {
                await onAddFiles(files)
                setShowBatchModal(false)
              }}
              onTexts={async (texts) => {
                await onAddTexts(texts)
                setShowBatchModal(false)
              }}
              onUrl={async (url, title) => {
                await onAddUrl(url, title)
                setShowBatchModal(false)
              }}
              onUnsupported={async (type, title, note) => {
                await onAddUnsupported(type, title, note)
                setShowBatchModal(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
