import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Code2, Printer, Maximize2, X } from 'lucide-react'
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
  const fullscreenIframeRef = useRef<HTMLIFrameElement>(null)

  const docTitle = useMemo(() => {
    const formattedType = artifactType.replaceAll('_', ' ')
    return `${title} · ${formattedType.charAt(0).toUpperCase() + formattedType.slice(1)}`
  }, [title, artifactType])

  const styledHtml = useMemo(() => {
    return markdownToStyledHtml(docTitle, content)
  }, [docTitle, content])

  const handlePrint = (isFs = false) => {
    const targetIframe = isFs ? fullscreenIframeRef.current : iframeRef.current
    if (targetIframe?.contentWindow) {
      targetIframe.contentWindow.focus()
      targetIframe.contentWindow.print()
    }
  }

  // Handle ESC key and lock body scroll when fullscreen modal is active
  useEffect(() => {
    if (!isFullscreen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  return (
    <>
      {/* Inline Card Viewport */}
      <div className="document-viewer-container">
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
                onClick={() => handlePrint(false)}
                title="Print or Save PDF"
              >
                <Printer size={13} />
                <span>Print / PDF</span>
              </button>
            )}

            <button
              type="button"
              className="viewer-tool-btn icon-only"
              onClick={() => setIsFullscreen(true)}
              title="Expand Fullscreen Preview"
            >
              <Maximize2 size={14} />
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

      {/* Expanded Fullscreen Preview Portal */}
      {isFullscreen &&
        createPortal(
          <div
            className="deliverable-fullscreen-overlay"
            onClick={() => setIsFullscreen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`Expanded preview of ${docTitle}`}
          >
            <div
              className="deliverable-fullscreen-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Fullscreen Toolbar */}
              <div className="fullscreen-modal-toolbar">
                <div className="fullscreen-toolbar-left">
                  <div className="fullscreen-toolbar-badge">
                    <FileText size={14} />
                    <span className="fullscreen-doc-type">
                      {artifactType.replaceAll('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <h3 className="fullscreen-doc-title" title={title}>
                    {title}
                  </h3>
                </div>

                <div className="fullscreen-toolbar-center">
                  <div className="viewer-mode-toggle">
                    <button
                      type="button"
                      className={`mode-btn ${viewMode === 'pdf' ? 'active' : ''}`}
                      onClick={() => setViewMode('pdf')}
                    >
                      <FileText size={13} />
                      <span>Document PDF View</span>
                    </button>
                    <button
                      type="button"
                      className={`mode-btn ${viewMode === 'markdown' ? 'active' : ''}`}
                      onClick={() => setViewMode('markdown')}
                    >
                      <Code2 size={13} />
                      <span>Markdown Source</span>
                    </button>
                  </div>
                </div>

                <div className="fullscreen-toolbar-right">
                  {viewMode === 'pdf' && (
                    <button
                      type="button"
                      className="viewer-tool-btn"
                      onClick={() => handlePrint(true)}
                      title="Print or Save PDF"
                    >
                      <Printer size={13} />
                      <span>Print / PDF</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="fullscreen-close-btn"
                    onClick={() => setIsFullscreen(false)}
                    title="Exit Fullscreen (Escape)"
                  >
                    <X size={15} />
                    <span>Close</span>
                  </button>
                </div>
              </div>

              {/* Fullscreen Viewport Body */}
              <div className="fullscreen-modal-body">
                {viewMode === 'pdf' ? (
                  <div className="paper-sheet-wrapper fullscreen-wrapper">
                    <div className="paper-sheet fullscreen-paper-sheet">
                      <iframe
                        ref={fullscreenIframeRef}
                        srcDoc={styledHtml}
                        title={docTitle}
                        className="paper-iframe fullscreen-paper-iframe"
                        sandbox="allow-same-origin allow-modals"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="markdown-raw-viewport fullscreen-markdown">
                    <pre className="markdown-pre">{content}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

