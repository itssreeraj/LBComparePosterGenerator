module.exports = {
  port: 4000,
  logLevel: 'warn',
  asyncRenderTimeoutSeconds: Number(process.env.ASYNC_RENDER_TIMEOUT_SECONDS) || 120,
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
};

