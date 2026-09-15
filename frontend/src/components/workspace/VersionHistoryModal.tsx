import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  RotateCcw,
  X,
  History,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Layers,
  FileText,
  Calendar,
  Sparkles,
  Plus,
  Minus,
  Edit3,
  Tag,
  GitCompare,
} from 'lucide-react'
import type { DNAVersion } from '../../types/transformation'
import type { ContentDNA } from '../../types/content'
import { computeDNAChanges } from '../../lib/dnaChangeDetector'

function extractAllFacts(facts?: ContentDNA['facts']): string[] {
  if (!facts) return []
  return [
    ...(facts.claims || []),
    ...(facts.statistics || []),
    ...(facts.dates || []),
    ...(facts.events || []),
  ]
}

function extractAllFindings(findings?: ContentDNA['findings']): string[] {
  if (!findings) return []
  return [
    ...(findings.key_findings || []),
    ...(findings.risks || []),
    ...(findings.opportunities || []),
    ...(findings.implications || []),
  ]
}

function countEntities(entities?: ContentDNA['entities']): number {
  if (!entities) return 0
  return (
    (entities.people?.length || 0) +
    (entities.organizations?.length || 0) +
    (entities.locations?.length || 0) +
    (entities.technologies?.length || 0)
  )
}

interface VersionHistoryModalProps {
  versions: DNAVersion[]
  currentVersion?: number
  onClose: () => void
  onRestoreVersion: (version: number) => void
}

export function VersionHistoryModal({
  versions,
  currentVersion,
  onClose,
  onRestoreVersion,
}: VersionHistoryModalProps) {
  const [expandedVer, setExpandedVer] = useState<number | null>(null)
  const [confirmVer, setConfirmVer] = useState<number | null>(null)

  const sortedVersions = [...versions].reverse()
  const activeVer = currentVersion ?? (versions.length > 0 ? versions[versions.length - 1].version : 1)

  const handleRestoreClick = (ver: number) => {
    if (confirmVer === ver) {
      onRestoreVersion(ver)
      onClose()
    } else {
      setConfirmVer(ver)
      setTimeout(() => setConfirmVer(null), 3500)
    }
  }

  return createPortal(
    <div className="version-modal-backdrop" onClick={onClose}>
      <div
        className="version-modal-card tactile-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="version-modal-header">
          <div className="version-header-left">
            <div className="version-header-icon">
              <History size={18} />
            </div>
            <div>
              <div className="version-header-title-row">
                <h3>DNA Version Rollback History</h3>
                <span className="version-count-pill">
                  {versions.length} snapshot{versions.length === 1 ? '' : 's'}
                </span>
              </div>
              <p>Inspect what changed in each snapshot or revert Content DNA to a verified baseline.</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Timeline Content */}
        <div className="version-modal-body">
          {versions.length === 0 ? (
            <div className="version-empty-state">
              <Clock size={32} />
              <h4>No version snapshots recorded yet</h4>
              <p>Version snapshots are automatically created on source ingestion and manual DNA edits.</p>
            </div>
          ) : (
            <div className="version-timeline-track">
              {sortedVersions.map((ver, idx) => {
                const isCurrent = activeVer === ver.version
                const isExpanded = expandedVer === ver.version
                const isConfirming = confirmVer === ver.version

                const allFacts = extractAllFacts(ver.content_dna?.facts)
                const allFindings = extractAllFindings(ver.content_dna?.findings)
                const entitiesCount = countEntities(ver.content_dna?.entities)
                const factsCount = allFacts.length
                const findingsCount = allFindings.length

                // Compute exact what changed delta from chronologically previous snapshot
                const prevVer = versions.find((v) => v.version === ver.version - 1)
                const changes = computeDNAChanges(ver.content_dna, prevVer?.content_dna, ver.note)

                let formattedDate = ''
                try {
                  formattedDate = ver.created_at
                    ? new Date(ver.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : `Snapshot #${ver.version}`
                } catch {
                  formattedDate = `Snapshot #${ver.version}`
                }

                return (
                  <div
                    key={ver.version}
                    className={`version-timeline-item ${isCurrent ? 'active-version' : ''}`}
                  >
                    {/* Timeline vertical connector marker */}
                    <div className="timeline-marker-col">
                      <div className={`timeline-dot ${isCurrent ? 'active' : ''}`}>
                        {isCurrent ? <CheckCircle2 size={12} /> : <span>{ver.version}</span>}
                      </div>
                      {idx < sortedVersions.length - 1 && <div className="timeline-line" />}
                    </div>

                    {/* Version Card */}
                    <div className="version-item-card tactile-card">
                      <div className="version-item-header">
                        <div className="version-item-meta">
                          <div className="version-title-row">
                            <strong className="version-name">DNA Version {ver.version}</strong>
                            {isCurrent && (
                              <span className="version-active-badge">ACTIVE</span>
                            )}
                            <span className="version-delta-preview">
                              {changes.isBaseline ? 'Initial Baseline' : changes.changeSummary}
                            </span>
                          </div>
                          <div className="version-timestamp-row">
                            <Calendar size={11} />
                            <span>{formattedDate}</span>
                            <span>•</span>
                            <span>{ver.note || (changes.isBaseline ? 'Initial baseline ingestion' : 'Updated snapshot')}</span>
                          </div>
                        </div>

                        <div className="version-actions-row">
                          <button
                            type="button"
                            className={`btn-peek-version ${isExpanded ? 'open' : ''}`}
                            onClick={() => setExpandedVer(isExpanded ? null : ver.version)}
                            title={isExpanded ? 'Hide changes' : 'Inspect what changed in this version'}
                          >
                            <GitCompare size={12} />
                            <span>What Changed</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>

                          <button
                            type="button"
                            className={`btn-restore-version ${isConfirming ? 'confirming' : ''}`}
                            disabled={isCurrent}
                            onClick={() => handleRestoreClick(ver.version)}
                            title={isCurrent ? 'Currently active version' : 'Revert to this version'}
                          >
                            <RotateCcw size={12} />
                            <span>
                              {isCurrent
                                ? 'Active'
                                : isConfirming
                                ? 'Confirm Restore?'
                                : 'Restore'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Quick Snapshot Stats */}
                      <div className="version-stats-strip">
                        <span className="stat-chip">
                          <Layers size={11} />
                          {entitiesCount} Entit{entitiesCount === 1 ? 'y' : 'ies'}
                        </span>
                        <span className="stat-chip">
                          <FileText size={11} />
                          {factsCount} Fact{factsCount === 1 ? '' : 's'}
                        </span>
                        <span className="stat-chip">
                          {findingsCount} Finding{findingsCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Expandable Dropdown Drawer - Says what was changed instead of the entire data */}
                      {isExpanded && (
                        <div className="version-expanded-drawer">
                          {/* Delta Summary Pill */}
                          <div className="drawer-changes-header">
                            <div className="changes-summary-pill">
                              <Sparkles size={12} className="text-accent" />
                              <strong>
                                {changes.isBaseline
                                  ? 'Baseline Snapshot Established'
                                  : `Delta: ${changes.changeSummary}`}
                              </strong>
                            </div>
                          </div>

                          {/* Facts Added */}
                          {changes.addedFacts.length > 0 && (
                            <div className="drawer-section">
                              <label className="change-label text-success">
                                <Plus size={11} /> Facts Added ({changes.addedFacts.length}):
                              </label>
                              <ul className="drawer-facts-list added">
                                {changes.addedFacts.map((f, fi) => (
                                  <li key={fi} className="fact-added-item">
                                    <span className="diff-bullet plus">+</span>
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Facts Removed / Resolved */}
                          {changes.removedFacts.length > 0 && (
                            <div className="drawer-section">
                              <label className="change-label text-danger">
                                <Minus size={11} /> Facts Corrected / Removed ({changes.removedFacts.length}):
                              </label>
                              <ul className="drawer-facts-list removed">
                                {changes.removedFacts.map((f, fi) => (
                                  <li key={fi} className="fact-removed-item">
                                    <span className="diff-bullet minus">-</span>
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Overview Summary Updated */}
                          {changes.summaryChanged && (
                            <div className="drawer-section">
                              <label className="change-label text-accent">
                                <Edit3 size={11} /> Overview Summary Revised:
                              </label>
                              <p className="change-summary-text">{changes.newSummary}</p>
                            </div>
                          )}

                          {/* Purpose Updated */}
                          {changes.purposeChanged && changes.newPurpose && (
                            <div className="drawer-section">
                              <label className="change-label text-accent">
                                <FileText size={11} /> Core Purpose Updated:
                              </label>
                              <p className="change-summary-text">{changes.newPurpose}</p>
                            </div>
                          )}

                          {/* Tone / Audience Adjusted */}
                          {(changes.toneChanged || changes.audienceChanged) && (
                            <div className="drawer-section">
                              <label className="change-label text-accent">
                                <Tag size={11} /> Context Parameters Adjusted:
                              </label>
                              <div className="change-tags-row">
                                {changes.toneChanged && (
                                  <span className="change-tag">
                                    Tone: <strong>{changes.toneChanged.from}</strong> ➔ <strong>{changes.toneChanged.to}</strong>
                                  </span>
                                )}
                                {changes.audienceChanged && (
                                  <span className="change-tag">
                                    Audience: <strong>{changes.audienceChanged.from}</strong> ➔ <strong>{changes.audienceChanged.to}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Added Entities */}
                          {changes.addedEntities.length > 0 && (
                            <div className="drawer-section">
                              <label className="change-label text-success">
                                <Plus size={11} /> New Entities Identified:
                              </label>
                              <div className="change-tags-row">
                                {changes.addedEntities.map((ent, ei) => (
                                  <span key={ei} className="entity-tag-pill added">
                                    +{ent}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* If no differences detected (e.g. state restore or identical sync) */}
                          {!changes.isBaseline && !changes.hasDifferences && (
                            <div className="drawer-baseline-note">
                              <p>
                                Reverted or re-synced state identical to v{prevVer?.version || 'baseline'}.
                                No content assertions were altered.
                              </p>
                            </div>
                          )}

                          {/* Baseline Note for Version 1 */}
                          {changes.isBaseline && (
                            <div className="drawer-baseline-note">
                              <p>
                                Foundational baseline extracted from source documents. Contains {factsCount} verified facts and {entitiesCount} catalogued entities. Subsequent modifications will display itemized deltas here.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
