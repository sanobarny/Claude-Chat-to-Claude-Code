export interface GitHubFile {
  path: string
  content: string
}

interface TreeItem {
  path: string
  mode: '100644'
  type: 'blob'
  sha: string
}

const API_BASE = 'https://api.github.com'

async function githubFetch(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub API error ${res.status}: ${body}`)
  }
  return res
}

/**
 * List repos for the authenticated user.
 */
export async function listRepos(
  token: string
): Promise<{ name: string; full_name: string; private: boolean; html_url: string }[]> {
  const res = await githubFetch(
    '/user/repos?sort=updated&per_page=30&affiliation=owner',
    token
  )
  return res.json()
}

/**
 * Create a new GitHub repository.
 */
export async function createRepo(
  token: string,
  name: string,
  isPrivate: boolean
): Promise<{ full_name: string; html_url: string; default_branch: string }> {
  const res = await githubFetch('/user/repos', token, {
    method: 'POST',
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
    }),
  })
  return res.json()
}

/**
 * Push a set of files to a GitHub repo in a single commit using the Git Trees API.
 * Works for both empty and existing repos.
 */
export async function pushFiles(
  token: string,
  owner: string,
  repo: string,
  files: GitHubFile[],
  commitMessage: string = 'Deploy from Claude Chat → Vercel'
): Promise<{ commitUrl: string; sha: string }> {
  // 1. Get the default branch ref
  let baseSha: string | null = null
  let baseTreeSha: string | null = null
  let defaultBranch = 'main'

  try {
    const repoRes = await githubFetch(`/repos/${owner}/${repo}`, token)
    const repoData = await repoRes.json()
    defaultBranch = repoData.default_branch || 'main'

    const refRes = await githubFetch(
      `/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
      token
    )
    const refData = await refRes.json()
    baseSha = refData.object.sha

    // Get the tree of the base commit
    const commitRes = await githubFetch(
      `/repos/${owner}/${repo}/git/commits/${baseSha}`,
      token
    )
    const commitData = await commitRes.json()
    baseTreeSha = commitData.tree.sha
  } catch {
    // Repo might be empty — that's fine, we'll create from scratch
  }

  // 2. Create blobs for each file
  const treeItems: TreeItem[] = []
  for (const file of files) {
    const blobRes = await githubFetch(`/repos/${owner}/${repo}/git/blobs`, token, {
      method: 'POST',
      body: JSON.stringify({
        content: file.content,
        encoding: 'utf-8',
      }),
    })
    const blobData = await blobRes.json()
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    })
  }

  // 3. Create tree
  const treePayload: Record<string, unknown> = { tree: treeItems }
  if (baseTreeSha) {
    treePayload.base_tree = baseTreeSha
  }
  const treeRes = await githubFetch(`/repos/${owner}/${repo}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify(treePayload),
  })
  const treeData = await treeRes.json()

  // 4. Create commit
  const commitPayload: Record<string, unknown> = {
    message: commitMessage,
    tree: treeData.sha,
  }
  if (baseSha) {
    commitPayload.parents = [baseSha]
  }
  const newCommitRes = await githubFetch(
    `/repos/${owner}/${repo}/git/commits`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(commitPayload),
    }
  )
  const newCommitData = await newCommitRes.json()

  // 5. Update ref (or create it)
  try {
    await githubFetch(
      `/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
      token,
      {
        method: 'PATCH',
        body: JSON.stringify({ sha: newCommitData.sha, force: true }),
      }
    )
  } catch {
    // If ref doesn't exist, create it
    await githubFetch(`/repos/${owner}/${repo}/git/refs`, token, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${defaultBranch}`,
        sha: newCommitData.sha,
      }),
    })
  }

  return {
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitData.sha}`,
    sha: newCommitData.sha,
  }
}
