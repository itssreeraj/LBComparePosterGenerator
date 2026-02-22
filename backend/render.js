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
const VIEWPORT_WIDTH = Number(config.viewportWidth) || 3840;
const MIN_VIEWPORT_HEIGHT = Number(config.minViewportHeight) || 1000;
const MAX_VIEWPORT_HEIGHT = Number(config.maxViewportHeight) || 4500;

async function generatePoster(data) {
  const templateName =
    data.template === "combined"
      ? "combined-template.html"
      : data.template === "wards"
      ? "ward-template.html"
      : "vote-template.html";

  const templatePath = path.join(__dirname, "templates", templateName);
  let html = fs.readFileSync(templatePath, "utf8");
  html = html.replace("__DATA__", JSON.stringify(data));

  const puppeteerConfig = config.puppeteer || {};
  const browser = await puppeteer.launch({
    headless:
      typeof puppeteerConfig.headless === "boolean"
        ? puppeteerConfig.headless
        : "new",
    args:
      Array.isArray(puppeteerConfig.args) && puppeteerConfig.args.length > 0
        ? puppeteerConfig.args
        : ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
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
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

module.exports = { generatePoster };
