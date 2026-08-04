import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { getWebApp } from './utils/telegram';

try {
  const webApp = getWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();
    if (webApp.requestFullscreen) {
      webApp.requestFullscreen();
    }
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
