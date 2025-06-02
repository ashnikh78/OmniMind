import React from 'react';

interface Persona {
  id: string;
  name: string;
  avatar: string;
  prompt: string;
  description?: string;
}

interface PersonaSelectorProps {
  personas: Persona[];
  selectedPersona: Persona | null;
  onSelect: (persona: Persona) => void;
}

const PersonaSelector: React.FC<PersonaSelectorProps> = ({ personas, selectedPersona, onSelect }) => {
  return (
    <div className="mb-4">
      <label htmlFor="persona-select" className="mr-2 text-sm font-medium">
        Persona:
      </label>
      <select
        id="persona-select"
        value={selectedPersona?.id || ''}
        onChange={(e) => {
          const persona = personas.find((p) => p.id === e.target.value);
          if (persona) onSelect(persona);
        }}
        className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Select persona"
      >
        <option value="" disabled>
          Select Persona
        </option>
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.avatar ? `${p.avatar} ` : ''}{p.name}
          </option>
        ))}
      </select>
      {selectedPersona && (
        <div className="mt-2 text-sm text-gray-600">
          <span className="text-lg mr-2">{selectedPersona.avatar}</span>
          <span className="font-semibold">{selectedPersona.name}</span>
          {selectedPersona.description && (
            <span className="ml-2">{selectedPersona.description}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default PersonaSelector;