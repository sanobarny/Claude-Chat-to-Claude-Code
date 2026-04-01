'use client'

export type DeployStage = 'idle' | 'creating-repo' | 'pushing' | 'done' | 'error'

interface DeploymentStatusProps {
  stage: DeployStage
  repoUrl: string
  commitUrl: string
  error: string
}

export default function DeploymentStatus({
  stage,
  repoUrl,
  commitUrl,
  error,
}: DeploymentStatusProps) {
  if (stage === 'idle') return null

  return (
    <div className="space-y-4">
      {/* Progress steps */}
      <div className="space-y-3">
        <Step
          label="Create repository"
          status={
            stage === 'creating-repo'
              ? 'active'
              : stage === 'pushing' || stage === 'done'
              ? 'done'
              : stage === 'error'
              ? 'error'
              : 'pending'
          }
        />
        <Step
          label="Push project files"
          status={
            stage === 'pushing'
              ? 'active'
              : stage === 'done'
              ? 'done'
              : stage === 'error' && stage !== 'creating-repo'
              ? 'error'
              : 'pending'
          }
        />
        <Step
          label="Ready for Vercel"
          status={stage === 'done' ? 'done' : 'pending'}
        />
      </div>

      {/* Error */}
      {stage === 'error' && error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Success */}
      {stage === 'done' && (
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-green-400">
            Successfully deployed to GitHub!
          </h3>
          <div className="space-y-2">
            {repoUrl && (
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-400 hover:text-blue-300 underline"
              >
                → View Repository on GitHub
              </a>
            )}
            {commitUrl && (
              <a
                href={commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-400 hover:text-blue-300 underline"
              >
                → View Commit
              </a>
            )}
          </div>
          <div className="bg-gray-900 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-gray-300">
              Next: Connect to Vercel for auto-deploy
            </p>
            <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
              <li>
                Go to{' '}
                <a
                  href="https://vercel.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  vercel.com/new
                </a>
              </li>
              <li>Import the GitHub repository you just created</li>
              <li>Click Deploy — Vercel will auto-detect Next.js</li>
              <li>Future pushes will auto-deploy!</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

function Step({
  label,
  status,
}: {
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}) {
  const icon =
    status === 'done'
      ? '✓'
      : status === 'active'
      ? '⟳'
      : status === 'error'
      ? '✕'
      : '○'

  const color =
    status === 'done'
      ? 'text-green-400'
      : status === 'active'
      ? 'text-blue-400 animate-pulse'
      : status === 'error'
      ? 'text-red-400'
      : 'text-gray-600'

  return (
    <div className={`flex items-center gap-3 ${color}`}>
      <span className="text-lg w-6 text-center">{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}
