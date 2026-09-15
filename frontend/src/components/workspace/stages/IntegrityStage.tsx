import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import type { Transformation, SourceIntegrity } from '../../../types/transformation'
import { ConflictResolutionPanel } from '../../dna/ConflictResolutionPanel'
import { IntegritySkeleton } from '../../ui/Skeleton'

interface IntegrityStageProps {
  transformation: Transformation
  integrity: SourceIntegrity | null
  busy: boolean
  integrityLoading: boolean
  integrityError: string
  onRunIntegrity: () => Promise<void>
  onConflictResolved: (updated: Transformation) => void
  onProceedToStudio: () => void
}

export function IntegrityStage({
  transformation,
  integrity,
  busy,
  integrityLoading,
  integrityError,
  onRunIntegrity,
  onConflictResolved,
  onProceedToStudio,
}: IntegrityStageProps) {
  const [showRawClaims, setShowRawClaims] = useState(false)
  const [claimSearch, setClaimSearch] = useState('')
  const [expandedClaimIds, setExpandedClaimIds] = useState<Record<string, boolean>>({})

  const conflicts = integrity?.conflicts || []
  const claims = integrity?.claims || []
  const corroboratedCount = claims.filter((c) => c.status === 'corroborated').length
  const supportedCount = claims.filter((c) => c.status === 'supported').length
  const unresolvedConflicts = conflicts.filter((c) => c.status !== 'resolved').length

  const filteredClaims = claims.filter((c) => {
    if (!claimSearch.trim()) return true
    const q = claimSearch.toLowerCase()
    return (
      c.subject.toLowerCase().includes(q) ||
      c.predicate.toLowerCase().includes(q) ||
      String(c.value ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="integrity-stage-container">
      {/* Top Audit Action Bar */}
      <div className="integrity-stage-toolbar tactile-card">
        <div className="toolbar-left">
          <h3>Source Integrity & Fact Audit</h3>
          <p>Verify cross-source consistency, detect contradictory claims, and resolve disputes.</p>
        </div>

        <div className="toolbar-right">
          <button
            type="button"
            className="audit-run-btn primary"
            onClick={() => void onRunIntegrity()}
            disabled={busy || integrityLoading}
          >
            <RefreshCw size={14} className={integrityLoading ? 'spin' : ''} />
            <span>{integrityLoading ? 'Analyzing Sources...' : 'Run Source Integrity'}</span>
          </button>

          <button
            type="button"
            className="proceed-stage-btn primary"
            onClick={onProceedToStudio}
          >
            <span>Proceed to Studio</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {integrityError && (
        <div className="integrity-error-banner tactile-card" role="alert">
          <AlertTriangle size={16} />
          <span>{integrityError}</span>
        </div>
      )}

      {integrityLoading ? (
        <div className="integrity-loading-box tactile-card">
          <IntegritySkeleton />
        </div>
      ) : integrity ? (
        <div className="integrity-main-layout">
          {/* Status Alert Banner */}
          {unresolvedConflicts > 0 ? (
            <div className="integrity-status-banner conflict-banner tactile-card">
              <div className="banner-icon-wrap warning">
                <AlertTriangle size={22} />
              </div>
              <div className="banner-content">
                <strong>{unresolvedConflicts} Source Dispute{unresolvedConflicts > 1 ? 's' : ''} Detected</strong>
                <p>Contradictory assertions were found across sources. Expand the Conflict Resolution deck below to pick authoritative values.</p>
              </div>
            </div>
          ) : (
            <div className="integrity-status-banner verified-banner tactile-card">
              <div className="banner-icon-wrap success">
                <CheckCircle2 size={22} />
              </div>
              <div className="banner-content">
                <strong>Source Integrity Fully Verified</strong>
                <p>All extracted facts corroborate consistently with zero active disputes across the source corpus.</p>
              </div>
            </div>
          )}

          {/* Metric Cards Grid */}
          <div className="integrity-metric-grid">
            <div className={`metric-card ${unresolvedConflicts > 0 ? 'warning' : 'neutral'} tactile-card`}>
              <span className="metric-label">Active Disputes</span>
              <strong className="metric-number">{unresolvedConflicts}</strong>
              <small>{unresolvedConflicts > 0 ? 'Requires user resolution' : 'Zero disputes'}</small>
            </div>

            <div className="metric-card success tactile-card">
              <span className="metric-label">Corroborated Facts</span>
              <strong className="metric-number">{corroboratedCount}</strong>
              <small>Multi-source verified</small>
            </div>

            <div className="metric-card cobalt tactile-card">
              <span className="metric-label">Evidence-Backed Facts</span>
              <strong className="metric-number">{supportedCount}</strong>
              <small>Citation grounded</small>
            </div>

            <div className="metric-card neutral tactile-card">
              <span className="metric-label">Total Claims Analyzed</span>
              <strong className="metric-number">{claims.length}</strong>
              <small>Knowledge graph claims</small>
            </div>
          </div>

          {/* Conflict Resolution Deck (Minimized by default) */}
          {conflicts.length > 0 && (
            <div className="conflict-resolution-wrapper">
              <ConflictResolutionPanel
                transformationId={transformation.id}
                conflicts={conflicts}
                claims={claims}
                initialExpanded={false}
                onResolved={onConflictResolved}
              />
            </div>
          )}

          {/* Collapsible Claims Database */}
          <div className="claims-database-card tactile-card">
            <button
              type="button"
              className="claims-drawer-toggle"
              onClick={() => setShowRawClaims((prev) => !prev)}
            >
              <div className="toggle-left">
                <ShieldCheck size={16} />
                <strong>Claims Database & Grounded Citations</strong>
                <span className="claims-count-pill">
                  {claims.length} claim{claims.length > 1 ? 's' : ''}
                </span>
              </div>
              {showRawClaims ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {showRawClaims && (
              <div className="claims-database-body">
                <div className="claims-search-bar">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search claims by subject, predicate or value..."
                    value={claimSearch}
                    onChange={(e) => setClaimSearch(e.target.value)}
                  />
                </div>

                <div className="claims-list-grid">
                  {filteredClaims.map((claim) => {
                    const isExpanded = expandedClaimIds[claim.claim_id] || false
                    const isConflict = claim.status === 'conflict'
                    const isCorroborated = claim.status === 'corroborated'

                    return (
                      <div
                        key={claim.claim_id}
                        className={`claim-record-item ${isConflict ? 'conflict' : isCorroborated ? 'corroborated' : 'supported'} tactile-card`}
                      >
                        <div
                          className="claim-item-header"
                          onClick={() =>
                            setExpandedClaimIds((prev) => ({
                              ...prev,
                              [claim.claim_id]: !isExpanded,
                            }))
                          }
                        >
                          <div className="claim-icon-status">
                            {isConflict ? (
                              <AlertTriangle size={15} className="status-conflict" />
                            ) : isCorroborated ? (
                              <CheckCircle2 size={15} className="status-corroborated" />
                            ) : (
                              <ShieldCheck size={15} className="status-supported" />
                            )}
                          </div>

                          <div className="claim-main-info">
                            <span className="claim-subject-pred">
                              <strong>{claim.subject}</strong> {claim.predicate.replaceAll('_', ' ')}
                            </span>
                            <span className="claim-value-badge">
                              {String(claim.value ?? 'Unknown')}{claim.unit ? ` ${claim.unit}` : ''}
                            </span>
                          </div>

                          <span className={`claim-status-tag tag-${claim.status}`}>
                            {claim.status.toUpperCase()}
                          </span>

                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>

                        {isExpanded && (
                          <div className="claim-expanded-details">
                            {claim.evidence && claim.evidence.length > 0 && (
                              <div className="claim-evidence-box">
                                <span className="evidence-title">Supporting Excerpt & Citations:</span>
                                {claim.evidence.map((ev, i) => (
                                  <blockquote key={i} className="claim-quote">
                                    "{ev.supporting_excerpt || 'Excerpt verified'}"
                                    {ev.page !== null && ev.page !== undefined && (
                                      <span className="page-citation"> — Page {ev.page}</span>
                                    )}
                                    {ev.source_reference && (
                                      <span className="source-ref"> ({ev.source_reference})</span>
                                    )}
                                  </blockquote>
                                ))}
                              </div>
                            )}

                            <div className="claim-meta-row">
                              {claim.time && <span>Time: {claim.time}</span>}
                              {claim.location && <span>Location: {claim.location}</span>}
                              {claim.scope && <span>Scope: {claim.scope}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="integrity-empty-state tactile-card">
          <ShieldAlert size={32} />
          <h4>No integrity analysis has been run yet</h4>
          <p>Click "Run Source Integrity" above to verify facts, cross-corroborate citations, and uncover contradictions.</p>
        </div>
      )}
    </div>
  )
}
