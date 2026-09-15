import { useState, useMemo, useRef } from 'react'
import { FileText, Code2, Printer, Maximize2, Minimize2 } from 'lucide-react'
import { markdownToStyledHtml } from '../../lib/export/documentExport'

interface DocumentPdfViewerProps {
  title: string
  content: string
  artifactType: string
}

export function DocumentPdfViewer({
  title,
  content,
  artifactType,
}: DocumentPdfViewerProps) {
  const [viewMode, setViewMode] = useState<'pdf' | 'markdown'>('pdf')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const docTitle = useMemo(() => {
    const formattedType = artifactType.replaceAll('_', ' ')
    return `${title} · ${formattedType.charAt(0).toUpperCase() + formattedType.slice(1)}`
  }, [title, artifactType])

  const styledHtml = useMemo(() => {
    return markdownToStyledHtml(docTitle, content)
  }, [docTitle, content])

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus()
      iframeRef.current.contentWindow.print()
    }
  }

  return (
    <div className={`document-viewer-container ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Viewer Control Bar */}
      <div className="viewer-toolbar">
        <div className="viewer-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${viewMode === 'pdf' ? 'active' : ''}`}
            onClick={() => setViewMode('pdf')}
            title="Rendered PDF Print-Ready Document Layout"
          >
            <FileText size={13} />
            <span>Document PDF View</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${viewMode === 'markdown' ? 'active' : ''}`}
            onClick={() => setViewMode('markdown')}
            title="Raw Markdown Source"
          >
            <Code2 size={13} />
            <span>Markdown Source</span>
          </button>
        </div>

        <div className="viewer-tools">
          {viewMode === 'pdf' && (
            <button
              type="button"
              className="viewer-tool-btn"
              onClick={handlePrint}
              title="Print or Save PDF"
            >
              <Printer size={13} />
              <span>Print / PDF</span>
            </button>
          )}

          <button
            type="button"
            className="viewer-tool-btn icon-only"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main Viewer Body */}
      <div className="viewer-viewport">
        {viewMode === 'pdf' ? (
          <div className="paper-sheet-wrapper">
            <div className="paper-sheet">
              <iframe
                ref={iframeRef}
                srcDoc={styledHtml}
                title={docTitle}
                className="paper-iframe"
                sandbox="allow-same-origin allow-modals"
              />
            </div>
          </div>
        ) : (
          <div className="markdown-raw-viewport">
            <pre className="markdown-pre">{content}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
