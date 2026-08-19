import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initTelegram } from './utils/telegram'

// Единственное место инициализации Telegram WebApp — до первого рендера,
// чтобы приложение сразу знало, есть ли initData.
initTelegram()

// Блокировка масштабирования и случайного приближения экрана
if (typeof window !== 'undefined') {
  // Запрет жестов масштабирования на iOS Safari
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

  // Запрет мультитач-зума (pinch-to-zoom двумя пальцами)
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Запрет зума по двойному быстрому тапу (кроме клика по интерактивным элементам)
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement | null;
        if (target && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'LABEL'].includes(target.tagName)) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  // Запрет масштабирования колесиком мыши / тачпадом с Ctrl
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Запрет масштабирования сочетаниями клавиш (Ctrl + / - / 0)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
