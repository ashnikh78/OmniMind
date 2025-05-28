import React, { useState } from "react";
import PersonaSelector from "./PersonaSelector";

const personas = [
  { id: "default", name: "Helpful Assistant", avatar: "🤖", prompt: "You are a helpful AI assistant." },
  { id: "coder", name: "Code Expert", avatar: "💻", prompt: "You are an expert programmer." },
  // ...add more personas as needed
];

export default function ChatPanel({ onSend }) {
  const [selectedPersona, setSelectedPersona] = useState(personas[0]);
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSend({ content: message, persona: selectedPersona });
      setMessage("");
    }
  };

  return (
    <div>
      <PersonaSelector
        personas={personas}
        selectedPersona={selectedPersona}
        onSelect={setSelectedPersona}
      />
      <div>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type your message..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
      {/* Render chat messages here */}
    </div>
  );
}