import axios from 'axios'

axios.defaults.withCredentials = true

// The app shell is gated server-side, so a 401 here means the session expired
// while the tab was open. Bounce to the login page instead of rendering
// error states across every panel.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.replace('/login')
    }
    return Promise.reject(error)
  },
)
