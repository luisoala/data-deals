'use client'

import { useState } from 'react'
import { Deal } from '@/app/page'

interface SuggestionModalProps {
  deal: Deal | null
  onClose: () => void
}

export default function SuggestionModal({ deal, onClose }: SuggestionModalProps) {
  const [formData, setFormData] = useState({
    data_receiver: deal?.data_receiver || '',
    data_aggregator: deal?.data_aggregator || '',
    ref: deal?.ref || '',
    source_url: deal?.source_url || '', // Include URL for edits too
    date: deal?.date || new Date().getFullYear(),
    type: deal?.type || '',
    value_raw: deal?.value_raw || '',
    codes: deal?.codes.join(',') || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const codes = formData.codes.split(',').map(c => c.trim()).filter(Boolean)
      
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: deal?.id || null,
          type: deal ? 'edit' : 'new',
          fields: {
            ...formData,
            codes,
            date: parseInt(formData.date.toString()),
            source_url: formData.source_url || null,
          },
        }),
      })

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        alert('Failed to submit suggestion')
      }
    } catch (error) {
      console.error('Error submitting suggestion:', error)
      alert('Failed to submit suggestion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {deal ? 'Suggest Edit' : 'Suggest New Entry'}
          </h2>
        </div>

        {success ? (
          <div className="p-6">
            <div className="text-green-600 mb-4 font-medium">
              ✓ Suggestion submitted successfully! Thank you for your contribution.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Receiver
                </label>
                <input
                  type="text"
                  value={formData.data_receiver}
                  onChange={(e) =>
                    setFormData({ ...formData, data_receiver: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Aggregator
                </label>
                <input
                  type="text"
                  value={formData.data_aggregator}
                  onChange={(e) =>
                    setFormData({ ...formData, data_aggregator: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference ID</label>
                <input
                  type="text"
                  value={formData.ref}
                  onChange={(e) =>
                    setFormData({ ...formData, ref: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., deal2024openai"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="number"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
              <input
                type="url"
                value={formData.source_url}
                onChange={(e) =>
                  setFormData({ ...formData, source_url: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://..."
                required={!deal}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select type</option>
                <option value="News">News</option>
                <option value="Images">Images</option>
                <option value="Academic">Academic</option>
                <option value="UGC">UGC</option>
                <option value="Audio">Audio</option>
                <option value="Health">Health</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
              <input
                type="text"
                value={formData.value_raw}
                onChange={(e) =>
                  setFormData({ ...formData, value_raw: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 25m, 25-50m, Undisclosed"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Codes (comma-separated)
              </label>
              <input
                type="text"
                value={formData.codes}
                onChange={(e) =>
                  setFormData({ ...formData, codes: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., C, S, R"
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
