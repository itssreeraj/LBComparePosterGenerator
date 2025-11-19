import React from "react";

export default function PosterPreview({ image, loading }) {
  return (
    <div className="card">
      <h2>Preview</h2>
      {loading && <p>Generating image...</p>}
      {!loading && !image && (
        <p style={{ opacity: 0.7 }}>Fill the form and click "Generate Image" to see the poster here.</p>
      )}
      {!loading && image && (
        <div>
          <img
            className="preview-image"
            src={`data:image/png;base64,${image}`}
            alt="Generated election poster"
          />
          <p style={{ marginTop: 8, fontSize: 14, opacity: 0.75 }}>
            Right-click the image and choose <strong>Save image as…</strong> to download.
          </p>
        </div>
      )}
    </div>
  );
}
