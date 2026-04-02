import { NextRequest, NextResponse } from 'next/server'

const API_BASE = 'https://api.github.com'

// Save archive to a private Gist
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token')
    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    const { archive, gistId } = await req.json()
    if (!archive) {
      return NextResponse.json({ error: 'Archive data required' }, { status: 400 })
    }

    const gistPayload = {
      description: 'Claude Chat → Vercel: App Archive Backup',
      public: false,
      files: {
        'claude-chat-app-archive.json': {
          content: JSON.stringify(archive, null, 2),
        },
      },
    }

    let res: Response
    if (gistId) {
      // Update existing gist
      res = await fetch(`${API_BASE}/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gistPayload),
      })
    } else {
      // Create new gist
      res = await fetch(`${API_BASE}/gists`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gistPayload),
      })
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`GitHub API error ${res.status}: ${body}`)
    }

    const gist = await res.json()
    return NextResponse.json({ gistId: gist.id, url: gist.html_url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backup failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Restore archive from a Gist
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token')
    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    const gistId = req.nextUrl.searchParams.get('gistId')
    if (!gistId) {
      return NextResponse.json({ error: 'gistId required' }, { status: 400 })
    }

    const res = await fetch(`${API_BASE}/gists/${gistId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`GitHub API error ${res.status}: ${body}`)
    }

    const gist = await res.json()
    const file = gist.files?.['claude-chat-app-archive.json']
    if (!file) {
      throw new Error('Archive file not found in gist')
    }

    const archive = JSON.parse(file.content)
    return NextResponse.json({ archive })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Restore failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
