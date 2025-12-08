import React, { useRef, useEffect, useState } from "react";
import Lottie from "lottie-react";
import voiceAnimation from "../../Animations/voice.json";
import "./style.css";
import defaultLogo from "../icons/default.png";

function ErrorDisplay({ errorInfo }) {
  return (
    <div
      className="error-page"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: 'column',
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        background: '#FFFFFF',
      }}
    >
      <h1 style={{ color: '#333', marginBottom: '10px' }}>Oops! Page not found.</h1>
      <p style={{ color: '#666' }}>{errorInfo.desc}</p>
    </div>
  );
}

export default function Page({ url, id, isActive, onFaviconChange, onUrlChange, onTitleChange, onLoadingChange, aiMode = false }) {
  const viewRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [errorInfo, setErrorInfo] = useState({ desc: '' });
  const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const lastHostRef = useRef("");
  const pendingFaviconRef = useRef(false);
  const failTimerRef = useRef(null);
  const lastFailRef = useRef({ code: 0, url: "", isMain: false });
  const [preInvalid, setPreInvalid] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const normalizeUrl = (raw) => {
    const val = (raw || "").trim();
    if (!val) return "about:blank";
    if (/^https?:\/\//i.test(val)) return val;
    // Treat space-containing inputs as search queries
    if (/\s/.test(val)) {
      const q = encodeURIComponent(val);
      return `https://www.google.com/search?q=${q}`;
    }
    // If it looks like a domain (has a dot), prepend https
    if (/\./.test(val)) return `https://${val}`;
    // Otherwise, search
    const q = encodeURIComponent(val);
    return `https://www.google.com/search?q=${q}`;
  };

  // This is the single source of truth for managing the error overlay.
  // It handles pre-validation, webview load events, and cleanup.
  useEffect(() => {
    // When the URL changes, we immediately reset the error state.
    setLoadError(false);
    setErrorInfo({ desc: '' });

    // 1. Pre-validate the URL before even attempting to load it.
    const val = (url || "").trim();
    if (!val) {
      // Empty tab: keep blank and no error overlay.
      setPreInvalid(true);
      setLoadError(false);
      setErrorInfo({ desc: '' });
      if (onFaviconChange) onFaviconChange(defaultLogo);
      return;
    }
    // Relax pre-validation: let webview attempt navigation; show overlay only on did-fail-load.
    // If value looks roughly like a URL, clear preInvalid so webview loads it.
    const looksUrl = /\./.test(val) || /^https?:\/\//i.test(val);
    setPreInvalid(!looksUrl);

    // 2. If pre-validation passes, attach listeners to the webview.
    const view = viewRef.current;
    if (!view) return;

    const onStart = () => {
      setLoadError(false);
      setErrorInfo({ desc: '' });
      setIsLoading(true);
      if (typeof onLoadingChange === 'function') onLoadingChange(true);
    };

    const onFinish = () => {
      // Do not clear error state here.
      // Successful navigations already clear errors in onStart.
      // Leaving this as a no-op prevents a late did-finish-load
      // from racing with did-fail-load and hiding the overlay.
      if (onTitleChange) {
        onTitleChange(view.getTitle());
      }
      setIsLoading(false);
      if (typeof onLoadingChange === 'function') onLoadingChange(false);
    };

    const onFail = (e) => {
      const isMain = e.isMainFrame === true;
      const code = e.errorCode || 0;
      const desc = e.errorDescription || '';
      
      // Ignore benign errors like user-cancelled navigations.
      const isTransient = code === -3; // ERR_ABORTED
      if (!isMain || isTransient) {
        // Ensure loading state is cleared for transient aborts too
        setIsLoading(false);
        if (typeof onLoadingChange === 'function') onLoadingChange(false);
        return;
      }
      // If the host might require www, attempt fallback once
      try {
        const currentUrl = (view && typeof view.getURL === 'function') ? view.getURL() : (e.validatedURL || e.url || "");
        if (currentUrl) {
          const u = new URL(currentUrl);
          const host = u.host || u.hostname || '';
          const needsWww = host && !/^www\./i.test(host) && /\./.test(host);
          if (needsWww) {
            const wwwHost = `www.${host}`;
            const fallback = `${u.protocol}//${wwwHost}${u.pathname || ''}${u.search || ''}${u.hash || ''}`;
            // Avoid infinite loop by marking once per host
            if (lastHostRef.current !== `www:${host}`) {
              lastHostRef.current = `www:${host}`;
              if (onUrlChange) onUrlChange(fallback);
              // Show a brief toast to indicate retry
              try {
                setToastMsg(`Retrying with www: ${wwwHost}`);
                if (toastTimerRef.current) {
                  clearTimeout(toastTimerRef.current);
                }
                toastTimerRef.current = setTimeout(() => setToastMsg(""), 2500);
              } catch {}
              // Do not show error overlay yet; give fallback a chance
              return;
            }
          }
        }
      } catch {}

      setLoadError(true);
      setErrorInfo({ desc });
      setIsLoading(false);
      if (typeof onLoadingChange === 'function') onLoadingChange(false);
      if (onFaviconChange) onFaviconChange(defaultLogo);
    };

    view.addEventListener("did-start-loading", onStart);
    view.addEventListener("did-fail-load", onFail);
    view.addEventListener("did-finish-load", onFinish);

    return () => {
      view.removeEventListener("did-start-loading", onStart);
      view.removeEventListener("did-fail-load", onFail);
      view.removeEventListener("did-finish-load", onFinish);
    };
  }, [url, onFaviconChange, onTitleChange]);

  
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !onFaviconChange) return;

    const handleFavicon = (e) => {
      const raw = e && e.favicons && e.favicons[0];
      const icon =
        typeof raw === 'string' && raw.trim().length > 0 ? raw : defaultLogo;
      onFaviconChange(icon);
      pendingFaviconRef.current = false;
    };
  

    const handleFail = (e) => {
      const isMain = e && e.isMainFrame === true;
      const code = e && typeof e.errorCode === 'number' ? e.errorCode : 0;
      if (isMain && code !== -3) onFaviconChange(defaultLogo);
    };
    const fetchFaviconViaDOM = async () => {
      try {
        const icon = await view.executeJavaScript(`(function(){
          const links = Array.from(document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'));
          const href = links.length ? links[0].href : '';
          if (!href) {
            return '/favicon.ico'; // Default path for favicons
          }
          return href;
        })()`);
        if (icon && typeof icon === 'string' && icon.trim().length > 0) {
          onFaviconChange(icon);
          pendingFaviconRef.current = false;
        }
      } catch (error) {
        console.error('Failed to fetch favicon:', error);
      }
    };
    const handleFinish = () => {
      // After load finishes, if favicon event didn't fire, try DOM extraction
      if (pendingFaviconRef.current) {
        fetchFaviconViaDOM();
      }
      // no-op for overlay; it's cleared by onFinish in the other effect
    };

    const handleStartLoading = () => {
      // Mark favicon as pending at the start of any navigation
      pendingFaviconRef.current = true;
      // Optimistically set a quick candidate favicon to avoid stale icon
      try {
        const currentUrl = (view && typeof view.getURL === 'function') ? view.getURL() : '';
        if (currentUrl) {
          const u = new URL(currentUrl);
          const origin = `${u.protocol}//${u.host}`;
          const candidate = `${origin}/favicon.ico`;
          onFaviconChange(candidate);
        } else {
          onFaviconChange(defaultLogo);
        }
      } catch {
        try { onFaviconChange(defaultLogo); } catch {}
      }
    };

    view.addEventListener("page-favicon-updated", handleFavicon);
   
    view.addEventListener("did-fail-load", handleFail);
    view.addEventListener("did-finish-load", handleFinish);
    view.addEventListener("did-start-loading", handleStartLoading);

    const handleNavigate = (e) => {
      console.info('Webview did-navigate', e && e.url);
      if (onUrlChange && e && e.url) onUrlChange(e.url);
    };
    const handleNavigateInPage = (e) => {
      console.info('Webview did-navigate-in-page', e && e.url);
      if (onUrlChange && e && e.url) onUrlChange(e.url);
    };
    const handleRedirect = (e) => {
      console.info('Webview did-redirect-navigation', e && e.url);
      if (onUrlChange && e && e.url) onUrlChange(e.url);
    };
    const handleWillNavigate = (e) => {
      console.info('Webview will-navigate', e && e.url);
      if (onUrlChange && e && e.url) onUrlChange(e.url);
    };
    const handleLoadCommit = (e) => {
      // mainFrame load commit includes the current URL reliably
      const isMain = e && e.isMainFrame === true;
      const current = e && e.url;
      if (isMain && current && onUrlChange) {
        console.info('Webview load-commit (main)', current);
        onUrlChange(current);
      }
    };
    const handleStartNavigation = (e) => {
      // When main-frame starts navigation to a different host, keep previous favicon
      // to avoid flicker; new favicon will update via page-favicon-updated or fail handler.
      if (!e || e.isInPlace || e.isSameDocument) return;
      const target = e.url || "";
      try {
        const host = new URL(target).host;
        if (host && host !== lastHostRef.current) {
          lastHostRef.current = host;
          // Mark favicon as pending; we'll update on event or DOM fallback
          pendingFaviconRef.current = true;
        }
      } catch {}
    };
    view.addEventListener("did-navigate", handleNavigate);
    view.addEventListener("did-navigate-in-page", handleNavigateInPage);
    view.addEventListener("did-start-navigation", handleStartNavigation);
    view.addEventListener("did-redirect-navigation", handleRedirect);
    view.addEventListener("will-navigate", handleWillNavigate);
    view.addEventListener("load-commit", handleLoadCommit);
    const handleTitleUpdated = (e) => {
      try {
        const title = e && e.title ? e.title : (view && typeof view.getTitle === 'function' ? view.getTitle() : '');
        if (title && onTitleChange) onTitleChange(title);
      } catch {}
    };
    view.addEventListener("page-title-updated", handleTitleUpdated);

    const handleNewWindow = (e) => {
      const targetUrl = e && e.url;
      if (targetUrl && window.api && typeof window.api.openPopupWindow === "function") {
        window.api.openPopupWindow(targetUrl);
      }
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }
    };
    view.addEventListener("new-window", handleNewWindow);

    return () => {
      view.removeEventListener("page-favicon-updated", handleFavicon);
      
      view.removeEventListener("did-fail-load", handleFail);
      view.removeEventListener("did-finish-load", handleFinish);
      view.removeEventListener("did-start-loading", handleStartLoading);
      view.removeEventListener("did-navigate", handleNavigate);
      view.removeEventListener("did-navigate-in-page", handleNavigateInPage);
      view.removeEventListener("did-start-navigation", handleStartNavigation);
      view.removeEventListener("did-redirect-navigation", handleRedirect);
      view.removeEventListener("will-navigate", handleWillNavigate);
      view.removeEventListener("load-commit", handleLoadCommit);
      view.removeEventListener("page-title-updated", handleTitleUpdated);
      view.removeEventListener("new-window", handleNewWindow);
    };
  }, [onFaviconChange, onUrlChange, onTitleChange]);

  // Listen for global navigation control events from UrlBar
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const onReload = () => {
      try { view.reload(); } catch {}
    };
    const onBack = () => {
      try { if (view.canGoBack()) view.goBack(); } catch {}
    };
    const onForward = () => {
      try { if (view.canGoForward()) view.goForward(); } catch {}
    };

    const reloadListener = () => onReload();
    const backListener = () => onBack();
    const forwardListener = () => onForward();

    const navigateListener = (e) => {
      try {
        const target = e && e.detail && e.detail.url ? e.detail.url : '';
        if (!target) return;
        const final = normalizeUrl(target);
        // Only active tab should respond to direct navigate
        if (isActive && typeof view.loadURL === 'function') {
          view.loadURL(final);
        }
      } catch {}
    };

    document.addEventListener("browser-reload", reloadListener);
    document.addEventListener("browser-back", backListener);
    document.addEventListener("browser-forward", forwardListener);
    document.addEventListener("browser-navigate", navigateListener);

    return () => {
      document.removeEventListener("browser-reload", reloadListener);
      document.removeEventListener("browser-back", backListener);
      document.removeEventListener("browser-forward", forwardListener);
      document.removeEventListener("browser-navigate", navigateListener);
    };
  }, [isActive]);

  // Do not reset favicon on URL prop change; background webviews may be hidden.
  // Instead, rely on navigation events (did-start-navigation, page-favicon-updated)
  // to mark favicon as pending and update when available.

   // This effect was too aggressive and caused favicon flickering.
   // The logic is now handled by did-start-navigation.
   // useEffect(() => {
   //   // URL changed: reset favicon state immediately
   //   pendingFaviconRef.current = true;
   //   if (onFaviconChange) onFaviconChange(defaultLogo);

  //   // Also clear load error instantly
  //   setLoadError(false);
  // }, [url]);
  return (
    <div
      className="page-container"
      style={{ display: isActive ? 'block' : 'none', position: 'absolute', inset: 0 }}
    >
      <div
        className="page-root"
        style={{
          position: 'absolute',
          inset: 0,
          visibility: isActive ? 'visible' : 'hidden',
          pointerEvents: isActive ? 'auto' : 'none'
        }}
      >
        <webview
          id={`webview-${id}`}
          ref={viewRef}
          src={preInvalid ? 'about:blank' : normalizeUrl(url)}
          webpreferences="contextIsolation=yes, nativeWindowOpen=yes"
          allowpopups="true"
          partition="persist:browser"
          useragent={desktopUA}
          style={{
            position: "absolute",
            left: 0,
            width: aiMode ? "70%" : "100%",
            height: "100%",
            zIndex: 0,
          }}
        ></webview>
        {aiMode && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "30%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#131515",
              borderLeft: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <Lottie
              animationData={voiceAnimation}
              loop={true}
              style={{ width: "50%", height: "50%" }}
            />
          </div>
        )}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                border: '3px solid rgba(255,255,255,0.25)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <style>{`
              @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
          </div>
        )}
        {toastMsg && (
          <div
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              fontSize: 12,
              zIndex: 1001,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {toastMsg}
          </div>
        )}
        {loadError && <ErrorDisplay errorInfo={errorInfo} />}
      </div>
    </div>
  );
}

