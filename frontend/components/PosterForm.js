import React, { useEffect, useState, useCallback } from "react";
import AllianceEditor from "./AllianceEditor";

export default function PosterForm({ onConfigChange }) {
  const [localbody, setLocalbody] = useState("");
  const [district, setDistrict] = useState("");
  const [template, setTemplate] = useState("combined");
  const [showVotes, setShowVotes] = useState(true);
  const [showPercent, setShowPercent] = useState(true);

  // ============================
  // MULTI-YEAR DATA
  // ============================
  const [years, setYears] = useState([
    {
      year: "2015",
      notes: "",
      votes: [
        { alliance: "LDF", color: "#dc2626", votes: 0, percent: 0 },
        { alliance: "UDF", color: "#2563eb", votes: 0, percent: 0 },
        { alliance: "NDA", color: "#f97316", votes: 0, percent: 0 }
      ],
      wards: [
        { alliance: "LDF", color: "#dc2626", first: 0, second: 0, third: 0 },
        { alliance: "UDF", color: "#2563eb", first: 0, second: 0, third: 0 },
        { alliance: "NDA", color: "#f97316", first: 0, second: 0, third: 0 }
      ]
    }
  ]);

  const [activeTab, setActiveTab] = useState(0);

  // ============================
  // UPDATE YEAR FIELDS
  // ============================
  const updateYearField = (index, field, value) => {
    const updated = [...years];
    updated[index][field] = value;
    setYears(updated);
  };

  // ============================
  // ADD NEW YEAR
  // Option 2: Copy alliances structure (zero votes)
  // ============================
  const addYear = () => {
    const last = years[years.length - 1];

    const copiedVotes = last.votes.map(a => ({
      alliance: a.alliance,
      color: a.color,
      votes: 0,
      percent: 0
    }));

    const copiedWards = last.wards.map(a => ({
      alliance: a.alliance,
      color: a.color,
      first: 0,
      second: 0,
      third: 0
    }));

    setYears([
      ...years,
      {
        year: String(Number(last.year) + 5),
        notes: "",
        votes: copiedVotes,
        wards: copiedWards
      }
    ]);

    setActiveTab(years.length);
  };

  // ============================
  // REMOVE YEAR
  // ============================
  const removeYear = (index) => {
    if (years.length === 1) return;
    const updated = years.filter((_, i) => i !== index);
    setYears(updated);
    setActiveTab(0);
  };

  // ============================
  // Build final backend config
  // ============================
  const buildConfig = useCallback(() => {
    return {
      template: "combined",
      localbody,
      district,
      showVotes,
      showPercent,
      years: years.map(y => ({
        year: y.year,
        notes: y.notes,
        votes: [...y.votes].sort((a, b) => b.votes - a.votes),
        wards: [...y.wards] // ward performance is not sorted
      }))
    };
  }, [localbody, district, showVotes, showPercent, years]);

  useEffect(() => {
    onConfigChange(buildConfig());
  }, [localbody, district, template, showVotes, showPercent, years, buildConfig]);

  // ============================
  // RENDER UI
  // ============================
  return (
    <div className="card">
      <h1>Election Poster Generator</h1>

      {/* Basic Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label>Local Body</label>
          <input
            type="text"
            value={localbody}
            onChange={(e) => setLocalbody(e.target.value)}
            placeholder="Vilappil Grama Panchayat"
          />
        </div>

        <div>
          <label>District</label>
          <input
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="Thiruvananthapuram"
          />
        </div>
      </div>

      {/* Show Votes / % */}
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

      {/* Year Tabs */}
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

      {/* ------------------------
          ACTIVE YEAR BLOCK
         ------------------------ */}
      <div className="card" style={{ marginTop: 10 }}>
        {/* Header */}
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

        {/* Year input */}
        <input
          type="text"
          value={years[activeTab].year}
          onChange={(e) => updateYearField(activeTab, "year", e.target.value)}
          style={{ marginTop: 10 }}
        />

        {/* Notes */}
        <label style={{ marginTop: 20 }}>Notes (Optional)</label>
        <textarea
          value={years[activeTab].notes}
          onChange={(e) =>
            updateYearField(activeTab, "notes", e.target.value)
          }
          placeholder="Optional notes for this year..."
          style={{
            width: "100%",
            height: 70,
            padding: "8px",
            marginBottom: 20,
            borderRadius: 8,
            border: "1px solid #4b5563",
            background: "#020617",
            color: "#e5e7eb",
          }}
        />

        {/* Vote Section */}
        <h3 style={{ marginTop: 20 }}>Vote Data</h3>
        <AllianceEditor
          alliances={years[activeTab].votes}
          onChange={(v) => updateYearField(activeTab, "votes", v)}
          mode="vote"
        />

        {/* Ward Section */}
        <h3 style={{ marginTop: 30 }}>Ward Performance</h3>
        <AllianceEditor
          alliances={years[activeTab].wards}
          onChange={(v) => updateYearField(activeTab, "wards", v)}
          mode="wards"
        />

      </div>
    </div>
  );
}
