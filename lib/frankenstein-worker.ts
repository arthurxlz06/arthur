import { Job } from 'bullmq'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { promises as fs } from 'fs'
import path from 'path'
import { getSupabaseAdmin } from './supabase'
import type { FrankenJobData } from './queue'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

async function getDropboxTempLink(token: string, filePath: string): Promise<string> {
  const res = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  })
  const data = await res.json() as { link?: string; error_summary?: string }
  if (!data.link) throw new Error(`Dropbox temp link falhou para ${filePath}: ${data.error_summary ?? 'sem link'}`)
  return data.link
}

async function refreshDropboxToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.DROPBOX_APP_KEY!,
      client_secret: process.env.DROPBOX_APP_SECRET!,
    }),
  })
  const data = await res.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Falha ao renovar token Dropbox')
  return data.access_token
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download falhou: ${res.status} ${url}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(destPath, buffer)
}

async function uploadToDropbox(token: string, localPath: string, dropboxPath: string): Promise<void> {
  const content = await fs.readFile(localPath)
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: dropboxPath,
        mode: 'add',
        autorename: true,
        mute: false,
      }),
    },
    body: content,
  })
  const data = await res.json() as { path_lower?: string; error_summary?: string }
  if (!data.path_lower) throw new Error(`Upload Dropbox falhou: ${data.error_summary ?? 'sem path'}`)
}

function runFfmpeg(hookPath: string, bodyPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(hookPath)
      .input(bodyPath)
      .complexFilter([
        '[0:v]trim=end=3,setpts=PTS-STARTPTS[v0]',
        '[1:v]trim=start=3,setpts=PTS-STARTPTS[v1]',
        '[0:a]atrim=end=3,asetpts=PTS-STARTPTS[a0]',
        '[1:a]atrim=start=3,asetpts=PTS-STARTPTS[a1]',
        '[v0][a0][v1][a1]concat=n=2:v=1:a=1[vout][aout]',
      ])
      .outputOptions(['-map [vout]', '-map [aout]', '-c:v libx264', '-c:a aac', '-movflags +faststart'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run()
  })
}

export async function processFrankenJob(job: Job<FrankenJobData>): Promise<void> {
  const { frankenstein_job_id, hook_path, body_path, dropbox_access_token, dropbox_refresh_token, user_id } = job.data
  const supabase = getSupabaseAdmin()
  const tmpDir = '/tmp'
  const id = frankenstein_job_id
  const hookTmp = path.join(tmpDir, `hook-${id}.mp4`)
  const bodyTmp = path.join(tmpDir, `body-${id}.mp4`)
  const outTmp = path.join(tmpDir, `out-${id}.mp4`)

  await supabase.from('frankenstein_jobs').update({ status: 'processing' }).eq('id', id)

  try {
    let token = dropbox_access_token

    // Get temp links (with refresh on failure)
    let hookLink: string
    let bodyLink: string
    try {
      hookLink = await getDropboxTempLink(token, hook_path)
      bodyLink = await getDropboxTempLink(token, body_path)
    } catch {
      if (!dropbox_refresh_token) throw new Error('Token Dropbox expirado e sem refresh token')
      token = await refreshDropboxToken(dropbox_refresh_token)
      await supabase.from('users').update({ dropbox_access_token: token }).eq('id', user_id)
      hookLink = await getDropboxTempLink(token, hook_path)
      bodyLink = await getDropboxTempLink(token, body_path)
    }

    await downloadFile(hookLink, hookTmp)
    await downloadFile(bodyLink, bodyTmp)

    await runFfmpeg(hookTmp, bodyTmp, outTmp)

    const timestamp = Date.now()
    const outputDropboxPath = `/frankenstein/${timestamp}.mp4`
    await uploadToDropbox(token, outTmp, outputDropboxPath)

    await supabase.from('frankenstein_jobs').update({
      status: 'done',
      output_path: outputDropboxPath,
      finished_at: new Date().toISOString(),
    }).eq('id', id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('frankenstein_jobs').update({
      status: 'failed',
      error_msg: msg,
      finished_at: new Date().toISOString(),
    }).eq('id', id)
    throw err
  } finally {
    await Promise.allSettled([
      fs.unlink(hookTmp).catch(() => null),
      fs.unlink(bodyTmp).catch(() => null),
      fs.unlink(outTmp).catch(() => null),
    ])
  }
}
