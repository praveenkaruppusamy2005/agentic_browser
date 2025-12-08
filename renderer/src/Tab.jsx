import React from 'react';
import './style.css';
import defaultLogo from '../icons/default.png';

export default function Tab({ id, title, favicon, isActive, onClick, onClose }) {
  const handleClose = (e) => {
    e.stopPropagation(); // Prevent click from bubbling to the tab itself
    onClose(id);
  };

  return (
    <div
  className={`tab-item ${isActive ? 'active' : ''} animate`}
  onClick={() => onClick(id)}
>
      <img src={favicon || defaultLogo} alt="favicon" className="tab-favicon" />
      <span className="tab-title">{title || 'New Tab'}</span>
      <button className="tab-close-btn" onClick={handleClose}>×</button>
    </div>
  );
}
