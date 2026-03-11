import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App.tsx'
import { getE2EHooks } from './testing/e2eHooks'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

let root: Root = createRoot(rootElement)

const renderApp = () => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

renderApp()

if (import.meta.env.DEV) {
  const e2eHooks = getE2EHooks()
  if (e2eHooks) {
    e2eHooks.remountApp = () => {
      root.unmount()
      root = createRoot(rootElement)
      renderApp()
    }
  }
}
