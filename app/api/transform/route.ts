import { NextRequest, NextResponse } from 'next/server'
import { transformToNextProject, InputFile } from '@/lib/transformer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { files, projectName } = body as {
      files: InputFile[]
      projectName: string
    }

    if (!files || !files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }
    if (!projectName) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const outputFiles = transformToNextProject(files, projectName)

    return NextResponse.json({ files: outputFiles })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transform failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
