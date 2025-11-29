import React from "react";

/**
 * AllianceEditor
 *
 * Props:
 *  - alliances: array
 *  - onChange: callback
 *  - mode: "vote" | "wards" | "generalVotes" | "generalBooths"
 */

export default function AllianceEditor({
  alliances,
  onChange,
  mode = "vote"
}) {
  const updateField = (index, field, value) => {
    const updated = alliances.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    onChange(updated);
  };

  const addAlliance = () => {
    const defaults = {
      alliance: "NEW",
      color: "#6b7280"
    };

    if (mode === "vote" || mode === "generalVotes") {
      defaults.votes = 0;
      defaults.percent = 0;
    } else {
      defaults.winner = 0;
      defaults.runnerUp = 0;
      defaults.third = 0;
    }

    onChange([...alliances, defaults]);
  };

  const removeAlliance = (index) => {
    onChange(alliances.filter((_, i) => i !== index));
  };

  const numberField = (label, val, f) => (
    <input
      type="number"
      value={val}
      placeholder={label}
      onChange={(e) => updateField(f, label.toLowerCase(), Number(e.target.value) || 0)}
    />
  );

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Alliances</div>

      {(alliances || []).map((a, idx) => (
        <div className="alliance-row" key={idx}>
          {/* Alliance name */}
          <input
            type="text"
            value={a.alliance}
            onChange={(e) => updateField(idx, "alliance", e.target.value)}
            placeholder="Alliance"
          />

          {/* Color */}
          <input
            type="color"
            value={a.color}
            onChange={(e) => updateField(idx, "color", e.target.value)}
          />

          {/* ===== VOTE MODE ===== */}
          {(mode === "vote" || mode === "generalVotes") && (
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

          {/* ===== WARD / BOOTH MODE ===== */}
          {(mode === "wards" || mode === "generalBooths") && (
            <>
              <input
                type="number"
                value={a.winner}
                onChange={(e) =>
                  updateField(idx, "winner", Number(e.target.value) || 0)
                }
                placeholder="Winner"
              />

              <input
                type="number"
                value={a.runnerUp}
                onChange={(e) =>
                  updateField(idx, "runnerUp", Number(e.target.value) || 0)
                }
                placeholder="Runner Up"
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

          {/* Remove */}
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
