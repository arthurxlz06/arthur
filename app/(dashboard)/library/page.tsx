'use client'

import { useEffect, useState, useRef, useCallback, useId } from 'react'
import {
  FolderPlus,
  Folder as FolderIcon,
  ChevronDown,
  ChevronRight,
  Film,
  ImageIcon,
  AlertCircle,
  Trash2,
  Upload,
  Link,
  Check,
  X,
  Pencil,
} from 'lucide-react'

interface Video {
  id: string
  filename: string
  storage_path: string | null
  external_url: string | null
  media_type: 'video' | 'image'
  order_number: number | null
  size_bytes: number | null
  duration_seconds: number | null
  import_source: string
  import_status: string
  import_error: string | null
  uploaded_at: string
  folder_id: string | null
}

interface Folder {
  id: string
  name: string
  created_at: string
  videos: Video[]
}

type ImportTab = 'manual' | 'gdrive' | 'dropbox'

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = { gdrive: 'Drive', dropbox: 'Dropbox', manual: 'Manual' }
  return map[source] ?? source
}

function getMediaType(filename: string): 'video' | 'image' {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif'].includes(ext)
    ? 'image'
    : 'video'
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: '2px solid var(--bg-border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

function VideoCard({
  video,
  onDelete,
  onUpdateOrder,
}: {
  video: Video
  onDelete: (id: string) => void
  onUpdateOrder: (id: string, order: number) => void
}) {
  const [order, setOrder] = useState(String(video.order_number ?? 1))
  const isImporting = video.import_status === 'importing'
  const isError = video.import_status === 'error'

  useEffect(() => {
    setOrder(String(video.order_number ?? 1))
  }, [video.order_number])

  return (
    <div
      style={{
        background: isError
          ? 'rgba(239,68,68,0.05)'
          : isImporting
          ? 'rgba(91,110,245,0.05)'
          : 'var(--bg-elevated)',
        border: `1px solid ${
          isError
            ? 'rgba(239,68,68,0.3)'
            : isImporting
            ? 'rgba(91,110,245,0.2)'
            : 'var(--bg-border)'
        }`,
        borderRadius: 'var(--radius-md)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          height: '72px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--bg-border)',
        }}
      >
        {isImporting ? (
          <Spinner size={22} />
        ) : isError ? (
          <AlertCircle size={22} color="var(--status-error)" />
        ) : getMediaType(video.filename) === 'image' ? (
          <ImageIcon size={22} color="var(--text-muted)" />
        ) : (
          <Film size={22} color="var(--text-muted)" />
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: '12px',
            fontWeight: '500',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '3px',
          }}
          title={video.filename}
        >
          {video.filename}
        </p>
        {isImporting && (
          <p style={{ fontSize: '11px', color: 'var(--accent)' }}>Importando...</p>
        )}
        {isError && (
          <p
            style={{
              fontSize: '11px',
              color: 'var(--status-error)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={video.import_error ?? ''}
          >
            {video.import_error ?? 'Erro na importação'}
          </p>
        )}
        {video.import_status === 'ready' && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {[formatSize(video.size_bytes), formatDuration(video.duration_seconds)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {!isImporting && !isError && (
          <>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
              Ordem:
            </span>
            <input
              type="number"
              min={1}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              onBlur={() => {
                const n = parseInt(order)
                if (!isNaN(n) && n > 0) onUpdateOrder(video.id, n)
                else setOrder(String(video.order_number ?? 1))
              }}
              style={{
                width: '44px',
                padding: '2px 5px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid var(--bg-border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                textAlign: 'center',
              }}
            />
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
          {!isImporting && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'var(--bg-surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--bg-border)',
                flexShrink: 0,
              }}
            >
              {sourceLabel(video.import_source)}
            </span>
          )}
          <button
            onClick={() => onDelete(video.id)}
            title="Remover vídeo"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
              borderRadius: '3px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--status-error)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportPanel({
  folderId,
  activeTab,
  onTabChange,
  onImported,
}: {
  folderId: string
  activeTab: ImportTab
  onTabChange: (tab: ImportTab) => void
  onImported: () => void
}) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [manualError, setManualError] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [dropboxUrl, setDropboxUrl] = useState('')
  const [urlError, setUrlError] = useState('')

  const tabs: { key: ImportTab; label: string }[] = [
    { key: 'manual', label: 'Upload Manual' },
    { key: 'gdrive', label: 'Google Drive' },
    { key: 'dropbox', label: 'Dropbox' },
  ]

  const handleFileUpload = async (files: FileList | null) => {
    if (!files?.length) return
    const file = files[0]
    setUploading(true)
    setUploadProgress(0)
    setManualError('')

    try {
      // 1. Get signed upload token from server
      const signedRes = await fetch('/api/upload/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      })
      const { token, storage_path, media_type, error: signedErr } = (await signedRes.json()) as {
        token?: string
        storage_path?: string
        media_type?: 'video' | 'image'
        error?: string
      }
      if (signedErr || !token || !storage_path) throw new Error(signedErr ?? 'Erro ao obter token de upload')

      // 2. Upload via TUS (resumable, sem limite de tamanho)
      const { Upload } = await import('tus-js-client')
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${token}`,
            'x-upsert': 'false',
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: 'videos',
            objectName: storage_path,
            contentType: file.type || 'application/octet-stream',
            cacheControl: '3600',
          },
          chunkSize: 6 * 1024 * 1024,
          onError: (err) => reject(new Error(err instanceof Error ? err.message : String(err))),
          onProgress: (bytesUploaded, bytesTotal) => {
            setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100))
          },
          onSuccess: () => resolve(),
        })
        upload.start()
      })

      // 3. Save metadata
      await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          storage_path,
          media_type: media_type ?? 'video',
          folder_id: folderId,
          order_number: 1,
          size_bytes: file.size,
        }),
      })

      onImported()
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Erro ao fazer upload')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleUrlImport = async (source: 'gdrive' | 'dropbox') => {
    const url = source === 'gdrive' ? driveUrl : dropboxUrl
    if (!url.trim()) { setUrlError('Cole o link aqui'); return }
    setUrlError('')
    setUploading(true)
    const endpoint = source === 'gdrive' ? '/api/upload/gdrive' : '/api/upload/dropbox'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, folder_id: folderId }),
    })
    const data = (await res.json()) as { error?: string }
    if (data.error) {
      setUrlError(data.error)
    } else {
      if (source === 'gdrive') setDriveUrl('')
      else setDropboxUrl('')
      onImported()
    }
    setUploading(false)
  }

  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--bg-border)',
        background: 'var(--bg-base)',
      }}
    >
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { onTabChange(t.key); setUrlError('') }}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid',
              borderColor: activeTab === t.key ? 'var(--accent)' : 'var(--bg-border)',
              background: activeTab === t.key ? 'rgba(91,110,245,0.12)' : 'transparent',
              color: activeTab === t.key ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === t.key ? '500' : '400',
              transition: 'all 150ms ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Manual upload */}
      {activeTab === 'manual' && (
        <div>
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,image/jpeg,image/png,image/gif,image/webp,image/avif"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFileUpload(e.dataTransfer.files)
            }}
            style={{
              border: '2px dashed var(--bg-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '20px',
              textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              transition: 'border-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (!uploading) e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--bg-border)'
            }}
          >
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Spinner size={14} />
                  <span style={{ fontSize: '13px' }}>
                    {uploadProgress > 0 ? `Enviando... ${uploadProgress}%` : 'Preparando...'}
                  </span>
                </div>
                {uploadProgress > 0 && (
                  <div style={{ width: '100%', height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${uploadProgress}%`,
                        background: 'var(--accent)',
                        borderRadius: '2px',
                        transition: 'width 200ms ease',
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <Upload size={20} color="var(--text-muted)" />
                <span>
                  Arraste um vídeo ou{' '}
                  <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                    clique para selecionar
                  </span>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Vídeo (MP4, MOV) · Imagem (JPG, PNG, GIF, WEBP)
                </span>
              </div>
            )}
          </div>
          {manualError && (
            <p style={{ fontSize: '11px', color: 'var(--status-error)', marginTop: '6px' }}>
              {manualError}
            </p>
          )}
        </div>
      )}

      {/* Drive / Dropbox URL import */}
      {(activeTab === 'gdrive' || activeTab === 'dropbox') && (
        <div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Link
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="url"
                placeholder={
                  activeTab === 'gdrive'
                    ? 'https://drive.google.com/file/d/...'
                    : 'https://www.dropbox.com/...'
                }
                value={activeTab === 'gdrive' ? driveUrl : dropboxUrl}
                onChange={(e) => {
                  setUrlError('')
                  if (activeTab === 'gdrive') setDriveUrl(e.target.value)
                  else setDropboxUrl(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUrlImport(activeTab as 'gdrive' | 'dropbox')
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${urlError ? 'rgba(239,68,68,0.5)' : 'var(--bg-border)'}`,
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={() => handleUrlImport(activeTab as 'gdrive' | 'dropbox')}
              disabled={uploading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent)',
                border: 'none',
                color: 'white',
                cursor: uploading ? 'wait' : 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                opacity: uploading ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              {uploading ? <Spinner size={12} /> : null}
              Importar
            </button>
          </div>
          {urlError && (
            <p style={{ fontSize: '11px', color: 'var(--status-error)', marginTop: '6px' }}>
              {urlError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function FolderSection({
  folder,
  isExpanded,
  onToggle,
  onDelete,
  onRename,
  onDeleteVideo,
  onUpdateOrder,
  onImported,
  activeTab,
  onTabChange,
}: {
  folder: Folder
  isExpanded: boolean
  onToggle: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onDeleteVideo: (id: string) => void
  onUpdateOrder: (id: string, order: number) => void
  onImported: () => void
  activeTab: ImportTab
  onTabChange: (tab: ImportTab) => void
}) {
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(folder.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitRename = () => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== folder.name) {
      onRename(folder.id, trimmed)
    } else {
      setNameValue(folder.name)
    }
    setEditing(false)
  }

  const sortedVideos = [...folder.videos].sort(
    (a, b) => (a.order_number ?? 0) - (b.order_number ?? 0)
  )

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          cursor: 'pointer',
        }}
        onClick={() => { if (!editing) onToggle() }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {isExpanded ? (
            <ChevronDown size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          ) : (
            <ChevronRight size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          )}
          <FolderIcon size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
          {editing ? (
            <input
              ref={inputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setNameValue(folder.name); setEditing(false) }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text-primary)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent)',
                borderRadius: '4px',
                padding: '2px 8px',
                outline: 'none',
                flex: 1,
                minWidth: 0,
              }}
            />
          ) : (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {folder.name}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {folder.videos.length} vídeo{folder.videos.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            title="Renomear pasta"
            onClick={() => setEditing(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '5px',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Pencil size={13} />
          </button>
          <button
            title="Remover pasta"
            onClick={() => onDelete(folder.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '5px',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--status-error)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid var(--bg-border)' }}>
          <ImportPanel
            folderId={folder.id}
            activeTab={activeTab}
            onTabChange={onTabChange}
            onImported={onImported}
          />
          {sortedVideos.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              Nenhum vídeo nesta pasta
            </div>
          ) : (
            <div
              style={{
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '12px',
              }}
            >
              {sortedVideos.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onDelete={onDeleteVideo}
                  onUpdateOrder={onUpdateOrder}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function LibraryPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [orphanVideos, setOrphanVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [activeTabs, setActiveTabs] = useState<Record<string, ImportTab>>({})
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const mountedRef = useRef(true)
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollingRef.current) clearTimeout(pollingRef.current)
    }
  }, [])

  useEffect(() => {
    if (showNewFolder) newFolderInputRef.current?.focus()
  }, [showNewFolder])

  const fetchAndSchedule = useCallback(async () => {
    if (pollingRef.current) clearTimeout(pollingRef.current)

    const res = await fetch('/api/library')
    const data = (await res.json()) as { folders: Folder[]; orphanVideos: Video[] }
    const newFolders = data.folders ?? []
    const newOrphans = data.orphanVideos ?? []

    if (!mountedRef.current) return

    setFolders(newFolders)
    setOrphanVideos(newOrphans)
    setLoading(false)

    const allVideos = [...newFolders.flatMap((f) => f.videos), ...newOrphans]
    const hasImporting = allVideos.some((v) => v.import_status === 'importing')

    if (hasImporting) {
      pollingRef.current = setTimeout(fetchAndSchedule, 3000)
    }
  }, [])

  useEffect(() => {
    fetchAndSchedule()
  }, [fetchAndSchedule])

  const createFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    setCreatingFolder(true)
    const res = await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = (await res.json()) as { folder?: Folder }
    if (data.folder) {
      setFolders((prev) => [{ ...data.folder!, videos: [] }, ...prev])
      setExpandedFolders((prev) => { const next = new Set(prev); next.add(data.folder!.id); return next })
    }
    setNewFolderName('')
    setShowNewFolder(false)
    setCreatingFolder(false)
  }

  const deleteFolder = async (id: string) => {
    await fetch('/api/library', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'folder', id }),
    })
    setFolders((prev) => prev.filter((f) => f.id !== id))
    fetchAndSchedule()
  }

  const renameFolder = async (id: string, name: string) => {
    await fetch('/api/library', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: id, name }),
    })
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)))
  }

  const deleteVideo = async (id: string) => {
    await fetch('/api/library', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'video', id }),
    })
    setFolders((prev) =>
      prev.map((f) => ({ ...f, videos: f.videos.filter((v) => v.id !== id) }))
    )
    setOrphanVideos((prev) => prev.filter((v) => v.id !== id))
  }

  const updateOrder = async (videoId: string, order: number) => {
    await fetch('/api/library', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, order_number: order }),
    })
    const updateInList = (videos: Video[]) =>
      videos.map((v) => (v.id === videoId ? { ...v, order_number: order } : v))
    setFolders((prev) =>
      prev.map((f) => ({ ...f, videos: updateInList(f.videos) }))
    )
    setOrphanVideos((prev) => updateInList(prev))
  }

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setFolderTab = (folderId: string, tab: ImportTab) => {
    setActiveTabs((prev) => ({ ...prev, [folderId]: tab }))
  }

  const totalVideos = folders.reduce((s, f) => s + f.videos.length, 0) + orphanVideos.length

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              marginBottom: '4px',
            }}
          >
            Biblioteca
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {folders.length} pasta{folders.length !== 1 ? 's' : ''} · {totalVideos} vídeo
            {totalVideos !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNewFolder(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'opacity 200ms ease',
          }}
        >
          <FolderPlus size={14} /> Nova Pasta
        </button>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            padding: '16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <input
            ref={newFolderInputRef}
            type="text"
            placeholder="Nome da pasta (ex: Ação Julho Semana 1)"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createFolder()
              if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            onClick={createFolder}
            disabled={creatingFolder || !newFolderName.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              border: 'none',
              color: 'white',
              cursor: creatingFolder ? 'wait' : 'pointer',
              fontSize: '13px',
              opacity: !newFolderName.trim() ? 0.5 : 1,
            }}
          >
            {creatingFolder ? <Spinner size={12} /> : <Check size={14} />}
            Criar
          </button>
          <button
            onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: '1px solid var(--bg-border)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            padding: '32px 0',
          }}
        >
          <Spinner size={16} /> Carregando biblioteca...
        </div>
      )}

      {/* Empty state */}
      {!loading && folders.length === 0 && orphanVideos.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 32px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <FolderIcon size={32} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '15px',
              marginBottom: '8px',
            }}
          >
            Nenhuma pasta criada
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Clique em &ldquo;Nova Pasta&rdquo; para começar a organizar seus vídeos
          </p>
        </div>
      )}

      {/* Folder list */}
      {!loading && folders.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {folders.map((folder) => (
            <FolderSection
              key={folder.id}
              folder={folder}
              isExpanded={expandedFolders.has(folder.id)}
              onToggle={() => toggleFolder(folder.id)}
              onDelete={deleteFolder}
              onRename={renameFolder}
              onDeleteVideo={deleteVideo}
              onUpdateOrder={updateOrder}
              onImported={fetchAndSchedule}
              activeTab={activeTabs[folder.id] ?? 'manual'}
              onTabChange={(tab) => setFolderTab(folder.id, tab)}
            />
          ))}
        </div>
      )}

      {/* Orphan videos */}
      {!loading && orphanVideos.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <p
            style={{
              fontSize: '12px',
              fontWeight: '500',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px',
            }}
          >
            Sem pasta
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px',
            }}
          >
            {orphanVideos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onDelete={deleteVideo}
                onUpdateOrder={updateOrder}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
