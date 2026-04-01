import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/analyze-error
 * Accepts an error description (text) and/or a base64-encoded screenshot.
 * Returns a structured analysis with suggested fixes.
 */
export async function POST(req: NextRequest) {
  try {
    const { errorText, screenshotBase64, files } = await req.json() as {
      errorText?: string
      screenshotBase64?: string
      files?: { path: string; content: string }[]
    }

    if (!errorText && !screenshotBase64) {
      return NextResponse.json(
        { error: 'Provide errorText or screenshotBase64' },
        { status: 400 }
      )
    }

    // Analyze the error against the project files to produce fixes
    const analysis = analyzeError(errorText || '', files || [])

    return NextResponse.json(analysis)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface Fix {
  filePath: string
  description: string
  oldContent: string
  newContent: string
}

interface Analysis {
  summary: string
  fixes: Fix[]
  newFiles: { path: string; content: string }[]
}

/**
 * Pattern-based error analyzer. Detects common React/Next.js errors
 * and produces fixes against the provided project files.
 */
function analyzeError(errorText: string, files: { path: string; content: string }[]): Analysis {
  const fixes: Fix[] = []
  const newFiles: { path: string; content: string }[] = []
  const summaryParts: string[] = []
  const text = errorText.toLowerCase()

  // Helper to find a file by path substring
  const findFile = (match: string) => files.find((f) => f.path.includes(match))

  // ---- Hydration / SSR errors ----
  if (text.includes('hydration') || text.includes('server-rendered') || text.includes('did not match')) {
    summaryParts.push('Hydration mismatch detected')
    const page = findFile('app/page.tsx') || findFile('page.tsx')
    if (page) {
      if (!page.content.includes("'use client'") && !page.content.includes('"use client"')) {
        fixes.push({
          filePath: page.path,
          description: 'Add "use client" directive to fix hydration mismatch',
          oldContent: page.content,
          newContent: `'use client'\n\n${page.content}`,
        })
      }
    }
  }

  // ---- Missing "use client" ----
  if (text.includes('usestate') || text.includes('useeffect') || text.includes('createcontext') ||
      text.includes('react hook') || text.includes('client component')) {
    summaryParts.push('Client component directive missing')
    for (const file of files) {
      if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
        const hasHooks = /\b(useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer)\b/.test(file.content)
        const hasDirective = /^['"]use client['"]/.test(file.content.trim())
        if (hasHooks && !hasDirective) {
          fixes.push({
            filePath: file.path,
            description: `Add "use client" to ${file.path} — it uses React hooks`,
            oldContent: file.content,
            newContent: `'use client'\n\n${file.content}`,
          })
        }
      }
    }
  }

  // ---- Module not found / import errors ----
  const moduleMatch = errorText.match(/(?:module not found|can't resolve|cannot find module)[:\s]*['"]([^'"]+)['"]/i)
  if (moduleMatch) {
    const missingModule = moduleMatch[1]
    summaryParts.push(`Missing module: ${missingModule}`)
    const pkgFile = findFile('package.json')
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content)
        if (!pkg.dependencies?.[missingModule] && !pkg.devDependencies?.[missingModule]) {
          pkg.dependencies = pkg.dependencies || {}
          pkg.dependencies[missingModule] = 'latest'
          fixes.push({
            filePath: pkgFile.path,
            description: `Add "${missingModule}" to dependencies`,
            oldContent: pkgFile.content,
            newContent: JSON.stringify(pkg, null, 2),
          })
        }
      } catch {}
    }
  }

  // ---- Export errors ----
  if (text.includes('does not have a default export') || text.includes('no default export')) {
    summaryParts.push('Missing default export')
    const page = findFile('app/page.tsx') || findFile('page.tsx')
    if (page && !/export\s+default\s/.test(page.content)) {
      const namedExport = page.content.match(/export\s+function\s+(\w+)/)
      if (namedExport) {
        fixes.push({
          filePath: page.path,
          description: `Add default export for ${namedExport[1]}`,
          oldContent: page.content,
          newContent: page.content + `\n\nexport default ${namedExport[1]}\n`,
        })
      }
    }
  }

  // ---- Type errors ----
  if (text.includes('type error') || text.includes('typescript')) {
    summaryParts.push('TypeScript type error detected')
    // Check for common "Property does not exist" patterns
    const propMatch = errorText.match(/property\s+'(\w+)'\s+does not exist on type\s+'(\w+)'/i)
    if (propMatch) {
      summaryParts.push(`Property '${propMatch[1]}' missing on '${propMatch[2]}'`)
    }
  }

  // ---- Tailwind / CSS errors ----
  if (text.includes('tailwind') || text.includes('postcss') || text.includes('unknown utility')) {
    summaryParts.push('Tailwind CSS configuration issue')
    const twConfig = findFile('tailwind.config')
    if (twConfig && !twConfig.content.includes('./components/')) {
      fixes.push({
        filePath: twConfig.path,
        description: 'Ensure tailwind.config includes components directory',
        oldContent: twConfig.content,
        newContent: twConfig.content.replace(
          /content:\s*\[/,
          "content: [\n    './components/**/*.{js,ts,jsx,tsx,mdx}',"
        ),
      })
    }
  }

  // ---- Image errors ----
  if (text.includes('image') && (text.includes('not found') || text.includes('404'))) {
    summaryParts.push('Missing image asset')
  }

  // ---- Runtime errors ----
  if (text.includes('is not a function') || text.includes('is not defined') || text.includes('undefined')) {
    summaryParts.push('Runtime error: undefined reference')
    // Check for missing imports
    const undefMatch = errorText.match(/(\w+)\s+is not (?:a function|defined)/i)
    if (undefMatch) {
      const symbol = undefMatch[1]
      for (const file of files) {
        if (file.content.includes(symbol) && !file.content.includes(`import`)) {
          summaryParts.push(`"${symbol}" used in ${file.path} but may not be imported`)
        }
      }
    }
  }

  // ---- Build / compilation errors ----
  if (text.includes('failed to compile') || text.includes('build error') || text.includes('syntax error')) {
    summaryParts.push('Build/compilation failure')
    // Look for common syntax issues
    for (const file of files) {
      if (file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
        // Check for unclosed JSX tags
        const openTags = (file.content.match(/<(\w+)[\s>]/g) || []).length
        const closeTags = (file.content.match(/<\/(\w+)>/g) || []).length
        const selfClosing = (file.content.match(/\/>/g) || []).length
        if (openTags > closeTags + selfClosing + 2) {
          summaryParts.push(`Possible unclosed JSX tag in ${file.path}`)
        }
      }
    }
  }

  // ---- 404 / routing errors ----
  if (text.includes('404') || text.includes('page not found') || text.includes('not found')) {
    summaryParts.push('Page/route not found (404)')
    const hasPage = files.some((f) => f.path === 'app/page.tsx' || f.path === 'app/page.jsx')
    if (!hasPage) {
      summaryParts.push('No app/page.tsx found — this is required for the home page')
    }
  }

  const summary = summaryParts.length > 0
    ? summaryParts.join('. ') + '.'
    : 'Could not auto-detect specific error patterns. Please review the error details manually.'

  return { summary, fixes, newFiles }
}
