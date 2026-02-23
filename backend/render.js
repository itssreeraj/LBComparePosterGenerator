const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const timeoutSeconds = Number(config.asyncRenderTimeoutSeconds);
const timeoutMilliseconds = Number(config.asyncRenderTimeoutMs);
const ASYNC_RENDER_TIMEOUT_MS = Number.isFinite(timeoutSeconds)
  ? timeoutSeconds * 1000
  : Number.isFinite(timeoutMilliseconds)
  ? timeoutMilliseconds
  : 120000;
const MAX_CONCURRENT_RENDERS = Number(config.maxConcurrentRenders) || 1;
const VIEWPORT_WIDTH = Number(config.viewportWidth) || 3840;
const MIN_VIEWPORT_HEIGHT = Number(config.minViewportHeight) || 1000;
const MAX_VIEWPORT_HEIGHT = Number(config.maxViewportHeight) || 4500;
const puppeteerConfig = config.puppeteer || {};
const PUPPETEER_LAUNCH_OPTIONS = {
  headless:
    typeof puppeteerConfig.headless === "boolean" ? puppeteerConfig.headless : "new",
  args:
    Array.isArray(puppeteerConfig.args) && puppeteerConfig.args.length > 0
      ? puppeteerConfig.args
      : ["--no-sandbox", "--disable-setuid-sandbox"],
};

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
let sharedBrowser = null;
let browserLaunchPromise = null;

function isBrowserConnected(browser) {
  if (!browser) return false;
  if (typeof browser.connected === "boolean") return browser.connected;
  if (typeof browser.isConnected === "function") return browser.isConnected();
  return true;
}

async function launchBrowser() {
  const browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS);
  browser.on("disconnected", () => {
    if (sharedBrowser === browser) {
      sharedBrowser = null;
    }
  });
  return browser;
}

async function getBrowser() {
  if (isBrowserConnected(sharedBrowser)) {
    return sharedBrowser;
  }

  if (!browserLaunchPromise) {
    browserLaunchPromise = (async () => {
      const browser = await launchBrowser();
      sharedBrowser = browser;
      return browser;
    })().finally(() => {
      browserLaunchPromise = null;
    });
  }

  return browserLaunchPromise;
}

async function generatePoster(data) {
  const release = await renderSemaphore.acquire();
  let page;

  try {
    const templateName =
      data.template === "combined"
        ? "combined-template.html"
        : data.template === "wards"
        ? "ward-template.html"
        : "vote-template.html";

    const templatePath = path.join(__dirname, "templates", templateName);
    let html = fs.readFileSync(templatePath, "utf8");
    html = html.replace("__DATA__", JSON.stringify(data));

    const browser = await getBrowser();
    page = await browser.newPage();

    page.setDefaultTimeout(ASYNC_RENDER_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(ASYNC_RENDER_TIMEOUT_MS);

    const requestedHeight = Number(data.height) || 5000;
    const clampedHeight = Math.min(
      Math.max(requestedHeight, MIN_VIEWPORT_HEIGHT),
      MAX_VIEWPORT_HEIGHT
    );

    await page.setViewport({
      width: VIEWPORT_WIDTH,
      height: clampedHeight,
      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: ASYNC_RENDER_TIMEOUT_MS,
    });

    const posterHandle = await page.$(".poster");
    if (!posterHandle) {
      throw new Error("Poster root (.poster) not found in template");
    }

    const imageBase64 = await posterHandle.screenshot({
      type: "png",
      encoding: "base64",
    });
    return imageBase64;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    release();
  }
}

module.exports = { generatePoster };
