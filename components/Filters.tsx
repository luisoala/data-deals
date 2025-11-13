'use client'

import { useState, useEffect, useRef } from 'react'

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
  const [draggingSlider, setDraggingSlider] = useState<'yearMin' | 'yearMax' | 'valueMin' | 'valueMax' | null>(null)
  const isInternalUpdateRef = useRef(false)

  // Sync localFilters when filters prop changes (e.g., from reset)
  // Only sync if the change came from outside (not from our own onFiltersChange)
  useEffect(() => {
    if (!isInternalUpdateRef.current) {
      setLocalFilters(filters)
    }
    isInternalUpdateRef.current = false
  }, [filters])

  useEffect(() => {
    isInternalUpdateRef.current = true
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
    if (val >= 1000000) return `${(val / 1000000).toFixed(0)}M`
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`
    return `${val}`
  }

  // For value slider: extend range to include "Undisclosed" as negative value
  // Use -1 to represent "Undisclosed", steps are 75, 150, 225, 300
  const valueMinWithUndisclosed = -1
  const valueMaxActual = 300 // Fixed max for stepped slider
  const valueRangeTotal = valueMaxActual - valueMinWithUndisclosed

  // Calculate percentage for range visualization (year)
  const yearRangePercent = {
    left: ((localFilters.yearMin - minYear) / (maxYear - minYear)) * 100,
    right: ((localFilters.yearMax - minYear) / (maxYear - minYear)) * 100,
    width: ((localFilters.yearMax - localFilters.yearMin) / (maxYear - minYear)) * 100,
  }

  // Calculate percentage for range visualization (value) - account for Undisclosed
  // Clamp values to valid step range
  const clampedValueMin = localFilters.valueMin < 0 ? valueMinWithUndisclosed : Math.max(75, Math.min(300, localFilters.valueMin))
  const clampedValueMax = Math.max(75, Math.min(300, localFilters.valueMax))
  const valueMinForDisplay = localFilters.valueMin < 0 ? valueMinWithUndisclosed : clampedValueMin
  const valueMaxForDisplay = clampedValueMax
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

  // Generate stepped ticks for value slider
  const valueTicks = [-1, 75, 150, 225, 300] // Undisclosed, 75, 150, 225, 300

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start lg:pl-4">
        {/* Year Range */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-semibold text-gray-700 mb-3">
            Year: <span className="text-green-400 font-bold">{localFilters.yearMin}</span> - <span className="text-green-400 font-bold">{localFilters.yearMax}</span>
          </label>
          <div className="relative">
            {/* Slider container */}
            <div className="relative h-12">
              {/* Range visualization background */}
              <div className="absolute top-5 left-0 w-full h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-2 bg-green-400 rounded-full"
                  style={{
                    left: `${yearRangePercent.left}%`,
                    width: `${yearRangePercent.width}%`,
                  }}
                />
              </div>
              {/* Ticks */}
              <div className="absolute top-5 left-0 w-full h-2 pointer-events-none">
                {yearTicks.map(year => (
                  <div
                    key={year}
                    className="absolute w-0.5 h-2 bg-gray-400"
                    style={{ left: `${((year - minYear) / (maxYear - minYear)) * 100}%` }}
                  />
                ))}
              </div>
              {/* Visible slider knobs - GRAY with visual offset when overlapping */}
              <div className="absolute top-3 left-0 w-full pointer-events-none">
                {localFilters.yearMin === localFilters.yearMax ? (
                  // When values are equal, offset knobs horizontally so both are visible
                  <>
                    <div
                      className="absolute w-4 h-4 bg-gray-100 rounded-full border-2 border-gray-200 shadow-sm transform -translate-x-1/2"
                      style={{ left: `calc(${yearRangePercent.left}% - 8px)` }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-gray-100 rounded-full border-2 border-gray-200 shadow-sm transform -translate-x-1/2"
                      style={{ left: `calc(${yearRangePercent.right}% + 8px)` }}
                    />
                  </>
                ) : (
                  // Normal positioning when values differ
                  <>
                    <div
                      className="absolute w-4 h-4 bg-gray-100 rounded-full border-2 border-gray-200 shadow-sm transform -translate-x-1/2"
                      style={{ left: `${yearRangePercent.left}%` }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-gray-100 rounded-full border-2 border-gray-200 shadow-sm transform -translate-x-1/2"
                      style={{ left: `${yearRangePercent.right}%` }}
                    />
                  </>
                )}
              </div>
              {/* Sliders - full width with drag handling */}
              <div
                className="absolute top-3 left-0 w-full h-6 cursor-pointer z-30 select-none"
                onMouseDown={(e) => {
                  e.preventDefault() // Prevent text selection
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  const clickX = e.clientX - rect.left
                  const percent = clickX / rect.width
                  const clickedValue = minYear + percent * (maxYear - minYear)
                  
                  // Determine which slider is closer to the click
                  let whichSlider: 'yearMin' | 'yearMax'
                  if (localFilters.yearMin === localFilters.yearMax) {
                    // When values are equal, use visual position (with offset) to determine which knob was clicked
                    const knobCenterPercent = (localFilters.yearMin - minYear) / (maxYear - minYear)
                    const leftKnobPos = knobCenterPercent - (8 / rect.width) // Left knob offset
                    const rightKnobPos = knobCenterPercent + (8 / rect.width) // Right knob offset
                    const distToLeft = Math.abs(percent - leftKnobPos)
                    const distToRight = Math.abs(percent - rightKnobPos)
                    whichSlider = distToLeft < distToRight ? 'yearMin' : 'yearMax'
                  } else {
                    // Normal case: use value distance
                    const leftDist = Math.abs(clickedValue - localFilters.yearMin)
                    const rightDist = Math.abs(clickedValue - localFilters.yearMax)
                    whichSlider = leftDist < rightDist ? 'yearMin' : 'yearMax'
                  }
                  setDraggingSlider(whichSlider)
                  
                  // Update immediately on click
                  const newValue = Math.round(clickedValue)
                  if (whichSlider === 'yearMin') {
                    setLocalFilters(prev => ({
                      ...prev,
                      yearMin: Math.min(newValue, prev.yearMax),
                    }))
                  } else {
                    setLocalFilters(prev => ({
                      ...prev,
                      yearMax: Math.max(newValue, prev.yearMin),
                    }))
                  }
                  
                  // Handle drag
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    moveEvent.preventDefault() // Prevent text selection during drag
                    const moveRect = rect
                    const moveX = moveEvent.clientX - moveRect.left
                    const movePercent = Math.max(0, Math.min(1, moveX / moveRect.width))
                    const moveValue = minYear + movePercent * (maxYear - minYear)
                    const roundedValue = Math.round(moveValue)
                    
                    if (whichSlider === 'yearMin') {
                      setLocalFilters(prev => ({
                        ...prev,
                        yearMin: Math.min(roundedValue, prev.yearMax),
                      }))
                    } else {
                      setLocalFilters(prev => ({
                        ...prev,
                        yearMax: Math.max(roundedValue, prev.yearMin),
                      }))
                    }
                  }
                  
                  const handleMouseUp = (upEvent: MouseEvent) => {
                    upEvent.preventDefault()
                    setDraggingSlider(null)
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
                style={{ pointerEvents: 'auto', userSelect: 'none', WebkitUserSelect: 'none' }}
              />
              <input
                type="range"
                min={minYear}
                max={maxYear}
                value={localFilters.yearMin}
                onChange={(e) => {
                  if (draggingSlider !== 'yearMin') {
                    const val = parseInt(e.target.value)
                    setLocalFilters(prev => ({
                      ...prev,
                      yearMin: Math.min(val, prev.yearMax),
                    }))
                  }
                }}
                className="absolute top-3 left-0 w-full h-6 cursor-pointer z-10"
                style={{ 
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
              <input
                type="range"
                min={minYear}
                max={maxYear}
                value={localFilters.yearMax}
                onChange={(e) => {
                  if (draggingSlider !== 'yearMax') {
                    const val = parseInt(e.target.value)
                    setLocalFilters(prev => ({
                      ...prev,
                      yearMax: Math.max(val, prev.yearMin),
                    }))
                  }
                }}
                className="absolute top-3 left-0 w-full h-6 cursor-pointer z-20"
                style={{ 
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
              {/* Tick labels */}
              <div className="absolute top-8 left-0 w-full mt-1">
                {yearTicks.map((year, idx) => (
                  <div
                    key={year}
                    className="absolute text-xs text-gray-500 transform -translate-x-1/2"
                    style={{ 
                      left: `${((year - minYear) / (maxYear - minYear)) * 100}%`,
                    }}
                  >
                    {`'${year.toString().slice(-2)}`}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Value Range */}
        <div className="lg:col-span-1 lg:pl-4">
          <label className="block text-xs font-semibold text-gray-700 mb-3">
            Value (million USD): <span className="text-green-400 font-bold">{formatValue(localFilters.valueMin)}</span> - <span className="text-green-400 font-bold">{formatValue(localFilters.valueMax)}</span>
          </label>
          <div className="relative">
            {/* Slider container */}
            <div className="relative h-12">
              {/* Range visualization background */}
              <div className="absolute top-5 left-0 w-full h-2 bg-gray-200 rounded-full">
                <div
                  className="absolute h-2 bg-green-400 rounded-full"
                  style={{
                    left: `${valueRangePercent.left}%`,
                    width: `${valueRangePercent.width}%`,
                  }}
                />
              </div>
              {/* Ticks */}
              <div className="absolute top-5 left-0 w-full h-2 pointer-events-none">
                {valueTicks.map((tick, idx) => (
                  <div
                    key={idx}
                    className="absolute w-0.5 h-2 bg-gray-400"
                    style={{ left: `${((tick - valueMinWithUndisclosed) / valueRangeTotal) * 100}%` }}
                  />
                ))}
              </div>
              {/* Visible slider knobs - GRAY with visual offset when overlapping */}
              <div className="absolute top-3 left-0 w-full pointer-events-none">
                {localFilters.valueMin === localFilters.valueMax || 
                 (localFilters.valueMin < 0 && localFilters.valueMax === 0) ||
                 (localFilters.valueMin >= 0 && Math.abs(localFilters.valueMin - localFilters.valueMax) < valueMaxActual * 0.01) ? (
                  // When values are equal or very close, offset knobs horizontally so both are visible
                  <>
                    <div
                      className="absolute w-4 h-4 bg-gray-100 rounded-full border-2 border-gray-200 shadow-sm transform -translate-x-1/2"
                      style={{ left: `calc(${valueRangePercent.left}% - 8px)` }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-gray-100 rounded-full border-2 border-gray-200 shadow-sm transform -translate-x-1/2"
                      style={{ left: `calc(${valueRangePercent.right}% + 8px)` }}
                    />
                  </>
                ) : (
                  // Normal positioning when values differ
                  <>
                    <div
                      className="absolute w-4 h-4 bg-gray-100 rounded-full border-2 border-gray-200 shadow-sm transform -translate-x-1/2"
                      style={{ left: `${valueRangePercent.left}%` }}
                    />
                    <div
                      className="absolute w-4 h-4 bg-gray-100 rounded-full border-2 border-gray-200 shadow-sm transform -translate-x-1/2"
                      style={{ left: `${valueRangePercent.right}%` }}
                    />
                  </>
                )}
              </div>
              {/* Sliders - full width with drag handling */}
              <div
                className="absolute top-3 left-0 w-full h-6 cursor-pointer z-30 select-none"
                onMouseDown={(e) => {
                  e.preventDefault() // Prevent text selection
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  const clickX = e.clientX - rect.left
                  const percent = clickX / rect.width
                  const clickedValue = valueMinWithUndisclosed + percent * (valueMaxActual - valueMinWithUndisclosed)
                  
                  // Determine which slider is closer to the click using visual position
                  let whichSlider: 'valueMin' | 'valueMax'
                  const leftValue = localFilters.valueMin < 0 ? valueMinWithUndisclosed : localFilters.valueMin
                  const rightValue = localFilters.valueMax
                  
                  // Calculate visual positions of knobs (as percentages)
                  const leftKnobPercent = (leftValue - valueMinWithUndisclosed) / (valueMaxActual - valueMinWithUndisclosed)
                  const rightKnobPercent = (rightValue - valueMinWithUndisclosed) / (valueMaxActual - valueMinWithUndisclosed)
                  
                  const valuesEqual = leftValue === rightValue || 
                                     (localFilters.valueMin < 0 && localFilters.valueMax === 0) ||
                                     (localFilters.valueMin >= 0 && Math.abs(localFilters.valueMin - localFilters.valueMax) < valueMaxActual * 0.01)
                  
                  if (valuesEqual) {
                    // When values are equal, use visual position (with offset) to determine which knob was clicked
                    const leftKnobPos = leftKnobPercent - (8 / rect.width) // Left knob offset
                    const rightKnobPos = rightKnobPercent + (8 / rect.width) // Right knob offset
                    const distToLeft = Math.abs(percent - leftKnobPos)
                    const distToRight = Math.abs(percent - rightKnobPos)
                    whichSlider = distToLeft < distToRight ? 'valueMin' : 'valueMax'
                  } else {
                    // Normal case: use visual position distance (more reliable than value distance)
                    const distToLeft = Math.abs(percent - leftKnobPercent)
                    const distToRight = Math.abs(percent - rightKnobPercent)
                    whichSlider = distToLeft < distToRight ? 'valueMin' : 'valueMax'
                  }
                  setDraggingSlider(whichSlider)
                  
                  // Snap to nearest step function (used by both click and drag handlers)
                  const snapToStep = (value: number): number => {
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
                  
                  // Check if click is very close to current knob position (within 5% of slider width)
                  // Account for visual offset when knobs overlap
                  let currentKnobPercent: number
                  if (valuesEqual && whichSlider === 'valueMin') {
                    currentKnobPercent = leftKnobPercent - (8 / rect.width) // Account for left offset
                  } else if (valuesEqual && whichSlider === 'valueMax') {
                    currentKnobPercent = rightKnobPercent + (8 / rect.width) // Account for right offset
                  } else {
                    currentKnobPercent = whichSlider === 'valueMin' ? leftKnobPercent : rightKnobPercent
                  }
                  const clickDistanceFromKnob = Math.abs(percent - currentKnobPercent)
                  const threshold = 0.05 // 5% of slider width
                  
                  // If clicking very close to the knob, don't snap - just use current value
                  let valueToUse: number
                  if (clickDistanceFromKnob < threshold) {
                    // Use current value without snapping
                    valueToUse = whichSlider === 'valueMin' ? leftValue : rightValue
                  } else {
                    // Snap to nearest step
                    const snappedValue = snapToStep(clickedValue)
                    valueToUse = snappedValue < 0 ? -1 : Math.max(75, Math.min(300, snappedValue))
                  }
                  
                  // Update immediately on click
                  if (whichSlider === 'valueMin') {
                    setLocalFilters(prev => ({
                      ...prev,
                      valueMin: Math.min(valueToUse, prev.valueMax),
                    }))
                  } else {
                    setLocalFilters(prev => ({
                      ...prev,
                      valueMax: Math.max(valueToUse, prev.valueMin),
                    }))
                  }
                  
                  // Handle drag with stepped values
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    moveEvent.preventDefault() // Prevent text selection during drag
                    const moveRect = rect
                    const moveX = moveEvent.clientX - moveRect.left
                    const movePercent = Math.max(0, Math.min(1, moveX / moveRect.width))
                    const moveValue = valueMinWithUndisclosed + movePercent * (valueMaxActual - valueMinWithUndisclosed)
                    const snappedValue = snapToStep(moveValue)
                    // Clamp to valid range
                    const clampedValue = snappedValue < 0 ? -1 : Math.max(75, Math.min(300, snappedValue))
                    
                    if (whichSlider === 'valueMin') {
                      setLocalFilters(prev => ({
                        ...prev,
                        valueMin: Math.min(clampedValue, prev.valueMax),
                      }))
                    } else {
                      setLocalFilters(prev => ({
                        ...prev,
                        valueMax: Math.max(clampedValue, prev.valueMin),
                      }))
                    }
                  }
                  
                  const handleMouseUp = (upEvent: MouseEvent) => {
                    upEvent.preventDefault()
                    setDraggingSlider(null)
                    document.removeEventListener('mousemove', handleMouseMove)
                    document.removeEventListener('mouseup', handleMouseUp)
                  }
                  
                  document.addEventListener('mousemove', handleMouseMove)
                  document.addEventListener('mouseup', handleMouseUp)
                }}
                style={{ pointerEvents: 'auto', userSelect: 'none', WebkitUserSelect: 'none' }}
              />
              <input
                type="range"
                min={valueMinWithUndisclosed}
                max={valueMaxActual}
                value={localFilters.valueMin < 0 ? valueMinWithUndisclosed : localFilters.valueMin}
                onChange={(e) => {
                  if (draggingSlider !== 'valueMin') {
                    const val = parseFloat(e.target.value)
                    const actualVal = val < 0 ? -1 : val
                    setLocalFilters(prev => ({
                      ...prev,
                      valueMin: Math.min(actualVal, prev.valueMax),
                    }))
                  }
                }}
                className="absolute top-3 left-0 w-full h-6 cursor-pointer z-10"
                style={{ 
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
              <input
                type="range"
                min={valueMinWithUndisclosed}
                max={valueMaxActual}
                value={localFilters.valueMax}
                onChange={(e) => {
                  if (draggingSlider !== 'valueMax') {
                    const val = parseFloat(e.target.value)
                    const actualVal = val < 0 ? -1 : val
                    setLocalFilters(prev => ({
                      ...prev,
                      valueMax: Math.max(actualVal, prev.valueMin),
                    }))
                  }
                }}
                className="absolute top-3 left-0 w-full h-6 cursor-pointer z-20"
                style={{ 
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
              {/* Tick labels */}
              <div className="absolute top-8 left-0 w-full mt-1">
                {valueTicks.map((tick, idx) => (
                  <div
                    key={idx}
                    className="absolute text-xs text-gray-500 whitespace-nowrap transform -translate-x-1/2"
                    style={{ 
                      left: `${((tick - valueMinWithUndisclosed) / valueRangeTotal) * 100}%`,
                    }}
                  >
                    {tick < 0 ? 'Und.' : `${tick}`}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content Types */}
        <div className="lg:col-span-1 lg:pl-6">
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
        <div className="lg:col-span-1 lg:pl-2">
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
