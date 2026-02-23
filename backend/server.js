const express = require("express");
const cors = require("cors");
const { generatePoster } = require("./render");
const config = require("./config");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors());

app.post("/generate", async (req, res) => {
  try {
    const imageBuffer = await generatePoster(req.body);
    res.type("png").send(imageBuffer);
  } catch (err) {
    if (err && err.code === "RENDER_QUEUE_FULL") {
      res.set("Retry-After", "1");
      return res.status(429).json({ error: "Renderer is busy, try again shortly" });
    }
    console.error("Poster generation failed:", err);
    res.status(500).json({ error: "Poster generation failed" });
  }
});

const PORT = process.env.PORT || config.port || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT} (profile=${config.profile})`);
});
