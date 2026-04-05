import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main className="not-found-shell">
      <h1>404</h1>
      <p>La ruta que buscas no existe.</p>
      <Link to="/">Volver al inicio</Link>
    </main>
  )
}

export default NotFoundPage
