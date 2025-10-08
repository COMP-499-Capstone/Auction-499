import React, { useState } from "react";
import "../styles/ToggleGroup.css";

export default function ToggleGroup({ options, onChange }) {
  const [active, setActive] = useState(options[0].value);

  const handleClick = (value) => {
    setActive(value);
    if (onChange) onChange(value);
  };

  return (
    <div className="toggle-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`toggle-btn ${active === opt.value ? "active" : ""}`}
          onClick={() => handleClick(opt.value)}
        >
          <opt.icon size={20} />
        </button>
      ))}
    </div>
  );
}