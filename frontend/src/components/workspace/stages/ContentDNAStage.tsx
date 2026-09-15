import { useState } from 'react'
import {
  ArrowRight,
  Dna,
  GitFork,
  Layers,
  History,
} from 'lucide-react'
import type { ContentDNA, ContentDNAPatch } from '../../../types/content'
import type { Transformation } from '../../../types/transformation'
import { SemanticLineageGraphVisualizer } from '../../dna/SemanticLineageGraphVisualizer'
import { ContentDNAStructure } from '../../dna/ContentDNAStructure'
import { DNAInspector } from '../../dna/DNAInspector'
import { DNAVersionTimelineView } from './DNAVersionTimelineView'
import type { DNASectionKey } from '../../dna/dnaData'

interface ContentDNAStageProps {
  transformation: Transformation
  dna: ContentDNA | null
  busy: boolean
  onPatch: (patch: ContentDNAPatch) => Promise<void>
  onRestoreVersion?: (version: number) => void
  onProceedToIntegrity: () => void
}

export function ContentDNAStage({
  transformation,
  dna,
  busy,
  onPatch,
  onRestoreVersion,
  onProceedToIntegrity,
}: ContentDNAStageProps) {
  const [viewMode, setViewMode] = useState<'lineage' | 'helix' | 'inspector' | 'versions'>('lineage')
  const [selectedNode, setSelectedNode] = useState<DNASectionKey>('overview')

  const versionsCount = transformation.versions?.length || (dna ? 1 : 0)

  return (
    <div className="dna-stage-container">
      {/* Top Toolbar */}
      <div className="dna-stage-toolbar tactile-card">
        <div className="toolbar-left">
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`mode-btn ${viewMode === 'lineage' ? 'active' : ''}`}
              onClick={() => setViewMode('lineage')}
              title="Interactive trace flow from raw sources to claims and deliverables"
            >
              <GitFork size={14} />
              <span>Semantic Lineage Graph</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${viewMode === 'helix' ? 'active' : ''}`}
              onClick={() => setViewMode('helix')}
              title="3D Structural visualizer of the knowledge layer"
            >
              <Dna size={14} />
              <span>Double-Helix Model</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${viewMode === 'inspector' ? 'active' : ''}`}
              onClick={() => setViewMode('inspector')}
              title="Detailed field editor and JSON patcher"
            >
              <Layers size={14} />
              <span>Attribute Inspector</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${viewMode === 'versions' ? 'active' : ''}`}
              onClick={() => setViewMode('versions')}
              title="Inspect DNA version snapshots, audit history, and rollback"
            >
              <History size={14} />
              <span>DNA Versions ({versionsCount})</span>
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          <button
            type="button"
            className="proceed-stage-btn primary"
            onClick={onProceedToIntegrity}
          >
            <span>Audit Fact Integrity</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Main DNA Canvas & Inspector Layout */}
      <div className="dna-stage-main-grid">
        {viewMode === 'versions' ? (
          <DNAVersionTimelineView
            transformation={transformation}
            currentDna={dna}
            onRestoreVersion={onRestoreVersion}
          />
        ) : viewMode === 'lineage' ? (
          <div className="lineage-canvas-wrapper tactile-card">
            <SemanticLineageGraphVisualizer
              transformation={transformation}
              selectedSectionKey={selectedNode}
              onSelectSection={setSelectedNode}
            />
          </div>
        ) : !dna ? (
          <div className="empty-dna-state tactile-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <Dna size={40} style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
            <h3>No Content DNA Extracted Yet</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Add sources in Stage 1 and extract DNA to inspect the canonical structure and helix visualization.
            </p>
          </div>
        ) : viewMode === 'helix' ? (
          <div className="helix-split-layout">
            <div className="helix-viewport tactile-card">
              <ContentDNAStructure
                dna={dna}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
              />
            </div>
            <div className="helix-inspector-viewport tactile-card">
              <DNAInspector
                dna={dna}
                saveState={busy ? 'saving' : 'saved'}
                selectedNode={selectedNode}
                onPatch={onPatch}
              />
            </div>
          </div>
        ) : (
          <div className="full-inspector-wrapper tactile-card">
            <DNAInspector
              dna={dna}
              saveState={busy ? 'saving' : 'saved'}
              selectedNode={selectedNode}
              onPatch={onPatch}
            />
          </div>
        )}
      </div>
    </div>
  )
}
