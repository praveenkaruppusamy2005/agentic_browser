import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import UrlBar from './UrlBar'
import Page from './Page'
function App() {
  return (
    <div className="app-root">
      <UrlBar></UrlBar>
      <Page/>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
