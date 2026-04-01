// Maps common import sources found in Claude Chat JSX to npm packages
export const DEPENDENCY_MAP: Record<string, string> = {
  'lucide-react': 'lucide-react@^0.468.0',
  'recharts': 'recharts@^2.15.0',
  'framer-motion': 'framer-motion@^11.15.0',
  '@radix-ui/react-slot': '@radix-ui/react-slot@^1.1.1',
  '@radix-ui/react-dialog': '@radix-ui/react-dialog@^1.1.4',
  '@radix-ui/react-dropdown-menu': '@radix-ui/react-dropdown-menu@^2.1.4',
  '@radix-ui/react-tabs': '@radix-ui/react-tabs@^1.1.2',
  '@radix-ui/react-tooltip': '@radix-ui/react-tooltip@^1.1.6',
  '@radix-ui/react-accordion': '@radix-ui/react-accordion@^1.2.2',
  '@radix-ui/react-select': '@radix-ui/react-select@^2.1.4',
  '@radix-ui/react-switch': '@radix-ui/react-switch@^1.1.2',
  '@radix-ui/react-checkbox': '@radix-ui/react-checkbox@^1.1.3',
  '@radix-ui/react-popover': '@radix-ui/react-popover@^1.1.4',
  'class-variance-authority': 'class-variance-authority@^0.7.1',
  'clsx': 'clsx@^2.1.1',
  'tailwind-merge': 'tailwind-merge@^2.6.0',
  'date-fns': 'date-fns@^4.1.0',
  'react-icons': 'react-icons@^5.4.0',
  '@headlessui/react': '@headlessui/react@^2.2.0',
  'zustand': 'zustand@^5.0.2',
  'react-hook-form': 'react-hook-form@^7.54.2',
  'zod': 'zod@^3.24.1',
  '@hookform/resolvers': '@hookform/resolvers@^3.9.1',
  'axios': 'axios@^1.7.9',
  'react-query': '@tanstack/react-query@^5.62.7',
  '@tanstack/react-query': '@tanstack/react-query@^5.62.7',
  'react-router-dom': 'react-router-dom@^7.1.1',
  'sonner': 'sonner@^1.7.3',
  'react-hot-toast': 'react-hot-toast@^2.4.1',
  '@dnd-kit/core': '@dnd-kit/core@^6.3.1',
  '@dnd-kit/sortable': '@dnd-kit/sortable@^10.0.0',
  'cmdk': 'cmdk@^1.0.4',
}

export function generatePackageJson(
  projectName: string,
  detectedDeps: string[]
): string {
  const deps: Record<string, string> = {
    'next': '^15.1.0',
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
  }

  for (const dep of detectedDeps) {
    const mapped = DEPENDENCY_MAP[dep]
    if (mapped) {
      const atIdx = mapped.lastIndexOf('@')
      const name = mapped.substring(0, atIdx)
      const version = mapped.substring(atIdx + 1)
      deps[name] = version
    } else {
      // Unknown dep — add with latest
      deps[dep] = 'latest'
    }
  }

  const pkg = {
    name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: deps,
    devDependencies: {
      '@types/node': '^20.17.0',
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      'autoprefixer': '^10.4.20',
      'postcss': '^8.4.49',
      'tailwindcss': '^3.4.16',
      'typescript': '^5.7.0',
    },
  }

  return JSON.stringify(pkg, null, 2)
}

export const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
`

export const TSCONFIG = `{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`

export const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`

export const POSTCSS_CONFIG = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`

export const GLOBALS_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;
`

export function generateLayout(projectName: string): string {
  return `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Created with Claude Chat → Vercel Deploy',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`
}

export const GITIGNORE = `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`
