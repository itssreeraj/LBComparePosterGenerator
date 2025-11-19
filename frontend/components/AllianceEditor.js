import React from "react";

export default function AllianceEditor({ alliances, onChange }) {
  const updateAlliance = (index, field, value) => {
    const updated = alliances.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    onChange(updated);
  };

  const addAlliance = () => {
    onChange([
      ...alliances,
      { alliance: "NEW", color: "#6b7280", votes: 0, percent: 0 },
    ]);
  };

  const removeAlliance = (index) => {
    const updated = alliances.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Alliances</div>
      {alliances.map((a, idx) => (
        <div className="alliance-row" key={idx}>
          <input
            type="text"
            value={a.alliance}
            onChange={(e) => updateAlliance(idx, "alliance", e.target.value)}
            placeholder="Alliance (LDF, UDF, NDA, IND, ...)"
          />
          <input
            type="color"
            value={a.color}
            onChange={(e) => updateAlliance(idx, "color", e.target.value)}
          />
          <input
            type="number"
            value={a.votes}
            onChange={(e) =>
              updateAlliance(idx, "votes", Number(e.target.value) || 0)
            }
            placeholder="Votes"
          />
          <input
            type="number"
            step="0.01"
            value={a.percent}
            onChange={(e) =>
              updateAlliance(idx, "percent", Number(e.target.value) || 0)
            }
            placeholder="%"
          />
          <button
            type="button"
            className="secondary"
            onClick={() => removeAlliance(idx)}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={addAlliance}>
        + Add alliance
      </button>
    </div>
  );
}
