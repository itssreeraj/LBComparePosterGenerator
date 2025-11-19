import React, { useEffect, useState } from "react";
import AllianceEditor from "./AllianceEditor";

export default function PosterForm({ onConfigChange }) {
  const [localbody, setLocalbody] = useState("");
  const [district, setDistrict] = useState("");
  const [year, setYear] = useState("2015");
  const [template, setTemplate] = useState("vote");
  const [showVotes, setShowVotes] = useState(true);
  const [showPercent, setShowPercent] = useState(true);
  const [alliances, setAlliances] = useState([
    { alliance: "LDF", color: "#dc2626", votes: 0, percent: 0 },
    { alliance: "UDF", color: "#2563eb", votes: 0, percent: 0 },
    { alliance: "NDA", color: "#f97316", votes: 0, percent: 0 },
  ]);

  useEffect(() => {
    const sortedRows = [...alliances].sort((a, b) => b.votes - a.votes);
    const config = {
      template,
      localbody,
      district,
      showVotes,
      showPercent,
      years: [
        {
          year,
          rows: sortedRows,
        },
      ],
    };
    onConfigChange(config);
  }, [localbody, district, year, template, showVotes, showPercent, alliances, onConfigChange]);

  return (
    <div className="card">
      <h1>Election Poster Generator</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Configure alliances, votes and colors. This will generate a high-quality PNG poster
        using a Node + Puppeteer backend.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label>Local body</label>
          <input
            type="text"
            value={localbody}
            onChange={(e) => setLocalbody(e.target.value)}
            placeholder="Kodungallur Municipality"
          />
        </div>
        <div>
          <label>District</label>
          <input
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="Thrissur"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label>Year</label>
          <input
            type="text"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2015"
          />
        </div>
        <div>
          <label>Template</label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #4b5563",
              background: "#020617",
              color: "#e5e7eb",
              marginBottom: 12,
            }}
          >
            <option value="vote">Vote poster</option>
            <option value="wards">Ward performance poster</option>
          </select>
        </div>
      </div>

      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={showVotes}
            onChange={(e) => setShowVotes(e.target.checked)}
          />{" "}
          Show votes
        </label>
        <label>
          <input
            type="checkbox"
            checked={showPercent}
            onChange={(e) => setShowPercent(e.target.checked)}
          />{" "}
          Show %
        </label>
      </div>

      <AllianceEditor alliances={alliances} onChange={setAlliances} />
    </div>
  );
}
