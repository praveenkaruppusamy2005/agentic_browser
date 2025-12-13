import React from 'react';
import './style.css';

function getDomainLetter(url) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, '')[0] || '?').toUpperCase();
  } catch {
    return '?';
  }
}

function getThemeColor() {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#888888';
  } catch {
    return '#888888';
  }
}

export default function Tab({ id, title, favicon, isActive, onClick, onClose }) {
  const handleClose = (e) => {
    e.stopPropagation();
    onClose(id);
  };

  // If favicon is a fallback SVG (data:image/svg+xml...) or missing, render a div with the letter
  const isFallback = !favicon || favicon.startsWith('data:image/svg+xml');
  let fallbackLetter = '?';
  let fallbackColor = '#888888';
  if (isFallback) {
    fallbackLetter = getDomainLetter(title);
    fallbackColor = getThemeColor();
  }

  return (
    <div
      className={`tab-item ${isActive ? 'active' : ''} animate`}
      onClick={() => onClick(id)}
    >
      {isFallback ? (
        <div
          className="tab-favicon tab-favicon-fallback"
          style={{
            background: fallbackColor,
            color: '#fff',
            borderRadius: '50%',
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 11,
            userSelect: 'none',
          }}
        >
          {fallbackLetter}
        </div>
      ) : (
        <img src={favicon} alt="favicon" className="tab-favicon" />
      )}
      <span className="tab-title">{title || 'New Tab'}</span>
      <button className="tab-close-btn" onClick={handleClose}>×</button>
    </div>
  );
}
