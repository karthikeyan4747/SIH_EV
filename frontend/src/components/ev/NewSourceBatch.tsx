import { useMemo, useRef, useState } from 'react'
import { ArrowRight, FileAudio, FileText, Image, Link, Plus, Sparkles, Trash2, Upload, Video, X } from 'lucide-react'
import { Button } from '../ui/Button'
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

  function selectFiles(selected: FileList | null) {
    if (!selected) return
    const nextFiles = Array.from(selected).filter((file) => /\.(txt|pdf|docx)$/i.test(file.name))
    setFiles([...files, ...nextFiles.filter((file) => !files.some((existing) => existing.name === file.name && existing.size === file.size))])
  }

  function selectImageFiles(selected: FileList | null) {
    if (!selected) return

    const nextImages = Array.from(selected).filter((file) =>
      /\.(png|jpe?g|webp)$/i.test(file.name),
    )

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

    const nextAudio = Array.from(selected).filter((file) =>
      /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(file.name),
    )

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

    const nextVideos = Array.from(selected).filter((file) =>
      /\.(mp4|mov|mkv|webm|avi)$/i.test(file.name),
    )

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

  return <section className="new-source page-enter">
    <div className="eyebrow"><span className="eyebrow-line" /> SOURCE INTAKE <span className="eyebrow-line" /></div>
    <h1>Start with a source.</h1>
    <p className="lead">Give EV one source or a batch of materials. Supported inputs become one combined Content DNA.</p>
    <div className="input-card">
      <div className="input-tabs source-mode-grid">
        {modes.map(({ key, label, Icon, supported }) => <button key={key} className={`${mode === key ? 'selected' : ''} ${supported ? '' : 'limited'}`} onClick={() => setMode(key)}><Icon size={16} />{label}</button>)}
      </div>
      {mode === 'text' && <div className="text-form batch-text-form">
        {drafts.map((draft, index) => <div className="text-draft" key={draft.id}>
          <div className="draft-heading"><span>TEXT SOURCE {String(index + 1).padStart(2, '0')}</span>{drafts.length > 1 && <button className="icon-action" aria-label={`Remove text source ${index + 1}`} onClick={() => removeText(draft.id)}><Trash2 size={15} /></button>}</div>
          <label>Source title <input value={draft.title} onChange={(event) => updateText(draft.id, 'title', event.target.value)} placeholder="e.g. SIH 2026 briefing" /></label>
          <label>Source content <textarea value={draft.text} onChange={(event) => updateText(draft.id, 'text', event.target.value)} placeholder="Paste or type source material..." rows={8} /></label>
        </div>)}
        <div className="composer-meta"><span>{wordCount} words</span><span>{drafts.reduce((count, draft) => count + draft.text.length, 0)} characters</span></div>
        <Button variant="ghost" className="add-source-button" onClick={addText}><Plus size={15} />Add another text source</Button>
        <BatchFooter busy={busy} disabled={!validDrafts.length} count={validDrafts.length} label={validDrafts.length === 1 ? 'Plain text works best' : `${validDrafts.length} text sources ready`} onClick={() => { onTexts(validDrafts); setDrafts([{ id: nextId.current++, title: '', text: '' }]) }} />
      </div>}
      {mode === 'file' && <div className="upload-zone batch-upload-zone">
        <input id="source-files" type="file" accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden onChange={(event) => selectFiles(event.target.files)} />
        <label htmlFor="source-files" className="drop-label"><Upload size={28} /><strong>Choose TXT,PDF or DOCX files</strong><span>Drag-and-drop support follows the browser file picker behavior</span></label>
        {files.length > 0 && <div className="file-queue">{files.map((file) => <div className="file-row" key={`${file.name}-${file.size}`}><FileText size={16} /><span>{file.name}</span><small>{(file.size / 1024).toFixed(1)} KB</small><button className="icon-action" aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((item) => item !== file))}><X size={15} /></button></div>)}</div>}
        {files.length > 0 && <BatchFooter busy={busy} disabled={false} count={files.length} label={`${files.length} file${files.length === 1 ? '' : 's'} ready`} onClick={() => { onFiles(files); setFiles([]) }} />}
      </div>}
      {mode === 'image' && (
        <div className="upload-zone batch-upload-zone">
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
        </div>
      )}
      {mode === 'audio' && (
        <div className="upload-zone batch-upload-zone">
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
        </div>
      )}
      {mode === 'video' && (
        <div className="upload-zone batch-upload-zone">
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
        </div>
      )}
      {mode === 'url' && <div className="text-form batch-text-form">
        <div className="text-draft">
          <div className="draft-heading"><span>URL SOURCE</span></div>
          <label>Source title <input value={urlTitle} onChange={(event) => setUrlTitle(event.target.value)} placeholder="Optional readable title" /></label>
          <label>URL <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/article" /></label>
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
              <input
                value={youtubeTitle}
                onChange={(event) =>
                  setYoutubeTitle(event.target.value)
                }
                placeholder="Optional video title"
              />
            </label>

            <label>
              YouTube URL
              <input
                value={youtubeUrl}
                onChange={(event) =>
                  setYoutubeUrl(event.target.value)
                }
                placeholder="https://www.youtube.com/watch?v=..."
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
        <p>EV can record this source in the transformation history, but this backend cannot extract usable Content DNA from it yet.</p>
        <label>Source title <input value={unsupportedTitle} onChange={(event) => setUnsupportedTitle(event.target.value)} placeholder={`${mode.toUpperCase()} source`} /></label>
        <Button variant="ghost" loading={busy} loadingLabel="Recording..." onClick={() => { onUnsupported(mode as SourceType, unsupportedTitle || `${mode.toUpperCase()} source`, 'Adapter unavailable in current backend'); setUnsupportedTitle('') }}>Record unavailable source</Button>
      </div>}
    </div>
    <div className="pipeline"><span><b>01</b> Source</span><ArrowRight size={15} /><span><b>02</b> Understand</span><ArrowRight size={15} /><span className="pipeline-current"><b>03</b> Review DNA</span><ArrowRight size={15} /><span className="pipeline-muted">04 Outputs</span></div>
  </section>
}

function BatchFooter({ busy, disabled, count, label, onClick }: { busy: boolean; disabled: boolean; count: number; label: string; onClick: () => void }) {
  return <div className="form-footer"><span>{label}</span><Button variant="primary" disabled={disabled} loading={busy} loadingLabel={`Processing ${count} source${count === 1 ? '' : 's'}...`} onClick={onClick}><Sparkles size={16} />Process {count} source{count === 1 ? '' : 's'}</Button></div>
}
