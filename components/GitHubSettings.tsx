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

    const fetchRepos = async () => {
      setLoading(true)
      setError('')
      try {
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!userRes.ok) throw new Error('Invalid token')
        const userData = await userRes.json()
        setUsername(userData.login)

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
        <label className="block text-sm font-medium text-neu-text mb-2">
          GitHub Personal Access Token
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="neu-input w-full px-4 py-3 rounded-xl text-sm font-mono text-neu-text placeholder:text-neu-text-muted pr-16"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neu-text-muted hover:text-neu-text transition"
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        {username && (
          <p className="text-sm text-green-600 mt-2 font-medium">
            Connected as <span className="font-semibold">{username}</span>
          </p>
        )}
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        <p className="text-xs text-neu-text-muted mt-2">
          Needs <code className="text-neu-text-light bg-neu-dark/30 px-1.5 py-0.5 rounded">repo</code> scope.{' '}
          Create one at GitHub Settings → Developer settings → Personal access tokens
        </p>
      </div>

      {/* Repo mode toggle */}
      {token && username && (
        <>
          <div>
            <label className="block text-sm font-medium text-neu-text mb-2">
              Repository
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => onRepoModeChange('new')}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${
                  repoMode === 'new' ? 'neu-btn-purple' : 'neu-btn text-neu-text-light'
                }`}
              >
                Create New Repo
              </button>
              <button
                onClick={() => onRepoModeChange('existing')}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${
                  repoMode === 'existing' ? 'neu-btn-purple' : 'neu-btn text-neu-text-light'
                }`}
              >
                Use Existing Repo
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
                className="neu-input w-full px-4 py-3 rounded-xl text-sm text-neu-text placeholder:text-neu-text-muted"
              />
              <label className="flex items-center gap-2 text-sm text-neu-text-light cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => onIsPrivateChange(e.target.checked)}
                  className="rounded border-neu-dark accent-neu-purple"
                />
                Private repository
              </label>
            </div>
          ) : (
            <div>
              {loading ? (
                <p className="text-sm text-neu-text-muted">Loading repos...</p>
              ) : (
                <select
                  value={selectedRepo}
                  onChange={(e) => onSelectedRepoChange(e.target.value)}
                  className="neu-input w-full px-4 py-3 rounded-xl text-sm text-neu-text"
                >
                  <option value="">Select a repository...</option>
                  {repos.map((repo) => (
                    <option key={repo.full_name} value={repo.full_name}>
                      {repo.full_name} {repo.private ? '(private)' : ''}
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
