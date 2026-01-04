module.exports = {
  port: 4000,
  logLevel: 'warn',
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
};
