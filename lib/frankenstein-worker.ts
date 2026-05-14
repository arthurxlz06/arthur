import { Job } from 'bullmq'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { promises as fs } from 'fs'
import path from 'path'
import { getSupabaseAdmin } from './supabase'
import type { FrankenJobData } from './queue'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download falhou (${res.status}): ${url}`)
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

function runFfmpeg(hookPath: string, bodyPath: string, outputPath: string, cutSeconds: number): Promise<void> {
  const c = cutSeconds
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(hookPath)
      .input(bodyPath)
      .complexFilter([
        `[0:v]trim=end=${c},setpts=PTS-STARTPTS[v0]`,
        `[1:v]trim=start=${c},setpts=PTS-STARTPTS[v1]`,
        `[0:a]atrim=end=${c},asetpts=PTS-STARTPTS[a0]`,
        `[1:a]atrim=start=${c},asetpts=PTS-STARTPTS[a1]`,
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
  const { frankenstein_job_id, hook_url, body_url, user_id, dropbox_access_token, dropbox_refresh_token, cut_seconds } = job.data
  const supabase = getSupabaseAdmin()
  const id = frankenstein_job_id
  const tmpDir = '/tmp'
  const hookTmp = path.join(tmpDir, `hook-${id}.mp4`)
  const bodyTmp = path.join(tmpDir, `body-${id}.mp4`)
  const outTmp  = path.join(tmpDir, `out-${id}.mp4`)

  await supabase.from('frankenstein_jobs').update({ status: 'processing' }).eq('id', id)

  try {
    // Download directly via share URL — no Dropbox token needed
    await downloadFile(hook_url, hookTmp)
    await downloadFile(body_url, bodyTmp)

    await runFfmpeg(hookTmp, bodyTmp, outTmp, cut_seconds ?? 3)

    // Upload result to Dropbox (token needed only here)
    let token = dropbox_access_token
    const outputDropboxPath = `/frankenstein/${Date.now()}.mp4`

    try {
      await uploadToDropbox(token, outTmp, outputDropboxPath)
    } catch {
      if (!dropbox_refresh_token) throw new Error('Token Dropbox expirado e sem refresh token para upload')
      token = await refreshDropboxToken(dropbox_refresh_token)
      await supabase.from('users').update({ dropbox_access_token: token }).eq('id', user_id)
      await uploadToDropbox(token, outTmp, outputDropboxPath)
    }

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
