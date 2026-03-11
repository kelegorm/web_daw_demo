import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App.tsx'
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
  const codexWindow = window as Window & { __remountApp?: () => void }
  codexWindow.__remountApp = () => {
    root.unmount()
    root = createRoot(rootElement)
    renderApp()
  }
}
