# Claude Chat → Vercel Deploy

A web app that transforms JSX artifacts from Claude Chat into deployable Next.js apps, pushes them to GitHub, and deploys to Vercel — all without needing a local development environment.

## How It Works

1. **Upload** — Drag & drop or paste JSX files from Claude Chat
2. **Configure** — Enter your GitHub token, choose to create a new repo or use an existing one
3. **Preview** — Review the auto-generated Next.js project (edit files if needed)
4. **Deploy** — Push to GitHub with one click; connect to Vercel for auto-deploy

## Features

- **Auto-transforms** Claude Chat JSX into a complete Next.js project structure
- **Detects dependencies** (lucide-react, recharts, framer-motion, shadcn, etc.) and adds them to package.json
- **Handles both** single-file and multi-file uploads
- **Adds "use client"** directives automatically when needed
- **Preview & edit** generated files before pushing
- **Single-commit push** using GitHub's Git Trees API (fast and atomic)
- **No local tools needed** — works entirely in the browser

## Setup

1. Deploy this app to Vercel (or any hosting that supports Next.js)
2. Generate a GitHub Personal Access Token with `repo` scope
3. Open the app, paste your token, upload JSX, and deploy!

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- GitHub REST API (via fetch)
- TypeScript
