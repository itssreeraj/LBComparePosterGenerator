const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const config = require("./config");

const ASYNC_RENDER_TIMEOUT_MS = config.asyncRenderTimeoutMs || 120000;

async function generatePoster(data) {
  // Pick template based on data.template
  const templateName =
    data.template === "combined"
      ? "combined-template.html"
      : data.template === "wards"
      ? "ward-template.html"
      : "vote-template.html";

  const templatePath = path.join(__dirname, "templates", templateName);

  let html = fs.readFileSync(templatePath, "utf8");
  // Inject JSON payload
  html = html.replace("__DATA__", JSON.stringify(data));

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(ASYNC_RENDER_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(ASYNC_RENDER_TIMEOUT_MS);

  await page.evaluate(() => {
    document.body.style.zoom = "200%"; 
  });

  await page.setViewport({
    width: 3840,
    height: data.height || 5000,
    deviceScaleFactor: 1,
  });

  await page.setContent(html, {
    waitUntil: "networkidle0",
    timeout: ASYNC_RENDER_TIMEOUT_MS,
  });

  // ❗ Crop exactly to the poster container to avoid extra white space
  const posterHandle = await page.$(".poster");
  const imageBase64 = await posterHandle.screenshot({
    type: "png",
    encoding: "base64",
  });

  await browser.close();
  return imageBase64;
}

module.exports = { generatePoster };
