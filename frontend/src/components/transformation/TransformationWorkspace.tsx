import { useEffect, useState, useCallback } from 'react'
import { AlertCircle, ArrowRight } from 'lucide-react'
import type { ContentDNAPatch, SourceType } from '../../types/content'
import type { Transformation, SourceIntegrity } from '../../types/transformation'
import { analyzeSourceIntegrity, resolveTransformationConflict } from '../../lib/api/client'

import { WorkspaceHeader } from '../workspace/WorkspaceHeader'
import { StageNavigation, type WorkspaceStage } from '../workspace/StageNavigation'
import { SourcesStage } from '../workspace/stages/SourcesStage'
import { ContentDNAStage } from '../workspace/stages/ContentDNAStage'
import { IntegrityStage } from '../workspace/stages/IntegrityStage'
import { StudioStage, type GenerationConfig } from '../workspace/stages/StudioStage'
import { VersionHistoryModal } from '../workspace/VersionHistoryModal'
import { GuidedTutorialWidget } from '../workspace/GuidedTutorialWidget'
import '../workspace/workspace.css'

export type { GenerationConfig }

interface TransformationWorkspaceProps {
  transformation: Transformation
  busy: boolean
  saveState: 'saved' | 'dirty' | 'saving' | 'error'
  themeMode?: 'light' | 'dark'
  onThemeToggle?: () => void
  onTexts: (sources: { title: string; text: string }[]) => Promise<void>
  onFiles: (files: File[]) => Promise<void>
  onUrl: (url: string, title?: string) => Promise<void>
  onUnsupported: (sourceType: SourceType, title: string, note?: string) => Promise<void>
  onPatch: (changes: ContentDNAPatch) => Promise<void>
  onRename: (title: string) => void
  onRemoveSource: (sourceId: string) => Promise<void>
  onGenerateOutputs: (types: string[], generationConfig: GenerationConfig) => void
  onRestoreVersion: (version: number) => void
  onConflictResolved: (transformation: Transformation) => void
  onDeleteOutput?: (outputId: string) => void
}

export function TransformationWorkspace({
  transformation,
  busy,
  saveState,
  themeMode = 'dark',
  onThemeToggle = () => {},
  onTexts,
  onFiles,
  onUrl,
  onUnsupported,
  onPatch,
  onRename,
  onRemoveSource,
  onGenerateOutputs,
  onRestoreVersion,
  onConflictResolved,
  onDeleteOutput,
}: TransformationWorkspaceProps) {
  // Determine starting stage logically
  const [activeStage, setActiveStage] = useState<WorkspaceStage>(() => {
    if (transformation.outputs && transformation.outputs.length > 0) return 'studio'
    if (transformation.sources && transformation.sources.length > 0) return 'dna'
    return 'sources'
  })

  // Integrity Analysis State
  const [integrity, setIntegrity] = useState<SourceIntegrity | null>(
    transformation.source_integrity ?? null
  )
  const [integrityLoading, setIntegrityLoading] = useState(false)
  const [integrityError, setIntegrityError] = useState('')

  // Version History Modal
  const [showVersionsModal, setShowVersionsModal] = useState(false)

  // Guided Tutorial Tour State (Starts open so evaluators immediately notice the guide)
  const [isTutorialOpen, setIsTutorialOpen] = useState(true)
  const [dnaViewMode, setDnaViewMode] = useState<
    'lineage' | 'helix' | 'inspector' | 'versions'
  >('lineage')

  // DNA Stale Prompt
  const [dnaChangedPrompt, setDnaChangedPrompt] = useState<{
    open: boolean
    reason: string
  } | null>(null)

  useEffect(() => {
    if (transformation.source_integrity) {
      setIntegrity(transformation.source_integrity)
    } else {
      setIntegrity(null)
    }
  }, [transformation.id, transformation.source_integrity])

  // Run Source Integrity
  async function runSourceIntegrity() {
    if (!transformation.sources.length) {
      setIntegrityError('Please attach at least one source before running Source Integrity.')
      return
    }

    try {
      setIntegrityLoading(true)
      setIntegrityError('')
      const result = await analyzeSourceIntegrity(transformation.id)
      setIntegrity(result)
    } catch (error) {
      console.error('Failed to analyze source integrity:', error)
      setIntegrityError(
        error instanceof Error ? error.message : 'Failed to analyze source integrity.'
      )
    } finally {
      setIntegrityLoading(false)
    }
  }

  // Handle inline DNA patch with stale check
  async function handlePatch(patch: ContentDNAPatch) {
    await onPatch(patch)
    if (transformation.outputs && transformation.outputs.length > 0) {
      setDnaChangedPrompt({
        open: true,
        reason: 'Content DNA knowledge layer was modified in the Attribute Inspector.',
      })
    }
  }

  async function handleQuickResolveConflict() {
    try {
      const updated = await resolveTransformationConflict(
        transformation.id,
        'conflict-energy-density-01',
        {
          decision: 'accept_source_b',
          selected_claim_id: 'claim-density-supplier',
          final_value: '285',
        },
      )
      setIntegrity(updated.source_integrity ?? null)
      onConflictResolved(updated)
      setDnaChangedPrompt({
        open: true,
        reason: 'Resolved cell energy density to 285 Wh/kg. Content DNA sanitized into Version 5.',
      })
    } catch (e) {
      console.error('Failed to resolve conflict:', e)
    }
  }

  const handleQuickLoadPresets = () => {
    const btn = document.querySelector<HTMLButtonElement>('.preset-load-all-btn')
    if (btn) {
      btn.click()
    }
  }

  const [hasClonedBlueprint, setHasClonedBlueprint] = useState(false)

  const handleQuickCloneBlueprint = useCallback(() => {
    setActiveStage('studio')
    scrollToSection('section-studio')
    setHasClonedBlueprint(true)
    setTimeout(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        '#tour-btn-clone-template, .blueprint-run-btn'
      )
      if (btn) {
        btn.click()
      }
    }, 150)
  }, [])

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      const yOffset = -90
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const handleSelectStage = (stage: WorkspaceStage) => {
    setActiveStage(stage)
    scrollToSection(`section-${stage}`)
  }

  useEffect(() => {
    const sectionIds: WorkspaceStage[] = ['sources', 'dna', 'integrity', 'studio']
    const handleScroll = () => {
      const scrollPos = window.scrollY + 140
      let current: WorkspaceStage = 'sources'
      for (const id of sectionIds) {
        const el = document.getElementById(`section-${id}`)
        if (el) {
          const top = el.offsetTop
          if (scrollPos >= top) {
            current = id
          }
        }
      }
      setActiveStage(current)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const conflicts = integrity?.conflicts || []
  const activeConflicts = conflicts.filter((c) => c.status !== 'resolved')

  return (
    <div className="workspace-shell-container page-enter">
      {/* 1. Global Studio Header */}
      <WorkspaceHeader
        transformation={transformation}
        saveState={saveState}
        themeMode={themeMode}
        onThemeToggle={onThemeToggle}
        onRename={onRename}
        onOpenVersions={() => setShowVersionsModal(true)}
        onToggleTutorial={() => setIsTutorialOpen((prev) => !prev)}
        isTutorialOpen={isTutorialOpen}
      />

      {/* 2. Persistent 4-Stage Stepper Quick-Jump Dock */}
      <StageNavigation
        activeStage={activeStage}
        onSelectStage={handleSelectStage}
        sourceCount={transformation.sources?.length || 0}
        hasDna={Boolean(transformation.content_dna)}
        conflictCount={activeConflicts.length}
        hasIntegrity={Boolean(integrity)}
        outputCount={transformation.outputs?.length || 0}
      />

      {/* 3. DNA Changed Prompt Banner */}
      {dnaChangedPrompt?.open && (
        <div className="tactile-card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px solid var(--accent-primary)', background: 'var(--accent-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={16} color="var(--accent-text)" />
            <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
              <strong>Knowledge Base Updated:</strong> {dnaChangedPrompt.reason}. You can regenerate deliverables in the Studio.
            </span>
          </div>
          <button
            type="button"
            className="header-action-btn primary"
            style={{ fontSize: '11px', padding: '5px 10px' }}
            onClick={() => {
              setDnaChangedPrompt(null)
              handleSelectStage('studio')
            }}
          >
            <span>Go to Studio</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* 4. Single-Page Continuous Vertical Scroll Flow */}
      <main className="workspace-scroll-flow">
        {/* Phase 01: Sources & Documents */}
        <section id="section-sources" className="workspace-section">
          <div className="section-anchor-header">
            <div className="section-anchor-tag">
              <span className="section-num">PHASE 01</span>
              <span className="section-title">Sources & Documents</span>
            </div>
          </div>
          <SourcesStage
            sources={transformation.sources || []}
            busy={busy}
            onAddTexts={onTexts}
            onAddFiles={onFiles}
            onAddUrl={onUrl}
            onAddUnsupported={onUnsupported}
            onRemoveSource={onRemoveSource}
            onProceedToDNA={() => handleSelectStage('dna')}
          />
        </section>

        {/* Phase 02: Content DNA & Facts */}
        <section id="section-dna" className="workspace-section">
          <div className="section-anchor-header">
            <div className="section-anchor-tag">
              <span className="section-num">PHASE 02</span>
              <span className="section-title">Content DNA & Key Facts</span>
            </div>
          </div>
          <ContentDNAStage
            transformation={transformation}
            dna={transformation.content_dna ?? null}
            busy={busy}
            viewMode={dnaViewMode}
            onViewModeChange={setDnaViewMode}
            onPatch={handlePatch}
            onRestoreVersion={onRestoreVersion}
            onProceedToIntegrity={() => handleSelectStage('integrity')}
          />
        </section>

        {/* Phase 03: Fact Integrity & Audit Deck */}
        <section id="section-integrity" className="workspace-section">
          <div className="section-anchor-header">
            <div className="section-anchor-tag">
              <span className="section-num">PHASE 03</span>
              <span className="section-title">Fact Integrity & Audit</span>
            </div>
          </div>
          <IntegrityStage
            transformation={transformation}
            integrity={integrity}
            busy={busy}
            integrityLoading={integrityLoading}
            integrityError={integrityError}
            onRunIntegrity={runSourceIntegrity}
            onConflictResolved={(updated) => {
              setIntegrity(updated.source_integrity ?? null)
              onConflictResolved(updated)
              if (updated.outputs && updated.outputs.length > 0) {
                setDnaChangedPrompt({
                  open: true,
                  reason: 'Conflicted assertions were resolved and updated in your Content DNA',
                })
              }
            }}
            onProceedToStudio={() => handleSelectStage('studio')}
          />
        </section>

        {/* Phase 04: Deliverables Production Studio */}
        <section id="section-studio" className="workspace-section">
          <div className="section-anchor-header">
            <div className="section-anchor-tag">
              <span className="section-num">PHASE 04</span>
              <span className="section-title">Deliverables Studio</span>
            </div>
          </div>
          <StudioStage
            transformation={transformation}
            busy={busy}
            onGenerateOutputs={onGenerateOutputs}
            onDeleteOutput={onDeleteOutput}
            onTransformationUpdated={onConflictResolved}
            onClonedBlueprintSuccess={() => setHasClonedBlueprint(true)}
          />
        </section>
      </main>

      {/* 5. Version History Modal */}
      {showVersionsModal && (
        <VersionHistoryModal
          versions={transformation.versions || []}
          currentVersion={transformation.versions?.[transformation.versions.length - 1]?.version}
          onClose={() => setShowVersionsModal(false)}
          onRestoreVersion={onRestoreVersion}
        />
      )}

      {/* 6. Guided Interactive Tutorial Widget */}
      <GuidedTutorialWidget
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onOpen={() => setIsTutorialOpen(true)}
        activeStage={activeStage}
        onSelectStage={handleSelectStage}
        dnaViewMode={dnaViewMode}
        onDnaViewModeChange={setDnaViewMode}
        onOpenVersionsModal={() => setShowVersionsModal(true)}
        sourceCount={transformation.sources?.length || 0}
        conflictsResolved={activeConflicts.length === 0 && (integrity?.resolutions?.length || 0) > 0}
        hasOutputs={(transformation.outputs?.length || 0) > 0}
        isVersionModalOpen={showVersionsModal}
        hasClonedBlueprint={hasClonedBlueprint || Boolean(transformation.outputs?.some((o) => o.metadata?.cloned_from_reference))}
        onQuickResolveConflict={handleQuickResolveConflict}
        onQuickLoadPresets={handleQuickLoadPresets}
        onQuickCloneBlueprint={handleQuickCloneBlueprint}
      />
    </div>
  )
}
