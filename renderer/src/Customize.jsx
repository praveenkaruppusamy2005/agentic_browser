import React, { useState } from "react";
import Modal from "react-modal";

const COLORS = [
  "#C8CFD2",
  "#25C4D1",
  "#D97A55",
  "#F8B8CE",
  "#EF5C63",
  "#F8A541",

  "#F4C136",
  "#E7D671",
  "#B7BF64",
  "#57B6EF",
  "#C59CDB",

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