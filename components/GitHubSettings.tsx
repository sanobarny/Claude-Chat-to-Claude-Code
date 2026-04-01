'use client'

import { useState, useEffect } from 'react'

interface Repo {
  name: string
  full_name: string
  private: boolean
  html_url: string
}

interface GitHubSettingsProps {
  token: string
  onTokenChange: (token: string) => void
  repoMode: 'new' | 'existing'
  onRepoModeChange: (mode: 'new' | 'existing') => void
  newRepoName: string
  onNewRepoNameChange: (name: string) => void
  isPrivate: boolean
  onIsPrivateChange: (isPrivate: boolean) => void
  selectedRepo: string
  onSelectedRepoChange: (repo: string) => void
}

export default function GitHubSettings({
  token,
  onTokenChange,
  repoMode,
  onRepoModeChange,
  newRepoName,
  onNewRepoNameChange,
  isPrivate,
  onIsPrivateChange,
  selectedRepo,
  onSelectedRepoChange,
}: GitHubSettingsProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [username, setUsername] = useState('')

  useEffect(() => {
    if (!token) {
      setRepos([])
      setUsername('')
      return
    }

    // Validate token and fetch repos
    const fetchRepos = async () => {
      setLoading(true)
      setError('')
      try {
        // Get username
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!userRes.ok) throw new Error('Invalid token')
        const userData = await userRes.json()
        setUsername(userData.login)

        // Fetch repos
        const res = await fetch('/api/github/repos', {
          headers: { 'x-github-token': token },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setRepos(data.repos)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect')
        setUsername('')
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(fetchRepos, 500)
    return () => clearTimeout(debounce)
  }, [token])

  return (
    <div className="space-y-5">
      {/* Token input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          GitHub Personal Access Token
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500 pr-16"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {username && (
          <p className="text-sm text-green-400 mt-2">
            ✓ Connected as <span className="font-medium">{username}</span>
          </p>
        )}
        {error && <p className="text-sm text-red-400 mt-2">✕ {error}</p>}
        <p className="text-xs text-gray-600 mt-2">
          Needs <code className="text-gray-500">repo</code> scope.{' '}
          Create one at GitHub → Settings → Developer settings → Personal access tokens
        </p>
      </div>

      {/* Repo mode toggle */}
      {token && username && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Repository
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => onRepoModeChange('new')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  repoMode === 'new'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Create New
              </button>
              <button
                onClick={() => onRepoModeChange('existing')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  repoMode === 'existing'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Use Existing
              </button>
            </div>
          </div>

          {repoMode === 'new' ? (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="my-awesome-app"
                value={newRepoName}
                onChange={(e) => onNewRepoNameChange(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => onIsPrivateChange(e.target.checked)}
                  className="rounded border-gray-700"
                />
                Private repository
              </label>
            </div>
          ) : (
            <div>
              {loading ? (
                <p className="text-sm text-gray-500">Loading repos...</p>
              ) : (
                <select
                  value={selectedRepo}
                  onChange={(e) => onSelectedRepoChange(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a repository...</option>
                  {repos.map((repo) => (
                    <option key={repo.full_name} value={repo.full_name}>
                      {repo.full_name} {repo.private ? '🔒' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
