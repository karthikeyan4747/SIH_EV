import { ArrowDown, FileText } from 'lucide-react'
import type { ContentDNA } from '../../types/content'
import { getDNANodes, type DNASectionKey, type DNANodeData } from './dnaData'
interface ContentDNAStructureProps { dna: ContentDNA; selectedNode: DNASectionKey | null; onSelectNode: (key: DNASectionKey) => void }

const relationships: [DNASectionKey, DNASectionKey][] = [
  ['identity', 'overview'], ['identity', 'entities'], ['overview', 'facts'], ['entities', 'facts'],
  ['facts', 'findings'], ['facts', 'context'], ['findings', 'evidence'], ['context', 'evidence'], ['evidence', 'recommendations'],
]

const helixStops = [
  { y: 126, left: 392, right: 608, pair: 'at', front: false },
  { y: 194, left: 346, right: 654, pair: 'gc', front: true },
  { y: 262, left: 376, right: 624, pair: 'ta', front: true },
  { y: 330, left: 430, right: 570, pair: 'cg', front: false },
  { y: 398, left: 430, right: 570, pair: 'at', front: false },
  { y: 466, left: 374, right: 626, pair: 'gc', front: true },
  { y: 534, left: 346, right: 654, pair: 'ta', front: true },
  { y: 602, left: 392, right: 608, pair: 'cg', front: false },
  { y: 670, left: 438, right: 562, pair: 'at', front: false },
  { y: 738, left: 376, right: 624, pair: 'gc', front: true },
  { y: 806, left: 348, right: 652, pair: 'ta', front: true },
]

const nodePositions: Record<DNASectionKey, { x: number; y: number; side: 'left' | 'right' }> = {
  overview: { x: 13, y: 22, side: 'left' },
  identity: { x: 13, y: 42, side: 'left' },
  entities: { x: 13, y: 62, side: 'left' },
  facts: { x: 13, y: 82, side: 'left' },
  findings: { x: 87, y: 29, side: 'right' },
  evidence: { x: 87, y: 48, side: 'right' },
  context: { x: 87, y: 67, side: 'right' },
  recommendations: { x: 87, y: 87, side: 'right' },
}

function DNANode({ data, selected, related, onSelect }: { data: DNANodeData; selected: boolean; related: boolean; onSelect: () => void }) {
  const Icon = data.icon
  return <button className={`dna-node ${selected ? 'selected' : ''} ${related ? 'related' : ''} ${data.empty ? 'empty' : ''}`} onClick={onSelect} aria-pressed={selected} aria-label={`${data.label}, ${data.count} elements`}><span className="node-icon"><Icon size={17} /></span><span className="node-copy"><strong>{data.label}</strong><small>{data.count ? `${data.count} element${data.count === 1 ? '' : 's'}` : 'No data identified'}</small></span><span className="node-status" /></button>
}

function DNAConnection({ to, selected, related }: { to: DNASectionKey; selected: boolean; related: boolean }) {
  const position = nodePositions[to]
  const x2 = position.side === 'left' ? 39 : 61
  return <line className={`dna-connection ${selected ? 'selected' : ''} ${related ? 'related' : ''}`} x1={`${position.x}%`} y1={`${position.y}%`} x2={`${x2}%`} y2={`${position.y}%`} />
}

function HelixIllustration() {
  const backPairs = helixStops.filter((stop) => !stop.front)
  const frontPairs = helixStops.filter((stop) => stop.front)
  return <svg className="dna-helix" viewBox="0 0 1000 920" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="helix-left" x1="360" x2="650" y1="40" y2="880" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#00d8ff" />
        <stop offset="48%" stopColor="#24a7ff" />
        <stop offset="100%" stopColor="#00d8ff" />
      </linearGradient>
      <linearGradient id="helix-right" x1="640" x2="350" y1="40" y2="880" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#56a9ff" />
        <stop offset="46%" stopColor="#0cd9ff" />
        <stop offset="100%" stopColor="#436dff" />
      </linearGradient>
      <filter id="helix-glow">
        <feGaussianBlur stdDeviation="4.2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="helix-soft-shadow">
        <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#031637" floodOpacity="0.5" />
      </filter>
    </defs>
    <g className="dna-circuit-traces">
      <path className="dna-circuit-line circuit-left" d="M42 172 H190 l42 42 h148" />
      <path className="dna-circuit-line circuit-left faint" d="M0 255 H172 l55 -55 h105" />
      <path className="dna-circuit-line circuit-left" d="M44 344 H236 l58 44 h86" />
      <path className="dna-circuit-line circuit-left faint" d="M0 510 H260 l52 -48 h72" />
      <path className="dna-circuit-line circuit-left" d="M36 650 H214 l72 -70 h96" />
      <path className="dna-circuit-line circuit-left faint" d="M130 788 H304 l70 -72 h70" />
      <path className="dna-circuit-line circuit-right" d="M958 175 H810 l-48 48 H622" />
      <path className="dna-circuit-line circuit-right faint" d="M1000 286 H812 l-45 -42 H640" />
      <path className="dna-circuit-line circuit-right" d="M960 392 H784 l-54 48 H622" />
      <path className="dna-circuit-line circuit-right faint" d="M1000 524 H748 l-48 -48 H618" />
      <path className="dna-circuit-line circuit-right" d="M948 668 H776 l-76 -76 H620" />
      <path className="dna-circuit-line circuit-right faint" d="M868 802 H708 l-78 -78 H560" />
      <circle className="dna-circuit-dot" cx="190" cy="172" r="5" />
      <circle className="dna-circuit-dot" cx="236" cy="344" r="4" />
      <circle className="dna-circuit-dot" cx="304" cy="788" r="4" />
      <circle className="dna-circuit-dot" cx="810" cy="175" r="5" />
      <circle className="dna-circuit-dot" cx="784" cy="392" r="4" />
      <circle className="dna-circuit-dot" cx="708" cy="802" r="4" />
    </g>
    {backPairs.map((stop, index) => <g className={`base-pair pair-${stop.pair} pair-back`} key={`back-${index}`}><line className="base-pair-left" x1={stop.left} y1={stop.y} x2="500" y2={stop.y} /><line className="base-pair-right" x1="500" y1={stop.y} x2={stop.right} y2={stop.y} /><line className="hydrogen-bond" x1="486" y1={stop.y} x2="514" y2={stop.y} /></g>)}
    <path className="helix-shadow" d="M390 58 C740 170, 260 286, 610 410 C260 542, 738 658, 390 862" />
    <path className="helix-shadow" d="M610 58 C260 170, 740 286, 390 410 C740 542, 262 658, 610 862" />
    <path className="helix-strand helix-strand-left strand-backbone" d="M390 58 C740 170, 260 286, 610 410 C260 542, 738 658, 390 862" />
    <path className="helix-strand helix-strand-right strand-backbone" d="M610 58 C260 170, 740 286, 390 410 C740 542, 262 658, 610 862" />
    {frontPairs.map((stop, index) => <g className={`base-pair pair-${stop.pair} pair-front`} key={`front-${index}`}><line className="base-pair-left" x1={stop.left} y1={stop.y} x2="500" y2={stop.y} /><line className="base-pair-right" x1="500" y1={stop.y} x2={stop.right} y2={stop.y} /><line className="hydrogen-bond" x1="486" y1={stop.y} x2="514" y2={stop.y} /></g>)}
    <path className="helix-highlight" d="M370 64 C690 174, 286 290, 588 408 C292 540, 700 660, 374 856" />
    <path className="helix-highlight" d="M588 64 C294 174, 714 290, 410 410 C708 540, 296 660, 588 856" />
    {helixStops.map((stop, index) => <circle className={`helix-marker phosphate-marker ${stop.front ? 'marker-front' : 'marker-back'}`} key={`marker-a-${index}`} cx={stop.left} cy={stop.y} r="12" />)}
    {helixStops.map((stop, index) => <circle className={`helix-marker phosphate-marker ${stop.front ? 'marker-front' : 'marker-back'}`} key={`marker-b-${index}`} cx={stop.right} cy={stop.y} r="12" />)}
  </svg>
}

export function ContentDNAStructure({ dna, selectedNode, onSelectNode }: ContentDNAStructureProps) {
  const nodes = getDNANodes(dna)
  const relatedKeys = selectedNode ? new Set(relationships.filter(([from, to]) => from === selectedNode || to === selectedNode).flat()) : new Set<DNASectionKey>()
  return <div className="structure-stage"><div className="structure-source"><FileText size={14} /><span>SOURCE</span><ArrowDown size={14} /><strong>{dna.identity.title || 'Untitled source'}</strong></div><div className="network-map helix-map"><HelixIllustration /><svg className="network-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{nodes.map((node) => <DNAConnection key={`helix-${node.key}`} to={node.key} selected={selectedNode === node.key} related={!selectedNode || relatedKeys.has(node.key)} />)}</svg>{nodes.map((node) => <div className={`node-position node-${node.key}`} key={node.key}><DNANode data={node} selected={selectedNode === node.key} related={!selectedNode || relatedKeys.has(node.key)} onSelect={() => onSelectNode(node.key)} /></div>)}</div><div className="structure-legend"><span><span className="legend-dot accent" />Selected gene</span><span><span className="legend-dot" />Content marker</span><span><span className="legend-dot muted" />Empty marker</span></div></div>
}
