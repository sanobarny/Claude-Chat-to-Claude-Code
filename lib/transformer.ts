import {
  DEPENDENCY_MAP,
  generatePackageJson,
  generateLayout,
  NEXT_CONFIG,
  TSCONFIG,
  TAILWIND_CONFIG,
  POSTCSS_CONFIG,
  GLOBALS_CSS,
  GITIGNORE,
} from './templates'

export interface InputFile {
  filename: string
  content: string
}

export interface OutputFile {
  path: string
  content: string
}

// Files that should never be included from uploads — we generate our own
const BLOCKED_FILES = new Set([
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  'vercel.json',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'postcss.config.js',
  'postcss.config.mjs',
  'tailwind.config.js',
  'tailwind.config.ts',
  '.gitignore',
])

/**
 * Detect npm dependencies by scanning import/require statements in JSX content.
 */
export function detectDependencies(files: InputFile[]): string[] {
  const deps = new Set<string>()
  const importRegex = /(?:import\s+.*?\s+from\s+['"]([^'"./][^'"]*?)['"]|require\s*\(\s*['"]([^'"./][^'"]*?)['"]\s*\))/g

  for (const file of files) {
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(file.content)) !== null) {
      const pkg = match[1] || match[2]
      if (!pkg) continue
      // Skip react/react-dom (included by default) and next
      if (pkg === 'react' || pkg === 'react-dom' || pkg === 'next' || pkg.startsWith('next/')) continue
      // Get the package name (handle scoped packages like @radix-ui/react-dialog)
      const pkgName = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0]
      deps.add(pkgName)
    }
  }

  return Array.from(deps)
}

/**
 * Check if content already has "use client" directive
 */
function hasUseClient(content: string): boolean {
  return /^['"]use client['"]/.test(content.trim())
}

/**
 * Check if content uses client-side features that require "use client"
 */
function needsUseClient(content: string): boolean {
  const clientPatterns = [
    /\buseState\b/,
    /\buseEffect\b/,
    /\buseRef\b/,
    /\buseCallback\b/,
    /\buseMemo\b/,
    /\buseContext\b/,
    /\buseReducer\b/,
    /\bonClick\b/,
    /\bonChange\b/,
    /\bonSubmit\b/,
    /\bonKey/,
    /\bonMouse/,
    /\bonFocus/,
    /\bonBlur/,
    /\bwindow\b/,
    /\bdocument\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
  ]
  return clientPatterns.some((p) => p.test(content))
}

/**
 * Ensure the file has a proper default export for use as a Next.js page.
 */
function ensureDefaultExport(content: string): string {
  // Already has default export
  if (/export\s+default\s/.test(content)) return content

  // Has a named export function — add default export
  const namedFunc = content.match(/export\s+function\s+(\w+)/)
  if (namedFunc) {
    return content + `\n\nexport default ${namedFunc[1]}\n`
  }

  // Has a const component like: const App = () => ...
  const constComp = content.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|)\s*=>/)
  if (constComp) {
    return content + `\n\nexport default ${constComp[1]}\n`
  }

  // Wrap entire content as default export
  return `export default function Page() {\n  return (\n    <>\n${content}\n    </>\n  )\n}\n`
}

/**
 * Add "use client" directive if the file needs it and doesn't have it.
 */
function addUseClientIfNeeded(content: string): string {
  if (hasUseClient(content) || !needsUseClient(content)) return content
  return `'use client'\n\n${content}`
}

/**
 * Sanitize JSX content to be Vercel-compatible.
 * Fixes common issues from Claude Chat artifacts.
 */
function sanitizeContent(content: string): string {
  let result = content

  // Remove // @ts-nocheck — we want proper types, not suppression
  result = result.replace(/^\s*\/\/\s*@ts-nocheck\s*\n?/gm, '')

  // Remove // @ts-ignore comments
  result = result.replace(/^\s*\/\/\s*@ts-ignore\s*\n?/gm, '')

  // Remove any `export const config = { ... output: 'export' }` patterns
  // that Claude might add thinking it helps with static export
  result = result.replace(/export\s+const\s+config\s*=\s*\{[^}]*output\s*:\s*['"]export['"][^}]*\}\s*;?\n?/g, '')

  return result
}

/**
 * Sanitize a Next.js config string to ensure it's Vercel-compatible.
 * Removes dangerous options that break Vercel deployment.
 */
function sanitizeNextConfig(content: string): string {
  // Remove output: 'export' — this breaks Vercel's Next.js runtime
  let result = content.replace(/\boutput\s*:\s*['"]export['"]\s*,?/g, '')

  // Remove distDir overrides — Vercel expects default .next
  result = result.replace(/\bdistDir\s*:\s*['"][^'"]*['"]\s*,?/g, '')

  // Remove trailingSlash if combined with export (can cause issues)
  // Keep it if there's no export though, it's fine for server mode

  return result
}

/**
 * Determine the clean filename for a component file.
 */
function cleanFilename(filename: string): string {
  let name = filename.replace(/\.(jsx|tsx|js|ts)$/, '')
  return name + '.tsx'
}

/**
 * Check if a filename should be blocked from uploads.
 */
function isBlockedFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return BLOCKED_FILES.has(lower) || lower === 'vercel.json'
}

/**
 * Transform uploaded JSX files into a complete Next.js project.
 *
 * IMPORTANT: This always generates Vercel-compatible output:
 * - No `output: 'export'` in next.config (Vercel needs .next directory)
 * - No vercel.json (Vercel auto-detects Next.js)
 * - No @ts-nocheck (proper types instead)
 * - Always includes "use client" where needed
 * - Always has proper default exports
 */
export function transformToNextProject(
  files: InputFile[],
  projectName: string
): OutputFile[] {
  const output: OutputFile[] = []

  // Filter out config files from uploads — we generate our own safe versions
  const jsxFiles = files.filter((f) => !isBlockedFile(f.filename))

  const detectedDeps = detectDependencies(jsxFiles)

  // Generate Vercel-safe boilerplate (these override anything from uploads)
  output.push({ path: 'package.json', content: generatePackageJson(projectName, detectedDeps) })
  output.push({ path: 'next.config.js', content: NEXT_CONFIG })
  output.push({ path: 'tsconfig.json', content: TSCONFIG })
  output.push({ path: 'tailwind.config.js', content: TAILWIND_CONFIG })
  output.push({ path: 'postcss.config.js', content: POSTCSS_CONFIG })
  output.push({ path: 'app/globals.css', content: GLOBALS_CSS })
  output.push({ path: 'app/layout.tsx', content: generateLayout(projectName) })
  output.push({ path: '.gitignore', content: GITIGNORE })

  // Do NOT generate vercel.json — Vercel auto-detects Next.js and handles it

  if (jsxFiles.length === 1) {
    // Single file mode: use as page.tsx directly
    let content = jsxFiles[0].content
    content = sanitizeContent(content)
    content = addUseClientIfNeeded(content)
    content = ensureDefaultExport(content)
    output.push({ path: 'app/page.tsx', content })
  } else if (jsxFiles.length > 1) {
    // Multi-file mode
    let mainComponent: InputFile | null = null
    const componentFiles: InputFile[] = []

    for (const file of jsxFiles) {
      const lowerName = file.filename.toLowerCase()
      if (
        lowerName.includes('app') ||
        lowerName.includes('page') ||
        lowerName.includes('main') ||
        lowerName.includes('index') ||
        lowerName.includes('home')
      ) {
        mainComponent = file
      } else {
        componentFiles.push(file)
      }
    }

    if (!mainComponent) {
      mainComponent = jsxFiles[0]
      componentFiles.length = 0
      for (let i = 1; i < jsxFiles.length; i++) {
        componentFiles.push(jsxFiles[i])
      }
    }

    // Add component files (sanitized)
    for (const comp of componentFiles) {
      let content = sanitizeContent(comp.content)
      content = addUseClientIfNeeded(content)
      const cleanName = cleanFilename(comp.filename)
      output.push({ path: `components/${cleanName}`, content })
    }

    // Create page.tsx from main component (sanitized)
    let mainContent = sanitizeContent(mainComponent.content)

    // Rewrite relative imports to point to @/components/
    mainContent = mainContent.replace(
      /from\s+['"]\.\/([^'"]+)['"]/g,
      (_match, importPath) => {
        const cleanPath = importPath.replace(/\.(jsx|tsx|js|ts)$/, '')
        return `from '@/components/${cleanPath}'`
      }
    )

    mainContent = addUseClientIfNeeded(mainContent)
    mainContent = ensureDefaultExport(mainContent)
    output.push({ path: 'app/page.tsx', content: mainContent })
  }

  // Final safety pass: ensure no output file has Vercel-breaking patterns
  for (const file of output) {
    if (file.path === 'next.config.js' || file.path === 'next.config.ts' || file.path === 'next.config.mjs') {
      file.content = sanitizeNextConfig(file.content)
    }
  }

  return output
}
