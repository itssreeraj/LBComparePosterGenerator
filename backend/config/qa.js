module.exports = {
  port: 4100,
  logLevel: 'info',
  asyncRenderTimeoutSeconds: Number(process.env.ASYNC_RENDER_TIMEOUT_SECONDS) || 120,
  puppeteer: {
    headless: true
  }
};

