import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary'

// Detect if API base URL is configured
if (!import.meta.env.VITE_API_BASE_URL) {
  console.warn('Warning: VITE_API_BASE_URL environment variable is not set. API calls will fail.');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
