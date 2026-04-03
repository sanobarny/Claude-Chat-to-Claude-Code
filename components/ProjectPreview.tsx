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
    <div className="neu-card overflow-hidden">
      <div className="flex">
        {/* File tree */}
        <div className="w-64 bg-neu-base border-r border-neu-dark/30 max-h-96 overflow-y-auto">
          <div className="p-3 text-xs font-medium text-neu-text-muted uppercase tracking-wider">
            Project Files ({files.length})
          </div>
          {files.map((file, i) => (
            <button
              key={file.path}
              onClick={() => {
                setSelectedFile(i)
                setEditing(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm truncate transition ${
                selectedFile === i
                  ? 'neu-pressed text-neu-purple font-medium'
                  : 'text-neu-text-light hover:text-neu-text hover:bg-neu-dark/20'
              }`}
            >
              <span className="text-neu-text-muted mr-1">
                {'  '.repeat(file.path.split('/').length - 1)}
              </span>
              {file.path}
            </button>
          ))}
        </div>

        {/* File content */}
        <div className="flex-1 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2.5 bg-neu-dark/20 border-b border-neu-dark/30">
            <span className="text-sm text-neu-text-light">{files[selectedFile]?.path}</span>
            {!editing ? (
              <button
                onClick={startEdit}
                className="neu-btn text-xs text-neu-purple px-3 py-1 rounded-lg font-medium"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="neu-btn text-xs text-neu-text-muted px-3 py-1 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="neu-btn-green text-xs px-3 py-1 rounded-lg font-medium"
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
              className="w-full h-80 p-4 bg-neu-base text-sm font-mono text-neu-text focus:outline-none resize-none"
            />
          ) : (
            <pre className="p-4 text-sm font-mono text-neu-text-light whitespace-pre-wrap bg-neu-base">
              {files[selectedFile]?.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
