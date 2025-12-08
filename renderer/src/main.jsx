import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import UrlBar from './UrlBar';
import Page from './Page';
import Tabs from './Tabs'; // Import the new Tabs component
import defaultLogo from '../icons/default.png';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

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
  const [tabs, setTabs] = React.useState([{ id: uuidv4(), url: getInitialUrl(), title: 'New Tab', favicon: defaultLogo, loading: false }]);
  const [activeTabId, setActiveTabId] = React.useState(tabs[0].id);

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0] || { id: '', url: getInitialUrl(), title: 'New Tab', favicon: defaultLogo };

  const handleUrlChange = (tabId, newUrl) => {
    // Normalize URL by ensuring protocol; set prelim title from hostname.
    let candidate = newUrl;
    let nextTitle = 'New Tab';
    try {
      const hasProtocol = /^https?:\/\//i.test(newUrl);
      candidate = hasProtocol ? newUrl : `https://${newUrl}`;
      const u = new URL(candidate);
      nextTitle = (u.host || u.hostname || '').replace(/^www\./i, '') || nextTitle;
    } catch {
      // keep candidate as provided; webview will show validation overlay
    }
    setTabs(tabs.map(tab => tab.id === tabId ? { ...tab, url: candidate, title: nextTitle } : tab));
  };

  const handleFaviconChange = (tabId, newFavicon) => {
    setTabs(tabs.map(tab => tab.id === tabId ? { ...tab, favicon: newFavicon } : tab));
  };

  const handleTitleChange = (tabId, newTitle) => {
    setTabs(tabs.map(tab => tab.id === tabId ? { ...tab, title: newTitle } : tab));
  };

  const handleNewTab = () => {
    // Create an empty tab; it will stay blank until a URL is entered
    const newTab = { id: uuidv4(), url: '', title: 'New Tab', favicon: defaultLogo, loading: false };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleTabClick = (tabId) => {
    setActiveTabId(tabId);
  };

  const handleTabClose = (tabId) => {
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabs.length <= 1) return; // never remove the final tab
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    let nextActiveId = activeTabId;
    if (activeTabId === tabId) {
      const nextIndex = Math.min(Math.max(tabIndex, 0), newTabs.length - 1);
      nextActiveId = newTabs[nextIndex].id;
    }
    setTabs(newTabs);
    setActiveTabId(nextActiveId);
  };

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

  const hexToRgba = (hex, alpha = 0.20) => {
  if (hex === "transparent") return "rgba(0,0,0,0)";
  
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

  return (
    <div className="app-root" style={{ backgroundColor: hexToRgba(themeColor, 0.6) }}>
      <Tabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
      />
      <UrlBar
        url={activeTab.url}
        setUrl={(newUrl) => handleUrlChange(activeTabId, newUrl)}
        favicon={activeTab.favicon}
        onThemeChange={setThemeColor}
        currentThemeColor={themeColor}
        setAiMode={setAiMode}
        isLoading={!!activeTab.loading}
      />
      <div style={{ position: 'relative', width: '99%', flex: '1 1 0'}}>
        {tabs.map(tab => (
          <Page
            key={tab.id}
            url={tab.url}
            isActive={tab.id === activeTabId}
            onFaviconChange={(favicon) => handleFaviconChange(tab.id, favicon)}
            onUrlChange={(url) => handleUrlChange(tab.id, url)}
            onTitleChange={(title) => handleTitleChange(tab.id, title)}
            onLoadingChange={(loading) => setTabs(tabs.map(t => t.id === tab.id ? { ...t, loading } : t))}
            aiMode={aiMode}
          />
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />);
