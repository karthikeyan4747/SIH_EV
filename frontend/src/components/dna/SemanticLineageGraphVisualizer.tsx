import React, { useState, useRef, useMemo, useEffect } from 'react'
import {
  FileText,
  Layers,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Minimize2,
  RotateCcw,
  Filter,
  Activity,
  CheckCircle2,
} from 'lucide-react'
import type { Transformation } from '../../types/transformation'
import type { DNASectionKey } from './dnaData'
import './semanticLineageGraph.css'

interface SemanticLineageGraphVisualizerProps {
  transformation: Transformation
  selectedSectionKey?: DNASectionKey | null
  onSelectSection?: (key: DNASectionKey) => void
  className?: string
}

type NodeCategory = 'source' | 'semantic' | 'claim' | 'conflict' | 'output'

interface GraphNode {
  id: string
  label: string
  subtitle: string
  category: NodeCategory
  x: number
  y: number
  width: number
  height: number
  data: any
  badge?: string
}

interface GraphEdge {
  id: string
  from: string
  to: string
  isConflict?: boolean
  pathD?: string
}

export function SemanticLineageGraphVisualizer({
  transformation,
  selectedSectionKey,
  onSelectSection,
  className = '',
}: SemanticLineageGraphVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [filter, setFilter] = useState<'all' | NodeCategory>('all')
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Canvas activation state: only zoom on wheel if canvas is clicked/active, fullscreen, or holding Ctrl/Cmd
  const [isCanvasActive, setIsCanvasActive] = useState(false)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const scrollHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fullscreen toggle with HTML5 Fullscreen API + fallback
  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          setFullscreen(true)
        })
      } else {
        setFullscreen(true)
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      setFullscreen(false)
    }
  }

  // Synchronize fullscreen state on ESC or browser exit
  useEffect(() => {
    const handleFsChange = () => {
      setFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    document.addEventListener('webkitfullscreenchange', handleFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      document.removeEventListener('webkitfullscreenchange', handleFsChange)
    }
  }, [])

  // Deactivate canvas zoom when clicking outside
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsCanvasActive(false)
      }
    }
    document.addEventListener('mousedown', handleDocClick)
    return () => {
      document.removeEventListener('mousedown', handleDocClick)
    }
  }, [])

  // Debounced hover handlers to prevent jitter when cursor is between nodes
  const handleNodeMouseEnter = (nodeId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredNodeId(nodeId)
  }

  const handleNodeMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNodeId(null)
      hoverTimeoutRef.current = null
    }, 100)
  }

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      if (scrollHintTimerRef.current) clearTimeout(scrollHintTimerRef.current)
    }
  }, [])

  // Zoom & Pan state
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragMoved, setDragMoved] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  const dna = transformation.content_dna
  const integrity = transformation.source_integrity
  const sources = transformation.sources || []
  const outputs = transformation.outputs || []

  // Dynamic layout & Highly accurate data-driven relation graph
  const { nodes, edges, viewHeight } = useMemo(() => {
    const nodeList: GraphNode[] = []
    const edgeList: GraphEdge[] = []

    const X_SOURCES = 70
    const X_SEMANTIC = 360
    const X_CLAIMS = 670
    const X_OUTPUTS = 970

    const NODE_WIDTH = 200
    const NODE_HEIGHT = 48
    const VERTICAL_SPACING = 60

    // 1. Layer 1: Sources
    const sourceCount = sources.length
    const effectiveSourceCount = Math.max(sourceCount, 1)

    // 2. Layer 2: Semantic Knowledge Nodes
    const semanticKeys: { key: DNASectionKey; label: string; count: number }[] = [
      { key: 'identity', label: 'Identity & Purpose', count: dna?.identity?.title ? 1 : 0 },
      { key: 'overview', label: 'Executive Summary', count: dna?.overview?.summary ? 1 : 0 },
      { key: 'entities', label: 'Entities & Actors', count: (dna?.entities?.people?.length || 0) + (dna?.entities?.organizations?.length || 0) },
      { key: 'facts', label: 'Claims & Statistics', count: (dna?.facts?.claims?.length || 0) + (dna?.facts?.statistics?.length || 0) },
      { key: 'findings', label: 'Findings & Risks', count: (dna?.findings?.key_findings?.length || 0) + (dna?.findings?.risks?.length || 0) },
      { key: 'recommendations', label: 'Strategic Directives', count: dna?.recommendations?.recommendations?.length || 0 },
      { key: 'context', label: 'Context & Audience', count: dna?.context?.target_audience ? 1 : 0 },
      { key: 'evidence', label: 'Grounded Evidence', count: dna?.evidence?.supporting_excerpt ? 1 : 0 },
    ]

    // 3. Layer 3: Claims & Conflicts
    const claims = integrity?.claims || []
    const conflicts = integrity?.conflicts || []
    const displayClaims = claims.slice(0, 8)
    const effectiveClaimsCount = Math.max(displayClaims.length + conflicts.length, 1)

    // 4. Layer 4: Outputs
    const effectiveOutputsCount = Math.max(outputs.length, 1)

    // Determine max items in any layer to scale height dynamically
    const maxLayerCount = Math.max(effectiveSourceCount, semanticKeys.length, effectiveClaimsCount, effectiveOutputsCount)
    const computedHeight = Math.max(580, maxLayerCount * VERTICAL_SPACING + 100)

    // Position Layer 1: Sources (Center vertically)
    const sourceTotalHeight = sources.length * VERTICAL_SPACING
    const sourceStartY = Math.max(60, (computedHeight - sourceTotalHeight) / 2)

    if (sources.length === 0) {
      nodeList.push({
        id: 'src-empty',
        label: 'Awaiting Source Input',
        subtitle: 'Add text or PDF document',
        category: 'source',
        x: X_SOURCES,
        y: (computedHeight - NODE_HEIGHT) / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        badge: 'EMPTY',
        data: null,
      })
    } else {
      sources.forEach((src, idx) => {
        const nodeId = `src-${src.source_id}`
        nodeList.push({
          id: nodeId,
          label: src.title || `Source ${idx + 1}`,
          subtitle: `${src.source_type.toUpperCase()} • ${src.text.length.toLocaleString()} chars`,
          category: 'source',
          x: X_SOURCES,
          y: sourceStartY + idx * VERTICAL_SPACING,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          badge: 'RAW INPUT',
          data: src,
        })
      })
    }

    // Position Layer 2: Semantic Knowledge Nodes
    const semStartY = 50
    semanticKeys.forEach((item, idx) => {
      const nodeId = `sem-${item.key}`
      nodeList.push({
        id: nodeId,
        label: item.label,
        subtitle: `${item.count} extracted elements`,
        category: 'semantic',
        x: X_SEMANTIC,
        y: semStartY + idx * VERTICAL_SPACING,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        badge: 'SEMANTIC NODE',
        data: { section: item.key, data: dna ? (dna as any)[item.key] : null },
      })
    })

    // Data-driven accurate connections from Sources to Semantic Nodes
    if (sources.length === 0) {
      edgeList.push({
        id: 'edge-src-empty-sem-overview',
        from: 'src-empty',
        to: 'sem-overview',
      })
    } else {
      const people = dna?.entities?.people || []
      const orgs = dna?.entities?.organizations || []
      const allEntities = [...people, ...orgs]

      sources.forEach((src, sIdx) => {
        const srcTextLower = (src.text || '').toLowerCase()
        const connectedKeys = new Set<DNASectionKey>()

        // Core canonical overview & identity
        connectedKeys.add('overview')
        if (sIdx === 0) connectedKeys.add('identity')

        // Check if entities appear in this source text
        const hasEntity = allEntities.some((e) => {
          const name = typeof e === 'string' ? e : (e as any).name || ''
          return name.length > 2 && srcTextLower.includes(name.toLowerCase())
        })
        if (hasEntity || allEntities.length > 0) {
          connectedKeys.add('entities')
        }

        // Check if claims or facts originate from this source
        const srcClaims = claims.filter((c) => {
          if (c.source_ids?.includes(src.source_id)) return true
          if (c.evidence?.some((ev) => ev.source_id === src.source_id)) return true
          if (c.value && srcTextLower.includes(String(c.value).toLowerCase())) return true
          return false
        })
        if (srcClaims.length > 0 || (dna?.facts?.claims?.length || 0) > 0) {
          connectedKeys.add('facts')
        }

        // Check if conflicts involve this source
        const isConflictSource = conflicts.some((conf) => {
          if (conf.claim_ids?.some((cid) => srcClaims.some((c) => c.claim_id === cid))) return true
          return false
        })
        if (isConflictSource || (dna?.findings?.key_findings?.length || 0) > 0) {
          connectedKeys.add('findings')
        }

        // Recommendations & Evidence
        if ((dna?.recommendations?.recommendations?.length || 0) > 0) {
          connectedKeys.add('recommendations')
        }
        if (dna?.evidence?.supporting_excerpt) {
          connectedKeys.add('evidence')
        }

        connectedKeys.forEach((key) => {
          edgeList.push({
            id: `edge-src-${src.source_id}-sem-${key}`,
            from: `src-${src.source_id}`,
            to: `sem-${key}`,
          })
        })
      })
    }

    // Position Layer 3: Claims & Conflicts
    const claimTotalHeight = (conflicts.length + displayClaims.length) * VERTICAL_SPACING
    const claimStartY = Math.max(50, (computedHeight - claimTotalHeight) / 2)
    let claimIdx = 0

    // Conflicts first (Red)
    conflicts.forEach((conf) => {
      const nodeId = `conf-${conf.conflict_id}`
      nodeList.push({
        id: nodeId,
        label: `Dispute: ${conf.claim_key}`,
        subtitle: conf.description.length > 34 ? `${conf.description.slice(0, 34)}...` : conf.description,
        category: 'conflict',
        x: X_CLAIMS,
        y: claimStartY + claimIdx * VERTICAL_SPACING,
        width: NODE_WIDTH + 14,
        height: NODE_HEIGHT + 2,
        badge: 'DISPUTE DETECTED',
        data: conf,
      })

      // Link semantic facts & findings to conflict
      edgeList.push({
        id: `edge-sem-facts-conf-${conf.conflict_id}`,
        from: 'sem-facts',
        to: nodeId,
        isConflict: true,
      })
      edgeList.push({
        id: `edge-sem-findings-conf-${conf.conflict_id}`,
        from: 'sem-findings',
        to: nodeId,
        isConflict: true,
      })

      // If dispute mentions entity actors
      const people = dna?.entities?.people || []
      const orgs = dna?.entities?.organizations || []
      const allEntities = [...people, ...orgs]
      const confText = `${conf.claim_key} ${conf.description}`.toLowerCase()
      const involvesEntity = allEntities.some((e) => {
        const name = typeof e === 'string' ? e : (e as any).name || ''
        return name.length > 2 && confText.includes(name.toLowerCase())
      })
      if (involvesEntity) {
        edgeList.push({
          id: `edge-sem-entities-conf-${conf.conflict_id}`,
          from: 'sem-entities',
          to: nodeId,
          isConflict: true,
        })
      }

      claimIdx++
    })

    // Corroborated / Verified Claims (Green)
    displayClaims.forEach((claim) => {
      if (conflicts.some((c) => c.claim_ids.includes(claim.claim_id))) return

      const nodeId = `claim-${claim.claim_id}`
      nodeList.push({
        id: nodeId,
        label: `${claim.subject}: ${claim.value}`,
        subtitle: `Status: ${claim.status.toUpperCase()}`,
        category: 'claim',
        x: X_CLAIMS,
        y: claimStartY + claimIdx * VERTICAL_SPACING,
        width: NODE_WIDTH + 14,
        height: NODE_HEIGHT,
        badge: claim.status === 'corroborated' ? 'CORROBORATED' : 'VERIFIED',
        data: claim,
      })

      // Link semantic facts to claim
      edgeList.push({
        id: `edge-sem-facts-${nodeId}`,
        from: 'sem-facts',
        to: nodeId,
      })

      // If claim involves entity
      const people = dna?.entities?.people || []
      const orgs = dna?.entities?.organizations || []
      const allEntities = [...people, ...orgs]
      const claimText = `${claim.subject} ${claim.value}`.toLowerCase()
      const involvesEntity = allEntities.some((e) => {
        const name = typeof e === 'string' ? e : (e as any).name || ''
        return name.length > 2 && claimText.includes(name.toLowerCase())
      })
      if (involvesEntity) {
        edgeList.push({
          id: `edge-sem-entities-${nodeId}`,
          from: 'sem-entities',
          to: nodeId,
        })
      }

      // If claim has grounded evidence excerpt
      if (claim.evidence && claim.evidence.length > 0) {
        edgeList.push({
          id: `edge-sem-evidence-${nodeId}`,
          from: 'sem-evidence',
          to: nodeId,
        })
      }

      claimIdx++
    })

    // Position Layer 4: Outputs
    const outTotalHeight = outputs.length * VERTICAL_SPACING
    const outStartY = Math.max(60, (computedHeight - outTotalHeight) / 2)

    if (outputs.length === 0) {
      nodeList.push({
        id: 'out-empty',
        label: 'Awaiting Deliverable',
        subtitle: 'Generate presentation or brief',
        category: 'output',
        x: X_OUTPUTS,
        y: (computedHeight - NODE_HEIGHT) / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        badge: 'READY TO GENERATE',
        data: null,
      })
      edgeList.push({
        id: 'edge-sem-rec-out-empty',
        from: 'sem-recommendations',
        to: 'out-empty',
      })
    } else {
      outputs.forEach((art, idx) => {
        const nodeId = `out-${art.id}`
        nodeList.push({
          id: nodeId,
          label: art.type || `Artifact ${idx + 1}`,
          subtitle: `v${art.dna_version} • ${art.status.toUpperCase()}`,
          category: 'output',
          x: X_OUTPUTS,
          y: outStartY + idx * VERTICAL_SPACING,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          badge: 'VERIFIED ARTIFACT',
          data: art,
        })

        // Strategic recommendations feed output
        edgeList.push({
          id: `edge-sem-rec-${nodeId}`,
          from: 'sem-recommendations',
          to: nodeId,
        })

        // Executive overview feeds output
        edgeList.push({
          id: `edge-sem-overview-${nodeId}`,
          from: 'sem-overview',
          to: nodeId,
        })

        // Resolved conflicts feed output
        conflicts.forEach((conf) => {
          edgeList.push({
            id: `edge-conf-${conf.conflict_id}-${nodeId}`,
            from: `conf-${conf.conflict_id}`,
            to: nodeId,
            isConflict: true,
          })
        })

        // Verified claims feed output
        displayClaims.forEach((claim) => {
          if (!conflicts.some((c) => c.claim_ids.includes(claim.claim_id))) {
            edgeList.push({
              id: `edge-claim-${claim.claim_id}-${nodeId}`,
              from: `claim-${claim.claim_id}`,
              to: nodeId,
            })
          }
        })
      })
    }

    // Precalculate curved bezier paths for edges
    edgeList.forEach((edge) => {
      const fromNode = nodeList.find((n) => n.id === edge.from)
      const toNode = nodeList.find((n) => n.id === edge.to)
      if (fromNode && toNode) {
        const x1 = fromNode.x + fromNode.width
        const y1 = fromNode.y + fromNode.height / 2
        const x2 = toNode.x
        const y2 = toNode.y + toNode.height / 2
        const midX = (x1 + x2) / 2
        edge.pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
      }
    })

    return { nodes: nodeList, edges: edgeList, viewHeight: computedHeight }
  }, [sources, dna, integrity, outputs])

  // Directed DAG traversal for crisp, focused lineage tracing on hover
  const { activeNodeIds, activeEdgeIds, lineageBreadcrumb } = useMemo(() => {
    if (!hoveredNodeId) {
      return { activeNodeIds: new Set<string>(), activeEdgeIds: new Set<string>(), lineageBreadcrumb: null }
    }

    const nodeIds = new Set<string>([hoveredNodeId])
    const edgeIds = new Set<string>()

    // 1. Forward Traversal: Follow downstream directed edges
    const forwardQueue = [hoveredNodeId]
    const visitedForward = new Set<string>([hoveredNodeId])
    while (forwardQueue.length > 0) {
      const curr = forwardQueue.shift()!
      edges.forEach((edge) => {
        if (edge.from === curr) {
          edgeIds.add(edge.id)
          nodeIds.add(edge.to)
          if (!visitedForward.has(edge.to)) {
            visitedForward.add(edge.to)
            forwardQueue.push(edge.to)
          }
        }
      })
    }

    // 2. Backward Traversal: Follow upstream directed edges
    const backwardQueue = [hoveredNodeId]
    const visitedBackward = new Set<string>([hoveredNodeId])
    while (backwardQueue.length > 0) {
      const curr = backwardQueue.shift()!
      edges.forEach((edge) => {
        if (edge.to === curr) {
          edgeIds.add(edge.id)
          nodeIds.add(edge.from)
          if (!visitedBackward.has(edge.from)) {
            visitedBackward.add(edge.from)
            backwardQueue.push(edge.from)
          }
        }
      })
    }

    // Active path summary for floating trace breadcrumb
    const activeNodes = nodes.filter((n) => nodeIds.has(n.id))
    const srcCount = activeNodes.filter((n) => n.category === 'source').length
    const semCount = activeNodes.filter((n) => n.category === 'semantic').length
    const confCount = activeNodes.filter((n) => n.category === 'conflict').length
    const claimCount = activeNodes.filter((n) => n.category === 'claim').length
    const outCount = activeNodes.filter((n) => n.category === 'output').length

    const parts: string[] = []
    if (srcCount > 0) parts.push(`${srcCount} Source${srcCount > 1 ? 's' : ''}`)
    if (semCount > 0) parts.push(`${semCount} Semantic Node${semCount > 1 ? 's' : ''}`)
    if (confCount > 0) parts.push(`${confCount} Dispute${confCount > 1 ? 's' : ''}`)
    if (claimCount > 0) parts.push(`${claimCount} Fact${claimCount > 1 ? 's' : ''}`)
    if (outCount > 0) parts.push(`${outCount} Deliverable${outCount > 1 ? 's' : ''}`)

    return {
      activeNodeIds: nodeIds,
      activeEdgeIds: edgeIds,
      lineageBreadcrumb: parts.join(' ➔ '),
    }
  }, [hoveredNodeId, edges, nodes])

  // Pan & Zoom controls
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    setIsCanvasActive(true)
    setIsDragging(true)
    setDragMoved(false)
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setDragMoved(true)
    }
    const svgRect = svgRef.current?.getBoundingClientRect()
    const ratioX = svgRect && svgRect.width > 0 ? 1240 / svgRect.width : 1
    const ratioY = svgRect && svgRect.height > 0 ? viewHeight / svgRect.height : 1

    setPan({
      x: dragStartRef.current.panX + dx * ratioX,
      y: dragStartRef.current.panY + dy * ratioY,
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false)
      dragStartRef.current = null
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      } catch {
        // ignore
      }
    }
  }

  // Native non-passive wheel listener for smooth two-finger panning and Ctrl/Cmd-zoom
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onWheelNative = (e: WheelEvent) => {
      if (isCanvasActive || fullscreen || e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const svgRect = svgRef.current?.getBoundingClientRect()
        const ratioX = svgRect && svgRect.width > 0 ? 1240 / svgRect.width : 1
        const ratioY = svgRect && svgRect.height > 0 ? viewHeight / svgRect.height : 1

        if (e.ctrlKey || e.metaKey) {
          // Pinch or Ctrl/Cmd + wheel -> Zoom smoothly
          const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08
          setScale((prev) => Math.min(Math.max(prev * zoomFactor, 0.35), 3.0))
        } else {
          // Two-finger trackpad swipe or wheel -> Pan in X and Y
          setPan((prev) => ({
            x: prev.x - e.deltaX * ratioX,
            y: prev.y - e.deltaY * ratioY,
          }))
        }
      } else {
        setShowScrollHint(true)
        if (scrollHintTimerRef.current) clearTimeout(scrollHintTimerRef.current)
        scrollHintTimerRef.current = setTimeout(() => {
          setShowScrollHint(false)
          scrollHintTimerRef.current = null
        }, 2200)
      }
    }

    el.addEventListener('wheel', onWheelNative, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheelNative)
    }
  }, [isCanvasActive, fullscreen, viewHeight])

  // Keyboard arrow navigation for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCanvasActive && !fullscreen) return
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      const PAN_STEP = 70
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPan((p) => ({ ...p, x: p.x + PAN_STEP }))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setPan((p) => ({ ...p, x: p.x - PAN_STEP }))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPan((p) => ({ ...p, y: p.y + PAN_STEP }))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPan((p) => ({ ...p, y: p.y - PAN_STEP }))
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setScale((s) => Math.min(s + 0.15, 3.0))
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        setScale((s) => Math.max(s - 0.15, 0.35))
      } else if (e.key === '0' || e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        resetTransform()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCanvasActive, fullscreen])

  const resetTransform = () => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  const filteredNodes = useMemo(() => {
    if (filter === 'all') return nodes
    if (filter === 'claim') return nodes.filter((n) => n.category === 'claim' || n.category === 'conflict')
    return nodes.filter((n) => n.category === filter)
  }, [nodes, filter])

  // Key stats
  const activeDisputes = integrity?.conflicts.filter((c) => c.status !== 'resolved').length || 0
  const verifiedClaimsCount = integrity?.claims.length || 0

  return (
    <div
      ref={containerRef}
      className={`lineage-graph-container ${fullscreen ? 'fullscreen' : ''} ${className}`}
    >
      {/* Top Glassmorphism Toolbar */}
      <div className="lineage-graph-toolbar">
        <div className="lineage-graph-title">
          <span className="pulse-dot" />
          <span>Semantic Lineage Graph</span>
          <span className="lineage-stats-pill">
            <Activity size={10} color="#38bdf8" />
            {nodes.length} Nodes • {edges.length} Flowlines
          </span>
          {activeDisputes > 0 ? (
            <span className="lineage-dispute-pill">
              <ShieldAlert size={10} /> {activeDisputes} Dispute{activeDisputes === 1 ? '' : 's'}
            </span>
          ) : verifiedClaimsCount > 0 ? (
            <span className="lineage-verified-pill">
              <CheckCircle2 size={10} /> {verifiedClaimsCount} Facts Verified
            </span>
          ) : null}
        </div>

        {lineageBreadcrumb && (
          <div className="lineage-active-trace-pill">
            <span className="trace-dot" />
            <span>Active Trace: <strong>{lineageBreadcrumb}</strong></span>
          </div>
        )}

        {/* Category Filters */}
        <div className="lineage-filters">
          <span style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Filter size={10} /> View:
          </span>
          <button
            type="button"
            className={`lineage-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`lineage-filter-btn ${filter === 'source' ? 'active' : ''}`}
            onClick={() => setFilter('source')}
          >
            Sources ({sources.length})
          </button>
          <button
            type="button"
            className={`lineage-filter-btn ${filter === 'semantic' ? 'active' : ''}`}
            onClick={() => setFilter('semantic')}
          >
            Semantic Nodes (8)
          </button>
          <button
            type="button"
            className={`lineage-filter-btn ${filter === 'claim' ? 'active' : ''}`}
            onClick={() => setFilter('claim')}
          >
            Claims ({integrity?.claims.length || 0})
          </button>
          <button
            type="button"
            className={`lineage-filter-btn ${filter === 'output' ? 'active' : ''}`}
            onClick={() => setFilter('output')}
          >
            Deliverables ({outputs.length})
          </button>
        </div>

        {/* Zoom & Pan View Controls */}
        <div className="lineage-controls">
          <button
            type="button"
            className="lineage-ctrl-btn"
            title="Pan Left (←)"
            onClick={() => setPan((p) => ({ ...p, x: p.x + 80 }))}
          >
            <ArrowLeft size={13} />
          </button>
          <button
            type="button"
            className="lineage-ctrl-btn"
            title="Pan Right (→)"
            onClick={() => setPan((p) => ({ ...p, x: p.x - 80 }))}
          >
            <ArrowRight size={13} />
          </button>
          <button
            type="button"
            className="lineage-ctrl-btn"
            title="Pan Up (↑)"
            onClick={() => setPan((p) => ({ ...p, y: p.y + 80 }))}
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            className="lineage-ctrl-btn"
            title="Pan Down (↓)"
            onClick={() => setPan((p) => ({ ...p, y: p.y - 80 }))}
          >
            <ArrowDown size={13} />
          </button>
          <div className="lineage-ctrl-divider" />
          <button
            type="button"
            className="lineage-ctrl-btn"
            title="Zoom In (+)"
            onClick={() => setScale((s) => Math.min(s + 0.15, 3.0))}
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="lineage-ctrl-btn"
            title="Zoom Out (-)"
            onClick={() => setScale((s) => Math.max(s - 0.15, 0.35))}
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="lineage-ctrl-btn"
            title="Reset Pan & Zoom (R)"
            onClick={resetTransform}
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            className="lineage-ctrl-btn"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen Presentation Canvas'}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* SVG Canvas Viewport */}
      <div
        ref={viewportRef}
        className={`lineage-canvas-viewport ${isDragging ? 'dragging' : ''}`}
        onClick={() => setIsCanvasActive(true)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Scroll / Zoom Activation Notifications */}
        {showScrollHint && !isCanvasActive && (
          <div className="lineage-zoom-hint-banner">
            <span>💡 Click canvas to enable pan & zoom, or hold <strong>Ctrl / ⌘</strong> while scrolling</span>
          </div>
        )}
        {isCanvasActive && !fullscreen && (
          <div className="lineage-zoom-hint-banner active-mode">
            <span>⚡ Interactive Canvas Active • Drag or Arrow Keys to Pan • Ctrl+Scroll to Zoom</span>
          </div>
        )}
        <svg
          ref={svgRef}
          className="lineage-svg"
          viewBox={`0 0 1240 ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="edge-grad-normal" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#818cf8" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="edge-grad-conflict" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f87171" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
            </linearGradient>

            <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Canvas Transform Group */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Layer Column Background Guidelines & Headers */}
            <g className="lineage-layer-headers">
              <text x="170" y="24" textAnchor="middle" className="lineage-layer-header">
                01 • Raw Evidence Sources
              </text>
              <text x="460" y="24" textAnchor="middle" className="lineage-layer-header">
                02 • Canonical Semantic Nodes
              </text>
              <text x="777" y="24" textAnchor="middle" className="lineage-layer-header">
                03 • Claims & Integrity Verification
              </text>
              <text x="1070" y="24" textAnchor="middle" className="lineage-layer-header">
                04 • Verified Deliverables
              </text>

              {/* Vertical guideline separators */}
              <line x1="285" y1="35" x2="285" y2={viewHeight - 30} className="lineage-grid-line" />
              <line x1="585" y1="35" x2="585" y2={viewHeight - 30} className="lineage-grid-line" />
              <line x1="895" y1="35" x2="895" y2={viewHeight - 30} className="lineage-grid-line" />
            </g>

            {/* Lineage Edges Layer */}
            <g className="lineage-edges-layer">
              {edges.map((edge) => {
                if (!edge.pathD) return null

                const isHighlighted = hoveredNodeId ? activeEdgeIds.has(edge.id) : false
                const isDimmed = hoveredNodeId ? !isHighlighted : false

                return (
                  <path
                    key={edge.id}
                    d={edge.pathD}
                    className={`lineage-edge ${edge.isConflict ? 'conflict-edge' : ''} ${
                      isHighlighted ? 'highlighted' : ''
                    } ${isDimmed ? 'dimmed' : ''}`}
                  />
                )
              })}
            </g>

            {/* Nodes Layer */}
            <g className="lineage-nodes-layer">
              {filteredNodes.map((node) => {
                const isHighlighted = hoveredNodeId ? activeNodeIds.has(node.id) : false
                const isDimmed = hoveredNodeId ? !isHighlighted : false
                const isSelected = selectedSectionKey && node.id === `sem-${selectedSectionKey}`

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className={`lineage-node-group node-${node.category} ${
                      isSelected ? 'selected' : ''
                    } ${isHighlighted ? 'highlighted' : ''} ${isDimmed ? 'dimmed' : ''}`}
                    onMouseEnter={() => handleNodeMouseEnter(node.id)}
                    onMouseLeave={handleNodeMouseLeave}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (dragMoved) return
                      if (node.category === 'semantic' && onSelectSection) {
                        onSelectSection(node.data.section)
                      }
                    }}
                  >
                    {/* Node Box */}
                    <rect
                      width={node.width}
                      height={node.height}
                      className="lineage-node-bg"
                    />

                    {/* Node Icon */}
                    <g transform="translate(10, 16)">
                      {node.category === 'source' && <FileText size={15} color="#38bdf8" />}
                      {node.category === 'semantic' && <Layers size={15} color="#818cf8" />}
                      {node.category === 'claim' && <ShieldCheck size={15} color="#34d399" />}
                      {node.category === 'conflict' && <ShieldAlert size={15} color="#f87171" />}
                      {node.category === 'output' && <BookOpen size={15} color="#2dd4bf" />}
                    </g>

                    {/* Node Text */}
                    <text x="34" y="20" className="lineage-node-title">
                      {node.label.length > 22 ? `${node.label.slice(0, 22)}...` : node.label}
                    </text>
                    <text x="34" y="36" className="lineage-node-sub">
                      {node.subtitle}
                    </text>

                    {/* Category Tag Badge */}
                    {node.badge && (() => {
                      const bw = Math.min(node.width - 70, Math.max(52, node.badge.length * 5.2 + 10))
                      const bx = node.width - bw - 8
                      const tx = bx + bw / 2
                      return (
                        <>
                          <rect
                            x={bx}
                            y={6}
                            width={bw}
                            height={13}
                            rx={3}
                            fill={
                              node.category === 'conflict'
                                ? 'rgba(239, 68, 68, 0.3)'
                                : node.category === 'claim'
                                ? 'rgba(16, 185, 129, 0.3)'
                                : 'rgba(56, 189, 248, 0.18)'
                            }
                          />
                          <text
                            x={tx}
                            y={15.5}
                            textAnchor="middle"
                            className="lineage-node-badge"
                            fill={
                              node.category === 'conflict'
                                ? '#fca5a5'
                                : node.category === 'claim'
                                ? '#6ee7b7'
                                : '#7dd3fc'
                            }
                          >
                            {node.badge}
                          </text>
                        </>
                      )
                    })()}
                  </g>
                )
              })}
            </g>
          </g>
        </svg>
      </div>

      {/* Legend Footer */}
      <div className="lineage-legend">
        <div className="lineage-legend-item">
          <span className="lineage-legend-dot" style={{ background: '#38bdf8' }} />
          <span>Raw Evidence Source</span>
        </div>
        <div className="lineage-legend-item">
          <span className="lineage-legend-dot" style={{ background: '#818cf8' }} />
          <span>Canonical Semantic Node</span>
        </div>
        <div className="lineage-legend-item">
          <span className="lineage-legend-dot" style={{ background: '#34d399' }} />
          <span>Corroborated Fact</span>
        </div>
        <div className="lineage-legend-item">
          <span className="lineage-legend-dot" style={{ background: '#ef4444' }} />
          <span>Contradiction Dispute</span>
        </div>
        <div className="lineage-legend-item">
          <span className="lineage-legend-dot" style={{ background: '#2dd4bf' }} />
          <span>Verified Deliverable</span>
        </div>
      </div>

    </div>
  )
}
