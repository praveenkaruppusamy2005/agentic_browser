import React, { useRef, useEffect, useState, useCallback } from "react";
import voiceAnimation from "../../Animations/voice.mp4";
import "./style.css";
import defaultLogo from "../icons/default.png";

// Removed AI_SERVICE_BASE as polling is no longer used

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

export default function Page({ url, id, isActive, onFaviconChange, onUrlChange, onTitleChange, onLoadingChange, aiMode = false, setAiMode }) {
  const viewRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [errorInfo, setErrorInfo] = useState({ desc: '' });
  const [newTabQuery, setNewTabQuery] = useState('');
  const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const lastHostRef = useRef("");
  const pendingFaviconRef = useRef(false);
  const [preInvalid, setPreInvalid] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentUrlRef = useRef(url);
  const overlayInputRef = useRef(null);
  const initialSrcRef = useRef(null);
  // Removed aiPollTimerRef as polling logic is removed
  const [aiListening, setAiListening] = useState(false);
  
  // State variables for displaying the transcript
  const [aiTranscript, setAiTranscript] = useState(""); // Kept for simplicity/legacy, though partial/final are preferred
  const [aiPartialTranscript, setAiPartialTranscript] = useState(""); 
  const [aiFinalTranscript, setAiFinalTranscript] = useState("");
  
  const [aiError, setAiError] = useState("");
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  
  useEffect(() => {
    const val = typeof url === 'string' ? url.trim() : '';
    currentUrlRef.current = /^about:blank\/?$/i.test(val) ? '' : val;
  }, [url]);
  
  const normalizeUrl = (raw) => {
    const val = (raw || "").trim();
    if (!val) return "about:blank";
    if (/^https?:\/\//i.test(val)) return val;
    if (/\s/.test(val)) {
      const q = encodeURIComponent(val);
      return `https://www.google.com/search?q=${q}`;
    }
    if (/\./.test(val)) return `https://${val}`;
    const q = encodeURIComponent(val);
    return `https://www.google.com/search?q=${q}`;
  };

  if (initialSrcRef.current === null) {
    initialSrcRef.current = normalizeUrl(url);
  }

  const sanitizeTabUrl = (raw) => {
    const val = typeof raw === "string" ? raw.trim() : "";
    if (!val || /^about:blank\/?$/i.test(val)) return "";
    try {
      return new URL(val).href;
    } catch {
      return val;
    }
  };

  const submitOverlayNavigation = () => {
    const view = viewRef.current;
    const query = newTabQuery.trim();
    if (!query) return;
    const target = normalizeUrl(query);
    const sanitized = sanitizeTabUrl(target) || target;
    if (view && typeof view.loadURL === "function") {
      try {
        view.loadURL(target);
      } catch {}
    } else {
      initialSrcRef.current = target;
    }
    currentUrlRef.current = sanitized;
    if (typeof onUrlChange === "function") onUrlChange(sanitized);
    setPreInvalid(false);
    setNewTabQuery("");
  };

  useEffect(() => {
    const el = overlayInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 160;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [newTabQuery, preInvalid]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      // Cleanup for aiPollTimerRef removed here
    };
  }, []);

  // Removed clearAiPolling, pollTranscriptOnce, and startTranscriptPolling functions

  const DEEPGRAM_WS_URL = "ws://127.0.0.1:5002";
  
  // Memoized function to stop the microphone and Deepgram connection
  const stopAiMic = useCallback(() => {
    // Stop MediaStreamTracks
    if (sourceRef.current && sourceRef.current.mediaStream) {
      sourceRef.current.mediaStream.getTracks().forEach(track => track.stop());
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audioContextRef.current.close().catch(e => console.error("Error closing AudioContext:", e));
      audioContextRef.current = null;
    }
    // Check if WS is open before trying to close it
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setAiListening(false);
  }, []);

  // Deepgram live streaming logic - Memoized function to start the mic and WS connection
  const startAiMic = useCallback(async () => {
    setAiError("");
    setAiTranscript("");
    setAiPartialTranscript("");
    setAiFinalTranscript("");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      const ws = new window.WebSocket(DEEPGRAM_WS_URL);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setAiListening(true);
        setAiError(""); // Clear error on successful connection
      }
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'transcript' && msg.data && msg.data.channel && msg.data.channel.alternatives) {
            const alt = msg.data.channel.alternatives[0];
            const transcriptText = alt.transcript || "";
            
            // Map Deepgram's is_final flag to update the separate final and partial transcripts
            if (msg.data.is_final) {
              // Append to final transcript and clear partial
              setAiFinalTranscript(prev => (prev + " " + transcriptText).trim());
              setAiPartialTranscript(""); 
            } else {
              // Update partial transcript for real-time display
              setAiPartialTranscript(transcriptText);
            }
            setAiTranscript(transcriptText); // Kept for original structure
          } else if (msg.type === 'error') {
            setAiError(`Deepgram Error: ${msg.message}`);
            stopAiMic();
          }
        } catch (e) {
          console.error("Error parsing WS message:", e);
        }
      };
      
      ws.onerror = () => {
        setAiError('WebSocket connection error (Deepgram server offline?)');
        stopAiMic();
      };
      ws.onclose = () => setAiListening(false);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === 1) {
          // Convert 32-bit float audio buffer to 16-bit PCM (linear16) for Deepgram
          const input = e.inputBuffer.getChannelData(0);
          const buffer = new ArrayBuffer(input.length * 2);
          const view = new DataView(buffer);
          for (let i = 0; i < input.length; i++) {
            let s = Math.max(-1, Math.min(1, input[i]));
            // Set 16-bit integer, true for little-endian encoding
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); 
          }
          ws.send(buffer);
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
    } catch (err) {
      setAiError('Mic permission/access error: ' + (err.message || err));
      setAiListening(false);
    }
  }, [stopAiMic]); // Dependency on stopAiMic is important

  const toggleAiMic = useCallback(() => {
    if (aiListening) {
      stopAiMic();
    } else {
      startAiMic();
    }
  }, [aiListening, startAiMic, stopAiMic]);

  useEffect(() => {
    if (!aiMode) {
      if (aiListening) {
        stopAiMic(); 
      }
    }
  }, [aiMode, aiListening, stopAiMic]);

  
  useEffect(() => {
    // When the URL changes, we immediately reset the error state.
    setLoadError(false);
    setErrorInfo({ desc: '' });

    // 1. Pre-validate the URL before even attempting to load it.
    const val = (url || "").trim();
    if (!val) {
      // Empty tab: keep blank and no error overlay.
      setPreInvalid(true);
      setNewTabQuery('');
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
              if (onUrlChange) onUrlChange(sanitizeTabUrl(fallback) || fallback);
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
  }, [url, onFaviconChange, onTitleChange, onUrlChange, onLoadingChange]);

  
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !onFaviconChange) return;

    const resolveFaviconUrl = (raw) => {
      if (typeof raw !== 'string') return defaultLogo;
      const trimmed = raw.trim();
      if (!trimmed) return defaultLogo;
      try {
        if (/^data:/i.test(trimmed) || /^https?:/i.test(trimmed)) {
          return trimmed;
        }
        const viewUrl = (view && typeof view.getURL === 'function') ? view.getURL() : '';
        const base = viewUrl || currentUrlRef.current || '';
        if (base) {
          return new URL(trimmed, base).href;
        }
        return new URL(trimmed).href;
      } catch {
        return trimmed;
      }
    };

    const handleFavicon = (e) => {
      const raw = e && Array.isArray(e.favicons) ? e.favicons.find((item) => typeof item === 'string' && item.trim().length > 0) : '';
      const icon = resolveFaviconUrl(raw || defaultLogo);
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
          if (links.length) {
            const href = links[0].href;
            if (href) return href;
          }
          try {
            return new URL('/favicon.ico', window.location.href).href;
          } catch (err) {
            return '/favicon.ico';
          }
        })()`);
        if (icon && typeof icon === 'string' && icon.trim().length > 0) {
          onFaviconChange(resolveFaviconUrl(icon));
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
          if (/^about:blank\/?$/i.test(currentUrl)) {
            currentUrlRef.current = "";
            onFaviconChange(defaultLogo);
            return;
          }
          const u = new URL(currentUrl);
          currentUrlRef.current = sanitizeTabUrl(u.href) || u.href;
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
      if (e && e.url) {
        const sanitized = sanitizeTabUrl(e.url);
        const nextUrl = sanitized === "" ? "" : sanitized;
        currentUrlRef.current = nextUrl;
        if (onUrlChange) onUrlChange(nextUrl);
      }
    };
    const handleNavigateInPage = (e) => {
      console.info('Webview did-navigate-in-page', e && e.url);
      if (e && e.url) {
        const sanitized = sanitizeTabUrl(e.url);
        const nextUrl = sanitized === "" ? "" : sanitized;
        currentUrlRef.current = nextUrl;
        if (onUrlChange) onUrlChange(nextUrl);
      }
    };
    const handleRedirect = (e) => {
      console.info('Webview did-redirect-navigation', e && e.url);
      if (e && e.url) {
        const sanitized = sanitizeTabUrl(e.url);
        const nextUrl = sanitized === "" ? "" : sanitized;
        currentUrlRef.current = nextUrl;
        if (onUrlChange) onUrlChange(nextUrl);
      }
    };
    const handleWillNavigate = (e) => {
      console.info('Webview will-navigate', e && e.url);
      if (e && e.url) {
        const sanitized = sanitizeTabUrl(e.url);
        const nextUrl = sanitized === "" ? "" : sanitized;
        currentUrlRef.current = nextUrl;
        if (onUrlChange) onUrlChange(nextUrl);
      }
    };
    const handleLoadCommit = (e) => {
      // mainFrame load commit includes the current URL reliably
      const isMain = e && e.isMainFrame === true;
      const current = e && e.url;
      if (isMain && current) {
        console.info('Webview load-commit (main)', current);
        const sanitized = sanitizeTabUrl(current);
        const nextUrl = sanitized === "" ? "" : sanitized;
        currentUrlRef.current = nextUrl;
        if (onUrlChange) onUrlChange(nextUrl);
      }
    };
    const handleStartNavigation = (e) => {
      // When main-frame starts navigation to a different host, keep previous favicon
      // to avoid flicker; new favicon will update via page-favicon-updated or fail handler.
      if (!e || e.isInPlace || e.isSameDocument) return;
      const target = e.url || "";
      try {
        const urlObj = new URL(target);
        const host = urlObj.host;
        if (host && host !== lastHostRef.current) {
          lastHostRef.current = host;
          // Mark favicon as pending; we'll update on event or DOM fallback
          pendingFaviconRef.current = true;
        }
        const sanitized = sanitizeTabUrl(urlObj.href);
        currentUrlRef.current = sanitized === "" ? "" : sanitized;
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

  useEffect(() => {
    if (!isActive) return;
    const view = viewRef.current;
    if (!view) return;
    try {
      const desired = normalizeUrl(url);
      if (!desired || desired === 'about:blank') return;
      const current = typeof view.getURL === 'function' ? view.getURL() : '';
      if (!current) {
        view.loadURL(desired);
        return;
      }
      const same = (() => {
        try {
          const a = new URL(desired);
          const b = new URL(current);
          return a.href === b.href;
        } catch {
          return desired === current;
        }
      })();
      if (!same) {
        view.loadURL(desired);
      }
    } catch {}
  }, [isActive, url]);


  const transcriptHeading = aiError
    ? "Error"
    : aiListening
      ? "Listening..."
      : aiFinalTranscript 
        ? "Transcription (Final)"
        : aiPartialTranscript 
          ? "Listening..."
          : "";

  const transcriptBody = aiError
    ? aiError
    // Display final, otherwise partial, otherwise prompt the user
    : aiFinalTranscript || aiPartialTranscript || (aiListening ? "Say something..." : ""); 

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
          src={initialSrcRef.current}
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
            visibility: preInvalid ? 'hidden' : 'visible',
            pointerEvents: preInvalid ? 'none' : 'auto',
          }}
        ></webview>
        {preInvalid && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '32px',
              backgroundColor: '#0d0d0d',
              color: '#f5f5f5',
              textAlign: 'center',
              padding: '32px'
            }}
          >
            <div
              style={{
                fontSize: '28px',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              How are you feeling today?
            </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
              <div
                style={{
                  width: 'min(640px, 90vw)',
                  borderRadius: '22px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, rgba(35,35,35,0.95), rgba(20,20,20,0.95))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 18px 60px rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(18px)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '12px',
                      background: 'rgba(239,68,68,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <line x1="16.65" y1="16.65" x2="21" y2="21" />
                    </svg>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start'
                    }}
                  >
                    <textarea
                      ref={overlayInputRef}
                      value={newTabQuery}
                      onChange={(e) => setNewTabQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          submitOverlayNavigation();
                        }
                      }}
                      placeholder="Ask anything. Type @ for mentions or / for shortcuts."
                      rows={1}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#f5f5f5',
                        fontSize: 16,
                        fontWeight: 500,
                        lineHeight: '22px',
                        resize: 'none',
                        padding: 0,
                        minHeight: '40px',
                        maxHeight: '160px',
                        overflow: 'hidden',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(255,255,255,0.08)',
                        color: '#f5f5f5',
                        cursor: 'pointer'
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#f5f5f5"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                    <button
                      onClick={submitOverlayNavigation}
                      style={{
                        width: 44,
                        height: 36,
                        borderRadius: '12px',
                        border: 'none',
                        background: '#0ea5e9',
                        color: '#0b0b0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: 18,
                        fontWeight: 600
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0b0b0b"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
              background: "#000000",
              borderLeft: "1px solid rgba(255,255,255,0.15)",
              overflow: "hidden"
            }}
          >
            {transcriptBody && (
              <div
                style={{
                  position: "absolute",
                  top: 32,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "88%",
                  color: "#f5f5f5",
                  textAlign: "center",
                  background: "rgba(11,11,11,0.65)",
                  borderRadius: 16,
                  padding: "16px 18px",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  zIndex: 2,
                  boxShadow: "0 14px 40px rgba(0,0,0,0.4)",
                  maxHeight: "40%",
                  overflowY: "auto",
                }}
              >
                {transcriptHeading && (
                  <div style={{ fontSize: 14, letterSpacing: "0.04em", opacity: 0.75, marginBottom: 8 }}>
                    {transcriptHeading}
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 500, lineHeight: "22px" }}>{transcriptBody}</div>
              </div>
            )}
            <video
              src={voiceAnimation}
              style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 12, zIndex: 0 }}
              autoPlay
              loop
              muted
              playsInline
            />
            <div
              style={{
                position: "absolute",
                bottom: 56,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 16,
                zIndex: 1
              }}
            >
              <button
                onClick={toggleAiMic}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: aiListening ? "rgba(14,165,233,0.85)" : "rgba(13,13,13,0.55)",
                  backdropFilter: "blur(12px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#f5f5f5",
                  transition: "background 0.2s ease",
                }}
                title={aiListening ? "Stop listening" : "Start listening"}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={aiListening ? "#0b0b0b" : "#f5f5f5"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              <button
                onClick={() => {
                  if (typeof setAiMode === "function") {
                    setAiMode(false);
                  }
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "rgba(13,13,13,0.55)",
                  backdropFilter: "blur(12px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#f5f5f5"
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f5f5f5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
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