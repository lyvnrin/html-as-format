export function authHeaders() {
  return { 'x-app-token': import.meta.env.VITE_APP_TOKEN || '' }
}
