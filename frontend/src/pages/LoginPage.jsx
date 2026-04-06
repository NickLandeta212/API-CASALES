import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import logo from '../assets/casales-san-pedro-logo.svg'

function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('admin@conjunto.com')
  const [password, setPassword] = useState('Admin123*')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (requestError) {
      const message = requestError?.response?.data?.message || 'No se pudo iniciar sesion'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-hero">
          <img className="login-logo" src={logo} alt="Casales San Pedro" />
          <div>
            <p className="eyebrow">CASALES SAN PEDRO</p>
            <h1>Panel de Gestion</h1>
            <p className="subtitle">Ingresa con tu cuenta para administrar torres, departamentos, personas y reservas.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Usuario / apodo
            <input
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="username"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="error-box">{error}</p> : null}

          <button type="submit" disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
