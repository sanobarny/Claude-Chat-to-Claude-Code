import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-github-token')
    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    const { owner, repo, title, body, labels } = await req.json()

    if (!owner || !repo || !title) {
      return NextResponse.json(
        { error: 'Owner, repo, and title are required' },
        { status: 400 }
      )
    }

    // Create the issue
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body: body || '',
          labels: labels || [],
        }),
      }
    )

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`GitHub API error ${res.status}: ${errBody}`)
    }

    const issue = await res.json()

    return NextResponse.json({
      html_url: issue.html_url,
      number: issue.number,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create issue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
