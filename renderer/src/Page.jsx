import React, { useRef, useEffect, useState } from "react";
import "./style.css";
import Lottie from "lottie-react";
import errorAnimation from "../../Animations/404.json"
import defaultLogo from "../icons/default.png";
export default function Page({ url, onFaviconChange }) {
  const viewRef = useRef(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // reset error when URL changes
    setLoadError(false);
  }, [url]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const onFail = () => {
      setLoadError(true);
    };

    view.addEventListener("did-fail-load", onFail);

    return () => {
      view.removeEventListener("did-fail-load", onFail);
    };
  }, []);

  
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !onFaviconChange) return;

    const handleFavicon = (e) => {
      const icon = e.favicons?.[0];
      onFaviconChange(icon || defaultLogo);
    };
    const handleStart = () => onFaviconChange(defaultLogo);
    const handleFail = () => onFaviconChange(defaultLogo);

    view.addEventListener("page-favicon-updated", handleFavicon);
    view.addEventListener("did-start-loading", handleStart);
    view.addEventListener("did-fail-load", handleFail);

    return () => {
      view.removeEventListener("page-favicon-updated", handleFavicon);
      view.removeEventListener("did-start-loading", handleStart);
      view.removeEventListener("did-fail-load", handleFail);
    };
  }, [onFaviconChange]);

  return (
    <div className="page-root" style={{ position: "relative" }}>
      <webview
        ref={viewRef}
        id="browser"
        className="webview"
        src={url}
        webpreferences="contextIsolation=yes"
      ></webview>
      {loadError && (
        <div
          className="error-page"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Lottie animationData={errorAnimation} loop={true} style={{ width: "50%", height: "50%" }} />
        </div>
      )}
    </div>
  );
}
 
