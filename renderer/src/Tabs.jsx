import React from 'react';
import Tab from './Tab';
import './style.css';

export default function Tabs({ tabs, activeTabId, onTabClick, onTabClose, onNewTab }) {
  return (
    <div className="tabs-container">
      <div className="tabs-list">
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            id={tab.id}
            title={tab.title}
            favicon={tab.favicon}
            isActive={tab.id === activeTabId}
            onClick={onTabClick}
            onClose={onTabClose}
          />
        ))}
        <button className="new-tab-btn" title="New Tab" onClick={onNewTab}>+</button>
      </div>
    </div>
  );
}
