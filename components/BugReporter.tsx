'use client'

import { useState, useRef } from 'react'

interface DeployedApp {
  name: string
  repoUrl: string
  repoFullName: string
  commitUrl: string
  timestamp: string
  vercelUrl?: string
}

interface Fix {
  filePath: string
  description: string
  oldContent: string
  newContent: string
}

interface BugReporterProps {
  app: DeployedApp
  token: string
  projectFiles: { path: string; content: string }[]
  onClose: () => void
  onFixPushed: (commitUrl: string) => void
}

const LABELS = [
  { value: 'bug', label: 'Bug', color: 'bg-red-600/20 text-red-400 border-red-800' },
  { value: 'ui', label: 'UI Issue', color: 'bg-purple-600/20 text-purple-400 border-purple-800' },
  { value: 'crash', label: 'Crash', color: 'bg-orange-600/20 text-orange-400 border-orange-800' },
  { value: 'feature', label: 'Feature Request', color: 'bg-blue-600/20 text-blue-400 border-blue-800' },
]

export default function BugReporter({ app, token, projectFiles, onClose, onFixPushed }: BugReporterProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>(['bug'])
  const [steps, setSteps] = useState('')
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')

  // Screenshot upload
  const [screenshots, setScreenshots] = useState<{ name: string; dataUrl: string }[]>([])
  const [extractedText, setExtractedText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Analysis & auto-fix
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<{ summary: string; fixes: Fix[] } | null>(null)
  const [autoFixing, setAutoFixing] = useState(false)
  const [fixResult, setFixResult] = useState<{ commitUrl: string } | null>(null)

  // Issue creation
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [issueUrl, setIssueUrl] = useState('')
  const [error, setError] = useState('')

  const toggleLabel = (value: string) => {
    setSelectedLabels((prev) =>
      prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value]
    )
  }

  // Handle screenshot upload
  const handleImageUpload = async (fileList: FileList) => {
    const newScreenshots: { name: string; dataUrl: string }[] = []
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      newScreenshots.push({ name: file.name, dataUrl })
    }
    setScreenshots((prev) => [...prev, ...newScreenshots])

    // Extract text from screenshots using canvas OCR-like approach
    for (const ss of newScreenshots) {
      extractTextFromImage(ss.dataUrl)
    }
  }

  // Simple text extraction from error screenshots by scanning common patterns
  const extractTextFromImage = (dataUrl: string) => {
    // We use the image itself as context — the real extraction happens
    // when we send it to the analyze endpoint. Store the base64 for analysis.
    const base64 = dataUrl.split(',')[1]
    if (base64) {
      setExtractedText((prev) =>
        prev ? prev + '\n[Screenshot uploaded for analysis]' : '[Screenshot uploaded for analysis]'
      )
    }
  }

  // Analyze error and get suggested fixes
  const handleAnalyze = async () => {
    setAnalyzing(true)
    setError('')
    setAnalysis(null)

    try {
      const allErrorText = [
        title,
        description,
        actual,
        extractedText,
      ].filter(Boolean).join('\n\n')

      const res = await fetch('/api/analyze-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorText: allErrorText,
          screenshotBase64: screenshots[0]?.dataUrl?.split(',')[1] || null,
          files: projectFiles,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setAnalysis(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  // Auto-fix: apply fixes and push to GitHub
  const handleAutoFix = async () => {
    if (!analysis?.fixes.length) return
    setAutoFixing(true)
    setError('')

    try {
      // Apply fixes to project files
      const updatedFiles = [...projectFiles]
      for (const fix of analysis.fixes) {
        const idx = updatedFiles.findIndex((f) => f.path === fix.filePath)
        if (idx >= 0) {
          updatedFiles[idx] = { ...updatedFiles[idx], content: fix.newContent }
        }
      }

      // Push to GitHub
      const [owner, repo] = app.repoFullName.split('/')
      const fixDescriptions = analysis.fixes.map((f) => f.description).join(', ')

      const pushRes = await fetch('/api/github/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-token': token,
        },
        body: JSON.stringify({
          owner,
          repo,
          files: updatedFiles,
          commitMessage: `Auto-fix: ${fixDescriptions}`,
        }),
      })
      const pushData = await pushRes.json()
      if (!pushRes.ok) throw new Error(pushData.error)

      setFixResult({ commitUrl: pushData.commitUrl })
      onFixPushed(pushData.commitUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-fix failed')
    } finally {
      setAutoFixing(false)
    }
  }

  // Create GitHub issue
  const handleSubmitIssue = async () => {
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

    const body = [
      description && `## Description\n${description}`,
      steps && `## Steps to Reproduce\n${steps}`,
      expected && `## Expected Behavior\n${expected}`,
      actual && `## Actual Behavior\n${actual}`,
      analysis?.summary && `## Auto-Analysis\n${analysis.summary}`,
      analysis?.fixes.length && `## Suggested Fixes\n${analysis.fixes.map((f) => `- ${f.description}`).join('\n')}`,
      fixResult && `## Auto-Fix Applied\nCommit: ${fixResult.commitUrl}`,
      `## Environment\n- App: ${app.name}\n- Repo: ${app.repoFullName}\n- Vercel: ${app.vercelUrl || 'N/A'}\n- Last Deploy: ${new Date(app.timestamp).toLocaleString()}\n- Last Commit: ${app.commitUrl}`,
      screenshots.length > 0 && `## Screenshots\n${screenshots.length} screenshot(s) attached during report`,
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Report & Auto-Fix</h2>
              <p className="text-sm text-gray-500 mt-1">
                <span className="text-gray-400">{app.repoFullName}</span>
                {' — '}describe the issue or upload a screenshot
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
                <p className="text-sm text-green-400 font-medium">Issue created!</p>
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 underline mt-2 block"
                >
                  → View Issue on GitHub
                </a>
                {fixResult && (
                  <div className="mt-3 pt-3 border-t border-green-800">
                    <p className="text-sm text-green-400">Auto-fix was pushed!</p>
                    <a
                      href={fixResult.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 underline"
                    >
                      → View Fix Commit
                    </a>
                    <p className="text-xs text-gray-500 mt-1">Vercel will auto-redeploy with the fix.</p>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Done
              </button>
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

              {/* Screenshot upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Screenshots (error screens, console logs, etc.)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-gray-500 transition bg-gray-950/50"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                    className="hidden"
                  />
                  <p className="text-sm text-gray-400">
                    Click to upload error screenshots or drag & drop
                  </p>
                  <p className="text-xs text-gray-600 mt-1">PNG, JPG — will be scanned for error patterns</p>
                </div>
                {screenshots.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {screenshots.map((ss, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={ss.dataUrl}
                          alt={ss.name}
                          className="w-24 h-24 object-cover rounded-lg border border-gray-700"
                        />
                        <button
                          onClick={() => setScreenshots((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                        <span className="text-xs text-gray-500 block mt-1 truncate max-w-[96px]">
                          {ss.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Error Message / Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Paste the full error message or describe what went wrong..."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
                />
              </div>

              {/* Steps / Expected / Actual */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Steps to Reproduce</label>
                <textarea
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder={"1. Go to...\n2. Click on...\n3. See error"}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Expected</label>
                  <textarea
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    placeholder="What should happen"
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Actual</label>
                  <textarea
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    placeholder="What actually happens"
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>
              </div>

              {/* Analyze & Auto-Fix section */}
              <div className="border border-gray-700 rounded-xl p-4 bg-gray-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">Auto-Fix Engine</h3>
                    <p className="text-xs text-gray-500">Analyze the error and attempt to fix it automatically</p>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || (!description && !title && screenshots.length === 0)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {analyzing ? 'Analyzing...' : 'Scan & Analyze'}
                  </button>
                </div>

                {analysis && (
                  <div className="space-y-3 pt-3 border-t border-gray-800">
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-sm text-gray-300">{analysis.summary}</p>
                    </div>

                    {analysis.fixes.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Suggested Fixes ({analysis.fixes.length})
                          </h4>
                          {analysis.fixes.map((fix, i) => (
                            <div key={i} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                              <p className="text-sm text-green-400">{fix.description}</p>
                              <p className="text-xs text-gray-500 mt-1">{fix.filePath}</p>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={handleAutoFix}
                          disabled={autoFixing}
                          className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {autoFixing
                            ? 'Applying fixes & pushing...'
                            : `Apply ${analysis.fixes.length} Fix${analysis.fixes.length > 1 ? 'es' : ''} & Push to GitHub`}
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">
                        No auto-fixable patterns detected. You can still create an issue below.
                      </p>
                    )}

                    {fixResult && (
                      <div className="bg-green-900/20 border border-green-800 rounded-lg p-3">
                        <p className="text-sm text-green-400 font-medium">Fix pushed successfully!</p>
                        <a
                          href={fixResult.commitUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                          → View commit
                        </a>
                        <p className="text-xs text-gray-500 mt-1">
                          Vercel will auto-redeploy with the fix.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && <p className="text-sm text-red-400">{error}</p>}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitIssue}
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
