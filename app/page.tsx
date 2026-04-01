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

  // Bug reporter
  const [reportingApp, setReportingApp] = useState<ArchivedApp | null>(null)

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('github-token')
    if (saved) setToken(saved)
    const archive = localStorage.getItem('app-archive')
    if (archive) {
      try { setArchivedApps(JSON.parse(archive)) } catch {}
    }
  }, [])

  const saveArchive = useCallback((apps: ArchivedApp[]) => {
    setArchivedApps(apps)
    localStorage.setItem('app-archive', JSON.stringify(apps))
  }, [])

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
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Claude Chat → Vercel</h1>
            <p className="text-sm text-gray-500">Transform JSX artifacts into deployable Next.js apps</p>
          </div>
          <div className="flex items-center gap-3">
            {mode === 'update' && (
              <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                Updating: {repoName}
              </span>
            )}
            <StepIndicator current={step} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Update mode banner */}
        {mode === 'update' && step === 'upload' && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-300">Updating: {repoName}</p>
              <p className="text-xs text-yellow-500 mt-1">Upload new/modified JSX files — changes will auto-push to the existing repo</p>
            </div>
            <button onClick={resetForNewDeploy} className="text-xs text-gray-400 hover:text-white px-3 py-1 border border-gray-700 rounded-lg">
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
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  App Name{mode === 'new' && repoMode === 'new' && ' (also used as GitHub repo name)'}
                </label>
                <input type="text" placeholder="my-awesome-app" value={repoName}
                  onChange={(e) => setRepoName(e.target.value)} readOnly={mode === 'update'}
                  className={`w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 ${mode === 'update' ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
                {mode === 'new' && repoMode === 'new' && repoName.trim() && (
                  <p className="text-xs text-gray-500 mt-1">
                    Will create: github.com/your-username/{repoName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')}
                  </p>
                )}
              </div>

              {/* Vercel URL (custom or auto-generated) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Vercel URL <span className="text-xs text-gray-500">(optional — auto-detected if blank)</span>
                </label>
                <input type="text" placeholder={repoName ? guessVercelUrl(repoName) : 'https://your-app.vercel.app'}
                  value={vercelUrl} onChange={(e) => setVercelUrl(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
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
                  <button onClick={() => setStep('upload')} className="px-4 py-2 text-gray-400 hover:text-white text-sm">← Back</button>
                  <button onClick={handleTransform} disabled={!canTransform || transforming}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
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
                <button onClick={() => setStep('configure')} className="px-4 py-2 text-gray-400 hover:text-white text-sm">← Back</button>
                <button onClick={() => { setStep('deploy'); handleDeploy() }} disabled={!canDeploy}
                  className={`px-6 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-40 ${
                    mode === 'update' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
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
              <div className="mt-4 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-300 mb-2">Vercel Auto-Deploy</p>
                <a href={vercelUrl || guessVercelUrl(repoName)} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 underline">
                  → {vercelUrl || guessVercelUrl(repoName)}
                </a>
                <p className="text-xs text-gray-500 mt-1">
                  {mode === 'new'
                    ? 'Import this repo at vercel.com/new to enable auto-deploy. After that, every push deploys automatically.'
                    : 'Vercel will auto-deploy this update within seconds.'}
                </p>
              </div>
            )}
            {deployStage === 'error' && (
              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep('configure')} className="px-4 py-2 text-gray-400 hover:text-white text-sm">← Back</button>
                <button onClick={handleDeploy} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Retry</button>
              </div>
            )}
            {deployStage === 'done' && (
              <div className="flex gap-3 mt-6">
                <button onClick={resetForNewDeploy} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  + Deploy New App
                </button>
                {mode === 'update' && (
                  <button onClick={() => { setFiles([]); setGeneratedFiles([]); setDeployStage('idle'); setCommitUrl(''); setDeployError(''); setStep('upload') }}
                    className="px-6 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700">
                    Push Another Update
                  </button>
                )}
              </div>
            )}
          </Section>
        )}

        {/* App Archive */}
        {archivedApps.length > 0 && (
          <section className="rounded-xl border border-gray-800 bg-gray-900/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Apps ({archivedApps.length})</h2>
              <span className="text-xs text-gray-600">Saved locally — files archived for editing</span>
            </div>
            <div className="space-y-3">
              {archivedApps.map((app, i) => (
                <div key={`${app.repoFullName}-${i}`} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-4">
                  {/* App header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{app.name}</h3>
                      <p className="text-xs text-gray-600">{app.repoFullName}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Last deployed: {new Date(app.timestamp).toLocaleDateString()}{' '}
                        {new Date(app.timestamp).toLocaleTimeString()}
                        {' · '}{app.sourceFiles.length} source file{app.sourceFiles.length !== 1 ? 's' : ''}
                        {' · '}{app.projectFiles.length} project file{app.projectFiles.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex flex-wrap gap-3 mt-3">
                    <a href={app.repoUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 px-3 py-1.5 rounded-md">
                      GitHub Repo
                    </a>
                    <a href={app.vercelUrl || guessVercelUrl(app.name)} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-green-400 px-3 py-1.5 rounded-md">
                      Vercel App →
                    </a>
                    <a href={app.commitUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded-md">
                      Last Commit
                    </a>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
                    <button onClick={() => handleEditApp(app)}
                      className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-1.5 rounded-md transition">
                      Edit & Update
                    </button>
                    <button onClick={() => setReportingApp(app)}
                      className="text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-1.5 rounded-md transition">
                      Report Bug / Auto-Fix
                    </button>
                    <button onClick={() => handleRemoveApp(i)}
                      className="text-xs text-gray-600 hover:text-red-400 px-2 py-1.5 ml-auto transition">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
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
    <section className={`rounded-xl border p-6 transition ${
      active ? 'border-blue-600/50 bg-gray-900/50'
        : completed ? 'border-green-800/30 bg-gray-900/20'
        : 'border-gray-800 bg-gray-900/20 opacity-60'
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          completed ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'
        }`}>
          {completed ? '✓' : number}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
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
    <div className="hidden sm:flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <span className={`text-xs px-2 py-1 rounded ${
            i === currentIdx ? 'bg-blue-600/20 text-blue-400 font-medium'
              : i < currentIdx ? 'text-green-400' : 'text-gray-600'
          }`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-gray-700 mx-1">›</span>}
        </div>
      ))}
    </div>
  )
}
