import React, { useCallback, useState } from "react";
import PosterForm from "../components/PosterForm";
import PosterPreview from "../components/PosterPreview";

export default function Home() {
  const [config, setConfig] = useState(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConfigChange = useCallback((cfg) => {
    setConfig(cfg);
  }, []);

  const handleGenerate = async () => {
    if (!config) return;
    setLoading(true);
    setError(null);
    setImage(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await res.json();
      setImage(data.image);
    } catch (err) {
      console.error(err);
      setError("Error generating poster. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <PosterForm onConfigChange={handleConfigChange} />
      <div className="card">
        <button
          className="primary"
          disabled={!config || loading}
          onClick={handleGenerate}
        >
          {loading ? "Generating…" : "Generate Image"}
        </button>
        {error && (
          <p style={{ marginTop: 8, color: "#fca5a5" }}>
            {error}
          </p>
        )}
      </div>
      <PosterPreview image={image} loading={loading} />
    </div>
  );
}
