import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import WebApp from '@twa-dev/sdk'

try {
  WebApp.ready();
  WebApp.expand();
  if (WebApp.requestFullscreen) {
    WebApp.requestFullscreen();
  }
} catch (e) {
  console.warn('WebApp init failed', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
