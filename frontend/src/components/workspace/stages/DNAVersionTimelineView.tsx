import { useState, useMemo } from 'react'
import {
  RotateCcw,
  History,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  Calendar,
  Sparkles,
  GitCompare,
  ShieldCheck,
  Tag,
  Plus,
  Minus,
  Edit3,
} from 'lucide-react'
import type { Transformation, DNAVersion } from '../../../types/transformation'
import type { ContentDNA } from '../../../types/content'
import { computeDNAChanges } from '../../../lib/dnaChangeDetector'

function extractAllFacts(facts?: ContentDNA['facts']): { text: string; category: string }[] {
  if (!facts) return []
  const items: { text: string; category: string }[] = []
  if (facts.claims) {
    facts.claims.forEach((c) => items.push({ text: c, category: 'Claim' }))
  }
  if (facts.statistics) {
    facts.statistics.forEach((s) => items.push({ text: s, category: 'Statistic' }))
  }
  if (facts.dates) {
    facts.dates.forEach((d) => items.push({ text: d, category: 'Date' }))
  }
  if (facts.events) {
    facts.events.forEach((e) => items.push({ text: e, category: 'Event' }))
  }
  return items
}

function extractAllFindings(findings?: ContentDNA['findings']): { text: string; type: string }[] {
  if (!findings) return []
  const items: { text: string; type: string }[] = []
  if (findings.key_findings) {
    findings.key_findings.forEach((f) => items.push({ text: f, type: 'Key Finding' }))
  }
  if (findings.risks) {
    findings.risks.forEach((r) => items.push({ text: r, type: 'Risk' }))
  }
  if (findings.opportunities) {
    findings.opportunities.forEach((o) => items.push({ text: o, type: 'Opportunity' }))
  }
  if (findings.implications) {
    findings.implications.forEach((i) => items.push({ text: i, type: 'Implication' }))
  }
  return items
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

interface DNAVersionTimelineViewProps {
  transformation: Transformation
  currentDna: ContentDNA | null
  onRestoreVersion?: (version: number) => void
}

export function DNAVersionTimelineView({
  transformation,
  currentDna,
  onRestoreVersion,
}: DNAVersionTimelineViewProps) {
  // Synthesize versions list if empty but currentDna exists
  const rawVersions = transformation.versions || []
  const versions: DNAVersion[] = useMemo(() => {
    if (rawVersions.length > 0) {
      return rawVersions
    }
    if (currentDna) {
      return [
        {
          version: 1,
          content_dna: currentDna,
          note: 'Initial DNA extraction baseline',
          created_at: transformation.created_at || new Date().toISOString(),
        },
      ]
    }
    return []
  }, [rawVersions, currentDna, transformation.created_at])

  const sortedVersions = useMemo(() => [...versions].reverse(), [versions])
  const latestVersionNumber = versions.length > 0 ? versions[versions.length - 1].version : 1

  const [selectedVerNum, setSelectedVerNum] = useState<number>(() => latestVersionNumber)
  const [activeTab, setActiveTab] = useState<'changes' | 'diff' | 'deepdive'>('changes')
  const [confirmRestoreVer, setConfirmRestoreVer] = useState<number | null>(null)

  // Keep selectedVerNum valid
  const selectedVersion = useMemo(() => {
    const found = versions.find((v) => v.version === selectedVerNum)
    return found || versions[versions.length - 1] || null
  }, [versions, selectedVerNum])

  const isCurrentActive = selectedVersion?.version === latestVersionNumber

  // Calculate delta of selected version from its predecessor
  const selectedChanges = useMemo(() => {
    if (!selectedVersion) return null
    const prev = versions.find((v) => v.version === selectedVersion.version - 1)
    return computeDNAChanges(selectedVersion.content_dna, prev?.content_dna, selectedVersion.note)
  }, [selectedVersion, versions])

  const handleRestoreClick = (ver: number) => {
    if (confirmRestoreVer === ver) {
      onRestoreVersion?.(ver)
      setConfirmRestoreVer(null)
    } else {
      setConfirmRestoreVer(ver)
      setTimeout(() => setConfirmRestoreVer(null), 4000)
    }
  }

  if (versions.length === 0) {
    return (
      <div className="dna-version-empty-card tactile-card">
        <History size={48} className="empty-icon" />
        <h3>No DNA Version Snapshots Recorded</h3>
        <p>
          Version snapshots are automatically created when you extract DNA from sources, resolve conflicts,
          or edit attributes.
        </p>
      </div>
    )
  }

  const snapDna = selectedVersion?.content_dna
  const snapFacts = extractAllFacts(snapDna?.facts)
  const snapEntities = snapDna?.entities || { people: [], organizations: [], locations: [], technologies: [] }
  const snapFindings = extractAllFindings(snapDna?.findings)
  const snapEntitiesCount = countEntities(snapDna?.entities)

  // Current Active DNA facts for comparison
  const currentFacts = extractAllFacts(currentDna?.facts)

  return (
    <div className="dna-version-view-container">
      {/* Left Column: Timeline Snapshot List */}
      <div className="dna-version-timeline-sidebar tactile-card">
        <div className="timeline-sidebar-header">
          <div className="sidebar-title-row">
            <History size={16} className="text-accent" />
            <h3>Version Timeline</h3>
            <span className="sidebar-count-badge">{versions.length} Snapshots</span>
          </div>
          <p className="sidebar-caption">
            Click any version to inspect what was changed and compare deltas.
          </p>
        </div>

        <div className="timeline-snapshot-list">
          {sortedVersions.map((v) => {
            const isSelected = selectedVersion?.version === v.version
            const isLive = v.version === latestVersionNumber
            const fCount = extractAllFacts(v.content_dna?.facts).length
            const eCount = countEntities(v.content_dna?.entities)

            // Compute delta summary for sidebar
            const prevVer = versions.find((item) => item.version === v.version - 1)
            const itemChanges = computeDNAChanges(v.content_dna, prevVer?.content_dna, v.note)

            let formattedDate = ''
            try {
              formattedDate = v.created_at
                ? new Date(v.created_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : `v${v.version}`
            } catch {
              formattedDate = `v${v.version}`
            }

            return (
              <div
                key={v.version}
                className={`timeline-snapshot-item ${isSelected ? 'selected' : ''} ${
                  isLive ? 'is-live' : ''
                }`}
                onClick={() => setSelectedVerNum(v.version)}
              >
                <div className="snapshot-item-top">
                  <div className="snapshot-version-tag">
                    <span className="ver-pill">v{v.version}</span>
                    {isLive && <span className="live-pill">ACTIVE</span>}
                  </div>
                  <span className="snapshot-date">
                    <Calendar size={11} />
                    {formattedDate}
                  </span>
                </div>

                {/* Delta preview instead of full data */}
                <div className="snapshot-delta-tag">
                  <Sparkles size={10} className="text-accent" />
                  <span>
                    {itemChanges.isBaseline
                      ? 'Initial Baseline'
                      : itemChanges.changeSummary}
                  </span>
                </div>

                <div className="snapshot-note-text">
                  {v.note || (isLive ? 'Current active workspace DNA' : 'Historical snapshot')}
                </div>

                <div className="snapshot-stats-micro">
                  <span className="micro-stat">
                    <FileText size={10} />
                    {fCount} facts
                  </span>
                  <span className="micro-stat">
                    <Layers size={10} />
                    {eCount} entities
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Column: Deep-Dive & Diff Inspector */}
      <div className="dna-version-detail-pane tactile-card">
        {selectedVersion && selectedChanges && (
          <>
            {/* Header / Action Bar */}
            <div className="version-detail-header">
              <div className="version-detail-meta">
                <div className="title-and-badges">
                  <h2>DNA Snapshot Version {selectedVersion.version}</h2>
                  {isCurrentActive ? (
                    <span className="badge-active-live">
                      <CheckCircle2 size={13} />
                      Current Active Baseline
                    </span>
                  ) : (
                    <span className="badge-historical">
                      <Clock size={13} />
                      Historical Snapshot
                    </span>
                  )}
                </div>
                <div className="meta-subline">
                  <span className="meta-item">
                    <Calendar size={12} />
                    {new Date(selectedVersion.created_at).toLocaleString()}
                  </span>
                  <span className="meta-separator">•</span>
                  <span className="meta-item">
                    <Tag size={12} />
                    {selectedVersion.note || (selectedChanges.isBaseline ? 'Initial Baseline' : 'Autosaved Snapshot')}
                  </span>
                </div>
              </div>

              <div className="version-detail-actions">
                {/* 3-Way Mode Selector */}
                <div className="sub-mode-toggle">
                  <button
                    type="button"
                    className={`sub-mode-btn ${activeTab === 'changes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('changes')}
                    title="Inspect what was changed in this version snapshot"
                  >
                    <Sparkles size={13} />
                    <span>What Changed</span>
                  </button>
                  <button
                    type="button"
                    className={`sub-mode-btn ${activeTab === 'diff' ? 'active' : ''}`}
                    onClick={() => setActiveTab('diff')}
                    title="Compare this snapshot against current active DNA"
                  >
                    <GitCompare size={13} />
                    <span>Diff vs Active</span>
                  </button>
                  <button
                    type="button"
                    className={`sub-mode-btn ${activeTab === 'deepdive' ? 'active' : ''}`}
                    onClick={() => setActiveTab('deepdive')}
                    title="View full snapshot structure"
                  >
                    <Layers size={13} />
                    <span>Full Data</span>
                  </button>
                </div>

                {/* Rollback Button */}
                {onRestoreVersion && !isCurrentActive && (
                  <button
                    type="button"
                    className={`btn-restore-action ${
                      confirmRestoreVer === selectedVersion.version ? 'confirming' : ''
                    }`}
                    onClick={() => handleRestoreClick(selectedVersion.version)}
                  >
                    <RotateCcw size={14} />
                    <span>
                      {confirmRestoreVer === selectedVersion.version
                        ? `Click to Confirm Rollback to v${selectedVersion.version}`
                        : `Restore to v${selectedVersion.version}`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Ribbon */}
            <div className="snapshot-metrics-ribbon">
              <div className="metric-box">
                <span className="metric-label">Verified Facts</span>
                <span className="metric-val">{snapFacts.length}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Entities Mapped</span>
                <span className="metric-val">{snapEntitiesCount}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Key Findings</span>
                <span className="metric-val">{snapFindings.length}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Tone Profile</span>
                <span className="metric-val text-capitalize">
                  {snapDna?.context?.tone || 'Analytical'}
                </span>
              </div>
            </div>

            {/* 1. What Changed Tab (Default View: Shows changes instead of entire data) */}
            {activeTab === 'changes' && (
              <div className="snapshot-changes-body">
                {/* Changes Overview Banner */}
                <div className="diff-header-banner">
                  <Sparkles size={18} className="text-accent" />
                  <div>
                    <strong>
                      {selectedChanges.isBaseline
                        ? 'Foundational Baseline Snapshot'
                        : `Changes in Version ${selectedVersion.version}`}
                    </strong>
                    <p>
                      {selectedChanges.isBaseline
                        ? 'Initial baseline established from ingested documents. Tracked as reference for all future deltas.'
                        : selectedChanges.changeSummary}
                    </p>
                  </div>
                </div>

                {/* Added Facts */}
                {selectedChanges.addedFacts.length > 0 && (
                  <div className="deepdive-section tactile-sunken">
                    <div className="section-head">
                      <Plus size={15} className="text-success" />
                      <h4 className="text-success">
                        Facts Added ({selectedChanges.addedFacts.length})
                      </h4>
                    </div>
                    <div className="change-facts-list">
                      {selectedChanges.addedFacts.map((fact, idx) => (
                        <div key={idx} className="change-fact-card added">
                          <span className="change-bullet-tag plus">+</span>
                          <p>{fact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed / Corrected Facts */}
                {selectedChanges.removedFacts.length > 0 && (
                  <div className="deepdive-section tactile-sunken">
                    <div className="section-head">
                      <Minus size={15} className="text-danger" />
                      <h4 className="text-danger">
                        Facts Corrected or Removed ({selectedChanges.removedFacts.length})
                      </h4>
                    </div>
                    <div className="change-facts-list">
                      {selectedChanges.removedFacts.map((fact, idx) => (
                        <div key={idx} className="change-fact-card removed">
                          <span className="change-bullet-tag minus">-</span>
                          <p>{fact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overview Summary Changes */}
                {selectedChanges.summaryChanged && (
                  <div className="deepdive-section tactile-sunken">
                    <div className="section-head">
                      <Edit3 size={15} className="text-accent" />
                      <h4>Overview Summary Revised</h4>
                    </div>
                    <div className="summary-change-box">
                      <p className="revised-text">{selectedChanges.newSummary}</p>
                    </div>
                  </div>
                )}

                {/* Purpose Changes */}
                {selectedChanges.purposeChanged && selectedChanges.newPurpose && (
                  <div className="deepdive-section tactile-sunken">
                    <div className="section-head">
                      <FileText size={15} className="text-accent" />
                      <h4>Core Purpose Updated</h4>
                    </div>
                    <div className="summary-change-box">
                      <p className="revised-text">{selectedChanges.newPurpose}</p>
                    </div>
                  </div>
                )}

                {/* Context Parameter Changes (Tone, Audience) */}
                {(selectedChanges.toneChanged || selectedChanges.audienceChanged) && (
                  <div className="deepdive-section tactile-sunken">
                    <div className="section-head">
                      <Tag size={15} className="text-accent" />
                      <h4>Context & Persona Adjustments</h4>
                    </div>
                    <div className="context-changes-grid">
                      {selectedChanges.toneChanged && (
                        <div className="context-change-card">
                          <span className="context-label">Tone</span>
                          <span className="context-val">
                            <span className="old-val">{selectedChanges.toneChanged.from}</span>
                            <span className="arrow">➔</span>
                            <span className="new-val">{selectedChanges.toneChanged.to}</span>
                          </span>
                        </div>
                      )}
                      {selectedChanges.audienceChanged && (
                        <div className="context-change-card">
                          <span className="context-label">Target Audience</span>
                          <span className="context-val">
                            <span className="old-val">{selectedChanges.audienceChanged.from}</span>
                            <span className="arrow">➔</span>
                            <span className="new-val">{selectedChanges.audienceChanged.to}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Entity Changes */}
                {selectedChanges.addedEntities.length > 0 && (
                  <div className="deepdive-section tactile-sunken">
                    <div className="section-head">
                      <Layers size={15} className="text-success" />
                      <h4>New Entities Identified ({selectedChanges.addedEntities.length})</h4>
                    </div>
                    <div className="entity-pills-wrap">
                      {selectedChanges.addedEntities.map((ent, idx) => (
                        <span key={idx} className="entity-tag-pill added">
                          +{ent}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* If state identical */}
                {!selectedChanges.isBaseline && !selectedChanges.hasDifferences && (
                  <div className="diff-card tactile-sunken">
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                      This snapshot was created during a rollback or state re-sync. All content assertions are identical to the target baseline.
                    </p>
                  </div>
                )}

                {/* If Baseline */}
                {selectedChanges.isBaseline && (
                  <div className="deepdive-section tactile-sunken">
                    <div className="section-head">
                      <ShieldCheck size={15} className="text-accent" />
                      <h4>Initial Extraction Breakdown</h4>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                      Established baseline with {snapFacts.length} assertions and {snapEntitiesCount} entities.
                      Any downstream modifications via Source Integrity or the Attribute Inspector will record explicit deltas here.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 2. Diff Mode vs Current Active DNA */}
            {activeTab === 'diff' && (
              <div className="snapshot-diff-body">
                <div className="diff-header-banner">
                  <GitCompare size={18} className="text-accent" />
                  <div>
                    <strong>Comparison: Snapshot v{selectedVersion.version} vs Active Baseline</strong>
                    <p>
                      Inspect knowledge layer variations, added or removed facts, and narrative evolution.
                    </p>
                  </div>
                </div>

                {/* Summary Comparison */}
                <div className="diff-card tactile-sunken">
                  <h4>Overview Summary Comparison</h4>
                  <div className="diff-comparison-grid">
                    <div className="diff-col">
                      <div className="diff-col-head">
                        <span className="diff-pill current">Active Baseline DNA</span>
                      </div>
                      <div className="diff-col-body">
                        <p>{currentDna?.overview?.summary || 'No active summary'}</p>
                      </div>
                    </div>
                    <div className="diff-col">
                      <div className="diff-col-head">
                        <span className="diff-pill snapshot">Snapshot v{selectedVersion.version}</span>
                      </div>
                      <div className="diff-col-body">
                        <p>{snapDna?.overview?.summary || 'No snapshot summary'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Facts Delta Comparison */}
                <div className="diff-card tactile-sunken">
                  <div className="diff-card-title-row">
                    <h4>Fact Delta Comparison</h4>
                    <span className="diff-stats-pill">
                      Active: {currentFacts.length} facts | v{selectedVersion.version}: {snapFacts.length} facts
                    </span>
                  </div>

                  <div className="diff-facts-split">
                    <div className="diff-subgroup">
                      <span className="subgroup-label">Facts Present in Snapshot v{selectedVersion.version}</span>
                      <div className="diff-facts-list">
                        {snapFacts.map((f, idx) => (
                          <div key={idx} className="diff-fact-row snapshot-row">
                            <span className="diff-indicator">+</span>
                            <p>{f.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="diff-subgroup">
                      <span className="subgroup-label">Facts Present in Current Active DNA</span>
                      <div className="diff-facts-list">
                        {currentFacts.map((f, idx) => (
                          <div key={idx} className="diff-fact-row active-row">
                            <span className="diff-indicator">•</span>
                            <p>{f.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Deep-Dive Tab (Complete Snapshot Data) */}
            {activeTab === 'deepdive' && (
              <div className="snapshot-deepdive-body">
                {/* 1. Overview Section */}
                <div className="deepdive-section tactile-sunken">
                  <div className="section-head">
                    <Sparkles size={15} className="text-accent" />
                    <h4>Core Overview & Narrative</h4>
                  </div>
                  <div className="overview-grid">
                    <div className="overview-item">
                      <span className="overview-label">Summary</span>
                      <p className="overview-text">
                        {snapDna?.overview?.summary || 'No overview summary recorded.'}
                      </p>
                    </div>
                    {snapDna?.overview?.purpose && (
                      <div className="overview-item">
                        <span className="overview-label">Core Purpose</span>
                        <p className="overview-text">{snapDna.overview.purpose}</p>
                      </div>
                    )}
                    {snapDna?.context?.target_audience && (
                      <div className="overview-item">
                        <span className="overview-label">Target Audience</span>
                        <p className="overview-text">{snapDna.context.target_audience}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Key Findings */}
                {snapFindings.length > 0 && (
                  <div className="deepdive-section tactile-sunken">
                    <div className="section-head">
                      <ShieldCheck size={15} className="text-success" />
                      <h4>Key Findings & Insights ({snapFindings.length})</h4>
                    </div>
                    <div className="findings-chips-grid">
                      {snapFindings.map((finding, idx) => (
                        <div key={idx} className="finding-card">
                          <span className="finding-num">{idx + 1}</span>
                          <div className="finding-content">
                            <span className="finding-type-pill">{finding.type}</span>
                            <span>{finding.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Verified Facts Sample */}
                <div className="deepdive-section tactile-sunken">
                  <div className="section-head">
                    <FileText size={15} className="text-accent" />
                    <h4>Verified Fact Assertions ({snapFacts.length})</h4>
                  </div>
                  {snapFacts.length === 0 ? (
                    <p className="empty-subtext">No verified facts in this snapshot.</p>
                  ) : (
                    <div className="facts-list-container">
                      {snapFacts.map((fact, idx) => (
                        <div key={idx} className="fact-snapshot-row">
                          <span className="fact-pill-idx">#{idx + 1}</span>
                          <div className="fact-content-col">
                            <p className="fact-statement">{fact.text}</p>
                            <div className="fact-meta-row">
                              <span className="fact-cat-tag">{fact.category}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Entity Clusters */}
                {snapEntitiesCount > 0 && (
                  <div className="deepdive-section tactile-sunken">
                    <div className="section-head">
                      <Layers size={15} className="text-accent" />
                      <h4>Entities & Canonical Identifiers ({snapEntitiesCount})</h4>
                    </div>
                    <div className="entities-groups">
                      {Object.entries(snapEntities).map(([cat, list]) => {
                        const items = Array.isArray(list) ? list : []
                        if (items.length === 0) return null
                        return (
                          <div key={cat} className="entity-group-card">
                            <strong className="entity-cat-title">{cat}</strong>
                            <div className="entity-pills-wrap">
                              {items.map((item, ii) => (
                                <span key={ii} className="entity-tag-pill">
                                  {typeof item === 'string' ? item : JSON.stringify(item)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
