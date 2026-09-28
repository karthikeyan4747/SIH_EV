import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Dna,
  FileText,
  GripHorizontal,
  History,
  Layers,
  Presentation,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import type { WorkspaceStage } from './StageNavigation'

interface GuidedTutorialWidgetProps {
  isOpen: boolean
  onClose: () => void
  onOpen: () => void
  activeStage: WorkspaceStage
  onSelectStage: (stage: WorkspaceStage) => void
  dnaViewMode: 'lineage' | 'helix' | 'inspector' | 'versions'
  onDnaViewModeChange: (mode: 'lineage' | 'helix' | 'inspector' | 'versions') => void
  onOpenVersionsModal: () => void
  sourceCount: number
  conflictsResolved: boolean
  hasOutputs: boolean
  isVersionModalOpen: boolean
  hasClonedBlueprint?: boolean
  onQuickResolveConflict?: () => void
  onQuickLoadPresets?: () => void
  onQuickCloneBlueprint?: () => void
}

interface TourStep {
  id: string
  stage: WorkspaceStage
  dnaMode?: 'lineage' | 'helix' | 'inspector' | 'versions'
  targetSelector: string
  preferredPlacement?: 'bottom' | 'top' | 'right' | 'left'
  stepNumber: number
  badge: string
  title: string
  instruction: string
  actionLabel: string
  actionIcon: typeof Sparkles
  checkCompleted: (state: {
    activeStage: WorkspaceStage
    dnaViewMode: string
    sourceCount: number
    conflictsResolved: boolean
    hasOutputs: boolean
    isVersionModalOpen: boolean
    hasClonedBlueprint?: boolean
  }) => boolean
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'mech-sources',
    stage: 'sources',
    targetSelector: '#tour-preset-selector, .predefined-input-selector',
    preferredPlacement: 'right',
    stepNumber: 1,
    badge: 'PHASE 01 · INGESTION',
    title: 'Multimodal Input Selector',
    instruction:
      'Select a verified engineering input from the dropdown or click "Load All 7 Inputs" to harmonize PDFs, specs, video, and audio into a unified knowledge base.',
    actionLabel: 'Load All 7 Sample Inputs',
    actionIcon: FileText,
    checkCompleted: (s) => s.sourceCount >= 7,
  },
  {
    id: 'mech-dna',
    stage: 'dna',
    dnaMode: 'inspector',
    targetSelector: '#tour-btn-inspector',
    preferredPlacement: 'bottom',
    stepNumber: 2,
    badge: 'PHASE 02 · CANONICAL DNA',
    title: '6-Layer Content DNA Inspector',
    instruction:
      'Inspect how raw inputs are decomposed into 6 canonical layers (facts, metrics, risks, citations) to eliminate hallucinations.',
    actionLabel: 'Open Attribute Inspector',
    actionIcon: Layers,
    checkCompleted: (s) => s.activeStage === 'dna' && s.dnaViewMode === 'inspector',
  },
  {
    id: 'mech-helix',
    stage: 'dna',
    dnaMode: 'helix',
    targetSelector: '#tour-btn-helix',
    preferredPlacement: 'bottom',
    stepNumber: 3,
    badge: 'PHASE 02 · 3D DUAL-STRAND',
    title: '3D Double-Helix Knowledge Model',
    instruction:
      'Switch to the 3D Double-Helix visualizer to see how raw evidence strands intertwine with synthesized canonical DNA.',
    actionLabel: 'Switch to Double-Helix',
    actionIcon: Dna,
    checkCompleted: (s) => s.activeStage === 'dna' && s.dnaViewMode === 'helix',
  },
  {
    id: 'mech-versions',
    stage: 'dna',
    dnaMode: 'versions',
    targetSelector: '#tour-btn-versions',
    preferredPlacement: 'bottom',
    stepNumber: 4,
    badge: 'PHASE 02 · AUDIT & ROLLBACK',
    title: 'DNA Version Snapshots & Audit Log',
    instruction:
      'Inspect immutable snapshots (v1 to v4), view diffs, author logs, and restore any previous state with one click.',
    actionLabel: 'View Version Snapshots',
    actionIcon: History,
    checkCompleted: (s) => (s.activeStage === 'dna' && s.dnaViewMode === 'versions') || s.isVersionModalOpen,
  },
  {
    id: 'mech-integrity',
    stage: 'integrity',
    targetSelector: '#tour-conflict-panel, .conflict-resolution-wrapper',
    preferredPlacement: 'bottom',
    stepNumber: 5,
    badge: 'PHASE 03 · DISPUTE AUDIT',
    title: 'Fact Dispute Resolution',
    instruction:
      'Notice the 310 Wh/kg vs 285 Wh/kg cell density dispute. Click to sanitize the Content DNA and generate a new Version 5 in history.',
    actionLabel: 'Resolve Conflict to 285 Wh/kg',
    actionIcon: ShieldCheck,
    checkCompleted: (s) => s.conflictsResolved,
  },
  {
    id: 'mech-template',
    stage: 'studio',
    targetSelector: '#tour-template-cloner, #template-cloner-workbench',
    preferredPlacement: 'bottom',
    stepNumber: 6,
    badge: 'PHASE 04 · BLUEPRINT CLONING',
    title: 'Reference Template Layout Cloner',
    instruction:
      'Compare unstyled raw text on the left with the styled reference designed page. Click to clone the visual format while injecting your raw data.',
    actionLabel: 'Clone Design with Raw Data',
    actionIcon: Sparkles,
    checkCompleted: (s) => Boolean(s.hasClonedBlueprint),
  },
  {
    id: 'mech-studio',
    stage: 'studio',
    targetSelector: '#tour-deliverables-viewer, .deliverable-pdf-container, .studio-artifacts-deck',
    preferredPlacement: 'top',
    stepNumber: 7,
    badge: 'PHASE 05 · UNIVERSAL STUDIO',
    title: 'Universal Deliverables Studio',
    instruction:
      'Inspect the 16:9 board presentation deck with speaker notes and technical whitepaper, synthesized strictly from verified DNA.',
    actionLabel: 'Inspect 16:9 Slide Deck',
    actionIcon: Presentation,
    checkCompleted: (s) => s.activeStage === 'studio' && s.hasOutputs,
  },
]

interface CardPosition {
  top: number
  left: number
  placement: 'bottom' | 'top' | 'right' | 'left'
  arrowLeft?: number
  arrowTop?: number
}

function getAttachedPosition(
  targetRect: DOMRect,
  cardWidth: number,
  cardHeight: number,
  preferredPlacement: 'bottom' | 'top' | 'right' | 'left' = 'bottom'
): CardPosition {
  const margin = 14
  const padding = 16
  const vw = window.innerWidth
  const vh = window.innerHeight

  const spaceBelow = vh - targetRect.bottom
  const spaceAbove = targetRect.top
  const spaceRight = vw - targetRect.right
  const spaceLeft = targetRect.left

  const fitsRight = spaceRight >= cardWidth + margin + padding
  const fitsBelow = spaceBelow >= cardHeight + margin + padding
  const fitsAbove = spaceAbove >= cardHeight + margin + padding
  const fitsLeft = spaceLeft >= cardWidth + margin + padding

  let placement: 'bottom' | 'top' | 'right' | 'left' = preferredPlacement

  if (preferredPlacement === 'right' && fitsRight) {
    placement = 'right'
  } else if (preferredPlacement === 'left' && fitsLeft) {
    placement = 'left'
  } else if (preferredPlacement === 'bottom' && fitsBelow) {
    placement = 'bottom'
  } else if (preferredPlacement === 'top' && fitsAbove) {
    placement = 'top'
  } else {
    // If preferred placement does not fit comfortably, select the best fitting orientation
    if (fitsBelow) {
      placement = 'bottom'
    } else if (fitsAbove) {
      placement = 'top'
    } else if (fitsRight) {
      placement = 'right'
    } else if (fitsLeft) {
      placement = 'left'
    } else {
      // Pick the side with the maximum clearance
      const maxSpace = Math.max(spaceBelow, spaceAbove, spaceRight, spaceLeft)
      if (maxSpace === spaceBelow) placement = 'bottom'
      else if (maxSpace === spaceAbove) placement = 'top'
      else if (maxSpace === spaceRight) placement = 'right'
      else placement = 'left'
    }
  }

  let top = 0
  let left = 0

  if (placement === 'right') {
    left = targetRect.right + margin
    const targetCenterY = targetRect.top + targetRect.height / 2
    top = targetCenterY - cardHeight / 2
  } else if (placement === 'left') {
    left = targetRect.left - cardWidth - margin
    const targetCenterY = targetRect.top + targetRect.height / 2
    top = targetCenterY - cardHeight / 2
  } else if (placement === 'bottom') {
    top = targetRect.bottom + margin
    const targetCenterX = targetRect.left + targetRect.width / 2
    left = targetCenterX - cardWidth / 2
  } else {
    // placement === 'top'
    top = targetRect.top - cardHeight - margin
    const targetCenterX = targetRect.left + targetRect.width / 2
    left = targetCenterX - cardWidth / 2
  }

  // Clamping to screen boundaries so the card is never off-screen
  top = Math.max(padding, Math.min(vh - cardHeight - padding, top))
  left = Math.max(padding, Math.min(vw - cardWidth - padding, left))

  // Arrow calculations relative to the card
  let arrowLeft: number | undefined
  let arrowTop: number | undefined

  if (placement === 'bottom' || placement === 'top') {
    const targetCenterX = targetRect.left + targetRect.width / 2
    arrowLeft = Math.max(28, Math.min(cardWidth - 28, targetCenterX - left))
  } else {
    const targetCenterY = targetRect.top + targetRect.height / 2
    arrowTop = Math.max(28, Math.min(cardHeight - 28, targetCenterY - top))
  }

  return { top, left, placement, arrowLeft, arrowTop }
}

export function GuidedTutorialWidget({
  isOpen,
  onClose,
  onOpen,
  activeStage,
  onSelectStage,
  dnaViewMode,
  onDnaViewModeChange,
  onOpenVersionsModal,
  sourceCount,
  conflictsResolved,
  hasOutputs,
  isVersionModalOpen,
  hasClonedBlueprint,
  onQuickResolveConflict,
  onQuickLoadPresets,
  onQuickCloneBlueprint,
}: GuidedTutorialWidgetProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMasteredModalOpen, setIsMasteredModalOpen] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [cardPos, setCardPos] = useState<CardPosition | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 })

  const handleFullExit = useCallback(() => {
    setIsMinimized(false)
    setIsMasteredModalOpen(false)
    onClose()
  }, [onClose])

  const handleMinimize = useCallback(() => {
    setIsMinimized(true)
    onClose()
  }, [onClose])

  const handleRestoreFromMinimized = useCallback(() => {
    setIsMinimized(false)
    onOpen()
  }, [onOpen])

  // Pressing Escape key cleanly exits the walkthrough immediately
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleFullExit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleFullExit])

  const stateSnapshot = {
    activeStage,
    dnaViewMode,
    sourceCount,
    conflictsResolved,
    hasOutputs,
    isVersionModalOpen,
    hasClonedBlueprint,
  }

  const completedMap = TOUR_STEPS.map((m) => m.checkCompleted(stateSnapshot))
  const completedCount = completedMap.filter(Boolean).length
  const activeStep = TOUR_STEPS[currentIdx]
  const isCurrentCompleted = completedMap[currentIdx]

  // Dynamic measurement and anchoring of card right to the target border
  const updatePosition = useCallback(() => {
    if (!isOpen) {
      setTargetRect(null)
      setCardPos(null)
      return
    }

    const el = document.querySelector<HTMLElement>(activeStep.targetSelector)
    if (!el) {
      setTargetRect(null)
      setCardPos(null)
      return
    }

    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setTargetRect(rect)
      const cardEl = cardRef.current
      const width = cardEl?.offsetWidth || 390
      const height = cardEl?.offsetHeight || 220
      const pos = getAttachedPosition(
        rect,
        width,
        height,
        activeStep.preferredPlacement || 'bottom'
      )
      setCardPos(pos)
    } else {
      setTargetRect(null)
      setCardPos(null)
    }
  }, [isOpen, activeStep])

  // Immediate layout calculation
  useLayoutEffect(() => {
    updatePosition()
  }, [updatePosition, currentIdx, isOpen])

  // Re-run measurement whenever the card dimensions adjust
  useEffect(() => {
    if (!isOpen || !cardRef.current) return
    const ro = new ResizeObserver(() => {
      updatePosition()
    })
    ro.observe(cardRef.current)
    return () => ro.disconnect()
  }, [isOpen, updatePosition])

  // Continuous tracking on scroll and resize (capture phase catches inner container scrolls)
  useEffect(() => {
    if (!isOpen) return

    const handleScroll = () => {
      updatePosition()
    }

    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOpen, updatePosition])

  // Scroll target element into view on step change, plus run high-frequency tracking RAF loop
  useEffect(() => {
    if (!isOpen) return

    // 1. Smoothly scroll target into view
    const scrollTimer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(activeStep.targetSelector)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 60)

    // 2. High-frequency tracking RAF loop for 1.2s to smoothly follow the scrolling element
    let active = true
    const startTime = performance.now()

    const followLoop = (now: number) => {
      if (!active) return
      updatePosition()
      if (now - startTime < 1200) {
        requestAnimationFrame(followLoop)
      }
    }

    const rafId = requestAnimationFrame(followLoop)

    return () => {
      active = false
      clearTimeout(scrollTimer)
      cancelAnimationFrame(rafId)
    }
  }, [currentIdx, isOpen, activeStep, updatePosition])

  // Dragging support
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return

    isDraggingRef.current = true
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left,
      startY: rect.top,
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return
      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY

      const newLeft = Math.max(
        16,
        Math.min(window.innerWidth - (rect.width || 380) - 16, dragStartRef.current.startX + deltaX)
      )
      const newTop = Math.max(
        16,
        Math.min(window.innerHeight - (rect.height || 220) - 16, dragStartRef.current.startY + deltaY)
      )

      setDragPos({ x: newLeft, y: newTop })
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleGoTo = (idx: number) => {
    setDragPos(null)
    setCurrentIdx(idx)
    const target = TOUR_STEPS[idx]
    onSelectStage(target.stage)
    if (target.dnaMode) {
      onDnaViewModeChange(target.dnaMode)
    }
  }

  const handleNextStep = () => {
    if (currentIdx < TOUR_STEPS.length - 1) {
      handleGoTo(currentIdx + 1)
    } else {
      setIsMasteredModalOpen(true)
    }
  }

  const handlePrevStep = () => {
    if (currentIdx > 0) {
      handleGoTo(currentIdx - 1)
    }
  }

  const handleExecuteAction = () => {
    onSelectStage(activeStep.stage)

    if (activeStep.dnaMode) {
      onDnaViewModeChange(activeStep.dnaMode)
    }

    if (activeStep.id === 'mech-sources') {
      if (onQuickLoadPresets) {
        onQuickLoadPresets()
      } else {
        const btn = document.querySelector<HTMLButtonElement>('.preset-load-all-btn')
        btn?.click()
      }
    } else if (activeStep.id === 'mech-versions') {
      onDnaViewModeChange('versions')
      if (onOpenVersionsModal) {
        onOpenVersionsModal()
      }
    } else if (activeStep.id === 'mech-integrity') {
      if (onQuickResolveConflict) {
        onQuickResolveConflict()
      }
    } else if (activeStep.id === 'mech-template') {
      onSelectStage('studio')
      if (onQuickCloneBlueprint) {
        onQuickCloneBlueprint()
      } else {
        const btn = document.querySelector<HTMLButtonElement>(
          '#tour-btn-clone-template, .blueprint-run-btn'
        )
        btn?.click()
      }
    } else if (activeStep.id === 'mech-studio') {
      const el = document.querySelector<HTMLElement>('#tour-deliverables-viewer, .studio-artifacts-deck')
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  // If minimized or closed: show dock button only if explicitly minimized
  if (!isOpen) {
    if (!isMinimized) {
      return null
    }

    if (typeof document === 'undefined') return null

    return createPortal(
      <div className="floating-tutorial-minimized-dock page-enter">
        <button
          type="button"
          className="floating-tutorial-trigger"
          onClick={handleRestoreFromMinimized}
          title="Resume interactive walkthrough (Click to open)"
        >
          <span className="tutorial-pulse-orb" />
          <Zap size={14} style={{ color: '#38bdf8' }} />
          <span>Tour Guide</span>
          <span className="step-count-pill">{completedCount}/7 Done</span>
        </button>
        <button
          type="button"
          className="floating-tutorial-dismiss-btn"
          onClick={() => setIsMinimized(false)}
          title="Dismiss permanently"
          aria-label="Dismiss tour guide"
        >
          <X size={12} />
        </button>
      </div>,
      document.body
    )
  }

  const ActionIcon = activeStep.actionIcon

  // Fallback position if element is temporarily mounting
  const activeCardPos: CardPosition = cardPos || {
    top: 120,
    left: Math.max(16, window.innerWidth - 420),
    placement: 'bottom',
    arrowLeft: 190,
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {/* 1. Neon Glowing Spotlight Outline on Target Element (NO dark backdrop, fully lit, pointer-events: none so demo is 100% operable) */}
      {targetRect && (
        <div
          className="tour-target-spotlight"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        >
          <div className="tour-target-beacon" />
          <div className="tour-target-callout-pill">
            <span className="pill-dot" />
            <span>Step {currentIdx + 1}: {activeStep.title}</span>
          </div>
        </div>
      )}

      {/* 2. Walkthrough Content Card Attached Directly to the Target Border */}
      <div
        ref={cardRef}
        className={`tour-attached-card placement-${activeCardPos.placement} page-enter`}
        style={
          dragPos
            ? { top: dragPos.y, left: dragPos.x }
            : { top: activeCardPos.top, left: activeCardPos.left }
        }
        role="region"
        aria-label={`Interactive Guided Tour Step ${currentIdx + 1}: ${activeStep.title}`}
      >
        {/* Directional Arrow pointing directly to the target border */}
        {!dragPos && targetRect && (
          <div
            className={`tour-card-arrow arrow-${activeCardPos.placement}`}
            style={{
              left:
                activeCardPos.placement === 'bottom' || activeCardPos.placement === 'top'
                  ? activeCardPos.arrowLeft
                  : undefined,
              top:
                activeCardPos.placement === 'right' || activeCardPos.placement === 'left'
                  ? activeCardPos.arrowTop
                  : undefined,
            }}
          />
        )}

        {/* Top Progress Line */}
        <div className="tour-guide-progress-track">
          <div
            className="tour-guide-progress-fill"
            style={{ width: `${((currentIdx + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Draggable Header with double-click to re-anchor */}
        <div
          className="tour-guide-header"
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setDragPos(null)}
          title="Drag to reposition · Double-click to re-anchor to element"
        >
          <div className="tour-guide-header-left">
            <GripHorizontal size={14} className="tour-drag-handle-icon" />
            <span className="tour-guide-badge">{activeStep.badge}</span>
            <span className="tour-guide-counter">
              Step {currentIdx + 1} of {TOUR_STEPS.length}
            </span>
            {isCurrentCompleted && (
              <span className="tour-guide-done-chip">
                <CheckCircle2 size={11} />
                <span>Done</span>
              </span>
            )}
          </div>

          <div className="tour-guide-header-right">
            <button
              type="button"
              className="tour-guide-icon-btn"
              onClick={handleMinimize}
              title="Minimize to corner"
              aria-label="Minimize walkthrough"
            >
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              className="tour-guide-icon-btn close-btn"
              onClick={handleFullExit}
              title="Exit walkthrough (Esc)"
              aria-label="Exit walkthrough"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Guide Body */}
        <div className="tour-guide-body">
          <h4 className="tour-guide-title">{activeStep.title}</h4>
          <p className="tour-guide-instruction">{activeStep.instruction}</p>

          {/* Primary Action Button */}
          <button
            type="button"
            className={`tour-guide-action-btn ${isCurrentCompleted ? 'completed-btn' : 'primary'}`}
            onClick={handleExecuteAction}
          >
            {isCurrentCompleted ? (
              <>
                <CheckCircle2 size={14} />
                <span>Trigger Again</span>
              </>
            ) : (
              <>
                <ActionIcon size={14} />
                <span>{activeStep.actionLabel}</span>
                <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>

        {/* Guide Footer */}
        <div className="tour-guide-footer">
          <div className="tour-guide-dots" role="tablist">
            {TOUR_STEPS.map((step, idx) => {
              const isDone = completedMap[idx]
              const isCurrent = idx === currentIdx
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`tour-step-dot ${isCurrent ? 'active' : isDone ? 'completed' : ''}`}
                  onClick={() => handleGoTo(idx)}
                  title={`Step ${idx + 1}: ${step.title}`}
                  aria-label={`Step ${idx + 1}`}
                >
                  {isDone ? '✓' : idx + 1}
                </button>
              )
            })}
          </div>

          <div className="tour-guide-nav-btns">
            <button
              type="button"
              className="tour-nav-btn"
              onClick={handlePrevStep}
              disabled={currentIdx === 0}
              title="Previous Step"
            >
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>
            <button
              type="button"
              className="tour-nav-btn primary"
              onClick={handleNextStep}
              title={currentIdx === TOUR_STEPS.length - 1 ? 'Finish Walkthrough' : 'Next Step'}
            >
              <span>{currentIdx === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Mastery Celebration Modal */}
      {isMasteredModalOpen && (
        <div className="tour-mastery-modal-backdrop" onClick={handleFullExit}>
          <div className="tour-mastery-dialog tactile-card" onClick={(e) => e.stopPropagation()}>
            <div className="trophy-badge-wrap">
              <Trophy size={32} style={{ color: '#38bdf8' }} />
            </div>
            <h3 className="mastery-headline">All 7 Mechanics Mastered</h3>
            <p className="mastery-subtext">
              You verified Multimodal Ingestion, 6-Layer Content DNA, 3D Double-Helix modeling, Version History, Fact Dispute Resolution, Reference Template Design Cloning, and Universal Studio synthesis.
            </p>
            <div className="mastery-actions">
              <button
                type="button"
                className="tour-action-trigger-btn secondary"
                onClick={() => {
                  setIsMasteredModalOpen(false)
                  handleGoTo(0)
                }}
              >
                <RotateCcw size={14} />
                <span>Replay Walkthrough</span>
              </button>
              <button
                type="button"
                className="tour-action-trigger-btn primary"
                onClick={handleFullExit}
              >
                <span>Explore Cockpit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
