import { useState } from 'react'
import { Check, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { DragInput } from '../ui/DragInput'
import { getDNANodes, type DNASectionKey } from './dnaData'
import type { ContentDNA, ContentDNAPatch } from '../../types/content'

interface DNAInspectorProps {
  dna: ContentDNA
  selectedNode: DNASectionKey | null
  saveState: 'saved' | 'dirty' | 'saving' | 'error'
  onPatch: (changes: ContentDNAPatch) => Promise<void>
}

const titles: Record<DNASectionKey, string> = {
  identity: 'Identity',
  overview: 'Overview',
  entities: 'Entities',
  facts: 'Facts',
  findings: 'Findings',
  recommendations: 'Recommendations',
  context: 'Context',
  evidence: 'Evidence',
}

const descriptions: Record<DNASectionKey, string> = {
  identity: 'The source identity and classification.',
  overview: 'The source in its most useful concise form.',
  entities: 'Named people, organizations, places and technologies.',
  facts: 'Claims, numbers, dates and events grounded in the source.',
  findings: 'What the source establishes, signals or implies.',
  recommendations: 'Actions explicitly recommended by the source.',
  context: 'Audience, tone and communication intent.',
  evidence: 'Traceability back to the original source.',
}

export function DNAInspector({
  dna,
  selectedNode,
  saveState,
  onPatch,
}: DNAInspectorProps) {
  const node = selectedNode
    ? getDNANodes(dna).find((item) => item.key === selectedNode)
    : null

  if (!selectedNode || !node) {
    return (
      <Card className="dna-inspector empty-inspector">
        <div className="empty-inspector-mark">✦</div>
        <h2>Select a DNA dimension</h2>
        <p>
          Choose a node to inspect and edit the structured
          understanding of your source.
        </p>
        <div className="inspector-hint">8 dimensions available</div>
      </Card>
    )
  }

  return (
    <Card
      className="dna-inspector"
      id={`inspector-${selectedNode}`}
    >
      <div className="inspector-heading">
        <div>
          <span className="inspector-eyebrow">DNA DIMENSION</span>
          <h2>{titles[selectedNode]}</h2>
          <p>{descriptions[selectedNode]}</p>
        </div>
        <span
          className={`inspector-count ${node.empty ? 'is-empty' : ''}`}
        >
          {node.count} elements
        </span>
      </div>

      <SectionEditor
        key={`${selectedNode}-${JSON.stringify(dna[selectedNode])}`}
        section={selectedNode}
        data={dna[selectedNode]}
        saveState={saveState}
        onPatch={onPatch}
      />
    </Card>
  )
}

function SectionEditor({
  section,
  data,
  saveState,
  onPatch,
}: {
  section: DNASectionKey
  data: ContentDNA[DNASectionKey]
  saveState: DNAInspectorProps['saveState']
  onPatch: DNAInspectorProps['onPatch']
}) {
  const values = data as unknown as Record<string, string | string[]>
  const [draft, setDraft] = useState(values)
  const [changed, setChanged] = useState(false)

  function update(key: string, value: string | string[]) {
    setDraft({ ...draft, [key]: value })
    setChanged(true)
  }

  async function save() {
    await onPatch({ [section]: draft } as ContentDNAPatch)
    setChanged(false)
  }

  const isMultiline = (key: string) =>
    key === 'summary' ||
    key === 'purpose' ||
    key === 'source_description' ||
    key === 'communication_objective' ||
    key === 'supporting_excerpt'

  return (
    <div className="inspector-fields">
      {Object.entries(draft).map(([key, value]) => {
        if (Array.isArray(value)) {
          return (
            <ArrayEditor
              key={key}
              label={key}
              values={value}
              onChange={(next) => update(key, next)}
            />
          )
        }

        const strVal = String(value ?? '')
        const needsMultiline = isMultiline(key) || strVal.length > 45 || strVal.includes('\n')
        const calculatedRows = isMultiline(key)
          ? (key === 'summary' || key === 'supporting_excerpt' ? 5 : 3)
          : Math.min(8, Math.max(2, Math.ceil(strVal.length / 45)))

        return (
          <div className="inspector-field" key={key}>
            <label htmlFor={`${section}-${key}`}>
              {key.replaceAll('_', ' ')}
            </label>
            {needsMultiline ? (
              <DragInput
                as="textarea"
                textarea={{
                  id: `${section}-${key}`,
                  value: strVal,
                  rows: calculatedRows,
                  style: { width: '100%', resize: 'vertical', lineHeight: 1.5 },
                  onChange: (event) =>
                    update(key, event.target.value),
                }}
              />
            ) : (
              <DragInput
                as="input"
                input={{
                  id: `${section}-${key}`,
                  value: strVal,
                  onChange: (event) =>
                    update(key, event.target.value),
                }}
              />
            )}
          </div>
        )
      })}

      <div className="inspector-savebar">
        <span
          className={`save-feedback save-${saveState}`}
        >
          {saveState === 'saving' ? (
            'Saving changes...'
          ) : saveState === 'error' ? (
            'Unable to save changes'
          ) : changed ? (
            'Unsaved changes'
          ) : (
            <>
              <Check size={13} />{' '}
              Saved
            </>
          )}
        </span>
        <div>
          <Button
            variant="ghost"
            disabled={!changed || saveState === 'saving'}
            onClick={() => {
              setDraft(values)
              setChanged(false)
            }}
          >
            <RotateCcw size={14} />
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!changed}
            loading={saveState === 'saving'}
            loadingLabel="Saving..."
            onClick={() => void save()}
          >
            <Save size={14} />
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}

function ArrayEditor({
  label,
  values,
  onChange,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
}) {
  const [newValue, setNewValue] = useState('')

  function add() {
    const value = newValue.trim()
    if (!value) return
    onChange([...values, value])
    setNewValue('')
  }

  return (
    <div className="inspector-array">
      <label>{label.replaceAll('_', ' ')}</label>
      {values.length ? (
        <div className="array-items">
          {values.map((value, index) => {
            const isLong = typeof value === 'string' && (value.length > 40 || value.includes('\n'))
            const calculatedRows = typeof value === 'string'
              ? Math.min(8, Math.max(2, Math.ceil(value.length / 45)))
              : 2

            return (
              <div
                className={`array-item ${isLong ? 'array-item-multiline' : ''}`}
                key={`${value}-${index}`}
              >
                {isLong ? (
                  <DragInput
                    as="textarea"
                    textarea={{
                      value: value,
                      'aria-label': `${label} item ${index + 1}`,
                      rows: calculatedRows,
                      style: { width: '100%', resize: 'vertical', lineHeight: 1.5 },
                      onChange: (event) =>
                        onChange(
                          values.map((item, itemIndex) =>
                            itemIndex === index
                              ? event.target.value
                              : item,
                          ),
                        ),
                    }}
                  />
                ) : (
                  <DragInput
                    as="input"
                    input={{
                      value: value,
                      'aria-label': `${label} item ${index + 1}`,
                      onChange: (event) =>
                        onChange(
                          values.map((item, itemIndex) =>
                            itemIndex === index
                              ? event.target.value
                              : item,
                          ),
                        ),
                    }}
                  />
                )}
                <button
                  type="button"
                  aria-label={`Delete ${label} item ${index + 1}`}
                  onClick={() =>
                    onChange(
                      values.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="inspector-empty">
          No {label.replaceAll('_', ' ')} identified
        </p>
      )}
      <div className="add-row">
        <DragInput
          as="input"
          input={{
            value: newValue,
            placeholder: `Add ${label.replaceAll('_', ' ')}`,
            onChange: (event) =>
              setNewValue(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') add()
            },
          }}
        />
        <Button
          variant="ghost"
          disabled={!newValue.trim()}
          onClick={add}
        >
          <Plus size={14} />
          Add
        </Button>
      </div>
    </div>
  )
}
