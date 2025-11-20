const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function generatePoster(data) {
  const templateName = data.template === "wards" ? "ward-template.html" : "vote-template.html";
  const templatePath = path.join(__dirname, "templates", templateName);

  let html = fs.readFileSync(templatePath, "utf8");
  html = html.replace("__DATA__", JSON.stringify(data));

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Mobile-friendly width, auto-height
  await page.setViewport({
    width: 1080,
    height: 10,
    deviceScaleFactor: 2,
  });

  await page.setContent(html, { waitUntil: "networkidle0" });

  // Measure actual content height
  const rect = await page.evaluate(() => {
    const r = document.body.getBoundingClientRect();
    return {
      x: 0,
      y: 0,
      width: Math.max(r.width, 1080),
      height: Math.max(r.height, 200) // avoid clipping too small
    };
  });

  const imageBase64 = await page.screenshot({
    type: "png",
    fullPage: false,
    clip: {
      x: 0,
      y: 0,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height)
    },
    encoding: "base64",
  });

  await browser.close();
  return imageBase64;
}

module.exports = { generatePoster };
