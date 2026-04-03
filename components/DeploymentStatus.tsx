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
              : stage === 'error'
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
        <div className="neu-card-inset p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Success */}
      {stage === 'done' && (
        <div className="neu-card-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-green-600">
            Successfully deployed to GitHub!
          </h3>
          <div className="space-y-2">
            {repoUrl && (
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-neu-purple hover:text-neu-pink underline font-medium"
              >
                → View Repository on GitHub
              </a>
            )}
            {commitUrl && (
              <a
                href={commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-neu-purple hover:text-neu-pink underline font-medium"
              >
                → View Commit
              </a>
            )}
          </div>
          <div className="neu-card-inset p-4 space-y-2">
            <p className="text-sm font-medium text-neu-text">
              Next: Connect to Vercel for auto-deploy
            </p>
            <ol className="text-sm text-neu-text-light space-y-1 list-decimal list-inside">
              <li>
                Go to{' '}
                <a
                  href="https://vercel.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neu-purple hover:text-neu-pink underline"
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
      ? 'text-green-600'
      : status === 'active'
      ? 'text-neu-purple animate-pulse'
      : status === 'error'
      ? 'text-red-500'
      : 'text-neu-text-muted'

  return (
    <div className={`flex items-center gap-3 ${color}`}>
      <span className="text-lg w-6 text-center">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}
