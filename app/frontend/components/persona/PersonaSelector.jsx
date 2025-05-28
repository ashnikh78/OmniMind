import React from "react";

/**
 * PersonaSelector component
 * @param {Object[]} personas - Array of persona objects: { id, name, avatar, description }
 * @param {Object} selectedPersona - The currently selected persona object
 * @param {Function} onSelect - Callback when a persona is selected
 */
export default function PersonaSelector({ personas, selectedPersona, onSelect }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor="persona-select" style={{ marginRight: 8 }}>
        Persona:
      </label>
      <select
        id="persona-select"
        value={selectedPersona?.id || ""}
        onChange={e => {
          const persona = personas.find(p => p.id === e.target.value);
          onSelect(persona);
        }}
      >
        <option value="">Select Persona</option>
        {personas.map(p => (
          <option key={p.id} value={p.id}>
            {p.avatar ? `${p.avatar} ` : ""}{p.name}
          </option>
        ))}
      </select>
      {selectedPersona && (
        <div style={{ marginTop: 8, fontSize: 14, color: "#555" }}>
          {selectedPersona.avatar && <span style={{ fontSize: 18 }}>{selectedPersona.avatar}</span>}{" "}
          <b>{selectedPersona.name}</b>
          {selectedPersona.description && (
            <span style={{ marginLeft: 8 }}>{selectedPersona.description}</span>
          )}
        </div>
      )}
    </div>
  );
}