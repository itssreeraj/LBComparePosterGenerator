module.exports = {
  port: 4000,
  logLevel: 'debug',
  asyncRenderTimeoutSeconds: Number(process.env.ASYNC_RENDER_TIMEOUT_SECONDS) || 120,
  maxConcurrentRenders: 2,
  puppeteer: {
    headless: true
  }
};

