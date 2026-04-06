import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/useAuth'

function DepartamentoDetallePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [departamento, setDepartamento] = useState(null)
  const [personas, setPersonas] = useState([])

  const canAccess = ['admin_general', 'admin_conjunto', 'condomino'].includes(user?.role)

  useEffect(() => {
    if (!canAccess) return

    let mounted = true

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const [departamentoResp, personasResp] = await Promise.all([
          api.get(`/departamentos/${id}`),
          api.get('/personas'),
        ])

        if (!mounted) return

        const filteredPersonas = personasResp.data.filter(
          (persona) => Number(persona.departamento_id) === Number(id),
        )

        setDepartamento(departamentoResp.data)
        setPersonas(filteredPersonas)
      } catch (requestError) {
        if (!mounted) return
        setError(requestError?.response?.data?.message || 'No se pudo cargar el detalle del departamento')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [canAccess, id])

  const ocupacion = useMemo(() => {
    const total = personas.length
    return `${total}/10`
  }, [personas.length])


  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Departamento</p>
          <h2>Inspeccion de personas registradas</h2>
          <p className="subtitle">Visualiza cuantas personas hay en este departamento y su detalle.</p>
        </div>
      </header>

      {error ? <p className="error-box">{error}</p> : null}

      <section className="panel">
        <div className="crud-head">
          <div>
            <h3 style={{ marginBottom: 8 }}>
              {loading || !departamento
                ? 'Cargando departamento...'
                : `Torre ${departamento.torre_numero} · Dpto ${departamento.numero}`}
            </h3>
            <p className="muted-note" style={{ margin: 0 }}>
              {loading ? 'Calculando ocupacion...' : `Personas registradas: ${personas.length} (cupo ${ocupacion})`}
            </p>
          </div>

          <Link to="/departamentos" className="ghost link-btn">
            Volver a departamentos
          </Link>
        </div>

        <div className="detail-grid">
          <article className="stat-card">
            <h3>Personas registradas</h3>
            <p>{loading ? '...' : personas.length}</p>
          </article>

          <article className="stat-card">
            <h3>Cupo maximo</h3>
            <p>10</p>
          </article>

          <article className="stat-card">
            <h3>Espacios disponibles</h3>
            <p>{loading ? '...' : Math.max(0, 10 - personas.length)}</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <h3>Listado de personas</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : personas.length === 0 ? (
          <p>No hay personas registradas en este departamento.</p>
        ) : (
          <ul className="plain-list">
            {personas.map((persona) => (
              <li key={persona.id}>
                <strong>
                  {persona.nombres} {persona.apellidos}
                </strong>{' '}
                · Documento: {persona.documento} · Tipo: {persona.tipo_ocupacion}
                {persona.telefono ? ` · Telefono: ${persona.telefono}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

export default DepartamentoDetallePage
