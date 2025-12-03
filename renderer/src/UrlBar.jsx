import React, { useEffect, useState } from "react";
import "./style.css";

import rightIcon from "../icons/icons8-chevron-right-100.png";
import leftIcon from "../icons/icons8-chevron-left-100.png";
import refreshIcon from "../icons/icons8-reload-100.png";
import defaultLogo from "../icons/default.png";
import aiIcon from "../icons/icons8-ai-100.png";
import profileIcon from "../icons/icons8-round-100.png";

import Modal from "react-modal";
import Customize from "./Customize";
Modal.setAppElement("#root");

export default function UrlBar({ url, setUrl, favicon, onThemeChange, currentThemeColor }) {
  const [openModal, setOpenModal] = useState(false);
  const [inputValue, setInputValue] = useState(url || "");
    // Format URL for display (hide trailing slash for root paths)
    const formatForDisplay = (value) => {
      if (!value) return "";
      try {
        const u = new URL(value);
        const isRoot = (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash;
        return isRoot ? `${u.protocol}//${u.hostname}` : value;
      } catch {
        return value;
      }
    };
    // Keep input in sync when url prop changes (e.g., link clicks)
    useEffect(() => {
      setInputValue(formatForDisplay(url || ""));
    }, [url]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const openCustomize = () => {
    setOpenModal(false);
    setCustomizeOpen(true);
  };
  const closeCustomize = () => setCustomizeOpen(false);
  const isLikelyUrl = (value) => {
    if (!value) return false;
    const test = value.includes("://") ? value : `https://${value}`;
    try {
      // Will throw on invalid URL
      // eslint-disable-next-line no-new
      new URL(test);
      return true;
    } catch {
      return false;
    }
  };

  // No direct webview listeners here; Page emits favicon via props
const goToUrl = () => {
    let final = (inputValue || "").trim();
    if (!final) return;
    if (!/^https?:\/\//i.test(final)) {
      final = `https://${final}`;
    }
    // If still not a valid URL, treat input as a search query
    if (!isLikelyUrl(final)) {
      const q = encodeURIComponent(inputValue.trim());
      final = `https://www.google.com/search?q=${q}`;
    }
    // If navigating to the same current URL, trigger a reload instead
    if ((url || "").trim() && final.trim() === (url || "").trim()) {
      document.dispatchEvent(new Event("browser-reload"));
      return;
    }
    setUrl(final);
  };
  return (
    <div className="urlbar">
      {customizeOpen && <Customize onClose={closeCustomize} onThemeChange={onThemeChange} currentColor={currentThemeColor} />}
      <div className="icons-div">

        

        <button className="icon-btn" onClick={() => document.dispatchEvent(new Event("browser-back"))}>
          <img className="icon" src={leftIcon} alt="Back" draggable="false" />
        </button>
        <button className="icon-btn" onClick={() => document.dispatchEvent(new Event("browser-forward"))}>
          <img className="icon" src={rightIcon} alt="Right" draggable="false" />
        </button>

        <button className="icon-btn" onClick={() => document.dispatchEvent(new Event("browser-reload"))}>
          <img className="icon" src={refreshIcon} alt="Refresh" draggable="false" />
        </button>


        <div className="urlbar-input-wrapper">
          <img src={favicon || defaultLogo} alt="Logo" className="suma-logo" />
          <input
            className="input"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
            onKeyDown={(e) => (e.key === "Enter" || e.key === "NumpadEnter") && goToUrl()}
            placeholder="Enter the url"
            type="text"
          />
        </div>

      </div>

      
      <div className="profile-modal-anchor">
        <div className="profile-div">
          <button className="other">
            <img src={aiIcon} style={{ height: "25px", width: "25px" }} />
          </button>

          <button className="other" onClick={() => setOpenModal((p) => !p)}>
            <img src={profileIcon} style={{ height: "30px", width: "30px" }} />
          </button>
        </div>

        {/* Dropdown Modal */}
        <Modal
          isOpen={openModal}
          onRequestClose={() => setOpenModal(false)}
          overlayClassName="modal-overlay-transparent"
          className="profile-modal-dropdown"
        >
          <div className="modal-content">

            <img src={profileIcon} className="modal-profile-img" />

            <p className="modal-username">Praveen</p>

            <button className="modal-option" onClick={openCustomize}>
              <img src="../icons/icons8-pencil-100.png" className="modal-option-icon" />
              <p className="modal-option-text">Customize browser</p>
            </button>

            <button className="modal-option">
              <img src="../icons/icons8-key-100.png" className="modal-option-icon" />
              <p className="modal-option-text">Manage passwords</p>
            </button>

          </div>
        </Modal>
      </div>

    </div>
  );
}
