'use client'

import { useState, useEffect } from 'react'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/neurips2025-data-deals'

interface AuditLog {
  id: number
  action: string
  entity_type: string
  entity_id: number | null
  user: string | null
  ip_address: string | null
  details: any
  created_at: string
}

interface AuditLogResponse {
  logs: AuditLog[]
  total: number
  limit: number
  offset: number
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    user: '',
  })
  const limit = 50

  useEffect(() => {
    fetchLogs()
  }, [offset, filters])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })
      if (filters.action) params.append('action', filters.action)
      if (filters.entity_type) params.append('entity_type', filters.entity_type)
      if (filters.user) params.append('user', filters.user)

      const response = await fetch(`${BASE_PATH}/api/audit-logs?${params}`)
      if (response.ok) {
        const data: AuditLogResponse = await response.json()
        setLogs(data.logs)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAction = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const getActionColor = (action: string) => {
    if (action.includes('approved')) return 'bg-green-100 text-green-800'
    if (action.includes('rejected')) return 'bg-red-100 text-red-800'
    if (action.includes('submitted')) return 'bg-blue-100 text-blue-800'
    if (action.includes('created')) return 'bg-purple-100 text-purple-800'
    if (action.includes('updated')) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (loading && logs.length === 0) {
    return <div className="text-center py-8">Loading audit logs...</div>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => {
                setFilters({ ...filters, action: e.target.value })
                setOffset(0)
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Actions</option>
              <option value="suggestion_submitted">Suggestion Submitted</option>
              <option value="suggestion_approved">Suggestion Approved</option>
              <option value="suggestion_rejected">Suggestion Rejected</option>
              <option value="deal_created">Deal Created</option>
              <option value="deal_updated">Deal Updated</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Entity Type</label>
            <select
              value={filters.entity_type}
              onChange={(e) => {
                setFilters({ ...filters, entity_type: e.target.value })
                setOffset(0)
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Types</option>
              <option value="suggestion">Suggestion</option>
              <option value="deal">Deal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">User</label>
            <input
              type="text"
              value={filters.user}
              onChange={(e) => {
                setFilters({ ...filters, user: e.target.value })
                setOffset(0)
              }}
              placeholder="GitHub username or IP"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-sm text-gray-600">
          Showing {logs.length} of {total} audit log entries
        </p>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${getActionColor(
                        log.action
                      )}`}
                    >
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {log.user || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {log.ip_address || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {log.details ? (
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:text-blue-800">
                          View Details
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-gray-700">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} entries
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

