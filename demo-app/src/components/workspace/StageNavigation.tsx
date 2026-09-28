import {
  FileText,
  Dna,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

export type WorkspaceStage = 'sources' | 'dna' | 'integrity' | 'studio'

interface StageNavigationProps {
  activeStage: WorkspaceStage
  onSelectStage: (stage: WorkspaceStage) => void
  sourceCount: number
  hasDna: boolean
  conflictCount: number
  hasIntegrity: boolean
  outputCount: number
}

export function StageNavigation({
  activeStage,
  onSelectStage,
  sourceCount,
  hasDna,
  conflictCount,
  hasIntegrity,
  outputCount,
}: StageNavigationProps) {
  const stages: {
    id: WorkspaceStage
    num: string
    title: string
    desc: string
    icon: typeof FileText
    badgeText?: string
    badgeVariant?: 'default' | 'success' | 'warning' | 'cobalt'
  }[] = [
    {
      id: 'sources',
      num: '01',
      title: 'Sources & Upload',
      desc: 'Documents, URLs & Audio',
      icon: FileText,
      badgeText: sourceCount === 0 ? 'Empty' : `${sourceCount} source${sourceCount > 1 ? 's' : ''}`,
      badgeVariant: sourceCount === 0 ? 'default' : 'cobalt',
    },
    {
      id: 'dna',
      num: '02',
      title: 'Content DNA & Lineage',
      desc: 'Key Facts & Identity',
      icon: Dna,
      badgeText: hasDna ? 'Ready' : 'Awaiting Input',
      badgeVariant: hasDna ? 'success' : 'default',
    },
    {
      id: 'integrity',
      num: '03',
      title: 'Fact Integrity & Audit',
      desc: 'Cross-Source Verification',
      icon: ShieldCheck,
      badgeText: !hasIntegrity
        ? 'Not Analyzed'
        : conflictCount > 0
        ? `${conflictCount} dispute${conflictCount > 1 ? 's' : ''}`
        : 'Verified',
      badgeVariant: !hasIntegrity
        ? 'default'
        : conflictCount > 0
        ? 'warning'
        : 'success',
    },
    {
      id: 'studio',
      num: '04',
      title: 'Deliverables Studio',
      desc: 'Reports, Slides & Briefs',
      icon: Sparkles,
      badgeText: outputCount > 0 ? `${outputCount} deliverable${outputCount > 1 ? 's' : ''}` : 'Ready to Create',
      badgeVariant: outputCount > 0 ? 'cobalt' : 'default',
    },
  ]

  return (
    <nav className="stage-nav-bar tactile-card" aria-label="Transformation Lifecycle Stages">
      <div className="stage-nav-container">
        {stages.map((stage) => {
          const isActive = activeStage === stage.id
          const Icon = stage.icon

          return (
            <button
              key={stage.id}
              type="button"
              className={`stage-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectStage(stage.id)}
            >
              <div className="stage-item-top">
                <span className="stage-number">{stage.num}</span>
                <span className={`stage-badge badge-${stage.badgeVariant}`}>
                  {stage.badgeVariant === 'warning' && <AlertTriangle size={11} />}
                  {stage.badgeVariant === 'success' && <CheckCircle2 size={11} />}
                  {stage.badgeText}
                </span>
              </div>

              <div className="stage-item-body">
                <div className="stage-icon-wrap">
                  <Icon size={16} />
                </div>
                <div className="stage-text">
                  <span className="stage-title">{stage.title}</span>
                  <span className="stage-desc">{stage.desc}</span>
                </div>
              </div>

              {isActive && <div className="stage-active-line" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
