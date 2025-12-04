import React, { useRef, useEffect, useState } from "react";
import "./style.css";
import defaultLogo from "../icons/default.png";
import Lottie from "lottie-react";
import animationData from "../../Animations/404.json";
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
      <Lottie
        animationData={animationData}
        loop={true}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export default function Page({ url, onFaviconChange, onUrlChange, aiMode = false }) {
  const viewRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [errorInfo, setErrorInfo] = useState({ desc: '' });
  const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const lastHostRef = useRef("");
  const pendingFaviconRef = useRef(false);
  const failTimerRef = useRef(null);
  const lastFailRef = useRef({ code: 0, url: "", isMain: false });
  const [preInvalid, setPreInvalid] = useState(false);

  // This is the single source of truth for managing the error overlay.
  // It handles pre-validation, webview load events, and cleanup.
  useEffect(() => {
    // When the URL changes, we immediately reset the error state.
    setLoadError(false);
    setErrorInfo({ desc: '' });

    // 1. Pre-validate the URL before even attempting to load it.
    const val = (url || "").trim();
    if (!val) {
      setPreInvalid(true);
      setLoadError(true);
      setErrorInfo({ desc: 'Please enter a URL.' });
      if (onFaviconChange) onFaviconChange(defaultLogo);
      return; // Stop here if URL is empty
    }
    const hasProtocol = /^https?:\/\//i.test(val);
    const candidate = hasProtocol ? val : `https://${val}`;
    try {
      // eslint-disable-next-line no-new
      new URL(candidate);
      setPreInvalid(false);
    } catch {
      setPreInvalid(true);
      setLoadError(true);
      setErrorInfo({ desc: 'The URL format is invalid.' });
      if (onFaviconChange) onFaviconChange(defaultLogo);
      return; // Stop here if URL is malformed
    }

    // 2. If pre-validation passes, attach listeners to the webview.
    const view = viewRef.current;
    if (!view) return;

    const onStart = () => {
      setLoadError(false);
      setErrorInfo({ desc: '' });
    };

    const onFinish = () => {
      // Do not clear error state here.
      // Successful navigations already clear errors in onStart.
      // Leaving this as a no-op prevents a late did-finish-load
      // from racing with did-fail-load and hiding the overlay.
    };

    const onFail = (e) => {
      const isMain = e.isMainFrame === true;
      const code = e.errorCode || 0;
      const desc = e.errorDescription || '';
      
      // Ignore benign errors like user-cancelled navigations.
      const isTransient = code === -3; // ERR_ABORTED
      if (!isMain || isTransient) return;

      setLoadError(true);
      setErrorInfo({ desc });
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
  }, [url, onFaviconChange]);

  
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
          return href || '';
        })()`);
        if (icon && typeof icon === 'string' && icon.trim().length > 0) {
          onFaviconChange(icon);
          pendingFaviconRef.current = false;
        }
      } catch {}
    };
    const handleFinish = () => {
      // After load finishes, if favicon event didn't fire, try DOM extraction
      if (pendingFaviconRef.current) {
        fetchFaviconViaDOM();
      }
      // no-op for overlay; it's cleared by onFinish in the other effect
    };

    view.addEventListener("page-favicon-updated", handleFavicon);
   
    view.addEventListener("did-fail-load", handleFail);
    view.addEventListener("did-finish-load", handleFinish);

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
      view.removeEventListener("did-navigate", handleNavigate);
      view.removeEventListener("did-navigate-in-page", handleNavigateInPage);
      view.removeEventListener("did-start-navigation", handleStartNavigation);
      view.removeEventListener("did-redirect-navigation", handleRedirect);
      view.removeEventListener("will-navigate", handleWillNavigate);
      view.removeEventListener("load-commit", handleLoadCommit);
      view.removeEventListener("new-window", handleNewWindow);
    };
  }, [onFaviconChange, onUrlChange]);

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

    document.addEventListener("browser-reload", reloadListener);
    document.addEventListener("browser-back", backListener);
    document.addEventListener("browser-forward", forwardListener);

    return () => {
      document.removeEventListener("browser-reload", reloadListener);
      document.removeEventListener("browser-back", backListener);
      document.removeEventListener("browser-forward", forwardListener);
    };
  }, []);

  useEffect(() => {
    // When the URL prop changes, it signifies a new navigation intent.
    // Reset the favicon to default and mark it as pending.
    pendingFaviconRef.current = true;
    if (onFaviconChange) {
      onFaviconChange(defaultLogo);
    }
  }, [url, onFaviconChange]);

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
      className="page-root"
      style={{
        position: "relative",
        width: "99%",
      }}
    >
      <webview
        ref={viewRef}
        id="browser"
        className="webview"
        src={preInvalid ? 'about:blank' : url}
        webpreferences="contextIsolation=yes, nativeWindowOpen=yes"
        allowpopups="true"
        partition="persist:browser"
        useragent={desktopUA}
        style={{
          position: "absolute",
          left: 0,
          width: aiMode ? "70%" : "100%",
          height: "100%",
          zIndex: 1,
        }}
      ></webview>
      {loadError && <ErrorDisplay errorInfo={errorInfo} />}
    </div>
  );
}

