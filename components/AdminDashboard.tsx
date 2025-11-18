'use client'

import { useState, useEffect } from 'react'
import { Deal } from '@/app/page'
import AuditLogViewer from './AuditLogViewer'

// Base path for API calls (matches next.config.js basePath)
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/neurips2025-data-deals'

interface Suggestion {
  id: number
  deal_id: number | null
  type: 'edit' | 'new'
  fields: any
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  deal: Deal | null
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'audit'>('suggestions')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`${BASE_PATH}/api/suggestions?status=pending`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data)
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (suggestion: Suggestion) => {
    try {
      const response = await fetch(`${BASE_PATH}/api/suggestions/${suggestion.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })

      if (response.ok) {
        await fetchSuggestions()
        setSelectedSuggestion(null)
        alert('Suggestion approved successfully!')
      } else {
        alert('Failed to approve suggestion')
      }
    } catch (error) {
      console.error('Error approving suggestion:', error)
      alert('Failed to approve suggestion')
    }
  }

  const handleReject = async (suggestion: Suggestion) => {
    if (!confirm('Are you sure you want to reject this suggestion?')) {
      return
    }

    try {
      const response = await fetch(`${BASE_PATH}/api/suggestions/${suggestion.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })

      if (response.ok) {
        await fetchSuggestions()
        setSelectedSuggestion(null)
        alert('Suggestion rejected')
      } else {
        alert('Failed to reject suggestion')
      }
    } catch (error) {
      console.error('Error rejecting suggestion:', error)
      alert('Failed to reject suggestion')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading suggestions...</div>
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'suggestions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Suggestions ({suggestions.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'audit'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Audit Log
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'suggestions' && (
        <>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">
              Pending Suggestions ({suggestions.length})
            </h2>

            {suggestions.length === 0 ? (
              <p className="text-gray-600">No pending suggestions</p>
            ) : (
              <div className="space-y-4">
                {suggestions.map(suggestion => (
                  <div
                    key={suggestion.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedSuggestion(suggestion)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">
                          {suggestion.type === 'new' ? 'New Entry' : 'Edit Entry'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Submitted: {new Date(suggestion.submitted_at).toLocaleString()}
                        </p>
                        {suggestion.deal && (
                          <p className="text-sm text-gray-600">
                            Deal ID: {suggestion.deal.id}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleApprove(suggestion)
                          }}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReject(suggestion)
                          }}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedSuggestion && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Suggestion Details</h2>
              <div className="space-y-4">
                {selectedSuggestion.deal && (
                  <div>
                    <h3 className="font-semibold mb-2">Current Deal:</h3>
                    <div className="bg-gray-50 p-4 rounded">
                      <pre className="text-sm overflow-x-auto">
                        {JSON.stringify(
                          {
                            ...selectedSuggestion.deal,
                            codes: selectedSuggestion.deal.codes,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold mb-2">Suggested Changes:</h3>
                  <div className="bg-blue-50 p-4 rounded">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(selectedSuggestion.fields, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(selectedSuggestion)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(selectedSuggestion)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setSelectedSuggestion(null)}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Audit Log</h2>
          <AuditLogViewer />
        </div>
      )}
    </div>
  )
}

