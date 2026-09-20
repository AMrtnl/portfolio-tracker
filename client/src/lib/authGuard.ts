import axios from 'axios'

axios.defaults.withCredentials = true

// A 401 inside the product means the session expired while the tab was open.
// Bounce to sign-in with a way back instead of rendering error states across
// every panel. Public pages never need a session, so they are left alone.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const path = window.location.pathname
    if (error?.response?.status === 401 && path.startsWith('/app')) {
      const next = encodeURIComponent(path + window.location.search)
      window.location.replace(`/login?next=${next}`)
    }
    return Promise.reject(error)
  },
)
