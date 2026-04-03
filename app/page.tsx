'use client'

import { useState, useEffect, useCallback } from 'react'
import FileUploader, { UploadedFile } from '@/components/FileUploader'
import GitHubSettings from '@/components/GitHubSettings'
import ProjectPreview from '@/components/ProjectPreview'
import DeploymentStatus, { DeployStage } from '@/components/DeploymentStatus'
import BugReporter from '@/components/BugReporter'

interface ProjectFile {
  path: string
  content: string
}

interface ArchivedApp {
  name: string
  repoUrl: string
  repoFullName: string
  commitUrl: string
  vercelUrl: string
  timestamp: string
  sourceFiles: UploadedFile[]  // original JSX uploads
  projectFiles: ProjectFile[]  // generated Next.js project
}

type Step = 'upload' | 'configure' | 'preview' | 'deploy'
type Mode = 'new' | 'update'

// Derive Vercel URL from repo name
function guessVercelUrl(repoName: string): string {
  const slug = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  return `https://${slug}.vercel.app`
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('new')
  const [step, setStep] = useState<Step>('upload')

  // Upload state
  const [files, setFiles] = useState<UploadedFile[]>([])

  // GitHub settings
  const [token, setToken] = useState('')
  const [repoMode, setRepoMode] = useState<'new' | 'existing'>('new')
  const [repoName, setRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState('')
  const [vercelUrl, setVercelUrl] = useState('')

  // Preview state
  const [generatedFiles, setGeneratedFiles] = useState<ProjectFile[]>([])
  const [transforming, setTransforming] = useState(false)

  // Deploy state
  const [deployStage, setDeployStage] = useState<DeployStage>('idle')
  const [repoUrl, setRepoUrl] = useState('')
  const [commitUrl, setCommitUrl] = useState('')
  const [deployError, setDeployError] = useState('')

  // Archive
  const [archivedApps, setArchivedApps] = useState<ArchivedApp[]>([])
  const [backupGistId, setBackupGistId] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState('')

  // Bug reporter
  const [reportingApp, setReportingApp] = useState<ArchivedApp | null>(null)

  // Load from localStorage — with migration safety
  useEffect(() => {
    const saved = localStorage.getItem('github-token')
    if (saved) setToken(saved)
    const gist = localStorage.getItem('backup-gist-id')
    if (gist) setBackupGistId(gist)

    // Load archive with migration: handle old format gracefully
    const archive = localStorage.getItem('app-archive')
    if (archive) {
      try {
        const parsed = JSON.parse(archive)
        // Migrate old entries that may lack new fields
        const migrated = parsed.map((app: Record<string, unknown>) => ({
          name: app.name || 'Untitled',
          repoUrl: app.repoUrl || '',
          repoFullName: app.repoFullName || '',
          commitUrl: app.commitUrl || '',
          vercelUrl: app.vercelUrl || '',
          timestamp: app.timestamp || new Date().toISOString(),
          sourceFiles: Array.isArray(app.sourceFiles) ? app.sourceFiles : [],
          projectFiles: Array.isArray(app.projectFiles) ? app.projectFiles : [],
        }))
        setArchivedApps(migrated)
      } catch {}
    }
  }, [])

  const saveArchive = useCallback((apps: ArchivedApp[]) => {
    setArchivedApps(apps)
    localStorage.setItem('app-archive', JSON.stringify(apps))
  }, [])

  // Export archive as JSON file download
  const handleExportArchive = () => {
    const data = JSON.stringify(archivedApps, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claude-apps-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import archive from JSON file
  const handleImportArchive = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as ArchivedApp[]
        if (!Array.isArray(imported)) throw new Error('Invalid format')
        // Merge: add imported apps that don't already exist
        const existing = new Set(archivedApps.map((a) => a.repoFullName))
        const merged = [...archivedApps]
        for (const app of imported) {
          if (!existing.has(app.repoFullName)) {
            merged.push(app)
            existing.add(app.repoFullName)
          }
        }
        saveArchive(merged)
        setSyncStatus(`Imported ${imported.length} app(s)`)
        setTimeout(() => setSyncStatus(''), 3000)
      } catch {
        setSyncStatus('Import failed — invalid file')
        setTimeout(() => setSyncStatus(''), 3000)
      }
    }
    reader.readAsText(file)
  }

  // Sync archive to GitHub Gist (cloud backup)
  const handleCloudBackup = async () => {
    if (!token) { setSyncStatus('GitHub token required'); return }
    setSyncing(true)
    setSyncStatus('')
    try {
      const res = await fetch('/api/github/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-github-token': token },
        body: JSON.stringify({ archive: archivedApps, gistId: backupGistId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBackupGistId(data.gistId)
      localStorage.setItem('backup-gist-id', data.gistId)
      setSyncStatus('Backed up to GitHub Gist')
      setTimeout(() => setSyncStatus(''), 3000)
    } catch (err) {
      setSyncStatus(err instanceof Error ? err.message : 'Backup failed')
    } finally {
      setSyncing(false)
    }
  }

  // Restore archive from GitHub Gist
  const handleCloudRestore = async () => {
    if (!token) { setSyncStatus('GitHub token required'); return }
    if (!backupGistId) { setSyncStatus('No backup found — backup first'); return }
    setSyncing(true)
    setSyncStatus('')
    try {
      const res = await fetch(`/api/github/backup?gistId=${backupGistId}`, {
        headers: { 'x-github-token': token },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      saveArchive(data.archive)
      setSyncStatus(`Restored ${data.archive.length} app(s) from cloud`)
      setTimeout(() => setSyncStatus(''), 3000)
    } catch (err) {
      setSyncStatus(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleTokenChange = (t: string) => {
    setToken(t)
    localStorage.setItem('github-token', t)
  }

  // Transform files
  const handleTransform = async () => {
    const name = repoName.trim()
    if (!name) { alert('Please enter a project/repo name'); return }
    setTransforming(true)
    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, projectName: name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGeneratedFiles(data.files)
      setStep('preview')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Transform failed')
    } finally {
      setTransforming(false)
    }
  }

  // Deploy/update to GitHub — fully automatic after preview
  const handleDeploy = async () => {
    setDeployStage(mode === 'update' ? 'pushing' : 'creating-repo')
    setDeployError('')
    setRepoUrl('')
    setCommitUrl('')

    try {
      let owner: string
      let repo: string

      if (mode === 'update') {
        if (!selectedRepo) throw new Error('No repo selected')
        owner = selectedRepo.split('/')[0]
        repo = selectedRepo.split('/')[1]
        setRepoUrl(`https://github.com/${selectedRepo}`)
      } else if (repoMode === 'new') {
        const name = repoName.trim()
        if (!name) throw new Error('Repo name is required')
        const res = await fetch('/api/github/repos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-github-token': token },
          body: JSON.stringify({ name, isPrivate }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        const fullName = data.repo.full_name
        owner = fullName.split('/')[0]
        repo = fullName.split('/')[1]
        setRepoUrl(data.repo.html_url)
        await new Promise((r) => setTimeout(r, 2000))
      } else {
        if (!selectedRepo) throw new Error('No repo selected')
        owner = selectedRepo.split('/')[0]
        repo = selectedRepo.split('/')[1]
        setRepoUrl(`https://github.com/${selectedRepo}`)
      }

      // Push files
      setDeployStage('pushing')
      const commitMsg = mode === 'update'
        ? `Update ${repoName.trim() || 'app'} from Claude Chat`
        : `Deploy ${repoName.trim() || 'app'} from Claude Chat`

      const pushRes = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-github-token': token },
        body: JSON.stringify({ owner, repo, files: generatedFiles, commitMessage: commitMsg }),
      })
      const pushData = await pushRes.json()
      if (!pushRes.ok) throw new Error(pushData.error)

      const newCommitUrl = pushData.commitUrl
      const newRepoUrl = `https://github.com/${owner}/${repo}`
      const newVercelUrl = vercelUrl || guessVercelUrl(repo)
      setCommitUrl(newCommitUrl)
      setRepoUrl(newRepoUrl)
      setVercelUrl(newVercelUrl)
      setDeployStage('done')

      // Save to archive
      const fullName = `${owner}/${repo}`
      const appData: ArchivedApp = {
        name: repoName.trim(),
        repoUrl: newRepoUrl,
        repoFullName: fullName,
        commitUrl: newCommitUrl,
        vercelUrl: newVercelUrl,
        timestamp: new Date().toISOString(),
        sourceFiles: [...files],
        projectFiles: [...generatedFiles],
      }

      const existingIdx = archivedApps.findIndex((a) => a.repoFullName === fullName)
      let updated: ArchivedApp[]
      if (existingIdx >= 0) {
        updated = [...archivedApps]
        updated[existingIdx] = appData
        updated.unshift(updated.splice(existingIdx, 1)[0])
      } else {
        updated = [appData, ...archivedApps]
      }
      saveArchive(updated.slice(0, 50))
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed')
      setDeployStage('error')
    }
  }

  // Edit existing app — loads its saved files
  const handleEditApp = (app: ArchivedApp) => {
    setMode('update')
    setRepoMode('existing')
    setRepoName(app.name)
    setSelectedRepo(app.repoFullName)
    setVercelUrl(app.vercelUrl)
    setFiles(app.sourceFiles.length > 0 ? app.sourceFiles : [])
    setGeneratedFiles(app.projectFiles.length > 0 ? app.projectFiles : [])
    setDeployStage('idle')
    setRepoUrl('')
    setCommitUrl('')
    setDeployError('')
    // If we have saved files, go straight to preview; otherwise upload
    setStep(app.sourceFiles.length > 0 ? 'preview' : 'upload')
  }

  const handleRemoveApp = (index: number) => {
    const updated = archivedApps.filter((_, i) => i !== index)
    saveArchive(updated)
  }

  // After bug reporter pushes a fix, update the archive
  const handleFixPushed = (fixCommitUrl: string) => {
    if (!reportingApp) return
    const idx = archivedApps.findIndex((a) => a.repoFullName === reportingApp.repoFullName)
    if (idx >= 0) {
      const updated = [...archivedApps]
      updated[idx] = { ...updated[idx], commitUrl: fixCommitUrl, timestamp: new Date().toISOString() }
      saveArchive(updated)
    }
  }

  const resetForNewDeploy = () => {
    setMode('new')
    setFiles([])
    setGeneratedFiles([])
    setDeployStage('idle')
    setRepoUrl('')
    setCommitUrl('')
    setDeployError('')
    setVercelUrl('')
    setStep('upload')
    setRepoName('')
    setSelectedRepo('')
    setRepoMode('new')
  }

  const canConfigure = files.length > 0
  const canTransform = token && (
    mode === 'update' ? repoName.trim() && selectedRepo
      : repoMode === 'new' ? repoName.trim() : selectedRepo
  )
  const canDeploy = generatedFiles.length > 0

  return (
    <div className="min-h-screen bg-neu-base">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-neu-base">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt="Logo" className="w-10 h-10 rounded-xl" />
            <div>
              <h1 className="text-xl font-bold text-neu-text">Claude Chat → Vercel</h1>
              <p className="text-sm text-neu-text-muted">Transform JSX artifacts into deployable Next.js apps</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {mode === 'update' && (
              <span className="text-xs neu-btn-yellow px-3 py-1 rounded-full">
                Updating: {repoName}
              </span>
            )}
            <StepIndicator current={step} />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6"><div className="h-px bg-gradient-to-r from-transparent via-neu-dark to-transparent" /></div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Update mode banner */}
        {mode === 'update' && step === 'upload' && (
          <div className="neu-card-sm p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neu-purple">Updating: {repoName}</p>
              <p className="text-xs text-neu-text-muted mt-1">Upload new/modified JSX files — changes will auto-push to the existing repo</p>
            </div>
            <button onClick={resetForNewDeploy} className="neu-btn text-xs text-neu-text-light px-4 py-2 rounded-xl">
              Cancel — Deploy New
            </button>
          </div>
        )}

        {/* Step 1: Upload */}
        <Section number={1} title={mode === 'update' ? 'Upload Updated JSX Files' : 'Upload JSX Files'}
          description={mode === 'update' ? 'Upload updated JSX — will auto-push to existing repo' : 'Drag & drop or paste JSX code from Claude Chat'}
          active={step === 'upload'} completed={files.length > 0 && step !== 'upload'}>
          <FileUploader files={files} onFilesChange={setFiles} />
          {canConfigure && (
            <div className="flex justify-end mt-4">
              <button onClick={() => setStep('configure')}
                className="neu-btn-purple px-6 py-2.5 rounded-xl text-sm font-medium">
                Next: Configure →
              </button>
            </div>
          )}
        </Section>

        {/* Step 2: Configure */}
        {(step === 'configure' || step === 'preview' || step === 'deploy') && (
          <Section number={2} title={mode === 'update' ? 'Review Configuration' : 'Configure & Connect GitHub'}
            description={mode === 'update' ? `Pushing update to ${selectedRepo}` : 'Name your app and choose where to push it'}
            active={step === 'configure'} completed={step === 'preview' || step === 'deploy'}>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-neu-text mb-2">
                  App Name{mode === 'new' && repoMode === 'new' && ' (also used as GitHub repo name)'}
                </label>
                <input type="text" placeholder="my-awesome-app" value={repoName}
                  onChange={(e) => setRepoName(e.target.value)} readOnly={mode === 'update'}
                  className={`w-full px-4 py-3 neu-input rounded-xl text-sm text-neu-text ${mode === 'update' ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
                {mode === 'new' && repoMode === 'new' && repoName.trim() && (
                  <p className="text-xs text-gray-500 mt-1">
                    Will create: github.com/your-username/{repoName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')}
                  </p>
                )}
              </div>

              {/* Vercel URL (custom or auto-generated) */}
              <div>
                <label className="block text-sm font-medium text-neu-text mb-2">
                  Vercel URL <span className="text-xs text-gray-500">(optional — auto-detected if blank)</span>
                </label>
                <input type="text" placeholder={repoName ? guessVercelUrl(repoName) : 'https://your-app.vercel.app'}
                  value={vercelUrl} onChange={(e) => setVercelUrl(e.target.value)}
                  className="w-full px-4 py-3 neu-input rounded-xl text-sm text-neu-text"
                />
              </div>

              {mode === 'new' && (
                <GitHubSettings token={token} onTokenChange={handleTokenChange}
                  repoMode={repoMode} onRepoModeChange={setRepoMode}
                  newRepoName={repoName} onNewRepoNameChange={setRepoName}
                  isPrivate={isPrivate} onIsPrivateChange={setIsPrivate}
                  selectedRepo={selectedRepo} onSelectedRepoChange={setSelectedRepo} />
              )}
              {mode === 'update' && !token && (
                <GitHubSettings token={token} onTokenChange={handleTokenChange}
                  repoMode="existing" onRepoModeChange={() => {}}
                  newRepoName={repoName} onNewRepoNameChange={() => {}}
                  isPrivate={false} onIsPrivateChange={() => {}}
                  selectedRepo={selectedRepo} onSelectedRepoChange={() => {}} />
              )}

              {step === 'configure' && (
                <div className="flex justify-between mt-4">
                  <button onClick={() => setStep('upload')} className="neu-btn px-4 py-2 rounded-xl text-sm text-neu-text-light">← Back</button>
                  <button onClick={handleTransform} disabled={!canTransform || transforming}
                    className="neu-btn-purple px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                    {transforming ? 'Transforming...' : 'Transform & Preview →'}
                  </button>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Step 3: Preview */}
        {(step === 'preview' || step === 'deploy') && (
          <Section number={3} title="Preview Generated Project"
            description="Review and edit — then deploy automatically"
            active={step === 'preview'} completed={step === 'deploy'}>
            <ProjectPreview files={generatedFiles} onFilesChange={setGeneratedFiles} />
            {step === 'preview' && (
              <div className="flex justify-between mt-4">
                <button onClick={() => setStep('configure')} className="neu-btn px-4 py-2 rounded-xl text-sm text-neu-text-light">← Back</button>
                <button onClick={() => { setStep('deploy'); handleDeploy() }} disabled={!canDeploy}
                  className={`px-6 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-40 ${
                    mode === 'update' ? 'neu-btn-yellow' : 'neu-btn-green'
                  }`}>
                  {mode === 'update'
                    ? `Push Update & Auto-Deploy →`
                    : repoMode === 'new'
                      ? 'Create Repo & Auto-Deploy →'
                      : `Push to ${selectedRepo.split('/')[1] || 'repo'} →`}
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Step 4: Deploy */}
        {step === 'deploy' && (
          <Section number={4} title={mode === 'update' ? 'Update Status' : 'Deployment'}
            description={mode === 'update' ? 'Pushing changes — Vercel auto-deploys' : 'Pushing to GitHub — Vercel auto-deploys'}
            active={step === 'deploy'} completed={deployStage === 'done'}>
            <DeploymentStatus stage={deployStage} repoUrl={repoUrl} commitUrl={commitUrl} error={deployError} />
            {deployStage === 'done' && (vercelUrl || repoName) && (
              <div className="mt-4 neu-card-inset p-5">
                <p className="text-sm font-medium text-neu-purple mb-2">Vercel Auto-Deploy</p>
                <a href={vercelUrl || guessVercelUrl(repoName)} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-neu-blue hover:text-neu-purple underline">
                  → {vercelUrl || guessVercelUrl(repoName)}
                </a>
                <p className="text-xs text-neu-text-muted mt-1">
                  {mode === 'new'
                    ? 'Import this repo at vercel.com/new to enable auto-deploy. After that, every push deploys automatically.'
                    : 'Vercel will auto-deploy this update within seconds.'}
                </p>
              </div>
            )}
            {deployStage === 'error' && (
              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep('configure')} className="neu-btn px-4 py-2 rounded-xl text-sm text-neu-text-light">← Back</button>
                <button onClick={handleDeploy} className="neu-btn-purple px-6 py-2.5 rounded-xl text-sm font-medium">Retry</button>
              </div>
            )}
            {deployStage === 'done' && (
              <div className="flex gap-3 mt-6">
                <button onClick={resetForNewDeploy} className="neu-btn-purple px-6 py-2.5 rounded-xl text-sm font-medium">
                  + Deploy New App
                </button>
                {mode === 'update' && (
                  <button onClick={() => { setFiles([]); setGeneratedFiles([]); setDeployStage('idle'); setCommitUrl(''); setDeployError(''); setStep('upload') }}
                    className="neu-btn-yellow px-6 py-2.5 rounded-xl text-sm font-medium">
                    Push Another Update
                  </button>
                )}
              </div>
            )}
          </Section>
        )}

        {/* App Archive */}
        <section className="neu-card p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-neu-text">Your Apps {archivedApps.length > 0 && `(${archivedApps.length})`}</h2>
          </div>

          {/* Backup / Restore Controls */}
          <div className="neu-card-inset p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-neu-text">Backup & Sync</h3>
                <p className="text-xs text-neu-text-muted">Your apps are saved in the browser. Backup to keep them safe across devices.</p>
              </div>
              {syncStatus && (
                <span className={`text-xs px-3 py-1 rounded-lg ${syncStatus.includes('fail') || syncStatus.includes('required') ? 'neu-btn-red' : 'neu-btn-green'}`}>
                  {syncStatus}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExportArchive} disabled={archivedApps.length === 0}
                className="neu-btn text-xs text-neu-text px-4 py-2 rounded-xl disabled:opacity-40">
                Download Backup
              </button>
              <label className="neu-btn text-xs text-neu-text px-4 py-2 rounded-xl cursor-pointer">
                Import Backup
                <input type="file" accept=".json" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImportArchive(e.target.files[0])} />
              </label>
              <span className="text-neu-text-muted mx-1 self-center">|</span>
              <button onClick={handleCloudBackup} disabled={syncing || !token || archivedApps.length === 0}
                className="neu-btn-purple text-xs px-4 py-2 rounded-xl disabled:opacity-40">
                {syncing ? 'Syncing...' : backupGistId ? 'Sync to Cloud' : 'Backup to Cloud'}
              </button>
              <button onClick={handleCloudRestore} disabled={syncing || !token || !backupGistId}
                className="neu-btn-purple text-xs px-4 py-2 rounded-xl disabled:opacity-40">
                Restore from Cloud
              </button>
              {backupGistId && (
                <span className="text-xs text-neu-text-muted flex items-center">
                  Cloud: synced
                </span>
              )}
            </div>
          </div>

          {/* App list */}
          {archivedApps.length > 0 ? (
            <div className="space-y-4">
              {archivedApps.map((app, i) => (
                <div key={`${app.repoFullName}-${i}`} className="neu-card-sm p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-neu-text">{app.name}</h3>
                      <p className="text-xs text-neu-text-light">{app.repoFullName}</p>
                      <p className="text-xs text-neu-text-muted mt-1">
                        Last deployed: {new Date(app.timestamp).toLocaleDateString()}{' '}
                        {new Date(app.timestamp).toLocaleTimeString()}
                        {' · '}{app.sourceFiles?.length || 0} source file{(app.sourceFiles?.length || 0) !== 1 ? 's' : ''}
                        {' · '}{app.projectFiles?.length || 0} project file{(app.projectFiles?.length || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    <a href={app.repoUrl} target="_blank" rel="noopener noreferrer"
                      className="neu-btn text-xs text-neu-blue px-4 py-2 rounded-xl font-medium">
                      GitHub Repo
                    </a>
                    <a href={app.vercelUrl || guessVercelUrl(app.name)} target="_blank" rel="noopener noreferrer"
                      className="neu-btn-green text-xs px-4 py-2 rounded-xl font-medium">
                      Vercel App
                    </a>
                    <a href={app.commitUrl} target="_blank" rel="noopener noreferrer"
                      className="neu-btn text-xs text-neu-text-light px-4 py-2 rounded-xl font-medium">
                      Last Commit
                    </a>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 mt-4 pt-4 border-t border-neu-dark/30">
                    <button onClick={() => handleEditApp(app)}
                      className="neu-btn text-xs text-neu-purple px-4 py-2 rounded-xl font-medium">
                      Edit & Update
                    </button>
                    <button onClick={() => setReportingApp(app)}
                      className="neu-btn-red text-xs px-4 py-2 rounded-xl font-medium">
                      Report Bug / Auto-Fix
                    </button>
                    <button onClick={() => handleRemoveApp(i)}
                      className="text-xs text-neu-text-muted hover:text-red-500 px-3 py-2 ml-auto transition">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-neu-text-muted">
              <p className="text-sm">No apps deployed yet.</p>
              <p className="text-xs mt-1">Upload JSX from Claude Chat to get started, or import a backup.</p>
            </div>
          )}
        </section>
      </main>

      {/* Bug Reporter Modal */}
      {reportingApp && (
        <BugReporter
          app={reportingApp}
          token={token}
          projectFiles={reportingApp.projectFiles}
          onClose={() => setReportingApp(null)}
          onFixPushed={handleFixPushed}
        />
      )}
    </div>
  )
}

function Section({ number, title, description, active, completed, children }: {
  number: number; title: string; description: string; active: boolean; completed: boolean; children: React.ReactNode
}) {
  return (
    <section className={`p-7 transition-all duration-300 ${
      active ? 'neu-card'
        : completed ? 'neu-card-sm opacity-80'
        : 'neu-card-sm opacity-50'
    }`}>
      <div className="flex items-center gap-4 mb-5">
        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold transition-all ${
          completed ? 'neu-btn-green' : active ? 'neu-btn-purple' : 'neu-pressed text-neu-text-muted'
        }`}>
          {completed ? '✓' : number}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-neu-text">{title}</h2>
          <p className="text-sm text-neu-text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'configure', label: 'Configure' },
    { key: 'preview', label: 'Preview' },
    { key: 'deploy', label: 'Deploy' },
  ]
  const currentIdx = steps.findIndex((s) => s.key === current)

  return (
    <div className="hidden sm:flex items-center gap-1 neu-card-sm px-3 py-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <span className={`text-xs px-3 py-1 rounded-lg transition-all ${
            i === currentIdx ? 'neu-btn-purple font-medium'
              : i < currentIdx ? 'text-green-600 font-medium' : 'text-neu-text-muted'
          }`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-neu-dark mx-1">›</span>}
        </div>
      ))}
    </div>
  )
}
