'use client'

import { useState } from 'react'

interface ProjectFile {
  path: string
  content: string
}

interface ProjectPreviewProps {
  files: ProjectFile[]
  onFilesChange: (files: ProjectFile[]) => void
}

export default function ProjectPreview({ files, onFilesChange }: ProjectPreviewProps) {
  const [selectedFile, setSelectedFile] = useState<number>(0)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  if (!files.length) return null

  // Build a simple tree structure
  const tree = buildTree(files.map((f) => f.path))

  const startEdit = () => {
    setEditContent(files[selectedFile].content)
    setEditing(true)
  }

  const saveEdit = () => {
    const updated = [...files]
    updated[selectedFile] = { ...updated[selectedFile], content: editContent }
    onFilesChange(updated)
    setEditing(false)
  }

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex border-b border-gray-800">
        {/* File tree */}
        <div className="w-64 bg-gray-900/50 border-r border-gray-800 max-h-96 overflow-y-auto">
          <div className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Project Files ({files.length})
          </div>
          {files.map((file, i) => (
            <button
              key={file.path}
              onClick={() => {
                setSelectedFile(i)
                setEditing(false)
              }}
              className={`w-full text-left px-3 py-1.5 text-sm truncate transition ${
                selectedFile === i
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-gray-600 mr-1">
                {'  '.repeat(file.path.split('/').length - 1)}
              </span>
              {file.path}
            </button>
          ))}
        </div>

        {/* File content */}
        <div className="flex-1 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900/30 border-b border-gray-800">
            <span className="text-sm text-gray-400">{files[selectedFile]?.path}</span>
            {!editing ? (
              <button
                onClick={startEdit}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="text-xs text-green-400 hover:text-green-300"
                >
                  Save
                </button>
              </div>
            )}
          </div>
          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-80 p-4 bg-gray-950 text-sm font-mono text-gray-300 focus:outline-none resize-none"
            />
          ) : (
            <pre className="p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap">
              {files[selectedFile]?.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

function buildTree(paths: string[]): Record<string, unknown> {
  const tree: Record<string, unknown> = {}
  for (const path of paths) {
    const parts = path.split('/')
    let current = tree
    for (const part of parts) {
      if (!current[part]) current[part] = {}
      current = current[part] as Record<string, unknown>
    }
  }
  return tree
}
