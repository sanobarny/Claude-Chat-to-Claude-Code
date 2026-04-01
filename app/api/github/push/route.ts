import { NextRequest, NextResponse } from 'next/server'
import { pushFiles, GitHubFile } from '@/lib/github'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token')
    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    const { owner, repo, files, commitMessage } = (await req.json()) as {
      owner: string
      repo: string
      files: GitHubFile[]
      commitMessage?: string
    }

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Owner and repo are required' }, { status: 400 })
    }
    if (!files || !files.length) {
      return NextResponse.json({ error: 'No files to push' }, { status: 400 })
    }

    const result = await pushFiles(token, owner, repo, files, commitMessage)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to push to GitHub'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
