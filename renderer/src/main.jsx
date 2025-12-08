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
  return "";
}

function App() {
  const [tabs, setTabs] = React.useState([{ id: uuidv4(), url: getInitialUrl(), title: 'New Tab', favicon: defaultLogo, loading: false }]);
  const [activeTabId, setActiveTabId] = React.useState(tabs[0].id);

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0] || { id: '', url: getInitialUrl(), title: 'New Tab', favicon: defaultLogo };

  const handleUrlChange = (tabId, newUrl) => {
    const raw = typeof newUrl === 'string' ? newUrl.trim() : '';
    const isBlank = !raw || /^about:blank\/?$/i.test(raw);
    if (isBlank) {
      setTabs(prevTabs => {
        let mutated = false;
        const next = prevTabs.map(tab => {
          if (tab.id !== tabId) return tab;
          const titleChanged = tab.title !== 'New Tab';
          const urlChanged = tab.url !== '';
          const faviconChanged = tab.favicon !== defaultLogo;
          const loadingChanged = tab.loading !== false;
          if (!titleChanged && !urlChanged && !faviconChanged && !loadingChanged) return tab;
          mutated = true;
          return { ...tab, url: '', title: 'New Tab', favicon: defaultLogo, loading: false };
        });
        return mutated ? next : prevTabs;
      });
      return;
    }

    // Normalize URL by ensuring protocol; set prelim title from hostname.
    let candidate = raw;
    try {
      const hasProtocol = /^https?:\/\//i.test(candidate);
      candidate = hasProtocol ? candidate : `https://${candidate}`;
    } catch {
      // keep candidate as provided; webview will show validation overlay
    }

    setTabs(prevTabs => {
      let mutated = false;
      const next = prevTabs.map(tab => {
        if (tab.id !== tabId) return tab;

        let nextTitle = tab.title;
        try {
          const parsed = new URL(candidate);
          const hostTitle = (parsed.host || parsed.hostname || '').replace(/^www\./i, '');
          if (hostTitle) nextTitle = hostTitle;
        } catch {
          // leave title as-is if parsing fails
        }

        const urlChanged = candidate !== tab.url;
        const titleChanged = nextTitle !== tab.title;
        if (!urlChanged && !titleChanged) return tab;

        mutated = true;
        return {
          ...tab,
          url: urlChanged ? candidate : tab.url,
          title: titleChanged ? nextTitle : tab.title,
        };
      });
      return mutated ? next : prevTabs;
    });
  };

  const handleFaviconChange = (tabId, newFavicon) => {
      setTabs(prevTabs => {
        let mutated = false;
        const next = prevTabs.map(tab => {
          if (tab.id !== tabId || tab.favicon === newFavicon) return tab;
          mutated = true;
          return { ...tab, favicon: newFavicon };
        });
        return mutated ? next : prevTabs;
      });
  };

  const handleTitleChange = (tabId, newTitle) => {
    const raw = typeof newTitle === 'string' ? newTitle.trim() : '';
    const sanitizedTitle = raw && !/^about:blank\/?$/i.test(raw) ? raw : 'New Tab';
    setTabs(prevTabs => {
      let mutated = false;
      const next = prevTabs.map(tab => {
        if (tab.id !== tabId || tab.title === sanitizedTitle) return tab;
        mutated = true;
        return { ...tab, title: sanitizedTitle };
      });
      return mutated ? next : prevTabs;
    });
  };

  const handleNewTab = () => {
    // Create an empty tab; it will stay blank until a URL is entered
    const newTab = { id: uuidv4(), url: '', title: 'New Tab', favicon: defaultLogo, loading: false };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleTabClick = (tabId) => {
    setActiveTabId(tabId);
  };

  const handleTabClose = (tabId) => {
    setTabs(prevTabs => {
      if (prevTabs.length <= 1) return prevTabs; // never remove the final tab
      const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) return prevTabs;
      const newTabs = prevTabs.filter(tab => tab.id !== tabId);
      setActiveTabId(prevActiveId => {
        if (prevActiveId !== tabId) return prevActiveId;
        const nextIndex = Math.min(Math.max(tabIndex, 0), newTabs.length - 1);
        return newTabs[nextIndex] ? newTabs[nextIndex].id : prevActiveId;
      });
      return newTabs;
    });
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
            onLoadingChange={(loading) => setTabs(prevTabs => {
              let mutated = false;
              const next = prevTabs.map(t => {
                if (t.id !== tab.id || t.loading === loading) return t;
                mutated = true;
                return { ...t, loading };
              });
              return mutated ? next : prevTabs;
            })}
            aiMode={aiMode}
          />
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />);
