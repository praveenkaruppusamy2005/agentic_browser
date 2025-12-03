import React, { useState } from "react";
import Modal from "react-modal";

const COLORS = [
  // Neutrals
  "#1f2933", "#323f4b", "#9fb3c8",
  // Blues
  "#2563eb", "#38bdf8", "#0ea5e9",
  // Purples / Pinks
  "#6366f1", "#8b5cf6", "#ec4899",
  // Warm / Accent
  "#f97316", "#facc15", "#22c55e",
  // Transparent / default
  "transparent"
];

export default function Customize({ onClose, onThemeChange, currentColor }) {
  const [selected, setSelected] = useState(currentColor || null);

  const selectColor = (hex) => {
    if (!onThemeChange) return;
    const base = hex === "transparent" ? "#000000" : hex;
    onThemeChange(base);
    setSelected(base);
    onClose && onClose();
  };

  return (
    <Modal
      isOpen={true}
      onRequestClose={onClose}
      overlayClassName="modal-overlay"
      contentLabel="Customize"
      className="customize-modal"
    >
      <div className="modal-content">
        <p className="modal-username">Choose a theme color</p>
        <div className="color-grid">
          {COLORS.map((c) => {
            const base = c === "transparent" ? "#000000" : c;
            // Preview with RGBA 0.6 opacity for consistency
            const r = parseInt(base.slice(1,3), 16);
            const g = parseInt(base.slice(3,5), 16);
            const b = parseInt(base.slice(5,7), 16);
            const withAlpha = `rgba(${r}, ${g}, ${b}, 0.6)`;
            const isSelected = selected === base;
            return (
              <button
                key={c}
                className={`color-swatch${isSelected ? " selected" : ""}`}
                style={{
                  background: c === "transparent" ? "none" : withAlpha,
                  border: c === "transparent" ? "1px dashed #666" : "none",
                }}
                onClick={() => selectColor(c)}
                aria-label={`color-${c}`}
              >
                {isSelected && <span className="swatch-check">✓</span>}
              </button>
            );
          })}
        </div>
        <button className="modal-option" onClick={onClose}>
          <p className="modal-option-text">Close</p>
        </button>
      </div>
    </Modal>
  );
}