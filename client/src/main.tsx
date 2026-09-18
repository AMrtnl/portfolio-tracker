import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './lib/authGuard'
import './wh/tokens.css'
import './wh/fonts.css'
import './index.css'
import './wealth.css'
import './wh/type.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
