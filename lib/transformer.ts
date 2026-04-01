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
 * Detect the main/default export component name from a JSX file.
 */
function detectDefaultExport(content: string): string | null {
  // export default function ComponentName
  const funcMatch = content.match(/export\s+default\s+function\s+(\w+)/)
  if (funcMatch) return funcMatch[1]

  // export default ComponentName
  const directMatch = content.match(/export\s+default\s+(\w+)\s*;?\s*$/)
  if (directMatch) return directMatch[1]

  return null
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
 * Determine the clean filename for a component file.
 */
function cleanFilename(filename: string): string {
  // Remove file extension, normalize
  let name = filename.replace(/\.(jsx|tsx|js|ts)$/, '')
  // If it doesn't have an extension, add .tsx
  return name + '.tsx'
}

/**
 * Transform uploaded JSX files into a complete Next.js project.
 */
export function transformToNextProject(
  files: InputFile[],
  projectName: string
): OutputFile[] {
  const output: OutputFile[] = []
  const detectedDeps = detectDependencies(files)

  // Add boilerplate files
  output.push({ path: 'package.json', content: generatePackageJson(projectName, detectedDeps) })
  output.push({ path: 'next.config.js', content: NEXT_CONFIG })
  output.push({ path: 'tsconfig.json', content: TSCONFIG })
  output.push({ path: 'tailwind.config.js', content: TAILWIND_CONFIG })
  output.push({ path: 'postcss.config.js', content: POSTCSS_CONFIG })
  output.push({ path: 'app/globals.css', content: GLOBALS_CSS })
  output.push({ path: 'app/layout.tsx', content: generateLayout(projectName) })
  output.push({ path: '.gitignore', content: GITIGNORE })

  if (files.length === 1) {
    // Single file mode: use as page.tsx directly
    let content = files[0].content
    content = addUseClientIfNeeded(content)
    content = ensureDefaultExport(content)
    output.push({ path: 'app/page.tsx', content })
  } else {
    // Multi-file mode: place components in components/, create page that imports main one
    let mainComponent: InputFile | null = null
    const componentFiles: InputFile[] = []

    for (const file of files) {
      const lowerName = file.filename.toLowerCase()
      // Identify the main/page component
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

    // If no obvious main component, use the first file
    if (!mainComponent) {
      mainComponent = files[0]
      componentFiles.length = 0
      for (let i = 1; i < files.length; i++) {
        componentFiles.push(files[i])
      }
    }

    // Add component files
    for (const comp of componentFiles) {
      let content = addUseClientIfNeeded(comp.content)
      const cleanName = cleanFilename(comp.filename)
      output.push({ path: `components/${cleanName}`, content })
    }

    // Create page.tsx from main component
    let mainContent = mainComponent.content

    // Rewrite relative imports to point to ../components/
    mainContent = mainContent.replace(
      /from\s+['"]\.\/([^'"]+)['"]/g,
      (match, importPath) => {
        const cleanPath = importPath.replace(/\.(jsx|tsx|js|ts)$/, '')
        return `from '@/components/${cleanPath}'`
      }
    )

    mainContent = addUseClientIfNeeded(mainContent)
    mainContent = ensureDefaultExport(mainContent)
    output.push({ path: 'app/page.tsx', content: mainContent })
  }

  return output
}
