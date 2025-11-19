const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function generatePoster(data) {
  const templateName = data.template === "wards" ? "ward-template.html" : "vote-template.html";
  const templatePath = path.join(__dirname, "templates", templateName);

  let html = fs.readFileSync(templatePath, "utf8");
  // Inject JSON payload
  html = html.replace("__DATA__", JSON.stringify(data));

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 2000,
    height: data.height || 2500,
    deviceScaleFactor: 2,
  });

  await page.setContent(html, { waitUntil: "networkidle0" });

  // Return base64-encoded PNG
  const imageBase64 = await page.screenshot({
    type: "png",
    fullPage: true,
    encoding: "base64",
  });

  await browser.close();
  return imageBase64;
}

module.exports = { generatePoster };
