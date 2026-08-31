import { useState, useEffect } from 'react'
import { Bot, ChevronDown, Cloud } from 'lucide-react'
import {
  getAvailableModels,
  type ModelListResponse,
  type ModelMode,
} from '../../lib/api/client'
import { ModelSelectorModal } from './ModelSelectorModal'
import '../../models.css'

interface ModelTelemetryBadgeProps {
  onModelChanged?: (modelId: string, provider: ModelMode) => void
}

export function ModelTelemetryBadge({ onModelChanged }: ModelTelemetryBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [data, setData] = useState<ModelListResponse | null>(null)

  async function fetchTelemetry() {
    try {
      const res = await getAvailableModels()
      setData(res)
    } catch (err) {
      console.debug('Telemetry poll error:', err)
    }
  }

  useEffect(() => {
    void fetchTelemetry()
    // Poll telemetry every 15 seconds for live token quota updates
    const timer = setInterval(() => {
      void fetchTelemetry()
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  const activeModel = data?.models.find((m) => m.is_active)
  const isApi = data?.active_provider === 'api'
  const Icon = isApi ? Cloud : Bot

  return (
    <>
      <button
        type="button"
        className={`model-topbar-pill ${isApi ? 'pill-api' : 'pill-local'}`}
        onClick={() => setModalOpen(true)}
        title="Click to switch AI models and view live token quotas"
        aria-label="Manage models and view token quotas"
      >
        <span className="pill-icon-container">
          <Icon size={12} />
        </span>

        <div className="pill-info-block">
          <div className="pill-title-row">
            <span className="pill-model-name">
              {activeModel?.name || (isApi ? 'Qwen 3.8 27B' : 'Local Qwen 3 8B')}
            </span>
            <span className="pill-live-dot" />
          </div>

          <span className="pill-token-count">
            {activeModel?.provider === 'local'
              ? '∞ Local'
              : activeModel?.remaining_daily_tokens != null
              ? `${(activeModel.remaining_daily_tokens / 1000).toFixed(0)}k left (${activeModel.percentage_remaining}%)`
              : 'Tokens Active'}
          </span>
        </div>

        <ChevronDown size={12} className="pill-chevron" />
      </button>

      <ModelSelectorModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          void fetchTelemetry()
        }}
        onModelChanged={(modelId, provider) => {
          void fetchTelemetry()
          onModelChanged?.(modelId, provider)
        }}
      />
    </>
  )
}
