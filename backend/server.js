const express = require("express");
const cors = require("cors");
const { generatePoster } = require("./render");
const config = require("./config");
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

const SERVER_LOG_LEVEL = resolveLogLevel(
  process.env.SERVER_LOG_LEVEL || config.logLevel || "info"
);

function shouldLog(level) {
  return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[SERVER_LOG_LEVEL];
}

function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name,
    message: error.message,
    code: error.code,
  };
}

function serverLog(level, event, meta = {}) {
  if (!shouldLog(level)) return;

  const payload = {
    ts: new Date().toISOString(),
    scope: "server",
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

let requestCounter = 0;

function nextRequestId() {
  requestCounter = (requestCounter + 1) % 1000000;
  return `gen-${Date.now()}-${requestCounter}`;
}

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors());

app.post("/generate", async (req, res) => {
  const requestId = nextRequestId();
  const startedAt = Date.now();
  const template =
    req.body && typeof req.body.template === "string" ? req.body.template : "vote";

  serverLog("info", "generate_request_start", {
    requestId,
    template,
  });

  try {
    const imageBuffer = await generatePoster(req.body, { requestId });
    res.type("png").send(imageBuffer);
    serverLog("info", "generate_request_success", {
      requestId,
      template,
      durationMs: Date.now() - startedAt,
      statusCode: 200,
      imageBytes: imageBuffer.length,
    });
  } catch (err) {
    if (err && err.code === "RENDER_QUEUE_FULL") {
      res.set("Retry-After", "1");
      serverLog("warn", "generate_request_rejected", {
        requestId,
        template,
        durationMs: Date.now() - startedAt,
        statusCode: 429,
        error: serializeError(err),
      });
      return res.status(429).json({ error: "Renderer is busy, try again shortly" });
    }
    serverLog("error", "generate_request_failed", {
      requestId,
      template,
      durationMs: Date.now() - startedAt,
      statusCode: 500,
      error: serializeError(err),
    });
    res.status(500).json({ error: "Poster generation failed" });
  }
});

const PORT = process.env.PORT || config.port || 4000;
app.listen(PORT, () => {
  serverLog("info", "server_started", {
    port: PORT,
    profile: config.profile,
    logLevel: SERVER_LOG_LEVEL,
    bodyLimit: "2mb",
  });
});
