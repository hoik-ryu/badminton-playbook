import { Outlet } from 'react-router'

export function RootLayout() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <Outlet />
    </main>
  )
}
