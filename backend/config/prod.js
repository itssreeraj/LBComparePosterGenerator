module.exports = {
  port: 4000,
  logLevel: 'warn',
  asyncRenderTimeoutMs: 120000,
  maxConcurrentRenders: 2,
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
};

