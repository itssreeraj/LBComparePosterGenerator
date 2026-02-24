module.exports = {
  port: 4000,
  logLevel: 'warn',
  asyncRenderTimeoutSeconds: Number(process.env.ASYNC_RENDER_TIMEOUT_SECONDS) || 120,
  viewportWidth: Number(process.env.VIEWPORT_WIDTH) || 1400,
  minViewportHeight: Number(process.env.MIN_VIEWPORT_HEIGHT) || 1000,
  maxViewportHeight: Number(process.env.MAX_VIEWPORT_HEIGHT) || 4500,
  maxConcurrentRenders: Number(process.env.MAX_CONCURRENT_RENDERS) || 1,
  maxRenderQueue: Number(process.env.MAX_RENDER_QUEUE) || 1,
  browserIdleTimeoutSeconds: Number(process.env.BROWSER_IDLE_TIMEOUT_SECONDS) || 60,
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
};
