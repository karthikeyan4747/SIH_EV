import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Presentation,
  FileText,
  Code2,
  ChevronLeft,
  ChevronRight,
  Printer,
  Maximize2,
  Mic,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import { parsePresentationMarkdown, type ParsedSlide } from '../../lib/export/presentationExport'
import { markdownToStyledHtml } from '../../lib/export/documentExport'

interface SlideDeckViewerProps {
  title: string
  content: string
  artifactType?: string
}

export function SlideDeckViewer({
  title,
  content,
  artifactType: _artifactType,
}: SlideDeckViewerProps) {
  const [viewMode, setViewMode] = useState<'deck' | 'pdf' | 'markdown'>('deck')
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fullscreenIframeRef = useRef<HTMLIFrameElement>(null)

  // Parse slides with zero phantom slides
  const slides = useMemo<ParsedSlide[]>(() => {
    return parsePresentationMarkdown(content)
  }, [content])

  // Bound index safely
  const activeIndex = Math.max(0, Math.min(slides.length - 1, currentSlideIndex))
  const currentSlide = slides[activeIndex] || {
    number: 1,
    title: title || 'Presentation',
    bullets: [],
    paragraphs: [],
  }

  // Keyboard navigation for slide deck
  useEffect(() => {
    if (viewMode !== 'deck') return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode, slides.length])

  // Fullscreen ESC listener and body scroll lock
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

  const docTitle = useMemo(() => {
    return `${title} · Executive Presentation Deck`
  }, [title])

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

  // Reusable Slide Canvas & Controls
  const renderSlideStage = (isFs = false) => (
    <div className={`slide-deck-stage ${isFs ? 'fullscreen-stage' : ''}`}>
      {/* 16:9 Presentation Canvas Card */}
      <div className="slide-canvas-outer">
        <div
          className={`slide-canvas-16-9 ${
            activeIndex === 0 ? 'slide-cover-theme' : 'slide-content-theme'
          } ${isFs ? 'fullscreen-canvas' : ''}`}
        >
          {/* Header Bar */}
          <div className="slide-header">
            <div className="slide-counter-badge">
              <span>SLIDE {activeIndex + 1} OF {slides.length}</span>
            </div>
            <div className="slide-deck-tagline">
              EXECUTIVE BRIEFING · VERIFIED EVIDENCE
            </div>
          </div>

          {/* Title Section */}
          <div className="slide-title-area">
            <h3 className="slide-title-text">{currentSlide.title}</h3>
            {currentSlide.visualDirection && (
              <div className="slide-direction-pill">
                <span className="direction-label">Visual Direction:</span>
                <span className="direction-value">{currentSlide.visualDirection}</span>
              </div>
            )}
          </div>

          {/* Slide Content Body */}
          <div className="slide-body-content">
            {currentSlide.bullets.length > 0 ? (
              <div className={`slide-bullets-grid ${currentSlide.bullets.length > 4 ? 'two-col' : 'one-col'}`}>
                {currentSlide.bullets.map((bullet, idx) => (
                  <div key={idx} className="slide-bullet-card">
                    <div className="bullet-indicator" />
                    <div className="bullet-text">{bullet}</div>
                  </div>
                ))}
              </div>
            ) : currentSlide.paragraphs.length > 0 ? (
              <div className="slide-paragraphs-block">
                {currentSlide.paragraphs.map((para, idx) => (
                  <p key={idx} className="slide-para-text">{para}</p>
                ))}
              </div>
            ) : (
              <div className="slide-empty-state">
                Executive overview slide prepared for briefing narration.
              </div>
            )}
          </div>

          {/* Bottom Footer on Slide */}
          <div className="slide-canvas-footer">
            <span className="platform-watermark">GenAI Transformation Studio</span>
            <span className="slide-canvas-num">{activeIndex + 1} / {slides.length}</span>
          </div>
        </div>
      </div>

      {/* Interactive Speaker Notes Drawer */}
      {currentSlide.speakerNotes && (
        <div className="slide-speaker-notes-box">
          <button
            type="button"
            className="speaker-notes-toggle-btn"
            onClick={() => setShowSpeakerNotes(!showSpeakerNotes)}
            title={showSpeakerNotes ? 'Hide Speaker Notes' : 'Show Speaker Notes'}
          >
            <div className="notes-btn-left">
              <Mic size={13} className="notes-mic-icon" />
              <strong className="notes-label">Presenter Script & Speaker Notes</strong>
            </div>
            <div className="notes-btn-right">
              <span>{showSpeakerNotes ? 'Collapse' : 'Expand'}</span>
              {showSpeakerNotes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
          </button>

          {showSpeakerNotes && (
            <div className="speaker-notes-content-drawer">
              <p className="speaker-notes-text">"{currentSlide.speakerNotes}"</p>
            </div>
          )}
        </div>
      )}

      {/* Slide Deck Navigation Bar */}
      <div className="slide-navigation-bar">
        <button
          type="button"
          className="slide-nav-btn prev-btn"
          disabled={activeIndex === 0}
          onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
          title="Previous slide (Left Arrow)"
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>

        {/* Quick-Jump Slide Number Pills */}
        <div className="slide-jump-pills-list">
          {slides.map((s, idx) => (
            <button
              key={idx}
              type="button"
              className={`slide-jump-pill ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => setCurrentSlideIndex(idx)}
              title={`Jump to Slide ${idx + 1}: ${s.title}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="slide-nav-btn next-btn"
          disabled={activeIndex === slides.length - 1}
          onClick={() => setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
          title="Next slide (Right Arrow)"
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Inline Preview Container */}
      <div className="slide-deck-viewer-container">
        {/* Top Toolbar */}
        <div className="viewer-toolbar">
          <div className="viewer-mode-toggle">
            <button
              type="button"
              className={`mode-btn ${viewMode === 'deck' ? 'active' : ''}`}
              onClick={() => setViewMode('deck')}
              title="Interactive 16:9 Presentation Deck Preview"
            >
              <Presentation size={13} />
              <span>Slide Deck View</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${viewMode === 'pdf' ? 'active' : ''}`}
              onClick={() => setViewMode('pdf')}
              title="Document Print-Ready Layout"
            >
              <FileText size={13} />
              <span>Document / PDF View</span>
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

        {/* Inline Viewport */}
        {viewMode === 'deck' ? (
          renderSlideStage(false)
        ) : viewMode === 'pdf' ? (
          <div className="viewer-viewport">
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
          </div>
        ) : (
          <div className="viewer-viewport">
            <div className="markdown-raw-viewport">
              <pre className="markdown-pre">{content}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Fullscreen Modal Portal */}
      {isFullscreen &&
        createPortal(
          <div
            className="deliverable-fullscreen-overlay"
            onClick={() => setIsFullscreen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`Expanded presentation preview of ${docTitle}`}
          >
            <div
              className="deliverable-fullscreen-dialog slide-deck-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Fullscreen Toolbar */}
              <div className="fullscreen-modal-toolbar">
                <div className="fullscreen-toolbar-left">
                  <div className="fullscreen-toolbar-badge">
                    <Presentation size={14} />
                    <span className="fullscreen-doc-type">SLIDES</span>
                  </div>
                  <h3 className="fullscreen-doc-title" title={title}>
                    {title}
                  </h3>
                  <span className="fullscreen-slide-counter">
                    Slide {activeIndex + 1} of {slides.length}
                  </span>
                </div>

                <div className="fullscreen-toolbar-center">
                  <div className="viewer-mode-toggle">
                    <button
                      type="button"
                      className={`mode-btn ${viewMode === 'deck' ? 'active' : ''}`}
                      onClick={() => setViewMode('deck')}
                    >
                      <Presentation size={13} />
                      <span>Slide Deck View</span>
                    </button>
                    <button
                      type="button"
                      className={`mode-btn ${viewMode === 'pdf' ? 'active' : ''}`}
                      onClick={() => setViewMode('pdf')}
                    >
                      <FileText size={13} />
                      <span>Document / PDF View</span>
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
                {viewMode === 'deck' ? (
                  renderSlideStage(true)
                ) : viewMode === 'pdf' ? (
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

