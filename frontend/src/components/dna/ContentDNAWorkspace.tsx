import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  FileText,
  Layers3,
  Network,
  PanelRight,
  Sparkles,
} from 'lucide-react'

import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { ContentDNAStructure } from './ContentDNAStructure'
import { getDNANodes, type DNASectionKey } from './dnaData'
import { DNAInspector } from './DNAInspector'


import type {
  ContentDNA,
  ContentDNAPatch,
  RawContent,
} from '../../types/content'

interface ContentDNAWorkspaceProps {
  source: RawContent
  dna: ContentDNA
  saveState: 'saved' | 'dirty' | 'saving' | 'error'
  onPatch: (changes: ContentDNAPatch) => Promise<void>
}

export function ContentDNAWorkspace({
  source,
  dna,
  saveState,
  onPatch,
}: ContentDNAWorkspaceProps) {
  const [selectedNode, setSelectedNode] =
    useState<DNASectionKey | null>(null)

  const [view, setView] = useState<'structure' | 'editor'>(
    'structure',
  )

  const nodes = useMemo(
    () => getDNANodes(dna),
    [dna],
  )

  const populated = nodes.filter(
    (node) => !node.empty,
  ).length

  const elements = nodes.reduce(
    (total, node) => total + node.count,
    0,
  )

  useEffect(() => {
    if (
      view === 'editor' &&
      selectedNode
    ) {
      document
        .getElementById(`inspector-${selectedNode}`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    }
  }, [view, selectedNode])

  function selectNode(key: DNASectionKey) {
    setSelectedNode(key)

    if (view === 'structure') {
      document
        .getElementById(`inspector-${key}`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    }
  }

  return (
    <section className="dna-workspace page-enter">
      {/* ============================================================
          HEADER
      ============================================================ */}

      <header className="dna-page-header">
        <div className="dna-heading-copy">
          <div className="eyebrow eyebrow-left">
            <span className="eyebrow-dot" />

            CONTENT DNA

            <Badge>
              CANONICAL
            </Badge>
          </div>

          <h1>
            {dna.identity.title || source.title}
          </h1>

          <p>
            The structured intelligence extracted
            from this source.
          </p>

          <div className="dna-metrics">
            <span>
              <b>{populated} / 8</b>{' '}
              dimensions populated
            </span>

            <span>
              <b>{elements}</b>{' '}
              extracted elements
            </span>

            <span>
              <FileText size={13} />
              {source.source_type.toUpperCase()} source
            </span>
          </div>
        </div>

        {/* ========================================================
            HEADER STATE
        ======================================================== */}

        <div className="dna-header-state">
          <span
            className={`save-feedback save-${saveState}`}
          >
            {saveState === 'saving' ? (
              'Saving...'
            ) : saveState === 'dirty' ? (
              'Unsaved changes'
            ) : saveState === 'error' ? (
              'Save failed'
            ) : (
              <>
                <Check size={14} />
                Saved
              </>
            )}
          </span>

          <div
            className="view-switcher"
            role="tablist"
            aria-label="Content DNA view"
          >
            <button
              className={
                view === 'structure'
                  ? 'active'
                  : ''
              }
              role="tab"
              aria-selected={
                view === 'structure'
              }
              onClick={() =>
                setView('structure')
              }
            >
              <Network size={15} />
              Structure
            </button>

            <button
              className={
                view === 'editor'
                  ? 'active'
                  : ''
              }
              role="tab"
              aria-selected={
                view === 'editor'
              }
              onClick={() =>
                setView('editor')
              }
            >
              <Layers3 size={15} />
              Editor
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          MAIN DNA WORKSPACE
      ============================================================ */}

      <div
        className={`dna-content-layout ${view === 'editor'
          ? 'editor-mode'
          : ''
          }`}
      >
        {/* ========================================================
            STRUCTURE PANEL
        ======================================================== */}

        <Card className="dna-structure-panel">
          <div className="dna-panel-bar">
            <div>
              <span className="panel-kicker">
                <Sparkles size={14} />

                INFORMATION NETWORK
              </span>

              <p>
                Source signal mapped into
                eight dimensions
              </p>
            </div>

            <Badge>
              {populated}/8 ACTIVE
            </Badge>
          </div>

          <ContentDNAStructure
            dna={dna}
            selectedNode={selectedNode}
            onSelectNode={selectNode}
          />

          <div className="structure-bottom">
            <span>
              <PanelRight size={14} />

              Select a dimension to inspect
            </span>

            <span>
              Relationships are source-derived
            </span>
          </div>
        </Card>

        {/* ========================================================
            DNA INSPECTOR
        ======================================================== */}

        <DNAInspector
          dna={dna}
          selectedNode={selectedNode}
          saveState={saveState}
          onPatch={onPatch}
        />
      </div>
    </section>
  )
}