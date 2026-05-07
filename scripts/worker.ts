import '../lib/worker'

console.log('[Worker] Processo de publicação iniciado')

process.on('SIGTERM', async () => {
  const { publishWorker } = await import('../lib/worker')
  await publishWorker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  const { publishWorker } = await import('../lib/worker')
  await publishWorker.close()
  process.exit(0)
})
