import { NextRequest, NextResponse } from 'next/server'
import { listRepos, createRepo } from '@/lib/github'

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token')
    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    const repos = await listRepos(token)
    return NextResponse.json({ repos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list repos'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token')
    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    const { name, isPrivate } = await req.json()
    if (!name) {
      return NextResponse.json({ error: 'Repo name is required' }, { status: 400 })
    }

    const repo = await createRepo(token, name, isPrivate ?? false)
    return NextResponse.json({ repo })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create repo'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
