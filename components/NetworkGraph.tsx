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

    const container = containerRef.current
    const width = container.clientWidth
    const height = 500 // Rectangle

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg.attr('width', width).attr('height', height)

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        hasUserZoomedRef.current = true
        g.attr('transform', event.transform.toString())
      })

    svg.call(zoom as any)

    const g = svg.append('g')

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
      .alphaDecay(hasPlayedInitialAnimationRef.current ? 0.3 : 0.05)
      .alpha(hasPlayedInitialAnimationRef.current ? 0.1 : 1)

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
        // Default: all nodes gray (unselected = no filter)
        // Selected nodes: green (#10b981) - same as filter buttons
        return selectedNodes.has(d.id) ? '#6ee7b7' : '#cbd5e1'
      })
      .attr('stroke', '#ffffff')
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

    // Update positions on simulation tick - no animation on click
    let hasFitted = false
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y)

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y)

      label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y)

      // After simulation settles, fit to bounds (only once, and only if user hasn't zoomed)
      if (!hasFitted && !initialZoomDoneRef.current && simulation.alpha() < 0.1) {
        hasFitted = true
        initialZoomDoneRef.current = true
        hasPlayedInitialAnimationRef.current = true
        // Stop the simulation completely after initial animation
        simulation.stop()
        setTimeout(() => {
          if (!hasUserZoomedRef.current) {
            try {
              const bounds = (g.node() as any).getBBox()
              const fullWidth = bounds.width || width
              const fullHeight = bounds.height || height
              const midX = bounds.x + fullWidth / 2
              const midY = bounds.y + fullHeight / 2
              
              const scale = Math.min(width / fullWidth, height / fullHeight, 1) * 0.45
              const translate = [width / 2 - scale * midX, height / 2 - scale * midY]
              
              svg.call(
                zoom.transform as any,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
              )
            } catch (e) {
              // Silently fail if bounds calculation fails
            }
          }
        }, 100)
      }
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
      // Default: all nodes gray (unselected = no filter)
      // Selected nodes: green (#10b981) - same as filter buttons
      return selectedNodes.has(d.id) ? '#10b981' : '#cbd5e1'
    })
  }, [selectedNodes]) // Only update colors, don't recreate graph

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Deal Network</h2>
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
