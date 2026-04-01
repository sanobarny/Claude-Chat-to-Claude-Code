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
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            !pasteMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Upload Files
        </button>
        <button
          onClick={() => setPasteMode(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            pasteMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
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
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'
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
          <p className="text-lg font-medium text-gray-300">
            Drag & drop JSX/TSX files here
          </p>
          <p className="text-sm text-gray-500 mt-1">
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
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
          <textarea
            placeholder="Paste your JSX code from Claude Chat here..."
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            rows={12}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
          />
          <button
            onClick={handlePasteAdd}
            disabled={!pasteContent.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add File
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">
            Uploaded Files ({files.length})
          </h3>
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-blue-400 text-sm">📄</span>
                <span className="text-sm font-medium">{file.filename}</span>
                <span className="text-xs text-gray-500">
                  {file.content.split('\n').length} lines
                </span>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="text-gray-500 hover:text-red-400 text-sm"
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
