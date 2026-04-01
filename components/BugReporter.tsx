'use client'

import { useState } from 'react'

interface DeployedApp {
  name: string
  repoUrl: string
  repoFullName: string
  commitUrl: string
  timestamp: string
}

interface BugReporterProps {
  app: DeployedApp
  token: string
  onClose: () => void
}

const LABELS = [
  { value: 'bug', label: 'Bug', color: 'bg-red-600/20 text-red-400 border-red-800' },
  { value: 'ui', label: 'UI Issue', color: 'bg-purple-600/20 text-purple-400 border-purple-800' },
  { value: 'crash', label: 'Crash', color: 'bg-orange-600/20 text-orange-400 border-orange-800' },
  { value: 'feature', label: 'Feature Request', color: 'bg-blue-600/20 text-blue-400 border-blue-800' },
]

export default function BugReporter({ app, token, onClose }: BugReporterProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>(['bug'])
  const [steps, setSteps] = useState('')
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [issueUrl, setIssueUrl] = useState('')
  const [error, setError] = useState('')

  const toggleLabel = (value: string) => {
    setSelectedLabels((prev) =>
      prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value]
    )
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!token) {
      setError('GitHub token is required to create issues')
      return
    }

    setSubmitting(true)
    setError('')

    // Build issue body
    const body = [
      description && `## Description\n${description}`,
      steps && `## Steps to Reproduce\n${steps}`,
      expected && `## Expected Behavior\n${expected}`,
      actual && `## Actual Behavior\n${actual}`,
      `## Environment\n- App: ${app.name}\n- Repo: ${app.repoFullName}\n- Last Deploy: ${new Date(app.timestamp).toLocaleString()}\n- Last Commit: ${app.commitUrl}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    try {
      const [owner, repo] = app.repoFullName.split('/')

      const res = await fetch('/api/github/issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-token': token,
        },
        body: JSON.stringify({
          owner,
          repo,
          title: title.trim(),
          body,
          labels: selectedLabels,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setIssueUrl(data.html_url)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Report Bug / Issue</h2>
              <p className="text-sm text-gray-500 mt-1">
                Creates a GitHub issue on <span className="text-gray-400">{app.repoFullName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-400 font-medium">Issue created successfully!</p>
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 underline mt-2 block"
                >
                  → View Issue on GitHub
                </a>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setTitle('')
                    setDescription('')
                    setSteps('')
                    setExpected('')
                    setActual('')
                    setSubmitted(false)
                    setIssueUrl('')
                    setSelectedLabels(['bug'])
                  }}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700"
                >
                  Report Another Issue
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Labels */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <div className="flex flex-wrap gap-2">
                  {LABELS.map((l) => (
                    <button
                      key={l.value}
                      onClick={() => toggleLabel(l.value)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        selectedLabels.includes(l.value)
                          ? l.color
                          : 'bg-gray-800 text-gray-500 border-gray-700'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue"
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of the issue..."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>

              {/* Steps to Reproduce */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Steps to Reproduce
                </label>
                <textarea
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder={"1. Go to...\n2. Click on...\n3. See error"}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
                />
              </div>

              {/* Expected vs Actual */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Expected Behavior
                  </label>
                  <textarea
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    placeholder="What should happen"
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Actual Behavior
                  </label>
                  <textarea
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    placeholder="What actually happens"
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim()}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating Issue...' : 'Create GitHub Issue'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
