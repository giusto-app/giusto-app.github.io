import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)

// `?compare` opens the staff-renderer comparison — a development page, as its
// own footer says. It is imported DYNAMICALLY because its three renderers drag
// in VexFlow, the frozen lily-viewer and the pre-lilyjs lily-parser: 2.0 MB of
// what was a 3.6 MB bundle, downloaded by every user for a page almost none of
// them open. Static-importing it here was costing 56% of the JavaScript.
if (new URLSearchParams(window.location.search).has('compare')) {
  void import('./pages/practice/StaffComparison.tsx').then(({ default: StaffComparison }) => {
    root.render(
      <StrictMode>
        <StaffComparison />
      </StrictMode>,
    )
  })
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

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
