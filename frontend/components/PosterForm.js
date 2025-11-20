import React, { useEffect, useState } from "react";
import AllianceEditor from "./AllianceEditor";

export default function PosterForm({ onConfigChange }) {
  const [localbody, setLocalbody] = useState("");
  const [district, setDistrict] = useState("");
  const [template, setTemplate] = useState("vote");
  const [showVotes, setShowVotes] = useState(true);
  const [showPercent, setShowPercent] = useState(true);

  // === MULTI-YEAR SUPPORT ===
  const [years, setYears] = useState([
    {
      year: "2015",
      alliances: [
        { alliance: "LDF", color: "#dc2626", votes: 0, percent: 0 },
        { alliance: "UDF", color: "#2563eb", votes: 0, percent: 0 },
        { alliance: "NDA", color: "#f97316", votes: 0, percent: 0 }
      ]
    }
  ]);

  const [activeTab, setActiveTab] = useState(0);

  // ADD A NEW YEAR (Option 2)
  const addYear = () => {
    const last = years[years.length - 1];
    const copiedAlliances = last.alliances.map(a =>
      template === "vote"
        ? {
            alliance: a.alliance,
            color: a.color,
            votes: 0,
            percent: 0
          }
        : {
            alliance: a.alliance,
            color: a.color,
            first: 0,
            second: 0,
            third: 0
          }
    );

    setYears([
      ...years,
      {
        year: String(Number(last.year) + 5), // auto guess next year
        alliances: copiedAlliances
      }
    ]);

    setActiveTab(years.length);
  };

  const updateAllianceSet = (index, newAlliances) => {
    const updated = [...years];
    updated[index].alliances = newAlliances;
    setYears(updated);
  };

  const updateYearValue = (index, value) => {
    const updated = [...years];
    updated[index].year = value;
    setYears(updated);
  };

  const removeYear = (index) => {
    if (years.length === 1) return;
    const updated = years.filter((_, i) => i !== index);
    setYears(updated);
    setActiveTab(0);
  };

  // === Build config for backend ===
  useEffect(() => {
    const config = {
      template,
      localbody,
      district,
      showVotes,
      showPercent,
      years: years.map((y) => ({
        year: y.year,
        rows:
          template === "vote"
            ? [...y.alliances].sort((a, b) => b.votes - a.votes)
            : [...y.alliances] // no sorting needed for wards
      }))

    };
    onConfigChange(config);
  }, [localbody, district, template, showVotes, showPercent, years, onConfigChange]);

  return (
    <div className="card">
      <h1>Election Poster Generator</h1>

      {/* Basic Fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label>Local body</label>
          <input
            type="text"
            value={localbody}
            onChange={(e) => setLocalbody(e.target.value)}
          />
        </div>

        <div>
          <label>District</label>
          <input
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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

      {/* Column toggles */}
      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={showVotes}
            onChange={(e) => setShowVotes(e.target.checked)}
          />{" "}
          Show Votes
        </label>

        <label>
          <input
            type="checkbox"
            checked={showPercent}
            onChange={(e) => setShowPercent(e.target.checked)}
          />{" "}
          Show Percent
        </label>
      </div>

      {/* === YEAR TABS === */}
      <div style={{ marginTop: 20, marginBottom: 10 }}>
        {years.map((y, idx) => (
          <button
            key={idx}
            className="secondary"
            onClick={() => setActiveTab(idx)}
            style={{
              marginRight: 10,
              background: idx === activeTab ? "#1e293b" : "#0f172a",
              border: idx === activeTab ? "1px solid #22c55e" : "1px solid #334155"
            }}
          >
            {y.year}
          </button>
        ))}

        <button className="secondary" onClick={addYear}>
          + Add Year
        </button>
      </div>

      {/* Active TAB CONTENT */}
      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <label style={{ fontSize: 18, fontWeight: 600 }}>
            Year Settings: {years[activeTab].year}
          </label>

          {years.length > 1 && (
            <button
              className="secondary"
              onClick={() => removeYear(activeTab)}
              style={{ color: "#fca5a5" }}
            >
              Delete Year
            </button>
          )}
        </div>

        <input
          type="text"
          value={years[activeTab].year}
          onChange={(e) => updateYearValue(activeTab, e.target.value)}
          style={{ marginTop: 10, marginBottom: 20 }}
        />

        <AllianceEditor
          alliances={years[activeTab].alliances}
          onChange={(v) => updateAllianceSet(activeTab, v)}
          template={template}
        />
      </div>
    </div>
  );
}
