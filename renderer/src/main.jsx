import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import UrlBar from './UrlBar'
import Page from './Page'
import defaultLogo from '../icons/default.png'
function getInitialUrl() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const startUrl = params.get("startUrl");
    if (startUrl) {
      return decodeURIComponent(startUrl);
    }
  } catch {
    // ignore and fall back
  }
  return "https://www.google.com";
}

function App() {
  const [url, setUrl] = React.useState(getInitialUrl);
  const [favicon, setFavicon] = React.useState(defaultLogo);
  const [themeColor, setThemeColor] = React.useState("#000000");
  const[aiMode, setAiMode] = React.useState(false);

  // Load saved theme on mount
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("app_theme_color");
      if (saved) setThemeColor(saved);
    } catch {}
  }, []);

  // Persist theme changes
  React.useEffect(() => {
    try {
      window.localStorage.setItem("app_theme_color", themeColor);
    } catch {}
  }, [themeColor]);

  const hexToRgba = (hex, alpha = 1) => {
    const normalized = hex.replace('#','');
    const r = parseInt(normalized.substring(0,2), 16) || 0;
    const g = parseInt(normalized.substring(2,4), 16) || 0;
    const b = parseInt(normalized.substring(4,6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${0.45})`;
  };
  return (
    <div className="app-root" style={{ backgroundColor: hexToRgba(themeColor, 0.6) }}>
      <UrlBar
        url={url}
        setUrl={setUrl}
        favicon={favicon}
        onThemeChange={setThemeColor}
        currentThemeColor={themeColor}
        setAiMode={setAiMode}
      />
      <Page
        url={url}
        onFaviconChange={setFavicon}
        onUrlChange={setUrl}
        aiMode={aiMode}
      />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
