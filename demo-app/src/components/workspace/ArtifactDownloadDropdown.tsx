import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, FileText, Presentation, FileCode, File, Check } from 'lucide-react'
import { exportArtifact, type ExportFormat } from '../../lib/export/documentExport'

interface ArtifactDownloadDropdownProps {
  artifactType: string
  artifactContent: string
  docTitle: string
}

export function ArtifactDownloadDropdown({
  artifactType,
  artifactContent,
  docTitle,
}: ArtifactDownloadDropdownProps) {
  const [open, setOpen] = useState(false)
  const [downloadedFormat, setDownloadedFormat] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const isPresentation =
    artifactType.toLowerCase().includes('presentation') ||
    artifactType.toLowerCase().includes('slide')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleExport = (format: ExportFormat) => {
    exportArtifact(artifactType, artifactContent, docTitle, format)
    setDownloadedFormat(format)
    setTimeout(() => setDownloadedFormat(null), 2000)
    setOpen(false)
  }

  return (
    <div className="download-split-dropdown" ref={menuRef}>
      <button
        type="button"
        className="btn-download-main"
        onClick={() => handleExport('pdf')}
        title="Download as PDF Document (Default)"
      >
        {downloadedFormat === 'pdf' ? <Check size={13} /> : <Download size={13} />}
        <span>{downloadedFormat === 'pdf' ? 'Exported PDF' : 'Download PDF'}</span>
      </button>

      <button
        type="button"
        className="btn-download-caret"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="More export formats"
        title="Choose file format"
      >
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className="download-menu-panel tactile-card">
          <div className="dropdown-section-label">SELECT FORMAT</div>

          <button
            type="button"
            className="menu-option-item default"
            onClick={() => handleExport('pdf')}
          >
            <div className="opt-icon pdf">
              <FileText size={15} />
            </div>
            <div className="opt-meta">
              <strong>PDF Document (.pdf)</strong>
              <small>Default · Print-ready styled A4 layout</small>
            </div>
          </button>

          <button
            type="button"
            className="menu-option-item"
            onClick={() => handleExport('docx')}
          >
            <div className="opt-icon docx">
              <FileText size={15} />
            </div>
            <div className="opt-meta">
              <strong>Word Document (.docx)</strong>
              <small>Formatted for MS Word & Google Docs</small>
            </div>
          </button>

          {isPresentation && (
            <button
              type="button"
              className="menu-option-item"
              onClick={() => handleExport('ppt')}
            >
              <div className="opt-icon pptx">
                <Presentation size={15} />
              </div>
              <div className="opt-meta">
                <strong>PowerPoint Presentation (.pptx)</strong>
                <small>Multi-slide editable presentation outline</small>
              </div>
            </button>
          )}

          <button
            type="button"
            className="menu-option-item"
            onClick={() => handleExport('md')}
          >
            <div className="opt-icon md">
              <FileCode size={15} />
            </div>
            <div className="opt-meta">
              <strong>Markdown Document (.md)</strong>
              <small>Raw GitHub-flavored markdown</small>
            </div>
          </button>

          <button
            type="button"
            className="menu-option-item"
            onClick={() => handleExport('txt')}
          >
            <div className="opt-icon txt">
              <File size={15} />
            </div>
            <div className="opt-meta">
              <strong>Plain Text (.txt)</strong>
              <small>Unformatted clean plain text</small>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
