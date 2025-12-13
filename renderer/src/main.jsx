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

const DEFAULT_THEME_COLOR = "#ffffff";

const hexToRgba = (hex, alpha = 0.20) => {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) {
    return `rgba(0,0,0,${alpha})`;
  }
  const fullHex = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;

  const r = parseInt(fullHex.slice(1,3), 16);
  const g = parseInt(fullHex.slice(3,5), 16);
  const b = parseInt(fullHex.slice(5,7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const buildPalette = (mode, accentColor) => {
  const accent = accentColor || DEFAULT_THEME_COLOR;
  const light = mode === "light";
  const dark = mode === "dark";

  const lightTint = hexToRgba(accent, 0.15);
  const darkTint = hexToRgba(accent, 0.55);
  const hasCustomAccent = accent.toLowerCase() !== DEFAULT_THEME_COLOR.toLowerCase();

  const baseDark = {
    appBg: hasCustomAccent ? darkTint : "#000000",
    pageBg: "#000000",
    urlBg: "#0f0f0f",
    urlBorder: "rgba(255, 255, 255, 0.18)",
    urlShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
    inputBg: "#161616",
    inputText: "#f5f5f5",
    inputPlaceholder: "rgba(255,255,255,0.5)",
    inputFocusBorder: "rgba(255,255,255,0.35)",
    tabText: "#f5f5f5",
    tabActiveText: "#ffffff",
    tabActiveBg: "rgba(255,255,255,0.16)",
    tabInactiveBg: "transparent",
    iconHoverBg: "rgba(255,255,255,0.07)",
    overlay: "rgba(0,0,0,0.65)",
    tabBarBg: hasCustomAccent ? darkTint : "#000000"
  };

  if (dark) return { ...baseDark, accent };

  const accentSoft = hexToRgba(accent, 0.35);
  return {
    accent,
    appBg: hasCustomAccent ? lightTint : "#ffffff",
    pageBg: "#ffffff",
    urlBg: "#ffffff",
    urlBorder: "rgba(0,0,0,0.08)",
    urlShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
    inputBg: "#f4f4f4",
    inputText: "#0b0b0b",
    inputPlaceholder: "rgba(0,0,0,0.45)",
    inputFocusBorder: accent,
    tabText: "#1f1f1f",
    tabActiveText: "#0b0b0b",
    tabInactiveBg: "transparent",
    tabActiveBg: "#ffffff",
    iconHoverBg: "rgba(0,0,0,0.06)",
    overlay: "rgba(255,255,255,0.6)",
    tabBarBg: hasCustomAccent ? lightTint : "#ffffff"
  };
};

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

  const createTabWithUrl = (rawUrl) => {
    const newId = uuidv4();
    let urlValue = '';
    let titleValue = 'New Tab';
    if (rawUrl && typeof rawUrl === 'string') {
      const trimmed = rawUrl.trim();
      if (trimmed) {
        try {
          const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
          urlValue = normalized;
          const parsed = new URL(normalized);
          const hostTitle = (parsed.host || parsed.hostname || '').replace(/^www\./i, '');
          if (hostTitle) titleValue = hostTitle;
        } catch {
          urlValue = trimmed;
        }
      }
    }
    const newTab = { id: newId, url: urlValue, title: titleValue, favicon: defaultLogo, loading: false };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newId);
  };

  const handleNewTab = () => {
    createTabWithUrl('');
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

  const [themeColor, setThemeColor] = React.useState(DEFAULT_THEME_COLOR);
  const [themeMode, setThemeMode] = React.useState("light");
  const [systemPrefersDark, setSystemPrefersDark] = React.useState(false);
  const[aiMode, setAiMode] = React.useState(false);

  // Load saved theme on mount
  React.useEffect(() => {
    try {
      const savedColor = window.localStorage.getItem("app_theme_color");
      if (savedColor) setThemeColor(savedColor);
      const savedMode = window.localStorage.getItem("app_theme_mode");
      if (savedMode) setThemeMode(savedMode);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (e) => setSystemPrefersDark(!!e.matches);
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Persist theme changes
  React.useEffect(() => {
    try {
      window.localStorage.setItem("app_theme_color", themeColor);
    } catch {}
  }, [themeColor]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem("app_theme_mode", themeMode);
    } catch {}
    if (window.api && typeof window.api.setThemeMode === "function") {
      window.api.setThemeMode(themeMode);
    }
  }, [themeMode]);

  React.useEffect(() => {
    if (themeMode !== "system") return;
    if (window.api && typeof window.api.setThemeMode === "function") {
      window.api.setThemeMode("system");
    }
  }, [themeMode, systemPrefersDark]);

  const effectiveTheme = themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : themeMode;
  const palette = buildPalette(effectiveTheme, themeColor);
  const accentSoft = hexToRgba(themeColor, effectiveTheme === "light" ? 0.35 : 0.25);

  React.useEffect(() => {
    const root = document.documentElement;
    if (!root || !root.style) return;
    const entries = [
      ['--app-bg', palette.appBg],
      ['--page-bg', palette.pageBg],
      ['--urlbar-bg', palette.urlBg],
      ['--urlbar-border', palette.urlBorder],
      ['--urlbar-shadow', palette.urlShadow],
      ['--input-bg', palette.inputBg],
      ['--input-text', palette.inputText],
      ['--input-placeholder', palette.inputPlaceholder],
      ['--input-focus-border', palette.inputFocusBorder],
      ['--tab-text', palette.tabText],
      ['--tab-active-text', palette.tabActiveText],
      ['--tab-active-bg', palette.tabActiveBg],
      ['--tab-inactive-bg', palette.tabInactiveBg || 'transparent'],
      ['--icon-hover-bg', palette.iconHoverBg],
      ['--tabbar-bg', palette.tabBarBg || accentSoft],
      ['--overlay-bg', palette.overlay],
      ['--accent', themeColor],
      ['--accent-soft', accentSoft],
      // Do not filter favicons in any mode
      ['--icon-filter', 'none'],
    ];
    entries.forEach(([key, value]) => {
      if (typeof value === "string") {
        root.style.setProperty(key, value);
      }
    });
  }, [palette, themeColor, accentSoft, effectiveTheme]);

  React.useEffect(() => {
    // Listen for custom event dispatched from Page.jsx (webview 'new-window')
    const handler = (e) => {
      const targetUrl = e && e.detail && e.detail.url ? e.detail.url : '';
      if (targetUrl) createTabWithUrl(targetUrl);
    };
    document.addEventListener('open-new-tab', handler);
    // Listen for IPC event from main process (for window.open)
    if (window.api && typeof window.api.onOpenNewTab === 'function') {
      window.api.onOpenNewTab((url) => {
        if (url) createTabWithUrl(url);
      });
    }
    // Listen for IPC event to open a new window (for popups)
    if (window.api && typeof window.api.openPopupWindow === 'function') {
      window.api.onOpenPopupWindow && window.api.onOpenPopupWindow((url) => {
        if (url) window.api.openPopupWindow(url);
      });
    }
    return () => {
      document.removeEventListener('open-new-tab', handler);
    };
  }, []);

  return (
    <div
      className={`app-root theme-${effectiveTheme}`}
      style={{
        backgroundColor: palette.appBg,
        '--accent': themeColor,
        '--accent-soft': accentSoft,
        '--app-bg': palette.appBg,
        '--page-bg': palette.pageBg,
        '--urlbar-bg': palette.urlBg,
        '--urlbar-border': palette.urlBorder,
        '--urlbar-shadow': palette.urlShadow,
        '--input-bg': palette.inputBg,
        '--input-text': palette.inputText,
        '--input-placeholder': palette.inputPlaceholder,
        '--input-focus-border': palette.inputFocusBorder,
        '--tab-text': palette.tabText,
        '--tab-active-text': palette.tabActiveText,
        '--tab-active-bg': palette.tabActiveBg,
        '--icon-hover-bg': palette.iconHoverBg,
        '--overlay-bg': palette.overlay,
        '--icon-filter': effectiveTheme === "light" ? 'invert(1)' : 'none'
      }}
    >
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
        onThemeModeChange={setThemeMode}
        themeMode={themeMode}
        effectiveTheme={effectiveTheme}
      />
      <div style={{ position: 'relative', width: '99%', flex: '1 1 0', background: 'transparent' }}>
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
            setAiMode={setAiMode}
          />
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />);
