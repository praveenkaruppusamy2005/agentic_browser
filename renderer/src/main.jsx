import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import UrlBar from './UrlBar'
import Page from './Page'
import defaultLogo from '../icons/default.png'
function App() {
  const [url, setUrl] = React.useState("https://www.google.com");
  const [favicon, setFavicon] = React.useState(defaultLogo);
  return (
    <div className="app-root">
      <UrlBar url={url} setUrl={setUrl} favicon={favicon} />
      <Page url={url} onFaviconChange={setFavicon} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
