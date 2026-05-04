export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  facebook_user_id: string | null
  created_at: string
}

export interface BusinessManager {
  id: string
  user_id: string
  meta_bm_id: string
  name: string | null
  connected_at: string
}

export interface AdAccount {
  id: string
  bm_id: string
  meta_account_id: string
  name: string | null
  status: string
  is_selected: boolean
}

export interface Folder {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Video {
  id: string
  folder_id: string | null
  user_id: string
  filename: string
  storage_path: string
  order_number: number | null
  duration_seconds: number | null
  size_bytes: number | null
  import_source: 'manual' | 'gdrive' | 'dropbox'
  import_status: 'importing' | 'ready' | 'error'
  import_error: string | null
  uploaded_at: string
}

export interface PublishJob {
  id: string
  video_id: string
  ad_account_id: string
  user_id: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  meta_video_id: string | null
  error_message: string | null
  queued_at: string
  finished_at: string | null
}
