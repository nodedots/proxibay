import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/open-runde/400.css'
import '@fontsource/open-runde/500.css'
import '@fontsource/open-runde/600.css'
import '@fontsource/open-runde/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
