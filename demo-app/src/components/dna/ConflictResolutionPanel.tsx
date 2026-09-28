import { useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  GitCompareArrows,
  RotateCcw,
  UserRound,
} from 'lucide-react'

import {
  resolveTransformationConflict,
  resetTransformationConflict,
} from '../../lib/api/client'
import { DragInput } from '../ui/DragInput'

import type {
  IntegrityClaim,
  IntegrityConflict,
  Transformation,
} from '../../types/transformation'

interface ConflictResolutionPanelProps {
  transformationId: string
  conflicts: IntegrityConflict[]
  claims: IntegrityClaim[]
  initialExpanded?: boolean
  onResolved: (transformation: Transformation) => void
}

export function ConflictResolutionPanel({
  transformationId,
  conflicts,
  claims,
  initialExpanded = false,
  onResolved,
}: ConflictResolutionPanelProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(initialExpanded)

  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  const [selected, setSelected] =
    useState<Record<string, string>>({})

  const [customValues, setCustomValues] =
    useState<Record<string, string>>({})

  const [resolved, setResolved] =
    useState<Record<string, boolean>>({})

  const [loading, setLoading] =
    useState<Record<string, boolean>>({})

  const [errors, setErrors] =
    useState<Record<string, string>>({})

  function getClaimsForConflict(
    conflict: IntegrityConflict,
  ) {
    return conflict.claim_ids
      .map((claimId) =>
        claims.find(
          (claim) => claim.claim_id === claimId,
        ),
      )
      .filter(
        (claim): claim is IntegrityClaim =>
          Boolean(claim),
      )
  }

  async function resolveConflict(
    conflict: IntegrityConflict,
  ) {
    const conflictId = conflict.conflict_id
    const selectedValue = selected[conflictId]

    if (!selectedValue) {
      return
    }

    const customValue =
      customValues[conflictId] || ''

    if (
      selectedValue === 'custom_value' &&
      !customValue.trim()
    ) {
      return
    }

    const conflictClaims =
      getClaimsForConflict(conflict)

    let decision:
      | 'accept_source_a'
      | 'accept_source_b'
      | 'custom_value'
      | 'retain_both'
      | 'mark_unresolved'

    let selectedClaimId:
      | string
      | undefined

    let finalValue:
      | string
      | undefined

    if (selectedValue === 'custom_value') {
      decision = 'custom_value'
      finalValue = customValue.trim()
    } else if (selectedValue === 'retain_both') {
      decision = 'retain_both'
    } else if (selectedValue === 'mark_unresolved') {
      decision = 'mark_unresolved'
    } else {
      const selectedIndex =
        conflictClaims.findIndex(
          (claim) =>
            claim.claim_id === selectedValue,
        )

      if (selectedIndex === -1) {
        return
      }

      selectedClaimId = selectedValue

      finalValue = String(
        conflictClaims[selectedIndex].value ?? '',
      )

      decision =
        selectedIndex === 0
          ? 'accept_source_a'
          : 'accept_source_b'
    }

    try {
      setLoading((current) => ({
        ...current,
        [conflictId]: true,
      }))

      setErrors((current) => ({
        ...current,
        [conflictId]: '',
      }))

      const updatedTransformation =
        await resolveTransformationConflict(
          transformationId,
          conflictId,
          {
            decision,
            ...(selectedClaimId
              ? {
                  selected_claim_id:
                    selectedClaimId,
                }
              : {}),
            ...(finalValue
              ? {
                  final_value: finalValue,
                }
              : {}),
          },
        )

      setResolved((current) => ({
        ...current,
        [conflictId]: true,
      }))

      onResolved(updatedTransformation)
    } catch (error) {
      console.error(
        'Failed to resolve conflict:',
        error,
      )

      setErrors((current) => ({
        ...current,
        [conflictId]:
          error instanceof Error
            ? error.message
            : 'Could not resolve this conflict.',
      }))
    } finally {
      setLoading((current) => ({
        ...current,
        [conflictId]: false,
      }))
    }
  }

  async function handleResetConflict(conflictId: string) {
    try {
      setLoading((current) => ({
        ...current,
        [conflictId]: true,
      }))
      setErrors((current) => ({
        ...current,
        [conflictId]: '',
      }))

      const updatedTransformation = await resetTransformationConflict(
        transformationId,
        conflictId,
      )

      setSelected((current) => ({
        ...current,
        [conflictId]: '',
      }))
      setCustomValues((current) => ({
        ...current,
        [conflictId]: '',
      }))
      setResolved((current) => ({
        ...current,
        [conflictId]: false,
      }))

      onResolved(updatedTransformation)
    } catch (error) {
      console.error('Failed to reset conflict:', error)
      setErrors((current) => ({
        ...current,
        [conflictId]:
          error instanceof Error
            ? error.message
            : 'Could not reset this conflict.',
      }))
    } finally {
      setLoading((current) => ({
        ...current,
        [conflictId]: false,
      }))
    }
  }

  async function handleResetAllConflicts() {
    try {
      const updatedTransformation = await resetTransformationConflict(
        transformationId,
      )
      setSelected({})
      setCustomValues({})
      setResolved({})
      onResolved(updatedTransformation)
    } catch (error) {
      console.error('Failed to reset all conflicts:', error)
    }
  }

  if (!conflicts.length) {
    return (
      <section className="conflict-resolution-panel">
        <div className="conflict-panel-header">
          <div>
            <div className="panel-kicker">
              <GitCompareArrows size={15} />
              SOURCE CONFLICTS
            </div>

            <h2>No conflicts detected</h2>

            <p>
              The current sources do not contain
              conflicting claims that require
              resolution.
            </p>
          </div>

          <span className="conflict-count">
            0 conflicts
          </span>
        </div>
      </section>
    )
  }

  const resolvedCount = conflicts.filter(
    (c) => resolved[c.conflict_id] || c.status === 'resolved',
  ).length
  const unresolvedCount = conflicts.length - resolvedCount

  return (
    <section className="conflict-resolution-panel">
      <div
        className="conflict-panel-header"
        style={{
          cursor: 'pointer',
          padding: '14px 18px',
          background: 'rgba(255, 170, 80, 0.04)',
          border: '1px solid rgba(255, 170, 80, 0.18)',
          borderRadius: '10px',
          transition: 'all 0.15s ease',
          marginBottom: isExpanded ? '18px' : '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div>
          <div className="panel-kicker">
            <GitCompareArrows size={15} />
            CONFLICT RESOLUTION
          </div>

          <h2>
            Resolve conflicting information
          </h2>

          <p>
            {isExpanded
              ? 'Review disagreements between sources and choose the authoritative value that should be used.'
              : `${unresolvedCount > 0 ? `${unresolvedCount} conflict${unresolvedCount !== 1 ? 's' : ''} requiring review and correction.` : 'All source conflicts have been resolved.'} Click to ${isExpanded ? 'minimize' : 'expand and resolve'}.`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {resolvedCount > 0 && (
            <>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#86efac',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                }}
              >
                <Check size={12} /> {resolvedCount} Resolved
              </span>
              <button
                type="button"
                className="reset-conflicts-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(255, 170, 80, 0.1)',
                  color: '#fdba74',
                  border: '1px solid rgba(255, 170, 80, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  void handleResetAllConflicts()
                }}
                title="Reset conflict back to unresolved state"
              >
                <RotateCcw size={12} />
                <span>Reset Conflict State</span>
              </button>
            </>
          )}

          <span className="conflict-count">
            {unresolvedCount > 0 ? `${unresolvedCount} Unresolved` : `${conflicts.length} Total`}
          </span>

          <button
            type="button"
            className="panel-toggle-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded((prev) => !prev)
            }}
          >
            <span>{isExpanded ? 'Minimize' : 'Expand / Review'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="conflict-list">
        {conflicts.map((conflict) => {
          const conflictClaims =
            getClaimsForConflict(conflict)

          const selectedValue =
            selected[conflict.conflict_id]

          const customValue =
            customValues[
              conflict.conflict_id
            ] || ''

          const isLoading =
            loading[conflict.conflict_id] ||
            false

          const error =
            errors[conflict.conflict_id] || ''

          const isResolved =
            resolved[conflict.conflict_id] ||
            conflict.status === 'resolved'

          const selectedClaim =
            conflictClaims.find(
              (claim) =>
                claim.claim_id === selectedValue,
            )

          const finalValue =
            selectedValue === 'custom_value'
              ? customValue
              : selectedClaim
                ? String(
                    selectedClaim.value ?? '',
                  )
                : 'No value selected'

          const isCardExpanded = expandedCards[conflict.conflict_id] ?? true

          return (
            <article
              className={`conflict-card ${
                isResolved
                  ? 'resolved'
                  : ''
              }`}
              key={conflict.conflict_id}
            >
              <div
                className="conflict-card-header"
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  setExpandedCards((prev) => ({
                    ...prev,
                    [conflict.conflict_id]: !isCardExpanded,
                  }))
                }
              >
                <div>
                  <span className="conflict-label">
                    CONFLICT DETECTED
                  </span>

                  <h3>
                    {conflict.description}
                  </h3>

                  {conflict.reason && (
                    <div
                      className="conflict-reason-banner"
                      style={{
                        marginTop: '8px',
                        fontSize: '0.85rem',
                        lineHeight: 1.45,
                        color: 'var(--accent-text, #60a5fa)',
                        background: 'rgba(59, 130, 246, 0.08)',
                        borderLeft: '3px solid #3b82f6',
                        padding: '6px 10px',
                        borderRadius: '4px',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Why this conflict occurred: </span>
                      <span>{conflict.reason}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {isResolved && (
                    <span className="resolved-badge">
                      <Check size={13} />
                      Resolved
                    </span>
                  )}
                  <button
                    type="button"
                    className="card-toggle-btn"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      color: '#94a3b8',
                      padding: '4px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedCards((prev) => ({
                        ...prev,
                        [conflict.conflict_id]: !isCardExpanded,
                      }))
                    }}
                  >
                    <span>{isCardExpanded ? 'Minimize' : 'Expand'}</span>
                    {isCardExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>

              {isCardExpanded && (isResolved ? (
                <div
                  className="resolved-summary-box"
                  style={{
                    marginTop: '12px',
                    padding: '14px 16px',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#86efac', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Authoritative Value Applied
                      </span>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginTop: '3px' }}>
                        {finalValue}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="edit-resolution-button"
                      style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '4px',
                        padding: '5px 10px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => {
                        void handleResetConflict(conflict.conflict_id)
                      }}
                    >
                      Reopen Conflict / Change Selection
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-success-text, #3fb950)', opacity: 0.9, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={13} />
                    <span>Stale conflicting claims removed. Authoritative fact updated in Semantic Lineage Graph.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="claim-options">
                    {conflictClaims.map((claim) => (
                      <button
                        type="button"
                        key={claim.claim_id}
                        disabled={isLoading}
                        className={`claim-option ${
                          selectedValue === claim.claim_id ? 'selected' : ''
                        }`}
                        onClick={() => {
                          setSelected((current) => ({
                            ...current,
                            [conflict.conflict_id]: claim.claim_id,
                          }))
                          setCustomValues((current) => ({
                            ...current,
                            [conflict.conflict_id]: '',
                          }))
                          setResolved((current) => ({
                            ...current,
                            [conflict.conflict_id]: false,
                          }))
                          setErrors((current) => ({
                            ...current,
                            [conflict.conflict_id]: '',
                          }))
                        }}
                      >
                        <div className="claim-radio">
                          {selectedValue === claim.claim_id && <span />}
                        </div>

                        <div className="claim-content">
                          <div className="claim-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '14px', color: '#38bdf8' }}>
                              {String(claim.value ?? 'No value')}{claim.unit ? ` ${claim.unit}` : ''}
                            </strong>
                            <span className="claim-source-badge" style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8' }}>
                              {claim.evidence?.[0]?.source_reference || claim.source_ids?.[0] || 'Source'}
                              {(() => {
                                const pages = Array.from(new Set((claim.evidence || []).map((e) => e.page).filter((p): p is number => p !== null && p !== undefined))).sort((a, b) => a - b);
                                const pageStr = pages.length > 0 ? ` · ${pages.length === 1 ? `Page ${pages[0]}` : `Pages ${pages.slice(0, 3).join(', ')}${pages.length > 3 ? '...' : ''}`}` : '';
                                const mentions = (claim.evidence || []).length > 1 ? ` · ${(claim.evidence || []).length} mentions` : '';
                                return `${pageStr}${mentions}`;
                              })()}
                            </span>
                          </div>

                          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                            <strong>{claim.subject}</strong> {claim.predicate}
                          </span>

                          {claim.evidence?.[0]?.supporting_excerpt && (
                            <blockquote style={{ margin: '6px 0 0', padding: '4px 8px', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', borderLeft: '2px solid #38bdf8', borderRadius: '2px' }}>
                              "{claim.evidence[0].supporting_excerpt}"
                            </blockquote>
                          )}

                          <div className="claim-meta-tags" style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '10.5px', color: '#94a3b8' }}>
                            {claim.time && <span>Time: {claim.time}</span>}
                            {claim.location && <span>Location: {claim.location}</span>}
                            {claim.scope && <span>Scope: {claim.scope}</span>}
                          </div>
                        </div>
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={isLoading}
                      className={`claim-option ${
                        selectedValue === 'retain_both' ? 'selected' : ''
                      }`}
                      onClick={() => {
                        setSelected((current) => ({
                          ...current,
                          [conflict.conflict_id]: 'retain_both',
                        }))
                        setCustomValues((current) => ({
                          ...current,
                          [conflict.conflict_id]: '',
                        }))
                        setResolved((current) => ({
                          ...current,
                          [conflict.conflict_id]: false,
                        }))
                        setErrors((current) => ({
                          ...current,
                          [conflict.conflict_id]: '',
                        }))
                      }}
                    >
                      <div className="claim-radio">
                        {selectedValue === 'retain_both' && <span />}
                      </div>

                      <div className="claim-content">
                        <strong>Retain both values</strong>
                        <span>Keep both source values</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={isLoading}
                      className={`claim-option ${
                        selectedValue === 'mark_unresolved' ? 'selected' : ''
                      }`}
                      onClick={() => {
                        setSelected((current) => ({
                          ...current,
                          [conflict.conflict_id]: 'mark_unresolved',
                        }))
                        setCustomValues((current) => ({
                          ...current,
                          [conflict.conflict_id]: '',
                        }))
                        setResolved((current) => ({
                          ...current,
                          [conflict.conflict_id]: false,
                        }))
                        setErrors((current) => ({
                          ...current,
                          [conflict.conflict_id]: '',
                        }))
                      }}
                    >
                      <div className="claim-radio">
                        {selectedValue === 'mark_unresolved' && <span />}
                      </div>

                      <div className="claim-content">
                        <strong>Keep unresolved</strong>
                        <span>Do not choose an authoritative value</span>
                      </div>
                    </button>
                  </div>

                  <div className="custom-resolution">
                    <div className="custom-resolution-title">
                      <UserRound size={14} />
                      Or define your own value
                    </div>

                    <DragInput
                      as="input"
                      input={{
                        type: "text",
                        value: customValue,
                        disabled: isLoading,
                        placeholder: "Enter the value you want to use...",
                        onChange: (event) => {
                          const value = event.target.value
                          setCustomValues((current) => ({
                            ...current,
                            [conflict.conflict_id]: value,
                          }))
                          setSelected((current) => ({
                            ...current,
                            [conflict.conflict_id]: value.trim() ? 'custom_value' : '',
                          }))
                          setResolved((current) => ({
                            ...current,
                            [conflict.conflict_id]: false,
                          }))
                          setErrors((current) => ({
                            ...current,
                            [conflict.conflict_id]: '',
                          }))
                        },
                      }}
                    />
                  </div>

                  {error && (
                    <div className="integrity-error" role="alert">
                      {error}
                    </div>
                  )}

                  <div className="conflict-actions">
                    <div className="resolution-preview">
                      <span>FINAL VALUE</span>
                      <strong>{finalValue}</strong>
                    </div>

                    <button
                      type="button"
                      className="resolve-button"
                      disabled={
                        isLoading ||
                        !selectedValue ||
                        (selectedValue === 'custom_value' && !customValue.trim())
                      }
                      onClick={() => void resolveConflict(conflict)}
                    >
                      <Check size={15} />
                      {isLoading ? 'Resolving...' : 'Resolve Conflict'}
                    </button>
                  </div>
                </>
              ))}
            </article>
          )
        })}
      </div>
      )}
    </section>
  )
}