'use client'

import { useState, useEffect } from 'react'

interface FiltersProps {
  stats: any
  filters: {
    yearMin: number
    yearMax: number
    valueMin: number
    valueMax: number
    types: string[]
    codes: string[]
  }
  onFiltersChange: (filters: any) => void
  onResetFilters: () => void
}

export default function Filters({ stats, filters, onFiltersChange, onResetFilters }: FiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters)

  useEffect(() => {
    onFiltersChange(localFilters)
  }, [localFilters, onFiltersChange])

  if (!stats) return null

  const years = Object.keys(stats.yearCounts)
    .map(Number)
    .sort((a, b) => a - b)
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)

  const types = Object.keys(stats.typeCounts)
  const codes = Object.keys(stats.codeCounts)

  const toggleType = (type: string) => {
    setLocalFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }))
  }

  const toggleCode = (code: string) => {
    setLocalFilters(prev => ({
      ...prev,
      codes: prev.codes.includes(code)
        ? prev.codes.filter(c => c !== code)
        : [...prev.codes, code],
    }))
  }

  const formatValue = (val: number) => {
    if (val < 0) return 'Undisclosed'
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`
    return `$${val}`
  }

  // For value slider: extend range to include "Undisclosed" as negative value
  // Use -1 to represent "Undisclosed", 0 to max for disclosed values
  const valueMinWithUndisclosed = -1
  const valueMaxActual = stats.valueRange.max
  const valueRangeTotal = valueMaxActual - valueMinWithUndisclosed

  // Calculate percentage for range visualization (year)
  const yearRangePercent = {
    left: ((localFilters.yearMin - minYear) / (maxYear - minYear)) * 100,
    right: ((localFilters.yearMax - minYear) / (maxYear - minYear)) * 100,
    width: ((localFilters.yearMax - localFilters.yearMin) / (maxYear - minYear)) * 100,
  }

  // Calculate percentage for range visualization (value) - account for Undisclosed
  const valueMinForDisplay = localFilters.valueMin < 0 ? valueMinWithUndisclosed : localFilters.valueMin
  const valueMaxForDisplay = localFilters.valueMax
  const valueRangePercent = {
    left: ((valueMinForDisplay - valueMinWithUndisclosed) / valueRangeTotal) * 100,
    right: ((valueMaxForDisplay - valueMinWithUndisclosed) / valueRangeTotal) * 100,
    width: ((valueMaxForDisplay - valueMinForDisplay) / valueRangeTotal) * 100,
  }

  // Generate intermediate ticks for year slider
  const yearTicks = []
  for (let year = minYear; year <= maxYear; year++) {
    yearTicks.push(year)
  }

  // Generate intermediate ticks for value slider (including Undisclosed)
  const valueTickCount = 8 // Number of ticks including ends
  const valueTicks = []
  valueTicks.push(valueMinWithUndisclosed) // Undisclosed
  valueTicks.push(0) // $0
  for (let i = 1; i < valueTickCount - 1; i++) {
    const ratio = i / (valueTickCount - 1)
    valueTicks.push(Math.round(valueMaxActual * ratio))
  }
  valueTicks.push(valueMaxActual)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Year Range */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-semibold text-gray-700 mb-3">
            Year: <span className="text-green-400 font-bold">{localFilters.yearMin}</span> - <span className="text-green-400 font-bold">{localFilters.yearMax}</span>
          </label>
          <div className="relative">
            {/* Slider container */}
            <div className="relative h-8">
              {/* Range visualization background */}
              <div className="absolute top-3 left-0 w-full h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-2 bg-green-400 rounded-full"
                  style={{
                    left: `${yearRangePercent.left}%`,
                    width: `${yearRangePercent.width}%`,
                  }}
                />
              </div>
              {/* Ticks */}
              <div className="absolute top-3 left-0 w-full h-2 pointer-events-none">
                {yearTicks.map(year => (
                  <div
                    key={year}
                    className="absolute w-0.5 h-2 bg-gray-400"
                    style={{ left: `${((year - minYear) / (maxYear - minYear)) * 100}%` }}
                  />
                ))}
              </div>
              {/* Sliders - taller hit area */}
              <input
                type="range"
                min={minYear}
                max={maxYear}
                value={localFilters.yearMin}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  setLocalFilters(prev => ({
                    ...prev,
                    yearMin: Math.min(val, prev.yearMax),
                  }))
                }}
                className="absolute top-0 left-0 w-full h-8 cursor-pointer z-10"
                style={{ opacity: 0 }}
              />
              <input
                type="range"
                min={minYear}
                max={maxYear}
                value={localFilters.yearMax}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  setLocalFilters(prev => ({
                    ...prev,
                    yearMax: Math.max(val, prev.yearMin),
                  }))
                }}
                className="absolute top-0 left-0 w-full h-8 cursor-pointer z-20"
                style={{ opacity: 0 }}
              />
            </div>
            {/* Labels */}
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{minYear}</span>
              <span>{maxYear}</span>
            </div>
          </div>
        </div>

        {/* Value Range */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-semibold text-gray-700 mb-3">
            Value: <span className="text-green-400 font-bold">{formatValue(localFilters.valueMin)}</span> - <span className="text-green-400 font-bold">{formatValue(localFilters.valueMax)}</span>
          </label>
          <div className="relative">
            {/* Slider container */}
            <div className="relative h-8">
              {/* Range visualization background */}
              <div className="absolute top-3 left-0 w-full h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-2 bg-green-400 rounded-full"
                  style={{
                    left: `${valueRangePercent.left}%`,
                    width: `${valueRangePercent.width}%`,
                  }}
                />
              </div>
              {/* Ticks */}
              <div className="absolute top-3 left-0 w-full h-2 pointer-events-none">
                {valueTicks.map((tick, idx) => (
                  <div
                    key={idx}
                    className="absolute w-0.5 h-2 bg-gray-400"
                    style={{ left: `${((tick - valueMinWithUndisclosed) / valueRangeTotal) * 100}%` }}
                  />
                ))}
              </div>
              {/* Sliders - taller hit area */}
              <input
                type="range"
                min={valueMinWithUndisclosed}
                max={valueMaxActual}
                value={localFilters.valueMin < 0 ? valueMinWithUndisclosed : localFilters.valueMin}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  const actualVal = val < 0 ? -1 : val
                  setLocalFilters(prev => ({
                    ...prev,
                    valueMin: Math.min(actualVal, prev.valueMax),
                  }))
                }}
                className="absolute top-0 left-0 w-full h-8 cursor-pointer z-10"
                style={{ opacity: 0 }}
              />
              <input
                type="range"
                min={valueMinWithUndisclosed}
                max={valueMaxActual}
                value={localFilters.valueMax}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  const actualVal = val < 0 ? -1 : val
                  setLocalFilters(prev => ({
                    ...prev,
                    valueMax: Math.max(actualVal, prev.valueMin),
                  }))
                }}
                className="absolute top-0 left-0 w-full h-8 cursor-pointer z-20"
                style={{ opacity: 0 }}
              />
            </div>
            {/* Labels */}
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Undisclosed</span>
              <span>{formatValue(valueMaxActual)}</span>
            </div>
          </div>
        </div>

        {/* Content Types */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-semibold text-gray-700 mb-2">Content Type</label>
          <div className="flex flex-wrap gap-1.5">
            {types.map(type => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  localFilters.types.includes(type)
                    ? 'bg-green-400 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Deal Codes */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-semibold text-gray-700 mb-2">Deal Codes</label>
          <div className="flex flex-wrap gap-1.5 items-center">
            {codes.map(code => (
              <button
                key={code}
                onClick={() => toggleCode(code)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  localFilters.codes.includes(code)
                    ? 'bg-green-400 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {code}
              </button>
            ))}
            <button
              onClick={onResetFilters}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors ml-auto"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
