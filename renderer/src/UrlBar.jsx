import React, { useState } from "react";
import "./style.css";

import rightIcon from "../icons/icons8-chevron-right-100.png";
import leftIcon from "../icons/icons8-chevron-left-100.png";
import refreshIcon from "../icons/icons8-reload-100.png";
import defaultLogo from "../icons/default.png";
import aiIcon from "../icons/icons8-ai-100.png";
import profileIcon from "../icons/icons8-round-100.png";

import Modal from "react-modal";
Modal.setAppElement("#root");

export default function UrlBar() {
  const [openModal, setOpenModal] = useState(false);
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="urlbar">

      <div className="icons-div">

        <button className="icon-btn">
          <img className="icon" src={leftIcon} alt="Left" draggable="false" />
        </button>

        <button className="icon-btn">
          <img className="icon" src={rightIcon} alt="Right" draggable="false" />
        </button>

        <button className="icon-btn">
          <img className="icon" src={refreshIcon} alt="Refresh" draggable="false" />
        </button>

        <div className="urlbar-input-wrapper">
          <img src={defaultLogo} alt="Logo" className="suma-logo" />
          <input
            className="input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask or Navigate"
            type="text"
          />
        </div>

      </div>

      {/* Profile + AI Icons */}
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

            <button className="modal-option">
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
