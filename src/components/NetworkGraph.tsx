"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { NetworkGraph as NetworkGraphData, GraphNode, GraphEdge } from "@/lib/graph/networkGraph"
import { cn } from "@/lib/utils"

type SimNode = GraphNode & {
  x: number
  y: number
  vx: number
  vy: number
  fx: number | null
  fy: number | null
}

type Props = {
  data: NetworkGraphData
  width?: number
  height?: number
  onNodeClick?: (node: GraphNode) => void
}

// Physics constants - tuned for stability with small graphs
const REPULSION = 400
const ATTRACTION = 0.08
const DAMPING = 0.7
const CENTER_GRAVITY = 0.02
const TARGET_DISTANCE = 120 // ideal distance between connected nodes
const VELOCITY_THRESHOLD = 0.1 // stop sim when movement is minimal

export default function NetworkGraph({ data, width = 600, height = 500, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const animationRef = useRef<number | null>(null)
  const [nodes, setNodes] = useState<SimNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null)
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Initialize nodes with positions
  useEffect(() => {
    const centerX = width / 2
    const centerY = height / 2

    const simNodes: SimNode[] = data.nodes.map((node, i) => {
      // Place current user at center, others in a circle
      const angle = (2 * Math.PI * i) / data.nodes.length
      const radius = node.isCurrentUser ? 0 : 150

      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      }
    })

    setNodes(simNodes)
    setEdges(data.edges)
  }, [data, width, height])

  // Physics simulation
  const simulate = useCallback(() => {
    setNodes((prevNodes) => {
      const newNodes = prevNodes.map((node) => ({ ...node }))
      const centerX = width / 2
      const centerY = height / 2

      let totalVelocity = 0

      // Apply forces
      for (let i = 0; i < newNodes.length; i++) {
        const node = newNodes[i]
        if (node.fx !== null) {
          node.x = node.fx
          node.y = node.fy!
          node.vx = 0
          node.vy = 0
          continue
        }

        let fx = 0
        let fy = 0

        // Repulsion from other nodes
        for (let j = 0; j < newNodes.length; j++) {
          if (i === j) continue
          const other = newNodes[j]
          const dx = node.x - other.x
          const dy = node.y - other.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          // Softer repulsion that scales with graph size
          const force = REPULSION / (dist * dist + 100)
          fx += (dx / dist) * force
          fy += (dy / dist) * force
        }

        // Attraction along edges - spring force toward target distance
        for (const edge of edges) {
          let other: SimNode | undefined
          if (edge.source === node.id) {
            other = newNodes.find((n) => n.id === edge.target)
          } else if (edge.target === node.id) {
            other = newNodes.find((n) => n.id === edge.source)
          }

          if (other) {
            const dx = other.x - node.x
            const dy = other.y - node.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            // Spring force: pull toward target distance
            const displacement = dist - TARGET_DISTANCE
            const strength = ATTRACTION * Math.min(edge.weight, 3)
            fx += (dx / dist) * displacement * strength
            fy += (dy / dist) * displacement * strength
          }
        }

        // Center gravity (keep graph centered)
        fx += (centerX - node.x) * CENTER_GRAVITY
        fy += (centerY - node.y) * CENTER_GRAVITY

        // Update velocity with damping
        node.vx = (node.vx + fx) * DAMPING
        node.vy = (node.vy + fy) * DAMPING

        // Clamp velocity
        const maxVel = 8
        const vel = Math.sqrt(node.vx * node.vx + node.vy * node.vy)
        if (vel > maxVel) {
          node.vx = (node.vx / vel) * maxVel
          node.vy = (node.vy / vel) * maxVel
        }

        totalVelocity += vel

        // Update position
        node.x += node.vx
        node.y += node.vy

        // Keep in bounds (with padding)
        const padding = 50
        node.x = Math.max(padding, Math.min(width - padding, node.x))
        node.y = Math.max(padding, Math.min(height - padding, node.y))
      }

      return newNodes
    })

    animationRef.current = requestAnimationFrame(simulate)
  }, [edges, width, height])

  // Start/stop simulation
  useEffect(() => {
    animationRef.current = requestAnimationFrame(simulate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [simulate])

  // Node drag handlers
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    setDraggedNode(nodeId)
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, fx: n.x, fy: n.y } : n
      )
    )
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left - transform.x) / transform.scale
      const y = (e.clientY - rect.top - transform.y) / transform.scale

      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggedNode ? { ...n, fx: x, fy: y, x, y } : n
        )
      )
    } else if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    if (draggedNode) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggedNode ? { ...n, fx: null, fy: null } : n
        )
      )
      setDraggedNode(null)
    }
    setIsPanning(false)
  }

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }

  // Zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.3, Math.min(3, transform.scale * scaleFactor))

    // Zoom toward mouse position
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const dx = mouseX - transform.x
      const dy = mouseY - transform.y
      const newX = mouseX - dx * (newScale / transform.scale)
      const newY = mouseY - dy * (newScale / transform.scale)

      setTransform({ x: newX, y: newY, scale: newScale })
    }
  }

  // Get node radius based on connections
  const getNodeRadius = (node: SimNode) => {
    const base = 20
    const connectionBonus = Math.min(node.connectionCount * 3, 15)
    return base + connectionBonus
  }

  // Get edge stroke width based on shared activities
  const getEdgeWidth = (edge: GraphEdge) => {
    return Math.min(1 + edge.weight * 1.5, 6)
  }

  // Check if edge is connected to hovered node
  const isEdgeHighlighted = (edge: GraphEdge) => {
    if (!hoveredNode) return false
    return edge.source === hoveredNode || edge.target === hoveredNode
  }

  // Check if node is connected to hovered node
  const isNodeHighlighted = (node: SimNode) => {
    if (!hoveredNode) return true
    if (node.id === hoveredNode) return true
    return edges.some(
      (e) =>
        (e.source === hoveredNode && e.target === node.id) ||
        (e.target === hoveredNode && e.source === node.id)
    )
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-stone-50 rounded-2xl border border-stone-200 cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleSvgMouseDown}
        onWheel={handleWheel}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const source = nodes.find((n) => n.id === edge.source)
            const target = nodes.find((n) => n.id === edge.target)
            if (!source || !target) return null

            const highlighted = isEdgeHighlighted(edge)
            const dimmed = hoveredNode && !highlighted

            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={highlighted ? "#57534e" : "#d6d3d1"}
                strokeWidth={getEdgeWidth(edge)}
                strokeOpacity={dimmed ? 0.2 : highlighted ? 1 : 0.6}
                className="transition-all duration-200"
                onMouseEnter={() => setHoveredEdge(edge)}
                onMouseLeave={() => setHoveredEdge(null)}
              />
            )
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const radius = getNodeRadius(node)
            const highlighted = isNodeHighlighted(node)
            const dimmed = hoveredNode && !highlighted

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={() => onNodeClick?.(node)}
                className="cursor-pointer"
              >
                {/* Node circle */}
                <circle
                  r={radius}
                  fill={node.isCurrentUser ? "#292524" : "#78716c"}
                  fillOpacity={dimmed ? 0.3 : 1}
                  stroke={hoveredNode === node.id ? "#292524" : "transparent"}
                  strokeWidth={3}
                  className="transition-all duration-200"
                />

                {/* Handle label */}
                <text
                  y={radius + 14}
                  textAnchor="middle"
                  fill="#57534e"
                  fontSize={11}
                  fontWeight={500}
                  opacity={dimmed ? 0.3 : 1}
                  className="pointer-events-none select-none"
                >
                  @{node.handle}
                </text>

                {/* Activity count inside node */}
                <text
                  y={4}
                  textAnchor="middle"
                  fill="white"
                  fontSize={12}
                  fontWeight={600}
                  opacity={dimmed ? 0.3 : 1}
                  className="pointer-events-none select-none"
                >
                  {node.activityCount}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Tooltip for hovered edge */}
      {hoveredEdge && (
        <div className="absolute bottom-4 left-4 bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-lg">
          <p className="text-xs font-medium text-stone-900">
            {hoveredEdge.weight} shared {hoveredEdge.weight === 1 ? "activity" : "activities"}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {hoveredEdge.sharedActivities.slice(0, 3).join(", ")}
            {hoveredEdge.sharedActivities.length > 3 && ` +${hoveredEdge.sharedActivities.length - 3} more`}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm border border-stone-200 rounded-xl px-3 py-2">
        <p className="text-xs text-stone-500">
          Node size = connections
        </p>
        <p className="text-xs text-stone-500">
          Line thickness = shared activities
        </p>
        <p className="text-xs text-stone-400 mt-1">
          Scroll to zoom, drag to pan
        </p>
      </div>
    </div>
  )
}
