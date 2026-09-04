import { useMemo, useRef, useState, useCallback, type DragEvent, type ReactNode } from 'react'
import { ArrowRight, FileAudio, FileText, Image, Link, Plus, Sparkles, Trash2, Upload, Video, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { DragInput } from '../ui/DragInput'
import type { SourceType } from '../../types/content'

interface TextDraft { id: number; title: string; text: string }
type SourceMode = 'text' | 'file' | 'url' | 'docx' | 'pptx' | 'youtube' | 'image' | 'video' | 'audio'

interface NewSourceBatchProps {
  busy: boolean
  onTexts: (drafts: TextDraft[]) => void
  onFiles: (files: File[]) => void
  onUrl: (url: string, title: string) => void
  onUnsupported: (sourceType: SourceType, title: string, note: string) => void
}

const modes: { key: SourceMode; label: string; Icon: typeof FileText; supported: boolean }[] = [
  { key: 'text', label: 'Text', Icon: FileText, supported: true },
  { key: 'file', label: 'TXT/PDF/DOCX', Icon: Upload, supported: true },
  { key: 'url', label: 'URL', Icon: Link, supported: true },
  { key: 'youtube', label: 'YouTube', Icon: Video, supported: true },
  { key: 'image', label: 'Image', Icon: Image, supported: true },
  { key: 'audio', label: 'Audio', Icon: FileAudio, supported: true },
  { key: 'video', label: 'Video', Icon: Video, supported: true },
]

export function NewSourceBatch({ busy, onTexts, onFiles, onUrl, onUnsupported }: NewSourceBatchProps) {
  const [mode, setMode] = useState<SourceMode>('text')
  const [drafts, setDrafts] = useState<TextDraft[]>([{ id: 1, title: '', text: '' }])
  const [files, setFiles] = useState<File[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  const [audioFiles, setAudioFiles] = useState<File[]>([])
  const [url, setUrl] = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeTitle, setYoutubeTitle] = useState('')
  const [unsupportedTitle, setUnsupportedTitle] = useState('')
  const nextId = useRef(2)
  const validDrafts = drafts.filter((draft) => draft.text.trim())
  const wordCount = useMemo(() => drafts.reduce((count, draft) => count + draft.text.trim().split(/\s+/).filter(Boolean).length, 0), [drafts])

  function addText() {
    setDrafts([...drafts, { id: nextId.current, title: '', text: '' }])
    nextId.current += 1
  }

  function updateText(id: number, field: 'title' | 'text', value: string) {
    setDrafts(drafts.map((draft) => draft.id === id ? { ...draft, [field]: value } : draft))
  }

  function removeText(id: number) {
    if (drafts.length === 1) return
    setDrafts(drafts.filter((draft) => draft.id !== id))
  }

  const MAX_FILE_SIZE_BYTES = 256 * 1024 * 1024
  const [fileError, setFileError] = useState('')

  function selectFiles(selected: FileList | null) {
    if (!selected) return
    const all = Array.from(selected).filter((file) => /\.(txt|pdf|docx)$/i.test(file.name))
    const oversized = all.filter((file) => file.size > MAX_FILE_SIZE_BYTES)
    if (oversized.length > 0) {
      setFileError('File is too large. Maximum supported file size is 256 MB.')
    } else {
      setFileError('')
    }
    const nextFiles = all.filter((file) => file.size <= MAX_FILE_SIZE_BYTES)
    setFiles([...files, ...nextFiles.filter((file) => !files.some((existing) => existing.name === file.name && existing.size === file.size))])
  }

  function selectImageFiles(selected: FileList | null) {
    if (!selected) return
    const all = Array.from(selected).filter((file) => /\.(png|jpe?g|webp)$/i.test(file.name))
    const oversized = all.filter((file) => file.size > MAX_FILE_SIZE_BYTES)
    if (oversized.length > 0) {
      setFileError('File is too large. Maximum supported file size is 256 MB.')
    } else {
      setFileError('')
    }
    const nextImages = all.filter((file) => file.size <= MAX_FILE_SIZE_BYTES)
    setImageFiles((current) => [
      ...current,
      ...nextImages.filter(
        (file) =>
          !current.some(
            (existing) =>
              existing.name === file.name &&
              existing.size === file.size,
          ),
      ),
    ])
  }

  function selectAudioFiles(selected: FileList | null) {
    if (!selected) return
    const all = Array.from(selected).filter((file) => /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(file.name))
    const oversized = all.filter((file) => file.size > MAX_FILE_SIZE_BYTES)
    if (oversized.length > 0) {
      setFileError('File is too large. Maximum supported file size is 256 MB.')
    } else {
      setFileError('')
    }
    const nextAudio = all.filter((file) => file.size <= MAX_FILE_SIZE_BYTES)
    setAudioFiles((current) => [
      ...current,
      ...nextAudio.filter(
        (file) =>
          !current.some(
            (existing) =>
              existing.name === file.name &&
              existing.size === file.size,
          ),
      ),
    ])
  }

  function selectVideoFiles(selected: FileList | null) {
    if (!selected) return
    const all = Array.from(selected).filter((file) => /\.(mp4|mov|mkv|webm|avi)$/i.test(file.name))
    const oversized = all.filter((file) => file.size > MAX_FILE_SIZE_BYTES)
    if (oversized.length > 0) {
      setFileError('File is too large. Maximum supported file size is 256 MB.')
    } else {
      setFileError('')
    }
    const nextVideos = all.filter((file) => file.size <= MAX_FILE_SIZE_BYTES)
    setVideoFiles((current) => [
      ...current,
      ...nextVideos.filter(
        (file) =>
          !current.some(
            (existing) =>
              existing.name === file.name &&
              existing.size === file.size,
          ),
      ),
    ])
  }

  function loadDemoPreset(preset: 'conflicts' | 'ev_policy' | 'leadership') {
    setMode('text')
    if (preset === 'conflicts') {
      setDrafts([
        {
          id: 1,
          title: 'Nexar Dynamics Q3 Report (Source 1)',
          text: 'Nexar Dynamics was founded in Bengaluru in 2022. In Q3 2026, the company generated $18 million in revenue and expanded its engineering team to 450 employees. The next-generation battery platform is scheduled for commercial rollout in March 2027.',
        },
        {
          id: 2,
          title: 'Nexar Dynamics Market Overview (Source 2)',
          text: 'Nexar Dynamics is a Chennai-based clean tech firm incorporated in 2022. According to internal reports, the firm recorded $10 million in revenue with a workforce of 250 employees. Commercial launch of the battery platform is planned for November 2027.',
        },
      ])
    } else if (preset === 'ev_policy') {
      setDrafts([
        {
          id: 1,
          title: 'National Clean Mobility Mission 2030',
          text: "India's National Clean Mobility Mission targets 30% EV adoption by 2030 across all vehicle categories. The central government has allocated 10,900 Crore INR under the PM E-DRIVE initiative. Over 8,500 fast DC charging stations are currently operational across national highway corridors.",
        },
        {
          id: 2,
          title: 'EV Charging Infrastructure Assessment',
          text: "The Ministry of Heavy Industries report highlights 8,500 active high-speed charging hubs deployed across tier-1 logistics arteries. Grid readiness evaluations confirm capacity expansion to support 15,000 public chargers by 2028 under the 10,900 Crore INR subsidy framework.",
        },
      ])
    } else {
      setDrafts([
        {
          id: 1,
          title: 'Executive Biography Source 1',
          text: "Karthikeyan founded the EV intelligence platform. Vani is Karthikeyan's mom. The initiative was declared the Overall Winner in SIH 2026.",
        },
        {
          id: 2,
          title: 'Executive Biography Source 2',
          text: "Karthikeyan leads the EV research group. Bala is Karthikeyan's mom. The initiative was shortlisted among top teams in SIH 2026.",
        },
      ])
    }
  }

  return <section className="new-source page-enter">
    <div className="eyebrow"><span className="eyebrow-line" /> SOURCE INTAKE <span className="eyebrow-line" /></div>
    <h1>Start with a source.</h1>
    <p className="lead">Give EV one source or a batch of materials. Supported inputs become one combined Semantic Lineage Graph.</p>

    {/* One-Click Demo Presets Bar */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      borderRadius: '10px',
      padding: '10px 16px',
      marginBottom: '18px',
      gap: '12px',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={15} color="#38bdf8" />
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ⚡ Quick Demo Scenarios:
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => loadDemoPreset('conflicts')}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🚨 Discrepancy & Revenue Conflict
        </button>
        <button
          type="button"
          onClick={() => loadDemoPreset('ev_policy')}
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#86efac',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🔋 EV Policy & Corroboration
        </button>
        <button
          type="button"
          onClick={() => loadDemoPreset('leadership')}
          style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            color: '#7dd3fc',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          👥 Relational & SIH Dispute
        </button>
      </div>
    </div>

    {fileError && (
      <div className="error-banner" role="alert" style={{ marginBottom: '1rem' }}>
        <span>{fileError}</span>
        <button aria-label="Dismiss error" onClick={() => setFileError('')}><X size={16} /></button>
      </div>
    )}
    <div className="input-card">
      <div className="input-tabs source-mode-grid">
        {modes.map(({ key, label, Icon, supported }) => <button key={key} className={`${mode === key ? 'selected' : ''} ${supported ? '' : 'limited'}`} onClick={() => setMode(key)}><Icon size={16} />{label}</button>)}
      </div>
       {mode === 'text' && <div className="text-form batch-text-form">
         {drafts.map((draft, index) => <div className="text-draft" key={draft.id}>
           <div className="draft-heading"><span>TEXT SOURCE {String(index + 1).padStart(2, '0')}</span>{drafts.length > 1 && <button className="icon-action" aria-label={`Remove text source ${index + 1}`} onClick={() => removeText(draft.id)}><Trash2 size={15} /></button>}</div>
           <label>Source title <DragInput as="input" input={{ value: draft.title, onChange: (event) => updateText(draft.id, 'title', event.target.value), placeholder: "e.g. SIH 2026 briefing" }} /></label>
           <label>Source content <DragInput as="textarea" textarea={{ value: draft.text, onChange: (event) => updateText(draft.id, 'text', event.target.value), placeholder: "Paste or type source material...", rows: 8 }} /></label>
         </div>)}
        <div className="composer-meta"><span>{wordCount} words</span><span>{drafts.reduce((count, draft) => count + draft.text.length, 0)} characters</span></div>
        <Button variant="ghost" className="add-source-button" onClick={addText}><Plus size={15} />Add another text source</Button>
        <BatchFooter busy={busy} disabled={!validDrafts.length} count={validDrafts.length} label={validDrafts.length === 1 ? 'Plain text works best' : `${validDrafts.length} text sources ready`} onClick={() => { onTexts(validDrafts); setDrafts([{ id: nextId.current++, title: '', text: '' }]) }} />
      </div>}
       {mode === 'file' && (
        <DropZone
          className="upload-zone batch-upload-zone"
          onDropFiles={selectFiles}
        >
          <input
            id="source-files"
            type="file"
            accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            hidden
            onChange={(event) =>
              selectFiles(event.target.files)
            }
          />

          <label htmlFor="source-files" className="drop-label">
            <Upload size={28} />
            <strong>Choose TXT,PDF or DOCX files</strong>
            <span>
              Drag-and-drop files here, or click to browse
            </span>
          </label>
        </DropZone>
       )}
       {files.length > 0 && (
        <div className="file-queue">
          {files.map((file) => (
            <div
              className="file-row"
              key={`${file.name}-${file.size}`}
            >
              <FileText size={16} />

              <span>{file.name}</span>

              <small>
                {(file.size / 1024).toFixed(1)} KB
              </small>

              <button
                className="icon-action"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  setFiles((current) =>
                    current.filter(
                      (item) => item !== file,
                    ),
                  )
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
       )}
       {files.length > 0 && (
        <BatchFooter
          busy={busy}
          disabled={false}
          count={files.length}
          label={`${files.length} file${files.length === 1 ? '' : 's'
            } ready`}
          onClick={() => {
            onFiles(files)
            setFiles([])
          }}
        />
       )}
      {mode === 'image' && (
        <DropZone
          className="upload-zone batch-upload-zone"
          onDropFiles={selectImageFiles}
        >
          <input
            id="source-images"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(event) =>
              selectImageFiles(event.target.files)
            }
          />

          <label
            htmlFor="source-images"
            className="drop-label"
          >
            <Image size={28} />
            <strong>Choose images</strong>
            <span>
              PNG, JPG, JPEG or WEBP images
            </span>
          </label>
        </DropZone>
      )}
      {imageFiles.length > 0 && (
        <div className="file-queue">
          {imageFiles.map((file) => (
            <div
              className="file-row"
              key={`${file.name}-${file.size}`}
            >
              <Image size={16} />

              <span>{file.name}</span>

              <small>
                {(file.size / 1024).toFixed(1)} KB
              </small>

              <button
                className="icon-action"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  setImageFiles((current) =>
                    current.filter(
                      (item) => item !== file,
                    ),
                  )
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {imageFiles.length > 0 && (
        <BatchFooter
          busy={busy}
          disabled={false}
          count={imageFiles.length}
          label={`${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'
            } ready`}
          onClick={() => {
            onFiles(imageFiles)
            setImageFiles([])
          }}
        />
      )}
      {mode === 'audio' && (
        <DropZone
          className="upload-zone batch-upload-zone"
          onDropFiles={selectAudioFiles}
        >
          <input
            id="source-audio"
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac"
            multiple
            hidden
            onChange={(event) =>
              selectAudioFiles(event.target.files)
            }
          />

          <label
            htmlFor="source-audio"
            className="drop-label"
          >
            <FileAudio size={28} />
            <strong>Choose audio files</strong>
            <span>
              MP3, WAV, M4A, AAC, OGG, FLAC or WMA
            </span>
          </label>
        </DropZone>
      )}
      {audioFiles.length > 0 && (
        <div className="file-queue">
          {audioFiles.map((file) => (
            <div
              className="file-row"
              key={`${file.name}-${file.size}`}
            >
              <FileAudio size={16} />

              <span>{file.name}</span>

              <small>
                {(file.size / 1024).toFixed(1)} KB
              </small>

              <button
                className="icon-action"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  setAudioFiles((current) =>
                    current.filter(
                      (item) => item !== file,
                    ),
                  )
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {audioFiles.length > 0 && (
        <BatchFooter
          busy={busy}
          disabled={false}
          count={audioFiles.length}
          label={`${audioFiles.length} audio ${audioFiles.length === 1 ? 'file' : 'files'
            } ready`}
          onClick={() => {
            onFiles(audioFiles)
            setAudioFiles([])
          }}
        />
      )}
      {mode === 'video' && (
        <DropZone
          className="upload-zone batch-upload-zone"
          onDropFiles={selectVideoFiles}
        >
          <input
            id="source-video"
            type="file"
            accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo"
            multiple
            hidden
            onChange={(event) =>
              selectVideoFiles(event.target.files)
            }
          />

          <label
            htmlFor="source-video"
            className="drop-label"
          >
            <Video size={28} />
            <strong>Choose video files</strong>
            <span>MP4, MOV, MKV, WEBM or AVI</span>
          </label>
        </DropZone>
      )}
      {videoFiles.length > 0 && (
        <div className="file-queue">
          {videoFiles.map((file) => (
            <div
              className="file-row"
              key={`${file.name}-${file.size}`}
            >
              <Video size={16} />

              <span>{file.name}</span>

              <small>
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </small>

              <button
                className="icon-action"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  setVideoFiles((current) =>
                    current.filter(
                      (item) => item !== file,
                    ),
                  )
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {videoFiles.length > 0 && (
        <BatchFooter
          busy={busy}
          disabled={false}
          count={videoFiles.length}
          label={`${videoFiles.length} video ${videoFiles.length === 1 ? 'file' : 'files'
            } ready`}
          onClick={() => {
            onFiles(videoFiles)
            setVideoFiles([])
          }}
        />
      )}
      {mode === 'url' && <div className="text-form batch-text-form">
         <div className="text-draft">
           <div className="draft-heading"><span>URL SOURCE</span></div>
           <label>Source title <DragInput as="input" input={{ value: urlTitle, onChange: (event) => setUrlTitle(event.target.value), placeholder: "Optional readable title" }} /></label>
           <label>URL <DragInput as="input" input={{ value: url, onChange: (event) => setUrl(event.target.value), placeholder: "https://example.com/article" }} /></label>
         </div>
         <BatchFooter busy={busy} disabled={!/^https?:\/\/.+/i.test(url)} count={1} label="Readable HTML and plain text URLs are supported" onClick={() => { onUrl(url, urlTitle); setUrl(''); setUrlTitle('') }} />
       </div>}
      {mode === 'youtube' && (
         <div className="text-form batch-text-form">
           <div className="text-draft">
             <div className="draft-heading">
               <span>YOUTUBE SOURCE</span>
             </div>

             <label>
               Video title
               <DragInput
                 as="input"
                 input={{
                   value: youtubeTitle,
                   onChange: (event) =>
                     setYoutubeTitle(event.target.value),
                   placeholder: "Optional video title",
                 }}
               />
             </label>

             <label>
               YouTube URL
               <DragInput
                 as="input"
                 input={{
                   value: youtubeUrl,
                   onChange: (event) =>
                     setYoutubeUrl(event.target.value),
                   placeholder: "https://www.youtube.com/watch?v=...",
                 }}
               />
             </label>
           </div>

           <BatchFooter
             busy={busy}
             disabled={
               !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(
                 youtubeUrl.trim(),
               )
             }
             count={1}
             label="Transcript will be extracted automatically"
             onClick={() => {
               onUrl(
                 youtubeUrl.trim(),
                 youtubeTitle.trim() || 'YouTube source',
               )
               setYoutubeUrl('')
               setYoutubeTitle('')
             }}
           />
         </div>
       )}
       {!modes.find((item) => item.key === mode)?.supported && <div className="unsupported-source-panel">
         <strong>{modes.find((item) => item.key === mode)?.label} processing is not available</strong>
         <p>EV can record this source in the transformation history, but this backend cannot construct a usable Semantic Lineage Graph from it yet.</p>
         <label>Source title <DragInput as="input" input={{ value: unsupportedTitle, onChange: (event) => setUnsupportedTitle(event.target.value), placeholder: `${mode.toUpperCase()} source` }} /></label>
         <Button variant="ghost" loading={busy} loadingLabel="Recording..." onClick={() => { onUnsupported(mode as SourceType, unsupportedTitle || `${mode.toUpperCase()} source`, 'Adapter unavailable in current backend'); setUnsupportedTitle('') }}>Record unavailable source</Button>
       </div>}
    </div>
    <div className="pipeline"><span><b>01</b> Source</span><ArrowRight size={15} /><span><b>02</b> Semantic Graph</span><ArrowRight size={15} /><span className="pipeline-current"><b>03</b> Lineage Verification</span><ArrowRight size={15} /><span className="pipeline-muted">04 Outputs</span></div>
  </section>
}

function BatchFooter({ busy, disabled, count, label, onClick }: { busy: boolean; disabled: boolean; count: number; label: string; onClick: () => void }) {
  return <div className="form-footer"><span>{label}</span><Button variant="primary" disabled={disabled} loading={busy} loadingLabel={`Processing ${count} source${count === 1 ? '' : 's'}...`} onClick={onClick}><Sparkles size={16} />Process {count} source{count === 1 ? '' : 's'}</Button></div>
}

interface DropZoneProps {
  children: ReactNode
  className?: string
  onDropFiles: (files: FileList) => void
}

function DropZone({ children, className, onDropFiles }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    [],
  )

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length === 0) return
      onDropFiles(e.dataTransfer.files)
    },
    [onDropFiles],
  )

  return (
    <div
      className={`${className} ${isDragging ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  )
}
