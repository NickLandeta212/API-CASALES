import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/useAuth'

function OverviewPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({ torres: 0, departamentos: 0, personas: 0, reservas: 0 })
  const [recentReservas, setRecentReservas] = useState([])

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const [torresResp, departamentosResp, personasResp, reservasResp] = await Promise.all([
          api.get('/torres'),
          api.get('/departamentos'),
          api.get('/personas'),
          api.get('/reservas'),
        ])

        if (!mounted) return

        setSummary({
          torres: torresResp.data.length,
          departamentos: departamentosResp.data.length,
          personas: personasResp.data.length,
          reservas: reservasResp.data.length,
        })

        setRecentReservas(reservasResp.data.slice(0, 5))
      } catch (requestError) {
        if (!mounted) return
        setError(requestError?.response?.data?.message || 'No se pudo cargar el resumen')
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [])

  const cards = useMemo(
    () => [
      { title: 'Torres', value: summary.torres },
      { title: 'Departamentos', value: summary.departamentos },
      { title: 'Personas', value: summary.personas },
      { title: 'Reservas', value: summary.reservas },
    ],
    [summary],
  )

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">CASALES SAN PEDRO</p>
          <h2>Bienvenido, {user?.nombre}</h2>
          <p className="subtitle">Vista rapida del sistema y actividad reciente.</p>
        </div>
      </header>

      {error ? <p className="error-box">{error}</p> : null}

      <section className="stats-grid">
        {cards.map((card) => (
          <article key={card.title} className="stat-card">
            <h3>{card.title}</h3>
            <p>{loading ? '...' : card.value}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <h3>Reservas recientes</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : recentReservas.length === 0 ? (
          <p>No hay reservas registradas.</p>
        ) : (
          <ul className="plain-list">
            {recentReservas.map((item) => (
              <li key={item.id}>
                <strong>{item.fecha}</strong> · Torre {item.torre_numero} · Dpto {item.departamento_numero} · {item.estado}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

export default OverviewPage
