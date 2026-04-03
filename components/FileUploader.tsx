'use client'

import { useState, useCallback, useRef } from 'react'

export interface UploadedFile {
  filename: string
  content: string
}

interface FileUploaderProps {
  files: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
}

export default function FileUploader({ files, onFilesChange }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteFilename, setPasteFilename] = useState('')
  const [pasteContent, setPasteContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const newFiles: UploadedFile[] = []
      for (const file of Array.from(fileList)) {
        const content = await file.text()
        newFiles.push({ filename: file.name, content })
      }
      onFilesChange([...files, ...newFiles])
    },
    [files, onFilesChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handlePasteAdd = () => {
    if (!pasteContent.trim()) return
    const filename = pasteFilename.trim() || 'App.tsx'
    onFilesChange([...files, { filename, content: pasteContent }])
    setPasteFilename('')
    setPasteContent('')
    setPasteMode(false)
  }

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button
          onClick={() => setPasteMode(false)}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${
            !pasteMode ? 'neu-btn-purple' : 'neu-btn text-neu-text-light'
          }`}
        >
          Upload Files
        </button>
        <button
          onClick={() => setPasteMode(true)}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${
            pasteMode ? 'neu-btn-purple' : 'neu-btn text-neu-text-light'
          }`}
        >
          Paste Code
        </button>
      </div>

      {!pasteMode ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-2xl p-12 text-center cursor-pointer transition ${
            isDragging
              ? 'neu-pressed'
              : 'neu-card-inset'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jsx,.tsx,.js,.ts"
            multiple
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />
          <div className="text-4xl mb-3">📁</div>
          <p className="text-lg font-medium text-neu-text">
            Drag & drop JSX/TSX files here
          </p>
          <p className="text-sm text-neu-text-muted mt-1">
            or click to browse
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Filename (e.g., App.tsx)"
            value={pasteFilename}
            onChange={(e) => setPasteFilename(e.target.value)}
            className="neu-input w-full px-4 py-3 rounded-xl text-sm text-neu-text placeholder:text-neu-text-muted"
          />
          <textarea
            placeholder="Paste your JSX code from Claude Chat here..."
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            rows={12}
            className="neu-input w-full px-4 py-3 rounded-xl text-sm font-mono text-neu-text placeholder:text-neu-text-muted resize-y"
          />
          <button
            onClick={handlePasteAdd}
            disabled={!pasteContent.trim()}
            className="neu-btn-purple px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add File
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-neu-text-light">
            Uploaded Files ({files.length})
          </h3>
          {files.map((file, i) => (
            <div
              key={i}
              className="neu-card-sm flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-neu-purple text-sm">📄</span>
                <span className="text-sm font-medium text-neu-text">{file.filename}</span>
                <span className="text-xs text-neu-text-muted">
                  {file.content.split('\n').length} lines
                </span>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="text-neu-text-muted hover:text-red-500 text-sm transition"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
