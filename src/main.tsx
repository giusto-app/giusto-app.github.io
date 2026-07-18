import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import StaffComparison from './pages/practice/StaffComparison.tsx'

const isCompare = new URLSearchParams(window.location.search).has('compare')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCompare ? <StaffComparison /> : <App />}
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
