const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const ASYNC_RENDER_TIMEOUT_MS = config.asyncRenderTimeoutMs || 120000;
const MAX_CONCURRENT_RENDERS = config.maxConcurrentRenders || 2;
const MAX_RENDER_RETRIES = config.maxRenderRetries || 1;
const MAX_VIEWPORT_HEIGHT = config.maxViewportHeight || 10000;
const MIN_VIEWPORT_HEIGHT = config.minViewportHeight || 1000;

const TEMPLATE_FILES = {
  combined: "combined-template.html",
  wards: "ward-template.html",
  votes: "vote-template.html",
};

const TEMPLATE_CACHE = Object.fromEntries(
  Object.entries(TEMPLATE_FILES).map(([key, fileName]) => [
    key,
    fs.readFileSync(path.join(__dirname, "templates", fileName), "utf8"),
  ])
);

let browserPromise = null;

class Semaphore {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.waiters = [];
  }

  async acquire() {
    if (this.active >= this.limit) {
      await new Promise((resolve) => this.waiters.push(resolve));
    }

    this.active += 1;
    return () => {
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) next();
    };
  }
}

const renderSemaphore = new Semaphore(MAX_CONCURRENT_RENDERS);

function isTargetClosedError(err) {
  if (!err) return false;
  const message = String(err.message || err);
  return (
    message.includes("Target closed") ||
    message.includes("Session closed") ||
    message.includes("Protocol error (Runtime.callFunctionOn)")
  );
}

async function resetBrowser() {
  const existing = browserPromise;
  browserPromise = null;
  if (!existing) return;

  try {
    const browser = await existing;
    if (browser && browser.connected) {
      await browser.close().catch(() => {});
    }
  } catch (_) {
    // Ignore; browser likely already crashed.
  }
}

async function getBrowser() {
  if (!browserPromise) {
    const puppeteerConfig = config.puppeteer || {};
    const launchArgs =
      Array.isArray(puppeteerConfig.args) && puppeteerConfig.args.length > 0
        ? puppeteerConfig.args
        : ["--no-sandbox", "--disable-setuid-sandbox"];

    browserPromise = puppeteer
      .launch({
        headless: puppeteerConfig.headless === false ? false : "new",
        args: launchArgs,
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });

    const browser = await browserPromise;
    browser.once("disconnected", () => {
      browserPromise = null;
    });
  }

  return browserPromise;
}

async function generatePoster(data) {
  const templateKey =
    data.template === "combined"
      ? "combined"
      : data.template === "wards"
      ? "wards"
      : "votes";

  const templateHtml = TEMPLATE_CACHE[templateKey];
  if (!templateHtml) {
    throw new Error(`Template not found for key: ${templateKey}`);
  }

  const html = templateHtml.replace("__DATA__", JSON.stringify(data));
  const release = await renderSemaphore.acquire();

  try {
    for (let attempt = 0; attempt <= MAX_RENDER_RETRIES; attempt += 1) {
      const browser = await getBrowser();
      const page = await browser.newPage();
      let posterHandle = null;

      try {
        page.setDefaultTimeout(ASYNC_RENDER_TIMEOUT_MS);
        page.setDefaultNavigationTimeout(ASYNC_RENDER_TIMEOUT_MS);

        const requestedHeight = Number(data.height) || 5000;
        const clampedHeight = Math.min(
          Math.max(requestedHeight, MIN_VIEWPORT_HEIGHT),
          MAX_VIEWPORT_HEIGHT
        );

        await page.setViewport({
          width: 3840,
          height: clampedHeight,
          deviceScaleFactor: 1,
        });

        await page.setContent(html, {
          waitUntil: "domcontentloaded",
          timeout: ASYNC_RENDER_TIMEOUT_MS,
        });

        await page.evaluate(async () => {
          if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
          }
        });

        posterHandle = await page.$(".poster");
        if (!posterHandle) {
          throw new Error("Poster root (.poster) not found in template");
        }

        return posterHandle.screenshot({
          type: "png",
          encoding: "base64",
        });
      } catch (err) {
        const shouldRetry =
          attempt < MAX_RENDER_RETRIES && isTargetClosedError(err);

        if (!shouldRetry) {
          throw err;
        }

        await resetBrowser();
      } finally {
        if (posterHandle) {
          await posterHandle.dispose().catch(() => {});
        }
        await page.close().catch(() => {});
      }
    }
  } finally {
    release();
  }
}

module.exports = { generatePoster };
