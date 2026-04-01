'use client'

import { useState, useEffect } from 'react'
import FileUploader, { UploadedFile } from '@/components/FileUploader'
import GitHubSettings from '@/components/GitHubSettings'
import ProjectPreview from '@/components/ProjectPreview'
import DeploymentStatus, { DeployStage } from '@/components/DeploymentStatus'

interface ProjectFile {
  path: string
  content: string
}

interface DeployedApp {
  name: string
  repoUrl: string
  commitUrl: string
  timestamp: string
}

type Step = 'upload' | 'configure' | 'preview' | 'deploy'

export default function Home() {
  // Step state
  const [step, setStep] = useState<Step>('upload')

  // Upload state
  const [files, setFiles] = useState<UploadedFile[]>([])

  // GitHub settings
  const [token, setToken] = useState('')
  const [repoMode, setRepoMode] = useState<'new' | 'existing'>('new')
  const [repoName, setRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState('')

  // Preview state
  const [generatedFiles, setGeneratedFiles] = useState<ProjectFile[]>([])
  const [transforming, setTransforming] = useState(false)

  // Deploy state
  const [deployStage, setDeployStage] = useState<DeployStage>('idle')
  const [repoUrl, setRepoUrl] = useState('')
  const [commitUrl, setCommitUrl] = useState('')
  const [deployError, setDeployError] = useState('')

  // History of deployed apps
  const [deployedApps, setDeployedApps] = useState<DeployedApp[]>([])

  // Load token and history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('github-token')
    if (saved) setToken(saved)
    const history = localStorage.getItem('deployed-apps')
    if (history) {
      try { setDeployedApps(JSON.parse(history)) } catch {}
    }
  }, [])

  // Save token to localStorage
  const handleTokenChange = (t: string) => {
    setToken(t)
    localStorage.setItem('github-token', t)
  }

  // Transform files
  const handleTransform = async () => {
    const name = repoName.trim()
    if (!name) {
      alert('Please enter a project/repo name')
      return
    }
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

  // Deploy to GitHub
  const handleDeploy = async () => {
    setDeployStage('creating-repo')
    setDeployError('')
    setRepoUrl('')
    setCommitUrl('')

    try {
      let owner: string
      let repo: string

      if (repoMode === 'new') {
        const name = repoName.trim()
        if (!name) throw new Error('Repo name is required')

        // Create new repo
        const res = await fetch('/api/github/repos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-github-token': token,
          },
          body: JSON.stringify({ name, isPrivate }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        const fullName = data.repo.full_name
        owner = fullName.split('/')[0]
        repo = fullName.split('/')[1]
        setRepoUrl(data.repo.html_url)

        // Wait for GitHub to initialize the repo
        await new Promise((r) => setTimeout(r, 2000))
      } else {
        // Use existing repo
        if (!selectedRepo) throw new Error('No repo selected')
        owner = selectedRepo.split('/')[0]
        repo = selectedRepo.split('/')[1]
        setRepoUrl(`https://github.com/${selectedRepo}`)
      }

      // Push files
      setDeployStage('pushing')
      const pushRes = await fetch('/api/github/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-token': token,
        },
        body: JSON.stringify({
          owner,
          repo,
          files: generatedFiles,
          commitMessage: `Deploy ${repoName.trim() || 'app'} from Claude Chat`,
        }),
      })
      const pushData = await pushRes.json()
      if (!pushRes.ok) throw new Error(pushData.error)

      const newCommitUrl = pushData.commitUrl
      const newRepoUrl = `https://github.com/${owner}/${repo}`
      setCommitUrl(newCommitUrl)
      setRepoUrl(newRepoUrl)
      setDeployStage('done')

      // Save to history
      const newApp: DeployedApp = {
        name: repoName.trim(),
        repoUrl: newRepoUrl,
        commitUrl: newCommitUrl,
        timestamp: new Date().toISOString(),
      }
      const updatedHistory = [newApp, ...deployedApps].slice(0, 20)
      setDeployedApps(updatedHistory)
      localStorage.setItem('deployed-apps', JSON.stringify(updatedHistory))
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deploy failed')
      setDeployStage('error')
    }
  }

  // Reset everything for a new deployment
  const resetForNewDeploy = () => {
    setFiles([])
    setGeneratedFiles([])
    setDeployStage('idle')
    setRepoUrl('')
    setCommitUrl('')
    setDeployError('')
    setStep('upload')
    setRepoName('')
    setSelectedRepo('')
    setRepoMode('new')
  }

  const canConfigure = files.length > 0
  const canTransform = token && (repoMode === 'new' ? repoName.trim() : selectedRepo)
  const canDeploy = generatedFiles.length > 0

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Claude Chat → Vercel</h1>
            <p className="text-sm text-gray-500">
              Transform JSX artifacts into deployable Next.js apps
            </p>
          </div>
          <StepIndicator current={step} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Step 1: Upload */}
        <Section
          number={1}
          title="Upload JSX Files"
          description="Drag & drop or paste the JSX code from Claude Chat"
          active={step === 'upload'}
          completed={files.length > 0 && step !== 'upload'}
        >
          <FileUploader files={files} onFilesChange={setFiles} />
          {canConfigure && (
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setStep('configure')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Next: Configure →
              </button>
            </div>
          )}
        </Section>

        {/* Step 2: Configure */}
        {(step === 'configure' || step === 'preview' || step === 'deploy') && (
          <Section
            number={2}
            title="Configure & Connect GitHub"
            description="Name your app and choose where to push it"
            active={step === 'configure'}
            completed={step === 'preview' || step === 'deploy'}
          >
            <div className="space-y-5">
              {/* Single name field used for both project name and repo name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  App Name{repoMode === 'new' && ' (also used as GitHub repo name)'}
                </label>
                <input
                  type="text"
                  placeholder="my-awesome-app"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
                {repoMode === 'new' && repoName.trim() && (
                  <p className="text-xs text-gray-500 mt-1">
                    Will create: github.com/your-username/{repoName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')}
                  </p>
                )}
              </div>
              <GitHubSettings
                token={token}
                onTokenChange={handleTokenChange}
                repoMode={repoMode}
                onRepoModeChange={setRepoMode}
                newRepoName={repoName}
                onNewRepoNameChange={setRepoName}
                isPrivate={isPrivate}
                onIsPrivateChange={setIsPrivate}
                selectedRepo={selectedRepo}
                onSelectedRepoChange={setSelectedRepo}
              />
              {step === 'configure' && (
                <div className="flex justify-between mt-4">
                  <button
                    onClick={() => setStep('upload')}
                    className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleTransform}
                    disabled={!canTransform || transforming}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {transforming ? 'Transforming...' : 'Transform & Preview →'}
                  </button>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Step 3: Preview */}
        {(step === 'preview' || step === 'deploy') && (
          <Section
            number={3}
            title="Preview Generated Project"
            description="Review and edit the generated Next.js project before pushing"
            active={step === 'preview'}
            completed={step === 'deploy'}
          >
            <ProjectPreview
              files={generatedFiles}
              onFilesChange={setGeneratedFiles}
            />
            {step === 'preview' && (
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setStep('configure')}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    setStep('deploy')
                    handleDeploy()
                  }}
                  disabled={!canDeploy}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40"
                >
                  {repoMode === 'new'
                    ? `Create Repo & Deploy →`
                    : `Push to ${selectedRepo.split('/')[1] || 'repo'} →`}
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Step 4: Deploy */}
        {step === 'deploy' && (
          <Section
            number={4}
            title="Deployment"
            description="Pushing to GitHub and preparing for Vercel"
            active={step === 'deploy'}
            completed={deployStage === 'done'}
          >
            <DeploymentStatus
              stage={deployStage}
              repoUrl={repoUrl}
              commitUrl={commitUrl}
              error={deployError}
            />
            {deployStage === 'error' && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setStep('configure')}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                >
                  ← Back to Configure
                </button>
                <button
                  onClick={handleDeploy}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            )}
            {deployStage === 'done' && (
              <div className="mt-6">
                <button
                  onClick={resetForNewDeploy}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  + Deploy Another App
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Deployment History */}
        {deployedApps.length > 0 && (
          <section className="rounded-xl border border-gray-800 bg-gray-900/20 p-6">
            <h2 className="text-lg font-semibold mb-4">Deployed Apps</h2>
            <div className="space-y-3">
              {deployedApps.map((app, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-medium">{app.name}</span>
                    <span className="text-xs text-gray-500 ml-3">
                      {new Date(app.timestamp).toLocaleDateString()}{' '}
                      {new Date(app.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href={app.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      GitHub
                    </a>
                    <a
                      href={app.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-gray-300"
                    >
                      Commit
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function Section({
  number,
  title,
  description,
  active,
  completed,
  children,
}: {
  number: number
  title: string
  description: string
  active: boolean
  completed: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-xl border p-6 transition ${
        active
          ? 'border-blue-600/50 bg-gray-900/50'
          : completed
          ? 'border-green-800/30 bg-gray-900/20'
          : 'border-gray-800 bg-gray-900/20 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            completed
              ? 'bg-green-600 text-white'
              : active
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-500'
          }`}
        >
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
          <span
            className={`text-xs px-2 py-1 rounded ${
              i === currentIdx
                ? 'bg-blue-600/20 text-blue-400 font-medium'
                : i < currentIdx
                ? 'text-green-400'
                : 'text-gray-600'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className="text-gray-700 mx-1">›</span>
          )}
        </div>
      ))}
    </div>
  )
}
