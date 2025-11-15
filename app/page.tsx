'use client'

import { useState, useEffect } from 'react'
import NetworkGraph from '@/components/NetworkGraph'
import Filters from '@/components/Filters'
import DealsTable from '@/components/DealsTable'
import SuggestionModal from '@/components/SuggestionModal'
import Link from 'next/link'
import Image from 'next/image'

export interface Deal {
  id: number
  data_receiver: string
  data_aggregator: string
  ref: string
  date: number
  type: string
  value_raw: string
  value_min: number | null
  value_max: number | null
  value_unit: string | null
  codes: string[]
  source_url: string | null
}

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([])
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [filters, setFilters] = useState({
    yearMin: 2016,
    yearMax: 2025,
    valueMin: -1, // Start with Undisclosed included
    valueMax: 0, // Will be set from stats
    types: [] as string[],
    codes: [] as string[],
  })
  const [stats, setStats] = useState<any>(null)
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  // Snap value to nearest step for value slider
  const snapToValueStep = (value: number): number => {
    if (value < 0) return -1
    const steps = [75, 150, 225, 300]
    // Find closest step
    let closest = steps[0]
    let minDist = Math.abs(value - closest)
    for (const step of steps) {
      const dist = Math.abs(value - step)
      if (dist < minDist) {
        minDist = dist
        closest = step
      }
    }
    // If value is between Undisclosed and first step, snap to first step
    if (value >= 0 && value < steps[0] / 2) {
      return steps[0]
    }
    return closest
  }

  useEffect(() => {
    fetch('/api/deals')
      .then(res => res.json())
      .then(data => {
        setDeals(data)
        setFilteredDeals(data)
      })

    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data)
        // Set initial value max from stats, clamped to stepped slider max (300) and snapped to nearest step
        const rawValueMax = Math.min(300, data.valueRange.max)
        const snappedValueMax = snapToValueStep(rawValueMax)
        setFilters(prev => ({
          ...prev,
          valueMin: -1, // Include Undisclosed by default
          valueMax: snappedValueMax,
        }))
      })
  }, [])

  useEffect(() => {
    applyFilters()
  }, [deals, selectedNodes, filters, searchQuery])

  const applyFilters = () => {
    let filtered = [...deals]

    // Filter by selected nodes - if none selected, show all (no filter)
    // If nodes selected, only show deals with those nodes
    if (selectedNodes.size > 0) {
      filtered = filtered.filter(
        deal =>
          selectedNodes.has(deal.data_receiver) ||
          selectedNodes.has(deal.data_aggregator)
      )
    }
    // If selectedNodes.size === 0, show all deals (no filter)

    // Filter by year
    filtered = filtered.filter(
      deal => deal.date >= filters.yearMin && deal.date <= filters.yearMax
    )

    // Filter by value
    filtered = filtered.filter(deal => {
      // Handle "Undisclosed" deals (valueMin < 0 means Undisclosed is included)
      if (deal.value_min === null && deal.value_max === null) {
        return filters.valueMin < 0 // Include if Undisclosed is in range
      }
      // For disclosed deals, convert from dollars to millions and check if they overlap with the filter range
      const dealMin = (deal.value_min || 0) / 1000000 // Convert to millions
      const dealMax = (deal.value_max || dealMin) / 1000000 // Convert to millions
      const filterMin = filters.valueMin < 0 ? 0 : filters.valueMin
      return (
        (dealMin >= filterMin && dealMin <= filters.valueMax) ||
        (dealMax >= filterMin && dealMax <= filters.valueMax) ||
        (dealMin <= filterMin && dealMax >= filters.valueMax)
      )
    })

    // Filter by types
    if (filters.types.length > 0) {
      filtered = filtered.filter(deal => filters.types.includes(deal.type))
    }

    // Filter by codes
    if (filters.codes.length > 0) {
      filtered = filtered.filter(deal =>
        deal.codes.some(code => filters.codes.includes(code))
      )
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(deal =>
        deal.data_receiver.toLowerCase().includes(query) ||
        deal.data_aggregator.toLowerCase().includes(query) ||
        deal.type.toLowerCase().includes(query) ||
        deal.value_raw.toLowerCase().includes(query) ||
        deal.codes.some(code => code.toLowerCase().includes(query))
      )
    }

    setFilteredDeals(filtered)
  }

  const resetAllFilters = () => {
    setSelectedNodes(new Set())
    setSearchQuery('')
    // Snap valueMax to nearest step
    const rawValueMax = stats ? Math.min(300, stats.valueRange.max) : 300
    const snappedValueMax = snapToValueStep(rawValueMax)
    setFilters({
      yearMin: 2016,
      yearMax: 2025,
      valueMin: -1, // Include Undisclosed
      valueMax: snappedValueMax, // Snapped to nearest step
      types: [],
      codes: [],
    })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Data Deals</h1>
                <p className="text-gray-600">
                  Interactive explorer
                </p>
              </div>
              
              {/* Vertical Separator */}
              <div className="hidden lg:block border-l border-gray-300 flex-shrink-0"></div>
              
              {/* Paper Info Box */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-[3fr_auto] gap-4 lg:gap-6">
                {/* Column 1: Paper Title + Links */}
                <div className="flex flex-col">
                  <h2 className="font-bold text-gray-900 text-sm leading-tight">
                    A Sustainable AI Economy Needs
                  </h2>
                  <h2 className="font-bold text-gray-900 text-sm leading-tight">
                    Data Deals That Work for Generators
                  </h2>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  <a 
                    href="https://openreview.net/pdf?id=mdKzkjY1dM" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    Paper
                  </a>
                  <a 
                    href="https://neurips.cc/virtual/2025/loc/san-diego/poster/121926" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    NeurIPS Poster
                  </a>
                  <a 
                    href="https://recorder-v3.slideslive.com/?share=107281&s=9746fb43-083d-4e57-a960-15a4e3fb26d8" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    Video
                  </a>
                  <a 
                    href="https://docs.google.com/presentation/d/1gk3LhmmyvB9qs5wWdLMOdmmoGd7u2LDO-vnSBN89MBQ/edit?usp=sharing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    Slides
                  </a>
                  </div>
                </div>
                
                {/* Column 2: Authors + Logos */}
                <div className="flex items-center gap-4">
                  {/* Authors - narrower column */}
                  <div className="flex flex-col max-w-xs">
                    <p className="text-gray-700 text-sm leading-relaxed">
                      Ruoxi Jia, Luis Oala, Wenjie Xiong, Suqin Ge, Jiachen T. Wang, Feiyang Kang, Dawn Song
                    </p>
                  </div>
                  
                  {/* Logos 1 */}
                  <div className="flex items-center">
                    <Image 
                      src="/logos/logos1.png" 
                      alt="Institutional logos" 
                      width={200}
                      height={64}
                      className="h-auto max-h-16 object-contain"
                    />
                  </div>
                  
                  {/* Vertical Separator */}
                  <div className="hidden lg:block border-l border-gray-300 flex-shrink-0 h-16 mx-4"></div>
                  
                  {/* Logos 2 */}
                  <div className="flex items-center flex-shrink-0">
                    <Image 
                      src="/logos/logos2.png" 
                      alt="NeurIPS logo" 
                      width={120}
                      height={64}
                      className="h-auto max-h-16 object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {stats && (
          <>
            {/* Network Graph with Filters */}
            <div className="mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <NetworkGraph
                  deals={deals}
                  stats={stats}
                  selectedNodes={selectedNodes}
                  onNodeToggle={(node) => {
                    setSelectedNodes(prev => {
                      const newSet = new Set(prev)
                      if (newSet.has(node)) {
                        newSet.delete(node)
                      } else {
                        newSet.add(node)
                      }
                      return newSet
                    })
                  }}
                  onResetFilters={resetAllFilters}
                />
                
                {/* Filters inside graph box */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <Filters
                    stats={stats}
                    filters={filters}
                    onFiltersChange={setFilters}
                    onResetFilters={resetAllFilters}
                  />
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="space-y-4">

              <DealsTable
                deals={filteredDeals}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onEdit={(deal) => {
                  setEditingDeal(deal)
                  setSuggestionModalOpen(true)
                }}
                onAddNew={() => {
                  setEditingDeal(null)
                  setSuggestionModalOpen(true)
                }}
              />
            </div>
          </>
        )}

        {suggestionModalOpen && (
          <SuggestionModal
            deal={editingDeal}
            onClose={() => {
              setSuggestionModalOpen(false)
              setEditingDeal(null)
            }}
          />
        )}

        {/* Footer with Citation and Admin Dashboard */}
        <footer className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Citation Box */}
            <div className="flex-1 max-w-7xl">
              <p className="text-sm text-gray-600 mb-2">
                We appreciate if you cite our work as follows:
              </p>
              <div className="relative bg-gray-50 border border-gray-200 rounded-lg p-4">
                <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto">
{`@inproceedings{
jia2025a,
title={A Sustainable {AI} Economy Needs Data Deals That Work for Generators},
author={Ruoxi Jia and Luis Oala and Wenjie Xiong and Suqin Ge and Jiachen T. Wang and Feiyang Kang and Dawn Song},
booktitle={The Thirty-Ninth Annual Conference on Neural Information Processing Systems Position Paper Track},
year={2025},
url={https://openreview.net/forum?id=mdKzkjY1dM}
}`}
                </pre>
                <button
                  onClick={() => {
                    const bibtex = `@inproceedings{
jia2025a,
title={A Sustainable {AI} Economy Needs Data Deals That Work for Generators},
author={Ruoxi Jia and Luis Oala and Wenjie Xiong and Suqin Ge and Jiachen T. Wang and Feiyang Kang and Dawn Song},
booktitle={The Thirty-Ninth Annual Conference on Neural Information Processing Systems Position Paper Track},
year={2025},
url={https://openreview.net/forum?id=mdKzkjY1dM}
}`
                    navigator.clipboard.writeText(bibtex)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="absolute top-2 right-2 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            
            <div className="flex justify-end w-full md:w-auto md:ml-auto">
              <Link
                href="/admin"
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors inline-block self-start"
              >
                Admin Dashboard
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
