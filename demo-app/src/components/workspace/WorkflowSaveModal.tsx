import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X } from 'lucide-react'
import { saveWorkflow, type WorkflowTemplate } from '../../lib/api/client'
import type { GenerationConfig } from './stages/StudioStage'

interface WorkflowSaveModalProps {
  open: boolean
  onClose: () => void
  outputTypes: string[]
  generationConfig: GenerationConfig
  onSave: (workflow: WorkflowTemplate) => void
}

export function WorkflowSaveModal({
  open,
  onClose,
  outputTypes,
  generationConfig,
  onSave,
}: WorkflowSaveModalProps) {
  const [workflowName, setWorkflowName] = useState('')
  const [workflowDesc, setWorkflowDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = workflowName.trim()
    if (!name) {
      setError('Please provide a workflow name.')
      return
    }

    const workflowId =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || `custom_${Date.now()}`

    setSaving(true)
    setError('')

    try {
      const saved = await saveWorkflow({
        id: workflowId,
        name,
        description: workflowDesc.trim() || 'Custom operator workflow.',
        output_types: outputTypes,
        generation_config: generationConfig,
      })
      onSave(saved)
      onClose()
      setWorkflowName('')
      setWorkflowDesc('')
    } catch (err: any) {
      setError(err?.message || 'Failed to save workflow.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="workflow-modal-backdrop" onClick={onClose}>
      <div className="workflow-modal-card tactile-card" onClick={(e) => e.stopPropagation()}>
        <div className="workflow-modal-header">
          <div className="modal-header-info">
            <span className="modal-kicker">
              <Sparkles size={13} />
              PRESET ENGINE
            </span>
            <h3>Save Custom Workflow</h3>
            <p>Save current deliverable formats and generation parameters as a reusable preset.</p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="modal-error-banner" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="workflow-modal-form">
          <div className="modal-field">
            <label>Workflow Name</label>
            <input
              type="text"
              placeholder="e.g. Hindi Executive Board Briefing"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label>Description (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Generates executive summary and presentation in Hindi for leadership"
              value={workflowDesc}
              onChange={(e) => setWorkflowDesc(e.target.value)}
            />
          </div>

          <div className="workflow-config-summary">
            <span className="summary-title">Configuration Snapshot:</span>
            <div className="snapshot-tags">
              <span className="snapshot-tag">{outputTypes.length} Output{outputTypes.length === 1 ? '' : 's'}</span>
              <span className="snapshot-tag">Lang: {generationConfig.language}</span>
              <span className="snapshot-tag">Audience: {generationConfig.audience}</span>
              <span className="snapshot-tag">Tone: {generationConfig.tone}</span>
              <span className="snapshot-tag">Detail: {generationConfig.detail}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save-workflow primary"
              disabled={saving || !workflowName.trim()}
            >
              <Sparkles size={14} />
              <span>{saving ? 'Saving...' : 'Save Workflow'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
