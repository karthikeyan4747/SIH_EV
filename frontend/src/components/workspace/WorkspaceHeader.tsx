import { useState, useEffect } from 'react'
import {
  Check,
  Clock,
  Edit2,
  Moon,
  Sun,
  History,
} from 'lucide-react'
import { ModelTelemetryBadge } from '../model/ModelTelemetryBadge'
import type { Transformation } from '../../types/transformation'

interface WorkspaceHeaderProps {
  transformation: Transformation
  saveState: 'saved' | 'dirty' | 'saving' | 'error'
  themeMode: 'light' | 'dark'
  onThemeToggle: () => void
  onRename: (title: string) => void
  onOpenVersions?: () => void
  onGenerateQuick?: () => void
}

export function WorkspaceHeader({
  transformation,
  saveState,
  themeMode,
  onThemeToggle,
  onRename,
  onOpenVersions,
}: WorkspaceHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [titleValue, setTitleValue] = useState(transformation.title)

  useEffect(() => {
    setTitleValue(transformation.title)
  }, [transformation.title])

  const handleTitleSubmit = () => {
    setIsEditing(false)
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== transformation.title) {
      onRename(trimmed)
    } else {
      setTitleValue(transformation.title)
    }
  }

  const versionsCount = transformation.versions?.length || 0

  return (
    <header className="workspace-header-bar tactile-card">
      <div className="workspace-title-group">
        {isEditing ? (
          <input
            type="text"
            className="workspace-title-input"
            value={titleValue}
            autoFocus
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit()
              if (e.key === 'Escape') {
                setTitleValue(transformation.title)
                setIsEditing(false)
              }
            }}
          />
        ) : (
          <div
            className="workspace-title-clickable"
            onClick={() => setIsEditing(true)}
            title="Click to rename"
          >
            <h1>{transformation.title || 'Untitled Transformation'}</h1>
            <Edit2 size={14} className="edit-icon" />
          </div>
        )}

        <div className="workspace-meta-pills">
          <span className="meta-pill id-pill">
            ID: {transformation.id.slice(0, 8)}
          </span>

          <span className={`meta-pill sync-pill ${saveState}`}>
            {saveState === 'saving' && <Clock size={11} className="spin" />}
            {saveState === 'saved' && <Check size={11} />}
            <span>{saveState === 'saving' ? 'Saving...' : saveState === 'dirty' ? 'Unsaved' : 'Synced'}</span>
          </span>

          {(versionsCount > 0 || Boolean(transformation.content_dna)) && onOpenVersions && (
            <button
              type="button"
              className="meta-pill version-btn"
              onClick={onOpenVersions}
              title="View DNA version rollback history"
            >
              <History size={12} />
              <span>v{Math.max(1, versionsCount)}</span>
            </button>
          )}
        </div>
      </div>

      <div className="workspace-header-actions">
        {/* Model Quota & Telemetry */}
        <ModelTelemetryBadge />

        {/* Crisp Light/Dark Mode Switcher */}
        <button
          type="button"
          className="header-action-btn icon-only"
          onClick={onThemeToggle}
          title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle Theme"
        >
          {themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}
