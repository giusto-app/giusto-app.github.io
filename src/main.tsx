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

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
} else if ('serviceWorker' in navigator) {
  // A production service worker previously registered on localhost can keep
  // serving an old index.html that references deleted hashed chunks. Clean up
  // registrations and Giusto caches so development always reaches the server.
  void navigator.serviceWorker.getRegistrations().then(registrations =>
    Promise.all(registrations.map(registration => registration.unregister())),
  )
  if ('caches' in window) {
    void caches.keys().then(keys =>
      Promise.all(keys.filter(key => key.startsWith('giusto-')).map(key => caches.delete(key))),
    )
  }
}
