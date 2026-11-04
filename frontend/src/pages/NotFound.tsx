import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center flex-col gap-4 text-center">
      <span className="text-6xl">🔍</span>
      <h1 className="text-title-page text-ink">Page not found</h1>
      <p className="text-body-default text-muted">The page you're looking for doesn't exist.</p>
      <Link to="/home" className="btn-primary">Go home</Link>
    </div>
  )
}

