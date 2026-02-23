module.exports = {
  port: 4000,
  logLevel: 'debug',
  asyncRenderTimeoutSeconds: Number(process.env.ASYNC_RENDER_TIMEOUT_SECONDS) || 120,
  maxRenderQueue: Number(process.env.MAX_RENDER_QUEUE) || 1,
  puppeteer: {
    headless: true
  }
};
