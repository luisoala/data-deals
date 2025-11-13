'use client'

import { useState, useEffect } from 'react'
import { Deal } from '@/app/page'

interface DealsTableProps {
  deals: Deal[]
  searchQuery: string
  onSearchChange: (query: string) => void
  onEdit: (deal: Deal) => void
  onAddNew: () => void
}

type SortField = 'data_receiver' | 'data_aggregator' | 'date' | 'type' | 'value_raw'
type SortDirection = 'asc' | 'desc'

export default function DealsTable({ deals, searchQuery, onSearchChange, onEdit, onAddNew }: DealsTableProps) {
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [refUrls, setRefUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load reference URLs
    fetch('/data/ref-urls.json')
      .then(res => res.json())
      .then(data => setRefUrls(data))
      .catch(() => {
        // Try alternative path
        fetch('/ref-urls.json')
          .then(res => res.json())
          .then(data => setRefUrls(data))
          .catch(() => {})
      })
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedDeals = [...deals].sort((a, b) => {
    let aVal: any = a[sortField]
    let bVal: any = b[sortField]

    if (sortField === 'date' || sortField === 'value_raw') {
      aVal = sortField === 'date' ? a.date : a.value_min || 0
      bVal = sortField === 'date' ? b.date : b.value_min || 0
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  // Get source URL and name
  const getSourceInfo = (ref: string) => {
    const url = refUrls[ref]
    if (url) {
      // Extract domain name for display
      try {
        const domain = new URL(url).hostname.replace('www.', '')
        return { url, name: domain }
      } catch {
        return { url, name: ref }
      }
    }
    return { url: null, name: ref }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Deals <span className="text-gray-500 font-normal">({sortedDeals.length})</span>
        </h2>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={onAddNew}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
        >
          + Add Entry
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('data_receiver')}
              >
                <div className="flex items-center gap-1">
                  Data Receiver
                  <SortIcon field="data_receiver" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('data_aggregator')}
              >
                <div className="flex items-center gap-1">
                  Data Aggregator
                  <SortIcon field="data_aggregator" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Date
                  <SortIcon field="date" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('type')}
              >
                <div className="flex items-center gap-1">
                  Type
                  <SortIcon field="type" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('value_raw')}
              >
                <div className="flex items-center gap-1">
                  Value
                  <SortIcon field="value_raw" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Codes
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedDeals.map(deal => {
              const sourceInfo = getSourceInfo(deal.ref)
              return (
                <tr key={deal.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-xs text-gray-900 font-medium truncate" title={deal.data_receiver}>
                    {deal.data_receiver}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-900 truncate" title={deal.data_aggregator}>
                    {deal.data_aggregator}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                    {deal.date}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                    {deal.type}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                    {deal.value_raw}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-1">
                      {deal.codes.map(code => (
                        <span
                          key={code}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs truncate">
                    {sourceInfo.url ? (
                      <a
                        href={sourceInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-500 hover:underline"
                        title={sourceInfo.url}
                      >
                        {sourceInfo.name}
                      </a>
                    ) : (
                      <span className="text-gray-400" title={sourceInfo.name}>{sourceInfo.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs">
                    <button
                      onClick={() => onEdit(deal)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
