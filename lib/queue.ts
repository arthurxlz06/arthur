import { Queue } from 'bullmq'
import IORedis from 'ioredis'

export const redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

export const publishQueue = new Queue('publish-jobs', { connection: redis })

export interface FrankenJobData {
  frankenstein_job_id: string
  hook_url: string
  body_url: string
  hook_ad_name: string
  body_ad_name: string
  dropbox_access_token: string
  dropbox_refresh_token: string | null
  user_id: string
}

export async function enqueueFrankenJob(data: FrankenJobData) {
  await publishQueue.add(`frankenstein-${data.frankenstein_job_id}`, data, {
    attempts: 2,
    backoff: { type: 'exponential' as const, delay: 3000 },
  })
}

export interface PublishJobData {
  publish_job_id: string
  video_storage_path: string | null
  external_url: string | null
  media_type: 'video' | 'image'
  meta_account_id: string
  facebook_access_token: string
  video_filename: string
}

export async function enqueuePublishJobs(
  jobsData: PublishJobData[],
  orderNumbers: number[]
) {
  const bulk = jobsData.map((data, i) => ({
    name: `publish-${data.publish_job_id}`,
    data,
    opts: {
      priority: orderNumbers[i],
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
    },
  }))
  await publishQueue.addBulk(bulk)
}
