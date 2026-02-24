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
  "assembly-overview": "assembly-overview-template.html",
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
const ALLIANCE_COLOR_MAP = {
  LDF: "#ef4444",
  UDF: "#16a34a",
  NDA: "#f97316",
  IND: "#3b82f6",
  OTH: "#9ca3af",
};
const LOG_LEVEL_WEIGHT = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel(level) {
  const normalized = String(level || "").toLowerCase();
  return LOG_LEVEL_WEIGHT[normalized] ? normalized : "info";
}

const RENDER_LOG_LEVEL = resolveLogLevel(
  process.env.RENDER_LOG_LEVEL || config.logLevel || "info"
);

function shouldLog(level) {
  return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[RENDER_LOG_LEVEL];
}

function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name,
    message: error.message,
    code: error.code,
  };
}

function renderLog(level, event, meta = {}) {
  if (!shouldLog(level)) return;

  const payload = {
    ts: new Date().toISOString(),
    scope: "render",
    level,
    event,
    ...meta,
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

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

function getAllianceColor(alliance) {
  const normalizedAlliance = textOrEmpty(alliance).trim().toUpperCase();
  return ALLIANCE_COLOR_MAP[normalizedAlliance] || SAFE_DEFAULT_COLOR;
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

function normalizeResultType(type) {
  const normalizedType = textOrEmpty(type).trim().toUpperCase();
  if (normalizedType === "ASSEMBLY") return "ASSEMBLY";
  if (normalizedType === "LOKSABHA") return "LOKSABHA";
  if (normalizedType === "LOCALBODY") return "LOCALBODY";
  return "OTHER";
}

function formatPercentWithTwoDecimals(value) {
  const number = toFiniteNumber(value);
  return number === null ? "-" : `${number.toFixed(2)}%`;
}

function buildAssemblyVoteRowsMarkup(rows) {
  const rankedRows = rows
    .slice()
    .sort(
      (left, right) =>
        numberOrDefault(right?.votes, 0) - numberOrDefault(left?.votes, 0)
    )
    .slice(0, 4);

  const maxVotes = rankedRows.reduce((max, row) => {
    const votes = numberOrDefault(row?.votes, 0);
    return Math.max(max, votes);
  }, 0);

  return rankedRows
    .map((row) => {
      const allianceRaw = textOrEmpty(row?.alliance || "OTH").trim().toUpperCase() || "OTH";
      const alliance = escapeHtml(allianceRaw);
      const color = sanitizeColor(row?.color || getAllianceColor(allianceRaw));
      const votes = numberOrDefault(row?.votes, 0);
      const voteDisplay = escapeHtml(formatNumber(row?.votes));
      const proportion = maxVotes > 0 ? Math.max(0, Math.min(votes / maxVotes, 1)) : 0;
      const percentDisplay = escapeHtml(
        formatPercentWithTwoDecimals(row?.percentage ?? row?.percent)
      );

      return `
        <div class="assembly-vote-row">
          <div class="assembly-alliance-cell">
            <span class="assembly-alliance-dot" style="background:${color};"></span>
            <span>${alliance}</span>
          </div>
          <div class="assembly-vote-bar-track">
            <div class="assembly-vote-bar-fill" style="background:${color};width:${proportion * 100}%;"></div>
            <div class="assembly-vote-bar-text">${voteDisplay}</div>
          </div>
          <div class="assembly-percent-cell">${percentDisplay}</div>
        </div>
      `;
    })
    .join("");
}

function buildAssemblyResultCardMarkup(result) {
  const year = escapeHtml(textOrEmpty(result?.year));
  const type = normalizeResultType(result?.type);
  const winner = escapeHtml(textOrEmpty(result?.winner || "-"));
  const runnerUp = escapeHtml(textOrEmpty(result?.runnerUp || "-"));
  const margin = escapeHtml(formatNumber(result?.margin));
  const voteRows = asArray(result?.voteShare);
  const rowsMarkup = buildAssemblyVoteRowsMarkup(voteRows);

  return `
    <div class="assembly-result-card">
      <div class="assembly-result-head">
        <div class="assembly-result-year">${year}</div>
        <div class="assembly-type-badge assembly-type-${type.toLowerCase()}">${escapeHtml(type)}</div>
      </div>
      <div class="assembly-summary-grid">
        <div class="assembly-summary-item">
          <div class="assembly-summary-label">Winner</div>
          <div class="assembly-summary-value">${winner}</div>
        </div>
        <div class="assembly-summary-item">
          <div class="assembly-summary-label">Runner-up</div>
          <div class="assembly-summary-value">${runnerUp}</div>
        </div>
        <div class="assembly-summary-item">
          <div class="assembly-summary-label">Margin</div>
          <div class="assembly-summary-value">${margin}</div>
        </div>
      </div>
      <div class="assembly-vote-header">
        <div>Alliance</div>
        <div>Votes</div>
        <div class="assembly-vote-header-percent">%</div>
      </div>
      ${rowsMarkup || '<div class="assembly-no-data">No vote share data</div>'}
    </div>
  `;
}

function buildAssemblyOverviewPosterMarkup(data) {
  const assembly = data && typeof data.assembly === "object" ? data.assembly : {};
  const titleText = textOrEmpty(assembly?.name).trim() || "Assembly Overview";
  const districtText = textOrEmpty(assembly?.district?.name).trim();
  const lsText = textOrEmpty(assembly?.ls?.name).trim();
  const metaPills = [];
  if (districtText) {
    metaPills.push(`<span class="assembly-meta-pill">District: ${escapeHtml(districtText)}</span>`);
  }
  if (lsText) {
    metaPills.push(`<span class="assembly-meta-pill">Lok Sabha: ${escapeHtml(lsText)}</span>`);
  }

  const results = asArray(data?.historicResults)
    .slice()
    .sort((left, right) => numberOrDefault(left?.year, 0) - numberOrDefault(right?.year, 0));
  const rowMarkupList = [];
  for (let index = 0; index < results.length; index += 2) {
    const rowResults = results.slice(index, index + 2);
    const rowColumns = rowResults.length <= 1 ? "1fr" : "1fr 1fr";
    const rowCardsMarkup = rowResults
      .map((result) => buildAssemblyResultCardMarkup(result))
      .join("");
    rowMarkupList.push(`
      <div class="assembly-row">
        <div class="assembly-row-watermark">@centerrightin</div>
        <div class="assembly-row-cards" style="grid-template-columns:${rowColumns};">
          ${rowCardsMarkup}
        </div>
      </div>
    `);
  }
  const rowsMarkup = rowMarkupList.join("");
  const metaRowMarkup = metaPills.length
    ? `<div class="assembly-meta-row">${metaPills.join("")}</div>`
    : "";
  const noteText =
    textOrEmpty(data?.posterNote).trim() ||
    "General election results exclude postal ballots. Only EVM votes are included.";

  return `
    <div class="header">
      <div class="title">${escapeHtml(titleText)}</div>
      <div class="subtitle">Assembly Results Overview</div>
      ${metaRowMarkup}
    </div>
    <div class="assembly-results-grid">
      ${rowsMarkup || '<div class="assembly-empty-state">No historic election results available.</div>'}
    </div>
    <div class="assembly-note">
      <strong>Note:</strong> ${escapeHtml(noteText)}
    </div>
    <div class="footer-watermark">@centerrightin</div>
    <div class="footer">
      <span>Generated by <strong>CentreRightIN</strong></span>
      &nbsp;·&nbsp;
      <a href="https://x.com/CentrerightIN" style="color:#60a5fa;text-decoration:none;font-weight:600;" target="_blank">@CentrerightIN</a>
    </div>
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
        renderLog("warn", "render_queue_full", {
          active: this.active,
          queueDepth: this.waiters.length,
          limit: this.limit,
          maxQueue: this.maxQueue,
        });
        throw error;
      }
      renderLog("debug", "render_enqueued", {
        active: this.active,
        queueDepth: this.waiters.length + 1,
        limit: this.limit,
        maxQueue: this.maxQueue,
      });
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

renderLog("info", "renderer_initialized", {
  logLevel: RENDER_LOG_LEVEL,
  maxConcurrentRenders: MAX_CONCURRENT_RENDERS,
  maxRenderQueue: MAX_RENDER_QUEUE,
  browserIdleTimeoutMs: BROWSER_IDLE_TIMEOUT_MS,
  viewportWidth: VIEWPORT_WIDTH,
  minViewportHeight: MIN_VIEWPORT_HEIGHT,
  maxViewportHeight: MAX_VIEWPORT_HEIGHT,
});

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
  renderLog("debug", "page_configured");
}

async function createConfiguredPage(browser) {
  const page = await browser.newPage();
  await configurePageForRendering(page);
  renderLog("debug", "page_created");
  return page;
}

async function acquirePooledPage(browser) {
  while (pagePool.length > 0) {
    const pooledPage = pagePool.pop();
    if (pooledPage && !pooledPage.isClosed()) {
      try {
        await configurePageForRendering(pooledPage);
        renderLog("debug", "page_reused_from_pool", {
          poolSizeAfterPop: pagePool.length,
        });
        return pooledPage;
      } catch {
        await pooledPage.close().catch(() => {});
        renderLog("warn", "page_reuse_failed_closed");
      }
    }
  }

  renderLog("debug", "page_pool_empty_create_new");
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
    renderLog("warn", "page_release_reset_failed_closed");
    return;
  }

  if (!isBrowserConnected(browser) || page.isClosed()) {
    return;
  }

  pagePool.push(page);
  renderLog("debug", "page_released_to_pool", {
    poolSize: pagePool.length,
  });
}

async function closeSharedBrowserIfIdle() {
  if (activeRenderCount > 0) {
    renderLog("debug", "idle_browser_close_skipped_active_render", {
      activeRenderCount,
    });
    return;
  }

  const browser = sharedBrowser;
  if (!isBrowserConnected(browser)) {
    sharedBrowser = null;
    clearPagePool();
    renderLog("debug", "idle_browser_close_skipped_not_connected");
    return;
  }

  sharedBrowser = null;
  clearPagePool();
  await browser.close().catch(() => {});
  renderLog("info", "browser_closed_idle");
}

function scheduleIdleBrowserClose() {
  clearIdleBrowserCloseTimer();

  if (BROWSER_IDLE_TIMEOUT_MS <= 0) {
    renderLog("debug", "idle_browser_close_disabled");
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
  renderLog("debug", "idle_browser_close_scheduled", {
    delayMs: BROWSER_IDLE_TIMEOUT_MS,
  });
}

async function launchBrowser() {
  const browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS);
  renderLog("info", "browser_launched");
  browser.on("disconnected", () => {
    if (sharedBrowser === browser) {
      sharedBrowser = null;
    }
    clearIdleBrowserCloseTimer();
    clearPagePool();
    renderLog("warn", "browser_disconnected");
  });
  return browser;
}

async function getBrowser() {
  if (isBrowserConnected(sharedBrowser)) {
    renderLog("debug", "browser_reused");
    return sharedBrowser;
  }

  if (!browserLaunchPromise) {
    renderLog("info", "browser_launch_start");
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

async function generatePoster(data, context = {}) {
  const requestId = context.requestId || null;
  const requestedTemplate = data && typeof data.template === "string" ? data.template : "vote";
  const requestStartedAt = Date.now();
  const release = await renderSemaphore.acquire();
  const queueWaitMs = Date.now() - requestStartedAt;
  activeRenderCount += 1;
  clearIdleBrowserCloseTimer();
  let browser;
  let page;
  let templateKey = "vote";

  try {
    templateKey =
      data && data.template === "combined"
        ? "combined"
        : data && data.template === "wards"
        ? "wards"
        : data &&
          (data.template === "assembly-overview" ||
            data.template === "assemblyOverview" ||
            data.template === "assembly_overview")
        ? "assembly-overview"
        : "vote";

    renderLog("info", "render_start", {
      requestId,
      template: templateKey,
      requestedTemplate,
      queueWaitMs,
      activeRenders: activeRenderCount,
      queueDepth: renderSemaphore.waiters.length,
    });

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
    } else if (templateKey === "assembly-overview") {
      if (!templateHtml.includes("__ASSEMBLY_OVERVIEW_CONTENT__")) {
        throw new Error("Assembly overview template placeholder not found");
      }
      html = templateHtml.replace(
        "__ASSEMBLY_OVERVIEW_CONTENT__",
        buildAssemblyOverviewPosterMarkup(data)
      );
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
    renderLog("info", "render_success", {
      requestId,
      template: templateKey,
      durationMs: Date.now() - requestStartedAt,
      imageBytes: imageBuffer.length,
      activeRenders: activeRenderCount,
      queueDepth: renderSemaphore.waiters.length,
    });
    return imageBuffer;
  } catch (error) {
    renderLog("error", "render_failed", {
      requestId,
      template: templateKey,
      durationMs: Date.now() - requestStartedAt,
      error: serializeError(error),
      activeRenders: activeRenderCount,
      queueDepth: renderSemaphore.waiters.length,
    });
    throw error;
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
