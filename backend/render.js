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
const parsedConcurrentRenders = Number(
  config.maxConcurrentRenders ?? process.env.MAX_CONCURRENT_RENDERS
);
const MAX_CONCURRENT_RENDERS =
  Number.isFinite(parsedConcurrentRenders) && parsedConcurrentRenders > 0
    ? Math.floor(parsedConcurrentRenders)
    : 1;
const parsedMaxRenderQueue = Number(
  config.maxRenderQueue ?? process.env.MAX_RENDER_QUEUE
);
const MAX_RENDER_QUEUE =
  Number.isFinite(parsedMaxRenderQueue) && parsedMaxRenderQueue >= 0
    ? Math.floor(parsedMaxRenderQueue)
    : 1;
const parsedBrowserIdleTimeoutSeconds = Number(
  config.browserIdleTimeoutSeconds ?? process.env.BROWSER_IDLE_TIMEOUT_SECONDS
);
const BROWSER_IDLE_TIMEOUT_MS =
  Number.isFinite(parsedBrowserIdleTimeoutSeconds) &&
  parsedBrowserIdleTimeoutSeconds > 0
    ? Math.floor(parsedBrowserIdleTimeoutSeconds * 1000)
    : 60000;
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
const TEMPLATE_FILE_MAP = {
  combined: "combined-template.html",
  wards: "ward-template.html",
  vote: "vote-template.html",
};
const BASE_CSS_PATH = path.join(__dirname, "templates", "base.css");
const BASE_CSS_CONTENT = fs.readFileSync(BASE_CSS_PATH, "utf8");
const TEMPLATE_CACHE = Object.entries(TEMPLATE_FILE_MAP).reduce(
  (accumulator, [key, fileName]) => {
    const templatePath = path.join(__dirname, "templates", fileName);
    const templateHtml = fs
      .readFileSync(templatePath, "utf8")
      .split("__BASE_CSS__")
      .join(BASE_CSS_CONTENT);
    accumulator[key] = templateHtml;
    return accumulator;
  },
  {}
);
const SAFE_DEFAULT_COLOR = "#999999";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeColor(value) {
  const color = typeof value === "string" ? value.trim() : "";
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
    return color;
  }
  return SAFE_DEFAULT_COLOR;
}

function textOrEmpty(value) {
  return value === null || value === undefined ? "" : String(value);
}

function textOrDashFromNumber(value) {
  const number = toFiniteNumber(value);
  return number === null ? "-" : String(number);
}

function numberOrDefault(value, defaultValue) {
  const number = toFiniteNumber(value);
  return number === null ? defaultValue : number;
}

function formatNumber(value) {
  const number = toFiniteNumber(value);
  return number === null ? "-" : number.toLocaleString();
}

function percentOrDash(value) {
  const number = toFiniteNumber(value);
  return number === null ? "-" : `${number}%`;
}

function detectElectionType(yearText) {
  const upper = yearText.toUpperCase();
  if (upper.includes("LOKSABHA")) return "LOKSABHA";
  if (upper.includes("ASSEMBLY")) return "ASSEMBLY";
  if (upper.includes("GE")) return "GE";
  return "LOCALBODY";
}

function buildVoteTableRows(rows) {
  const maxVotes = rows.reduce((max, row) => {
    const votes = toFiniteNumber(row?.votes);
    return Math.max(max, votes === null ? 0 : votes);
  }, 0);

  return rows
    .map((row) => {
      const alliance = escapeHtml(textOrEmpty(row?.alliance || "OTH"));
      const color = sanitizeColor(row?.color);
      const votesNumber = toFiniteNumber(row?.votes);
      const votesText = escapeHtml(textOrDashFromNumber(votesNumber));
      const votesForBar = votesNumber === null ? 0 : votesNumber;
      const barWidth =
        maxVotes > 0 ? Math.max(0, Math.min((votesForBar / maxVotes) * 100, 100)) : 0;
      const percentText = escapeHtml(percentOrDash(row?.percent));

      return `
        <tr>
          <td><span class="alliance-dot" style="background:${color}"></span>${alliance}</td>
          <td>
            <div class="bar-track">
              <div class="bar-fill" style="width:${barWidth}%;background:${color};"></div>
              <div class="bar-text">${votesText}</div>
            </div>
          </td>
          <td>${percentText}</td>
        </tr>
      `;
    })
    .join("");
}

function buildPerformanceTableRows(rows) {
  return rows
    .map((row) => {
      const alliance = escapeHtml(textOrEmpty(row?.alliance || "OTH"));
      const color = sanitizeColor(row?.color);
      const winner = escapeHtml(textOrDashFromNumber(row?.winner));
      const runnerUp = escapeHtml(textOrDashFromNumber(row?.runnerUp));
      const third = escapeHtml(textOrDashFromNumber(row?.third));

      return `
        <tr>
          <td><span class="alliance-dot" style="background:${color}"></span>${alliance}</td>
          <td>${winner}</td>
          <td>${runnerUp}</td>
          <td>${third}</td>
        </tr>
      `;
    })
    .join("");
}

function buildVoteTableMarkup(rows) {
  return `
    <table class="vote-table">
      <thead><tr><th>Alliance</th><th>Votes</th><th>%</th></tr></thead>
      <tbody>${buildVoteTableRows(rows)}</tbody>
    </table>
  `;
}

function buildPerformanceTableMarkup(rows, tableClassName) {
  return `
    <table class="${tableClassName}">
      <thead><tr><th>Alliance</th><th>Win</th><th>2nd</th><th>3rd</th></tr></thead>
      <tbody>${buildPerformanceTableRows(rows)}</tbody>
    </table>
  `;
}

function buildYearColumnMarkup(yearData) {
  const yearText = textOrEmpty(yearData?.year);
  const electionType = detectElectionType(yearText);
  const isGeneralElection = electionType !== "LOCALBODY";
  const yearHeading = escapeHtml(yearText);
  const badgeClass = isGeneralElection ? "badge-ge" : "badge-localbody";
  const badgeText = escapeHtml(electionType);
  const notes = textOrEmpty(yearData?.notes).trim();
  let sections = "";

  if (!isGeneralElection) {
    const votes = asArray(yearData?.votes);
    const wards = asArray(yearData?.wards);

    sections += `<div class="section-label">Vote Share</div>`;
    sections += buildVoteTableMarkup(votes);
    sections += `<div class="section-label">Ward Performance</div>`;
    sections += buildPerformanceTableMarkup(wards, "ward-table");
  } else {
    const generalVotes = asArray(yearData?.generalVotes);
    const generalBooths = asArray(yearData?.generalBooths);
    const electionTypeLabel = escapeHtml(electionType);

    sections += `<div class="section-label">${electionTypeLabel} - Vote Share</div>`;
    sections += buildVoteTableMarkup(generalVotes);
    sections += `<div class="section-label">${electionTypeLabel} - Booth Summary</div>`;
    sections += buildPerformanceTableMarkup(generalBooths, "booth-table");
  }

  const notesMarkup = notes ? `<div class="year-notes">${escapeHtml(notes)}</div>` : "";

  return `
    <div class="year-column">
      <div class="year-heading-row">
        <div class="year-heading">${yearHeading}</div>
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
      ${sections}
      ${notesMarkup}
    </div>
  `;
}

function buildCombinedPosterMarkup(data) {
  const years = asArray(data?.years);
  const yearColumns = years.map((yearData) => buildYearColumnMarkup(yearData)).join("");

  let gridTemplateColumns = "repeat(1, 1fr)";
  if (years.length <= 3) {
    gridTemplateColumns = "repeat(3, 1fr)";
  } else if (years.length <= 6) {
    gridTemplateColumns = "repeat(2, 1fr)";
  }

  const district = escapeHtml(textOrEmpty(data?.district));
  const localbody = escapeHtml(textOrEmpty(data?.localbody));

  return `
    <div class="header">
      <div class="district">${district}</div>
      <div class="localbody">${localbody}</div>
    </div>
    <div class="years-grid" style="grid-template-columns:${gridTemplateColumns};">
      ${yearColumns}
    </div>
    <div class="watermark">@centerrightin</div>
    <div class="footer-watermark">@centerrightin</div>
  `;
}

function buildVoteRowsMarkup(rows) {
  const maxVotes = rows.reduce((max, row) => {
    const votes = numberOrDefault(row?.votes, 0);
    return Math.max(max, votes);
  }, 0);

  return rows
    .map((row) => {
      const alliance = escapeHtml(textOrEmpty(row?.alliance || "Alliance"));
      const color = sanitizeColor(row?.color);
      const votes = numberOrDefault(row?.votes, 0);
      const voteDisplay = escapeHtml(formatNumber(row?.votes));
      const proportion = maxVotes > 0 ? Math.max(0, Math.min(votes / maxVotes, 1)) : 0;
      const percentDisplay = escapeHtml(percentOrDash(row?.percent));

      return `
        <div class="row">
          <div class="alliance-cell">
            <div class="tag" style="background:${color};"></div>
            <div>${alliance}</div>
          </div>
          <div>
            <div class="vote-bar-wrapper">
              <div class="vote-bar-fill" style="background:${color};width:${proportion * 100}%;"></div>
              <div class="vote-text">${voteDisplay}</div>
            </div>
          </div>
          <div class="percent-cell">${percentDisplay}</div>
        </div>
      `;
    })
    .join("");
}

function buildVoteYearBlockMarkup(yearBlock) {
  const yearTitle = escapeHtml(textOrEmpty(yearBlock?.year));
  const rows = asArray(yearBlock?.rows);

  return `
    <div class="year-block">
      <div class="section-title">${yearTitle}</div>
      <div class="table-header">
        <div>Alliance</div>
        <div>Votes</div>
        <div>Vote %</div>
      </div>
      ${buildVoteRowsMarkup(rows)}
    </div>
  `;
}

function buildVotePosterMarkup(data) {
  const localbody = escapeHtml(textOrEmpty(data?.localbody));
  const district = textOrEmpty(data?.district).trim();
  const subtitleText = district ? `(${district})` : "";
  const subtitle = escapeHtml(subtitleText);
  const years = asArray(data?.years);
  const gridColumns = years.length === 2 ? "1fr 1fr" : "1fr";
  const yearBlocksMarkup = years.map((year) => buildVoteYearBlockMarkup(year)).join("");

  return `
    <div class="header">
      <div class="title">${localbody}</div>
      <div class="subtitle">${subtitle}</div>
    </div>
    <div style="display:grid;grid-template-columns:${gridColumns};gap:32px;">
      ${yearBlocksMarkup}
    </div>
    <div class="footer">
      <span>Generated by <strong>CentreRightIN</strong></span>
      &nbsp;·&nbsp;
      <a href="https://x.com/CentrerightIN" style="color:#60a5fa;text-decoration:none;font-weight:600;" target="_blank">@CentrerightIN</a>
    </div>
  `;
}

function buildWardRowsMarkup(rows) {
  return rows
    .map((row) => {
      const alliance = escapeHtml(textOrEmpty(row?.alliance || "Alliance"));
      const color = sanitizeColor(row?.color);
      const first = numberOrDefault(row?.first, 0);
      const second = numberOrDefault(row?.second, 0);
      const third = numberOrDefault(row?.third, 0);

      return `
        <div class="row">
          <div class="tag" style="background:${color};">${alliance}</div>
          <div class="value">1st: ${first}  ·  2nd: ${second}  ·  3rd: ${third}</div>
        </div>
      `;
    })
    .join("");
}

function buildWardPosterMarkup(data) {
  const localbody = escapeHtml(textOrEmpty(data?.localbody || "Localbody Name"));
  const district = textOrEmpty(data?.district).trim();
  const caption = textOrEmpty(data?.caption).trim();
  const sectionTitle = escapeHtml(textOrEmpty(data?.sectionTitle || "Ward Performance"));
  const subtitleText = `${district ? `(${district})` : ""}${caption ? `${district ? " · " : ""}${caption}` : ""}`;
  const subtitle = escapeHtml(subtitleText);
  const rows = asArray(data?.rows);

  return `
    <div class="header">
      <div class="title">${localbody}</div>
      <div class="subtitle">${subtitle}</div>
    </div>
    <div class="section-title">${sectionTitle}</div>
    ${buildWardRowsMarkup(rows)}
    <div class="footer">
      <span>Generated by <strong>CentreRightIN</strong></span>
      &nbsp;·&nbsp;
      <a href="https://x.com/CentrerightIN" style="color:#60a5fa;text-decoration:none;font-weight:600;" target="_blank">@CentrerightIN</a>
    </div>
  `;
}

class Semaphore {
  constructor(limit, maxQueue) {
    this.limit = limit;
    this.maxQueue = maxQueue;
    this.active = 0;
    this.waiters = [];
  }

  async acquire() {
    if (this.active >= this.limit) {
      if (this.waiters.length >= this.maxQueue) {
        const error = new Error("Render queue is full");
        error.code = "RENDER_QUEUE_FULL";
        throw error;
      }
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

const renderSemaphore = new Semaphore(MAX_CONCURRENT_RENDERS, MAX_RENDER_QUEUE);
let sharedBrowser = null;
let browserLaunchPromise = null;
let activeRenderCount = 0;
let idleBrowserCloseTimer = null;
let pagePool = [];
const configuredPages = new WeakSet();

function isBrowserConnected(browser) {
  if (!browser) return false;
  if (typeof browser.connected === "boolean") return browser.connected;
  if (typeof browser.isConnected === "function") return browser.isConnected();
  return true;
}

function clearIdleBrowserCloseTimer() {
  if (idleBrowserCloseTimer) {
    clearTimeout(idleBrowserCloseTimer);
    idleBrowserCloseTimer = null;
  }
}

function clearPagePool() {
  pagePool = [];
}

function shouldAllowPageRequest(request) {
  const url = request.url();
  if (
    url.startsWith("about:") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return true;
  }

  return request.resourceType() === "document";
}

async function configurePageForRendering(page) {
  if (configuredPages.has(page)) {
    return;
  }

  page.setDefaultTimeout(ASYNC_RENDER_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(ASYNC_RENDER_TIMEOUT_MS);
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const action = shouldAllowPageRequest(request)
      ? request.continue()
      : request.abort();
    action.catch(() => {});
  });

  configuredPages.add(page);
}

async function createConfiguredPage(browser) {
  const page = await browser.newPage();
  await configurePageForRendering(page);
  return page;
}

async function acquirePooledPage(browser) {
  while (pagePool.length > 0) {
    const pooledPage = pagePool.pop();
    if (pooledPage && !pooledPage.isClosed()) {
      try {
        await configurePageForRendering(pooledPage);
        return pooledPage;
      } catch {
        await pooledPage.close().catch(() => {});
      }
    }
  }

  return createConfiguredPage(browser);
}

async function releasePooledPage(browser, page) {
  if (!page) {
    return;
  }

  if (!isBrowserConnected(browser) || page.isClosed()) {
    return;
  }

  try {
    await page.goto("about:blank", {
      waitUntil: "domcontentloaded",
      timeout: ASYNC_RENDER_TIMEOUT_MS,
    });
  } catch {
    await page.close().catch(() => {});
    return;
  }

  if (!isBrowserConnected(browser) || page.isClosed()) {
    return;
  }

  pagePool.push(page);
}

async function closeSharedBrowserIfIdle() {
  if (activeRenderCount > 0) {
    return;
  }

  const browser = sharedBrowser;
  if (!isBrowserConnected(browser)) {
    sharedBrowser = null;
    clearPagePool();
    return;
  }

  sharedBrowser = null;
  clearPagePool();
  await browser.close().catch(() => {});
}

function scheduleIdleBrowserClose() {
  clearIdleBrowserCloseTimer();

  if (BROWSER_IDLE_TIMEOUT_MS <= 0) {
    return;
  }

  idleBrowserCloseTimer = setTimeout(() => {
    idleBrowserCloseTimer = null;
    closeSharedBrowserIfIdle().catch((error) => {
      console.error("Idle browser close failed:", error);
    });
  }, BROWSER_IDLE_TIMEOUT_MS);

  if (typeof idleBrowserCloseTimer.unref === "function") {
    idleBrowserCloseTimer.unref();
  }
}

async function launchBrowser() {
  const browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS);
  browser.on("disconnected", () => {
    if (sharedBrowser === browser) {
      sharedBrowser = null;
    }
    clearIdleBrowserCloseTimer();
    clearPagePool();
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
  activeRenderCount += 1;
  clearIdleBrowserCloseTimer();
  let browser;
  let page;

  try {
    const templateKey =
      data.template === "combined"
        ? "combined"
        : data.template === "wards"
        ? "wards"
        : "vote";

    const templateHtml = TEMPLATE_CACHE[templateKey];
    if (!templateHtml) {
      throw new Error(`Unknown template key '${templateKey}'`);
    }

    let html;
    if (templateKey === "combined") {
      if (!templateHtml.includes("__COMBINED_CONTENT__")) {
        throw new Error("Combined template placeholder not found");
      }
      html = templateHtml.replace("__COMBINED_CONTENT__", buildCombinedPosterMarkup(data));
    } else if (templateKey === "vote") {
      if (!templateHtml.includes("__VOTE_CONTENT__")) {
        throw new Error("Vote template placeholder not found");
      }
      html = templateHtml.replace("__VOTE_CONTENT__", buildVotePosterMarkup(data));
    } else if (templateKey === "wards") {
      if (!templateHtml.includes("__WARD_CONTENT__")) {
        throw new Error("Ward template placeholder not found");
      }
      html = templateHtml.replace("__WARD_CONTENT__", buildWardPosterMarkup(data));
    } else {
      throw new Error(`Unhandled template key '${templateKey}'`);
    }

    browser = await getBrowser();
    page = await acquirePooledPage(browser);

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
      waitUntil: "domcontentloaded",
      timeout: ASYNC_RENDER_TIMEOUT_MS,
    });

    const posterHandle = await page.$(".poster");
    if (!posterHandle) {
      throw new Error("Poster root (.poster) not found in template");
    }

    const imageBuffer = await posterHandle.screenshot({
      type: "png",
    });
    return imageBuffer;
  } finally {
    await releasePooledPage(browser, page);
    activeRenderCount = Math.max(0, activeRenderCount - 1);
    release();
    if (activeRenderCount === 0) {
      scheduleIdleBrowserClose();
    }
  }
}

module.exports = { generatePoster };
