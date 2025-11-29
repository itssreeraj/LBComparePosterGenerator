import React, { useEffect, useState, useCallback } from "react";
import AllianceEditor from "./AllianceEditor";

export default function PosterForm({ onConfigChange }) {
  const [localbody, setLocalbody] = useState("");
  const [district, setDistrict] = useState("");
  const [showVotes, setShowVotes] = useState(true);
  const [showPercent, setShowPercent] = useState(true);

  const [years, setYears] = useState([
    {
      year: "2015",
      notes: "",
      votes: [],
      wards: [],
      generalVotes: [],
      generalBooths: []
    },
    {
      year: "2020",
      notes: "",
      votes: [],
      wards: [],
      generalVotes: [],
      generalBooths: []
    },
    {
      year: "2024 GE",
      notes: "",
      votes: [],
      wards: [],
      generalVotes: [],
      generalBooths: []
    }
  ]);

  const [activeTab, setActiveTab] = useState(0);

  const updateYearField = (index, field, value) => {
    const updated = [...years];
    updated[index][field] = value;
    setYears(updated);
  };

  const addYear = () => {
    setYears([
      ...years,
      {
        year: "NEW YEAR",
        notes: "",
        votes: [],
        wards: [],
        generalVotes: [],
        generalBooths: []
      }
    ]);
    setActiveTab(years.length);
  };

  const removeYear = (index) => {
    if (years.length === 1) return;
    setYears(years.filter((_, i) => i !== index));
    setActiveTab(0);
  };

  const buildConfig = useCallback(() => {
    return {
      template: "combined",
      localbody,
      district,
      showVotes,
      showPercent,
      years: years.map((y) => ({
        year: y.year,
        notes: y.notes,
        votes: y.votes,
        wards: y.wards,
        generalVotes: y.generalVotes,
        generalBooths: y.generalBooths
      }))
    };
  }, [localbody, district, showVotes, showPercent, years]);

  useEffect(() => {
    onConfigChange(buildConfig());
  }, [localbody, district, showVotes, showPercent, years, buildConfig]);

  return (
    <div className="card">
      <h1>Election Poster Generator</h1>

      {/* Basic fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label>Local Body</label>
          <input value={localbody} onChange={(e) => setLocalbody(e.target.value)} />
        </div>

        <div>
          <label>District</label>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} />
        </div>
      </div>

      <div className="checkbox-row">
        <label>
          <input
            type="checkbox"
            checked={showVotes}
            onChange={(e) => setShowVotes(e.target.checked)}
          />
          Show Votes
        </label>

        <label>
          <input
            type="checkbox"
            checked={showPercent}
            onChange={(e) => setShowPercent(e.target.checked)}
          />
          Show Vote %
        </label>
      </div>

      {/* Year Tabs */}
      <div style={{ marginTop: 20 }}>
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

      {/* YEAR BLOCK */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <label style={{ fontSize: 18, fontWeight: 600 }}>
            Year Settings: {years[activeTab].year}
          </label>

          {years.length > 1 && (
            <button
              className="secondary"
              style={{ color: "#fca5a5" }}
              onClick={() => removeYear(activeTab)}
            >
              Delete Year
            </button>
          )}
        </div>

        <input
          value={years[activeTab].year}
          onChange={(e) => updateYearField(activeTab, "year", e.target.value)}
          style={{ marginTop: 10 }}
        />

        {/* Notes */}
        <label style={{ marginTop: 20 }}>Notes</label>
        <textarea
          value={years[activeTab].notes}
          onChange={(e) => updateYearField(activeTab, "notes", e.target.value)}
          style={{
            width: "100%",
            height: 70,
            marginBottom: 20
          }}
        />

        {/* Sections */}
        {!years[activeTab].year.includes("2024") && (
          <>
            <h3>Local Election Vote Data</h3>
            <AllianceEditor
              alliances={years[activeTab].votes}
              onChange={(v) => updateYearField(activeTab, "votes", v)}
              mode="vote"
            />

            <h3 style={{ marginTop: 20 }}>Ward Performance</h3>
            <AllianceEditor
              alliances={years[activeTab].wards}
              onChange={(v) => updateYearField(activeTab, "wards", v)}
              mode="wards"
            />
          </>
        )}

        {years[activeTab].year.includes("2024") && (
          <>
            <h3>GE 2024 Vote Share</h3>
            <AllianceEditor
              alliances={years[activeTab].generalVotes}
              onChange={(v) => updateYearField(activeTab, "generalVotes", v)}
              mode="generalVotes"
            />

            <h3 style={{ marginTop: 20 }}>GE 2024 Booth Summary</h3>
            <AllianceEditor
              alliances={years[activeTab].generalBooths}
              onChange={(v) => updateYearField(activeTab, "generalBooths", v)}
              mode="generalBooths"
            />
          </>
        )}
      </div>
    </div>
  );
}
