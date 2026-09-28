import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Bot,
  Check,
  ChevronRight,
  Cloud,
  Cpu,
  Gauge,
  Info,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
  X,
  ShieldAlert,
} from 'lucide-react'
import {
  getAvailableModels,
  selectActiveModel,
  type ModelInfo,
  type ModelListResponse,
  type ModelMode,
} from '../../lib/api/client'
import '../../models.css'

interface ModelSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onModelChanged?: (modelId: string, provider: ModelMode) => void
}

type SectionKey = 'all' | 'local' | 'openai' | 'qwen_deepseek' | 'compound'

interface SectionDefinition {
  key: SectionKey
  label: string
  icon: typeof Cloud
  description: string
}

const SECTIONS: SectionDefinition[] = [
  { key: 'all', label: 'All Engines', icon: Layers, description: 'All active and verified AI models' },
  { key: 'local', label: 'Local (Ollama)', icon: Bot, description: '100% On-device private inference' },
  { key: 'openai', label: 'OpenAI', icon: Sparkles, description: 'OpenAI OSS open-weights models' },
  { key: 'qwen_deepseek', label: 'Qwen', icon: Cloud, description: 'Advanced mathematical & reasoning engines' },
  { key: 'compound', label: 'Groq Compound', icon: Zap, description: 'High-speed compound & multilingual models' },
]

export function ModelSelectorModal({
  isOpen,
  onClose,
  onModelChanged,
}: ModelSelectorModalProps) {
  const [modelData, setModelData] = useState<ModelListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [switchingModelId, setSwitchingModelId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')

  async function loadModels() {
    try {
      setLoading(true)
      setError('')
      const data = await getAvailableModels()
      setModelData(data)
    } catch (err) {
      console.error('Failed to load models:', err)
      setError('Unable to fetch live model token quotas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void loadModels()
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const filteredModels = useMemo(() => {
    if (!modelData?.models) return []
    return modelData.models.filter((m) => {
      const modelSection = m.section || (m.provider === 'local' ? 'local' : 'other')
      const matchesSection = activeSection === 'all' || modelSection === activeSection
      if (!matchesSection) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.provider_name.toLowerCase().includes(q) ||
        (m.section_name && m.section_name.toLowerCase().includes(q)) ||
        m.recommended_for.some((r) => r.toLowerCase().includes(q))
      )
    })
  }, [modelData, activeSection, searchQuery])

  // Group models by section when 'all' is active
  const groupedSections = useMemo(() => {
    if (activeSection !== 'all') {
      return [{
        key: activeSection,
        title: SECTIONS.find((s) => s.key === activeSection)?.label || 'Models',
        description: SECTIONS.find((s) => s.key === activeSection)?.description || '',
        models: filteredModels,
      }]
    }

    const order: SectionKey[] = ['local', 'openai', 'qwen_deepseek', 'compound']
    const groups: { key: SectionKey; title: string; description: string; models: ModelInfo[] }[] = []

    for (const key of order) {
      const sectionModels = filteredModels.filter((m) => (m.section || (m.provider === 'local' ? 'local' : 'other')) === key)
      if (sectionModels.length > 0) {
        const def = SECTIONS.find((s) => s.key === key)
        groups.push({
          key,
          title: def?.label || key,
          description: def?.description || '',
          models: sectionModels,
        })
      }
    }

    return groups
  }, [filteredModels, activeSection])

  if (!isOpen) return null

  async function handleSelect(model: ModelInfo) {
    if (model.is_active || model.status === 'exhausted') return
    try {
      setSwitchingModelId(model.id)
      setError('')
      const updated = await selectActiveModel(model.id, model.provider)
      setModelData(updated)
      onModelChanged?.(model.id, model.provider)
    } catch (err) {
      console.error('Failed to switch model:', err)
      setError('Failed to switch model. Please try again.')
    } finally {
      setSwitchingModelId(null)
    }
  }

  const activeModelInfo = modelData?.models.find((m) => m.is_active)

  return createPortal(
    <div
      className="model-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !switchingModelId) onClose()
      }}
    >
      <section
        className="model-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-modal-title"
      >
        {/* Top Header */}
        <div className="model-modal-header">
          <div className="header-title-block">
            <div className="header-badge">
              <Sparkles size={13} />
              <span>AI INFERENCE HUB</span>
            </div>
            <h2 id="model-modal-title">AI Engine Sections & Live Quotas</h2>
            <p>
              Choose from categorized model sections: Local on-device Ollama, OpenAI OSS, Meta Llama, and specialized reasoning models.
            </p>
          </div>

          <div className="header-ctrls">
            <button
              type="button"
              className="refresh-btn"
              title="Refresh token telemetry"
              disabled={loading}
              onClick={() => void loadModels()}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Refreshing...' : 'Sync Quotas'}</span>
            </button>
            <button
              type="button"
              className="close-modal-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="model-modal-alert">
            <ShieldAlert size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Active Engine Summary Hero */}
        {activeModelInfo && (
          <div className="active-hero-banner">
            <div className="hero-left">
              <div className="hero-status-pill">
                <span className="live-pulsar" />
                <span>CURRENTLY ACTIVE</span>
              </div>
              <h3>{activeModelInfo.name}</h3>
              <p>{activeModelInfo.description}</p>

              <div className="hero-tags">
                <span className="hero-chip section-chip">
                  <Layers size={11} />
                  {activeModelInfo.section_name || 'Active Section'}
                </span>
                <span className="hero-chip">
                  {activeModelInfo.provider === 'api' ? <Cloud size={11} /> : <Bot size={11} />}
                  {activeModelInfo.provider_name}
                </span>
                <span className="hero-chip">
                  <Info size={11} />
                  {(activeModelInfo.context_window / 1000).toFixed(0)}k Context
                </span>
                <span className="hero-chip">
                  <Gauge size={11} />
                  {activeModelInfo.speed_rating}
                </span>
              </div>
            </div>

            <div className="hero-right">
              <div className="hero-quota-box">
                <div className="quota-header">
                  <span className="quota-label">Daily Available Tokens</span>
                  <strong className="quota-val">
                    {activeModelInfo.provider === 'local'
                      ? '∞ Unlimited Local'
                      : activeModelInfo.remaining_daily_tokens != null
                      ? `${activeModelInfo.remaining_daily_tokens.toLocaleString()}`
                      : 'Available'}
                  </strong>
                </div>

                {activeModelInfo.provider === 'api' && activeModelInfo.tpd_limit ? (
                  <>
                    <div className="hero-gauge-track">
                      <div
                        className={`hero-gauge-fill ${
                          activeModelInfo.percentage_remaining < 15
                            ? 'fill-danger'
                            : activeModelInfo.percentage_remaining < 40
                            ? 'fill-warning'
                            : 'fill-success'
                        }`}
                        style={{ width: `${Math.max(4, activeModelInfo.percentage_remaining)}%` }}
                      />
                    </div>
                    <div className="quota-footer-stats">
                      <span>{activeModelInfo.percentage_remaining}% daily quota remaining</span>
                      <span>Limit: {(activeModelInfo.tpd_limit / 1000).toFixed(0)}k / day</span>
                    </div>
                  </>
                ) : (
                  <div className="local-unlimited-note">
                    <Cpu size={12} />
                    <span>Runs 100% on device with zero API token consumption</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search & Category Filter Toolbar */}
        <div className="models-toolbar">
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search all sections (e.g. openai, llama, local, 70b)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="category-tabs" role="tablist">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon
              const count =
                sec.key === 'all'
                  ? modelData?.models.length || 0
                  : modelData?.models.filter(
                      (m) => (m.section || (m.provider === 'local' ? 'local' : 'other')) === sec.key,
                    ).length || 0

              return (
                <button
                  key={sec.key}
                  type="button"
                  role="tab"
                  aria-selected={activeSection === sec.key}
                  className={activeSection === sec.key ? 'tab-btn active' : 'tab-btn'}
                  onClick={() => setActiveSection(sec.key)}
                >
                  <Icon size={12} />
                  <span>{sec.label}</span>
                  <span className="tab-count">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Interactive Models List by Section */}
        <div className="models-scroll-list">
          {groupedSections.length === 0 ? (
            <div className="empty-models-state">
              <Search size={24} />
              <p>No AI models found matching "{searchQuery}"</p>
              <button type="button" onClick={() => { setSearchQuery(''); setActiveSection('all') }}>
                Reset search filters
              </button>
            </div>
          ) : (
            groupedSections.map((group) => (
              <div key={group.key} className="model-section-group">
                <div className="section-group-header">
                  <div className="section-title-line">
                    <span className="section-group-badge">{group.title}</span>
                    <span className="section-group-desc">{group.description}</span>
                  </div>
                  <span className="section-model-count">{group.models.length} {group.models.length === 1 ? 'model' : 'models'}</span>
                </div>

                <div className="section-models-grid">
                  {group.models.map((model) => {
                    const isCurrent = model.is_active
                    const isSwitching = switchingModelId === model.id
                    const isExhausted = model.status === 'exhausted'
                    const isLocal = model.provider === 'local'

                    return (
                      <div
                        key={model.id}
                        className={`model-row-item ${isCurrent ? 'row-active' : ''} ${
                          isExhausted ? 'row-exhausted' : ''
                        }`}
                        onClick={() => !isCurrent && !isExhausted && !isSwitching && void handleSelect(model)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            if (!isCurrent && !isExhausted) void handleSelect(model)
                          }
                        }}
                      >
                        {/* Left: Model Identity */}
                        <div className="row-identity">
                          <div className={`model-icon-badge ${isLocal ? 'icon-local' : 'icon-api'}`}>
                            {isLocal ? <Bot size={15} /> : <Cloud size={15} />}
                          </div>

                          <div className="model-name-group">
                            <div className="model-title-line">
                              <strong className="model-name">{model.name}</strong>
                              <span className="model-section-pill">{model.section_name || 'Groq Cloud'}</span>
                              {isCurrent && (
                                <span className="active-tag">
                                  <Check size={11} /> Current Engine
                                </span>
                              )}
                            </div>
                            <p className="model-desc">{model.description}</p>
                            {model.recommended_for.length > 0 && (
                              <div className="model-rec-chips">
                                {model.recommended_for.map((rec, i) => (
                                  <span key={i} className="rec-chip">
                                    {rec}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Middle: Live Token Quota Telemetry */}
                        <div className="row-token-telemetry">
                          <div className="token-headline">
                            <span className="token-label">Remaining Daily Quota</span>
                            <strong className="token-amount">
                              {isLocal
                                ? '∞ Unlimited'
                                : model.remaining_daily_tokens != null
                                ? `${model.remaining_daily_tokens.toLocaleString()} tokens`
                                : 'Available'}
                            </strong>
                          </div>

                          {!isLocal && model.tpd_limit ? (
                            <div className="row-progress-track">
                              <div
                                className={`row-progress-fill ${
                                  model.percentage_remaining < 15
                                    ? 'fill-danger'
                                    : model.percentage_remaining < 40
                                    ? 'fill-warning'
                                    : 'fill-success'
                                }`}
                                style={{ width: `${Math.max(4, model.percentage_remaining)}%` }}
                              />
                            </div>
                          ) : (
                            <div className="local-meter-fill">
                              <span>Offline Hardware Inference</span>
                            </div>
                          )}

                          <div className="token-subinfo">
                            {!isLocal && model.tpm_limit && (
                              <span>
                                <Zap size={10} /> {model.tpm_limit.toLocaleString()} TPM limit
                              </span>
                            )}
                            <span>
                              <Info size={10} /> {(model.context_window / 1000).toFixed(0)}k Context
                            </span>
                          </div>
                        </div>

                        {/* Right: Status & Action Button */}
                        <div className="row-action-side">
                          {isCurrent ? (
                            <div className="current-badge-indicator">
                              <Check size={14} />
                              <span>Active</span>
                            </div>
                          ) : isExhausted ? (
                            <div className="exhausted-chip">
                              <span>Daily Limit</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="select-engine-btn"
                              disabled={isSwitching}
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleSelect(model)
                              }}
                            >
                              {isSwitching ? (
                                <RefreshCw size={12} className="spin" />
                              ) : (
                                <>
                                  <span>Select</span>
                                  <ChevronRight size={13} />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info bar */}
        <div className="model-modal-footer">
          <div className="footer-left-info">
            <span className="footer-dot" />
            <span>
              Cumulative Usage Today:{' '}
              <strong>{(modelData?.total_tokens_used_today || 0).toLocaleString()} tokens</strong>
            </span>
          </div>
          <div className="footer-right-info">
            <span>Organized into Local, OpenAI, Meta, Qwen & Mistral sections</span>
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
