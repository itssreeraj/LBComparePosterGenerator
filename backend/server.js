const express = require("express");
const cors = require("cors");
const { generatePoster } = require("./render");
const config = require("./config");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());

app.post("/generate", async (req, res) => {
  try {
    const imageBase64 = await generatePoster(req.body);
    res.json({ image: imageBase64 });
  } catch (err) {
    console.error("Poster generation failed:", err);
    res.status(500).json({ error: "Poster generation failed" });
  }
});

const PORT = process.env.PORT || config.port || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT} (profile=${config.profile})`);
});

