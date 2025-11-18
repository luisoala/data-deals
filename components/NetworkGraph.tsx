'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { Deal } from '@/app/page'

interface NetworkGraphProps {
  deals: Deal[]
  stats: any
  selectedNodes: Set<string>
  onNodeToggle: (node: string) => void
  onResetFilters: () => void
}

export default function NetworkGraph({
  deals,
  stats,
  selectedNodes,
  onNodeToggle,
  onResetFilters,
}: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasUserZoomedRef = useRef(false)
  const initialZoomDoneRef = useRef(false)
  const hasPlayedInitialAnimationRef = useRef(false)
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null)
  const nodesRef = useRef<any[]>([])
  const nodeElementsRef = useRef<d3.Selection<SVGCircleElement, any, SVGGElement, unknown> | null>(null)

  // Initial graph setup - only runs when deals or stats change
  useEffect(() => {
    if (!svgRef.current || !stats || !containerRef.current) return

    const INITIAL_ZOOM_MULTIPLIER = 1.5 // Zoom in to focus on OpenAI cluster
    const INITIAL_SIMULATION_TICKS = 800

    const container = containerRef.current
    const width = container.clientWidth
    const height = 500 // Rectangle

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg.attr('width', width).attr('height', height)

    const g = svg.append('g')

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3]) // Increased minimum to prevent graph disappearing
      .translateExtent([[-width * 2, -height * 2], [width * 3, height * 3]]) // Constrain panning
      .on('zoom', (event) => {
        // Always update transform, but track user interaction
        const transform = event.transform
        g.attr('transform', transform.toString())
        // Mark as user zoomed only after initial zoom is done
        if (initialZoomDoneRef.current) {
          hasUserZoomedRef.current = true
        }
      })

    svg.call(zoom as any)

    const applyInitialZoom = () => {
      if (initialZoomDoneRef.current) return
      try {
        // Find OpenAI node to center on (D3 adds x, y properties during simulation)
        const openAINode = nodes.find(n => n.id === 'OpenAI') as any
        
        console.log('applyInitialZoom called', { 
          nodeCount: nodes.length, 
          openAIFound: !!openAINode,
          openAIX: openAINode?.x,
          openAIY: openAINode?.y,
          hasCoords: openAINode && typeof openAINode.x === 'number' && typeof openAINode.y === 'number'
        })
        
        if (openAINode && typeof openAINode.x === 'number' && typeof openAINode.y === 'number' && 
            isFinite(openAINode.x) && isFinite(openAINode.y)) {
          // Center on OpenAI node with fixed zoom level
          const targetX = openAINode.x
          const targetY = openAINode.y
          
          // Use a fixed scale that zooms in nicely on the cluster
          const fixedScale = INITIAL_ZOOM_MULTIPLIER
          const clampedScale = Math.max(0.1, Math.min(3, fixedScale))
          
          // Center on OpenAI node
          const translate = [width / 2 - clampedScale * targetX, height / 2 - clampedScale * targetY]

          console.log('Applying zoom to OpenAI:', { targetX, targetY, scale: clampedScale, translate, width, height })

          svg.call(
            zoom.transform as any,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(clampedScale)
          )
          
          // Only mark as done if we successfully applied zoom
          initialZoomDoneRef.current = true
        } else {
          // Fallback to full graph bounds if OpenAI not found
          const bounds = (g.node() as any).getBBox()
          const fullWidth = bounds.width || 0
          const fullHeight = bounds.height || 0

          if (fullWidth <= 0 || fullHeight <= 0 || !isFinite(fullWidth) || !isFinite(fullHeight)) {
            return
          }

          const midX = bounds.x + fullWidth / 2
          const midY = bounds.y + fullHeight / 2

          const baseScale = Math.min(width / fullWidth, height / fullHeight)
          const scale = baseScale * INITIAL_ZOOM_MULTIPLIER
          const clampedScale = Math.max(0.1, Math.min(3, scale))
          
          const translate = [width / 2 - clampedScale * midX, height / 2 - clampedScale * midY]

          svg.call(
            zoom.transform as any,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(clampedScale)
          )
        }

        initialZoomDoneRef.current = true
      } catch (error) {
        console.error('Failed to apply initial zoom:', error)
      }
    }

    // Create nodes map - count total deals per entity (as buyer OR seller)
    const nodesMap = new Map<string, { name: string; count: number }>()
    
    deals.forEach(deal => {
      const receiver = deal.data_receiver
      const aggregator = deal.data_aggregator

      if (!nodesMap.has(receiver)) {
        nodesMap.set(receiver, { name: receiver, count: 0 })
      }
      if (!nodesMap.has(aggregator)) {
        nodesMap.set(aggregator, { name: aggregator, count: 0 })
      }

      nodesMap.get(receiver)!.count++
      nodesMap.get(aggregator)!.count++
    })

    const nodes = Array.from(nodesMap.values()).map((node, i) => ({
      id: node.name,
      ...node,
      index: i,
    }))

    // Create links with direction and count - count actual transactions
    const linkMap = new Map<string, { source: string; target: string; count: number }>()
    deals.forEach(deal => {
      const key = `${deal.data_aggregator}->${deal.data_receiver}`
      if (!linkMap.has(key)) {
        linkMap.set(key, {
          source: deal.data_aggregator,
          target: deal.data_receiver,
          count: 0,
        })
      }
      linkMap.get(key)!.count++
    })

    const links = Array.from(linkMap.values()).map(link => ({
      source: nodes.find(n => n.id === link.source)?.index || 0,
      target: nodes.find(n => n.id === link.target)?.index || 0,
      count: link.count,
    })).filter(link => link.source !== undefined && link.target !== undefined)

    // Create force simulation with better spacing
    // Only use high alpha for initial animation, then use lower alpha for subsequent updates
    const simulation = d3
      .forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.index).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => Math.sqrt(d.count) * 4 + 12))
      .alphaDecay(hasPlayedInitialAnimationRef.current ? 0.3 : 0.02)
      .alpha(hasPlayedInitialAnimationRef.current ? 0.1 : 1)
      .velocityDecay(0.4)

    // Draw links with arrows - thin edges, no scaling
    const defs = g.append('defs')
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -2 4 4')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-2L4,0L0,2')
      .attr('fill', '#94a3b8')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 0.5)

    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5) // Thin, constant width
      .attr('marker-end', 'url(#arrowhead)')

    // Draw nodes - all same color, size by count
    const node = g
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d: any) => Math.sqrt(d.count) * 2.5 + 8)
          .attr('fill', (d: any) => {
            // Default: all nodes gray (unselected = no filter) - same as reset filter button
            // Selected nodes: green (#4ade80) - same as filter buttons
            return selectedNodes.has(d.id) ? '#4ade80' : '#f3f4f6'
          })
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGCircleElement, any>()
          .on('start', (event, d: any) => {
            if (!event.active && simulationRef.current) {
              // Only restart simulation if it was stopped
              if (simulationRef.current.alpha() === 0) {
                simulationRef.current.alpha(0.1).restart()
              } else {
                simulationRef.current.alphaTarget(0.1).restart()
              }
            }
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d: any) => {
            d.fx = event.x
            d.fy = event.y
            // Update positions immediately during drag
            if (simulationRef.current) {
              simulationRef.current.tick()
            }
          })
          .on('end', (event, d: any) => {
            if (!event.active && simulationRef.current) {
              simulationRef.current.alphaTarget(0)
            }
            d.fx = null
            d.fy = null
          }) as any
      )
      .on('click', (event, d: any) => {
        event.stopPropagation()
        onNodeToggle(d.id)
      })

    // Add labels
    const label = g
      .append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d: any) => d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name)
      .attr('font-size', '11px')
      .attr('fill', '#1e293b')
      .attr('dx', 12)
      .attr('dy', 4)
      .style('pointer-events', 'none')
      .style('font-weight', '500')

    let zoomApplied = false
    
    const updatePositions = () => {
      link
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y)

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y)

      label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y)
    }

    // Update positions on simulation tick
    simulation.on('tick', updatePositions)

    // Run several ticks synchronously so we have usable coordinates before applying zoom
    for (let i = 0; i < INITIAL_SIMULATION_TICKS; i++) {
      simulation.tick()
    }
    updatePositions()
    
    // Force stop simulation completely
    simulation.stop()
    simulation.alpha(0)
    simulation.alphaTarget(0)
    
    // Apply zoom synchronously right after simulation stops
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const openAINode = nodes.find(n => n.id === 'OpenAI') as any
        
        if (openAINode && typeof openAINode.x === 'number' && typeof openAINode.y === 'number' && 
            isFinite(openAINode.x) && isFinite(openAINode.y)) {
          const targetX = openAINode.x
          const targetY = openAINode.y
          const fixedScale = INITIAL_ZOOM_MULTIPLIER
          const clampedScale = Math.max(0.1, Math.min(3, fixedScale))
          const translate = [width / 2 - clampedScale * targetX, height / 2 - clampedScale * targetY]
          
          // Apply transform directly without going through zoom handler
          const transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(clampedScale)
          g.attr('transform', transform.toString())
          
          // Update zoom's internal state
          svg.call(zoom.transform as any, transform)
          
          initialZoomDoneRef.current = true
          console.log('Applied OpenAI zoom:', { targetX, targetY, scale: clampedScale, translate })
        } else {
          console.log('OpenAI not ready:', { found: !!openAINode, x: openAINode?.x, y: openAINode?.y })
        }
      })
    })

    // Store references for later updates
    simulationRef.current = simulation
    nodesRef.current = nodes
    nodeElementsRef.current = node

    // Reset zoom on double click
    svg.on('dblclick.zoom', null)
    svg.on('dblclick', () => {
      svg.transition().duration(750).call(
        zoom.transform as any,
        d3.zoomIdentity
      )
    })
  }, [deals, stats]) // Only recreate graph when deals or stats change

  // Update node colors when selection changes - without restarting simulation
  useEffect(() => {
    if (!nodeElementsRef.current || !svgRef.current) return
    
    // Update colors without restarting simulation
    nodeElementsRef.current.attr('fill', (d: any) => {
      // Default: all nodes gray (unselected = no filter) - same as reset filter button
      // Selected nodes: green (#4ade80) - same as filter buttons
      return selectedNodes.has(d.id) ? '#4ade80' : '#f3f4f6'
    })
  }, [selectedNodes]) // Only update colors, don't recreate graph

  return (
    <div>
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Deal Network</h2>
        {/* Vertical Separator */}
        <div className="hidden lg:block border-l border-gray-300 flex-shrink-0 h-6"></div>
        {/* Disclaimer */}
        <div className="text-xs text-gray-500 flex-1">
          <strong>Disclaimer:</strong> Our listings comprise publicly disclosed deals and public filings. However, many transactions are private or under NDA, so our dataset likely undercounts and our classification necessarily simplifies heterogeneous contracts. While we provide a transparent table, completeness cannot be assumed. If you know additional public information of data deals in AI please add them below.
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-4">
        Select nodes to filter the deal table.
      </div>
      <div ref={containerRef} className="w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50" style={{ height: '500px' }}>
        <svg ref={svgRef} className="w-full h-full"></svg>
      </div>
    </div>
  )
}
