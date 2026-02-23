export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const backendRes = await fetch("http://localhost:4000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!backendRes.ok) {
      const text = await backendRes.text();
      console.error("Backend error:", text);
      return res.status(500).json({ error: "Backend generate failed" });
    }

    const arrayBuffer = await backendRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = backendRes.headers.get("content-type") || "image/png";

    res.setHeader("Content-Type", contentType);
    res.status(200).send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Proxy error" });
  }
}
