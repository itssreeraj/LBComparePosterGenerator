import React from "react";

export default function AllianceEditor({ alliances, onChange, template }) {

  const updateField = (index, field, value) => {
    const updated = alliances.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    onChange(updated);
  };

  const addAlliance = () => {
    const defaultObj =
      template === "wards"
        ? { alliance: "NEW", color: "#6b7280", first: 0, second: 0, third: 0 }
        : { alliance: "NEW", color: "#6b7280", votes: 0, percent: 0 };

    onChange([...alliances, defaultObj]);
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
          {/* Alliance name */}
          <input
            type="text"
            value={a.alliance}
            onChange={(e) => updateField(idx, "alliance", e.target.value)}
            placeholder="Alliance (LDF, UDF, NDA...)"
          />

          {/* Color */}
          <input
            type="color"
            value={a.color}
            onChange={(e) => updateField(idx, "color", e.target.value)}
          />

          {/* Template-specific fields */}
          {template === "vote" && (
            <>
              <input
                type="number"
                value={a.votes}
                onChange={(e) =>
                  updateField(idx, "votes", Number(e.target.value) || 0)
                }
                placeholder="Votes"
              />

              <input
                type="number"
                step="0.01"
                value={a.percent}
                onChange={(e) =>
                  updateField(idx, "percent", Number(e.target.value) || 0)
                }
                placeholder="%"
              />
            </>
          )}

          {template === "wards" && (
            <>
              <input
                type="number"
                value={a.first}
                onChange={(e) =>
                  updateField(idx, "first", Number(e.target.value) || 0)
                }
                placeholder="1st"
              />

              <input
                type="number"
                value={a.second}
                onChange={(e) =>
                  updateField(idx, "second", Number(e.target.value) || 0)
                }
                placeholder="2nd"
              />

              <input
                type="number"
                value={a.third}
                onChange={(e) =>
                  updateField(idx, "third", Number(e.target.value) || 0)
                }
                placeholder="3rd"
              />
            </>
          )}

          {/* Remove button */}
          <button
            type="button"
            className="secondary"
            style={{ marginLeft: 6 }}
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
