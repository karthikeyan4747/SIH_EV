import { ArrowDown, FileText } from 'lucide-react'
import type { ContentDNA } from '../../types/content'
import { getDNANodes, type DNASectionKey, type DNANodeData } from './dnaData'
interface ContentDNAStructureProps { dna: ContentDNA; selectedNode: DNASectionKey | null; onSelectNode: (key: DNASectionKey) => void }

const relationships: [DNASectionKey, DNASectionKey][] = [
  ['identity', 'overview'], ['identity', 'entities'], ['overview', 'facts'], ['entities', 'facts'],
  ['facts', 'findings'], ['facts', 'context'], ['findings', 'evidence'], ['context', 'evidence'], ['evidence', 'recommendations'],
]

function DNANode({ data, selected, related, onSelect }: { data: DNANodeData; selected: boolean; related: boolean; onSelect: () => void }) {
  const Icon = data.icon
  return <button className={`dna-node ${selected ? 'selected' : ''} ${related ? 'related' : ''} ${data.empty ? 'empty' : ''}`} onClick={onSelect} aria-pressed={selected} aria-label={`${data.label}, ${data.count} elements`}><span className="node-icon"><Icon size={17} /></span><span className="node-copy"><strong>{data.label}</strong><small>{data.count ? `${data.count} element${data.count === 1 ? '' : 's'}` : 'No data identified'}</small></span><span className="node-status" /></button>
}

function DNAConnection({ from, to, selected, related }: { from: DNASectionKey; to: DNASectionKey; selected: boolean; related: boolean }) {
  const positions: Record<DNASectionKey, [number, number]> = { identity: [50, 10], overview: [28, 30], entities: [72, 30], facts: [50, 50], findings: [27, 68], context: [73, 68], evidence: [50, 84], recommendations: [50, 98] }
  const [x1, y1] = positions[from]; const [x2, y2] = positions[to]
  return <line className={`dna-connection ${selected ? 'selected' : ''} ${related ? 'related' : ''}`} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} />
}

export function ContentDNAStructure({ dna, selectedNode, onSelectNode }: ContentDNAStructureProps) {
  const nodes = getDNANodes(dna)
  const relatedKeys = selectedNode ? new Set(relationships.filter(([from, to]) => from === selectedNode || to === selectedNode).flat()) : new Set<DNASectionKey>()
  return <div className="structure-stage"><div className="structure-source"><FileText size={14} /><span>SOURCE</span><ArrowDown size={14} /><strong>{dna.identity.title || 'Untitled source'}</strong></div><div className="network-map"><svg className="network-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{relationships.map(([from, to]) => <DNAConnection key={`${from}-${to}`} from={from} to={to} selected={selectedNode === from || selectedNode === to} related={relatedKeys.has(from) && relatedKeys.has(to)} />)}</svg>{nodes.map((node) => <div className={`node-position node-${node.key}`} key={node.key}><DNANode data={node} selected={selectedNode === node.key} related={!selectedNode || relatedKeys.has(node.key)} onSelect={() => onSelectNode(node.key)} /></div>)}</div><div className="structure-legend"><span><span className="legend-dot accent" />Selected</span><span><span className="legend-dot" />Dimension</span><span><span className="legend-dot muted" />Empty dimension</span></div></div>
}
