import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

const EMPTY_TORRE = { numero: '', total_departamentos: '' }
const EMPTY_DEPARTAMENTO = { torre_id: '', numero: '', usuario_id: '', tipo_ocupacion: 'dueno' }
const EMPTY_PERSONA = { departamento_id: '', nombres: '', apellidos: '', documento: '', telefono: '' }
const EMPTY_RESERVA = { departamento_id: '', fecha: '', estado: 'disponible', observaciones: '' }
const EMPTY_USUARIO = { nombre: '', email: '', password: '', role: 'condomino' }

function DashboardPage() {
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('torres')
  const [search, setSearch] = useState('')

  const [torres, setTorres] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [personas, setPersonas] = useState([])
  const [reservas, setReservas] = useState([])
  const [usuarios, setUsuarios] = useState([])

  const [torreForm, setTorreForm] = useState(EMPTY_TORRE)
  const [departamentoForm, setDepartamentoForm] = useState(EMPTY_DEPARTAMENTO)
  const [personaForm, setPersonaForm] = useState(EMPTY_PERSONA)
  const [reservaForm, setReservaForm] = useState(EMPTY_RESERVA)
  const [usuarioForm, setUsuarioForm] = useState(EMPTY_USUARIO)

  const [editingId, setEditingId] = useState(null)
  const [summary, setSummary] = useState({ torres: 0, departamentos: 0, personas: 0, reservas: 0 })

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      setError('')
      setMessage('')

      try {
        const [torresResp, departamentosResp, personasResp, reservasResp] = await Promise.all([
          api.get('/torres'),
          api.get('/departamentos'),
          api.get('/personas'),
          api.get('/reservas'),
        ])

        let usuariosResp = { data: [] }
        if (user?.role === 'admin_general' || user?.role === 'admin_conjunto') {
          try {
            usuariosResp = await api.get('/usuarios')
          } catch {
            usuariosResp = { data: [] }
          }
        }

        if (!mounted) return

        setTorres(Array.isArray(torresResp.data) ? torresResp.data : [])
        setDepartamentos(Array.isArray(departamentosResp.data) ? departamentosResp.data : [])
        setPersonas(Array.isArray(personasResp.data) ? personasResp.data : [])
        setReservas(Array.isArray(reservasResp.data) ? reservasResp.data : [])
        setUsuarios(Array.isArray(usuariosResp.data) ? usuariosResp.data : [])

        setSummary({
          torres: torresResp.data.length,
          departamentos: departamentosResp.data.length,
          personas: personasResp.data.length,
          reservas: reservasResp.data.length,
        })
      } catch (requestError) {
        if (!mounted) return
        setError(requestError?.response?.data?.message || 'No se pudo cargar el tablero')
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
  }, [user?.role])

  const cards = useMemo(
    () => [
      { key: 'torres', title: 'Torres', value: summary.torres },
      { key: 'departamentos', title: 'Departamentos', value: summary.departamentos },
      { key: 'personas', title: 'Personas', value: summary.personas },
      { key: 'reservas', title: 'Reservas', value: summary.reservas },
    ],
    [summary],
  )

  const canManageTorres = user?.role === 'admin_general' || user?.role === 'admin_conjunto'
  const canManageDepartamentos = canManageTorres
  const canManageUsuarios = user?.role === 'admin_general'

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return {
        torres,
        departamentos,
        personas,
        reservas,
        usuarios,
      }
    }

    const byText = (row) => JSON.stringify(row).toLowerCase().includes(q)
    return {
      torres: torres.filter(byText),
      departamentos: departamentos.filter(byText),
      personas: personas.filter(byText),
      reservas: reservas.filter(byText),
      usuarios: usuarios.filter(byText),
    }
  }, [search, torres, departamentos, personas, reservas, usuarios])

  function resetForms() {
    setEditingId(null)
    setTorreForm(EMPTY_TORRE)
    setDepartamentoForm(EMPTY_DEPARTAMENTO)
    setPersonaForm(EMPTY_PERSONA)
    setReservaForm(EMPTY_RESERVA)
    setUsuarioForm(EMPTY_USUARIO)
  }

  async function refreshData() {
    const [torresResp, departamentosResp, personasResp, reservasResp] = await Promise.all([
      api.get('/torres'),
      api.get('/departamentos'),
      api.get('/personas'),
      api.get('/reservas'),
    ])

    setTorres(torresResp.data)
    setDepartamentos(departamentosResp.data)
    setPersonas(personasResp.data)
    setReservas(reservasResp.data)

    if (user?.role === 'admin_general' || user?.role === 'admin_conjunto') {
      const usersResp = await api.get('/usuarios')
      setUsuarios(usersResp.data)
    }

    setSummary({
      torres: torresResp.data.length,
      departamentos: departamentosResp.data.length,
      personas: personasResp.data.length,
      reservas: reservasResp.data.length,
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      if (activeTab === 'torres') {
        const payload = {
          numero: Number(torreForm.numero),
          total_departamentos: Number(torreForm.total_departamentos),
        }
        if (editingId) {
          await api.put(`/torres/${editingId}`, payload)
          setMessage('Torre actualizada')
        } else {
          await api.post('/torres', payload)
          setMessage('Torre creada')
        }
      }

      if (activeTab === 'departamentos') {
        const payload = {
          torre_id: Number(departamentoForm.torre_id),
          numero: Number(departamentoForm.numero),
          usuario_id: departamentoForm.usuario_id ? Number(departamentoForm.usuario_id) : null,
          tipo_ocupacion: departamentoForm.tipo_ocupacion,
        }
        if (editingId) {
          await api.put(`/departamentos/${editingId}`, payload)
          setMessage('Departamento actualizado')
        } else {
          await api.post('/departamentos', payload)
          setMessage('Departamento creado')
        }
      }

      if (activeTab === 'personas') {
        const payload = {
          departamento_id: Number(personaForm.departamento_id),
          nombres: personaForm.nombres,
          apellidos: personaForm.apellidos,
          documento: personaForm.documento,
          telefono: personaForm.telefono,
        }
        if (editingId) {
          await api.put(`/personas/${editingId}`, payload)
          setMessage('Persona actualizada')
        } else {
          await api.post('/personas', payload)
          setMessage('Persona creada')
        }
      }

      if (activeTab === 'reservas') {
        const payload = {
          departamento_id: Number(reservaForm.departamento_id),
          fecha: reservaForm.fecha,
          estado: reservaForm.estado,
          observaciones: reservaForm.observaciones,
        }
        if (editingId) {
          await api.put(`/reservas/${editingId}`, payload)
          setMessage('Reserva actualizada')
        } else {
          await api.post('/reservas', payload)
          setMessage('Reserva creada')
        }
      }

      if (activeTab === 'usuarios' && canManageUsuarios) {
        const payload = {
          nombre: usuarioForm.nombre,
          email: usuarioForm.email,
          role: usuarioForm.role,
          ...(usuarioForm.password ? { password: usuarioForm.password } : {}),
        }

        if (editingId) {
          await api.put(`/usuarios/${editingId}`, payload)
          setMessage('Usuario actualizado')
        } else {
          await api.post('/usuarios', payload)
          setMessage('Usuario creado')
        }
      }

      resetForms()
      await refreshData()
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar el registro')
    }
  }

  async function handleDelete(id) {
    setError('')
    setMessage('')

    try {
      if (activeTab === 'torres') await api.delete(`/torres/${id}`)
      if (activeTab === 'departamentos') await api.delete(`/departamentos/${id}`)
      if (activeTab === 'personas') await api.delete(`/personas/${id}`)
      if (activeTab === 'reservas') await api.delete(`/reservas/${id}`)
      if (activeTab === 'usuarios' && canManageUsuarios) await api.delete(`/usuarios/${id}`)

      setMessage('Registro eliminado')
      if (editingId === id) {
        resetForms()
      }
      await refreshData()
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo eliminar')
    }
  }

  function startEdit(item) {
    setError('')
    setMessage('')
    setEditingId(item.id)

    if (activeTab === 'torres') {
      setTorreForm({ numero: String(item.numero ?? ''), total_departamentos: String(item.total_departamentos ?? '') })
    }

    if (activeTab === 'departamentos') {
      setDepartamentoForm({
        torre_id: String(item.torre_id ?? ''),
        numero: String(item.numero ?? ''),
        usuario_id: item.usuario_id ? String(item.usuario_id) : '',
        tipo_ocupacion: item.tipo_ocupacion ?? 'dueno',
      })
    }

    if (activeTab === 'personas') {
      setPersonaForm({
        departamento_id: String(item.departamento_id ?? ''),
        nombres: item.nombres ?? '',
        apellidos: item.apellidos ?? '',
        documento: item.documento ?? '',
        telefono: item.telefono ?? '',
      })
    }

    if (activeTab === 'reservas') {
      setReservaForm({
        departamento_id: String(item.departamento_id ?? ''),
        fecha: item.fecha ?? '',
        estado: item.estado ?? 'disponible',
        observaciones: item.observaciones ?? '',
      })
    }

    if (activeTab === 'usuarios') {
      setUsuarioForm({
        nombre: item.nombre ?? '',
        email: item.email ?? '',
        password: '',
        role: item.role ?? 'condomino',
      })
    }
  }

  function renderForm() {
    if (activeTab === 'torres') {
      if (!canManageTorres) return null
      return (
        <>
          <input placeholder="Numero" value={torreForm.numero} onChange={(e) => setTorreForm((p) => ({ ...p, numero: e.target.value }))} required />
          <input placeholder="Total departamentos" value={torreForm.total_departamentos} onChange={(e) => setTorreForm((p) => ({ ...p, total_departamentos: e.target.value }))} required />
        </>
      )
    }

    if (activeTab === 'departamentos') {
      if (!canManageDepartamentos) return null
      return (
        <>
          <input placeholder="Torre ID" value={departamentoForm.torre_id} onChange={(e) => setDepartamentoForm((p) => ({ ...p, torre_id: e.target.value }))} required />
          <input placeholder="Numero departamento" value={departamentoForm.numero} onChange={(e) => setDepartamentoForm((p) => ({ ...p, numero: e.target.value }))} required />
          <input placeholder="Usuario ID (opcional)" value={departamentoForm.usuario_id} onChange={(e) => setDepartamentoForm((p) => ({ ...p, usuario_id: e.target.value }))} />
          <select value={departamentoForm.tipo_ocupacion} onChange={(e) => setDepartamentoForm((p) => ({ ...p, tipo_ocupacion: e.target.value }))}>
            <option value="dueno">Dueno</option>
            <option value="arrendatario">Arrendatario</option>
          </select>
        </>
      )
    }

    if (activeTab === 'personas') {
      return (
        <>
          <input placeholder="Departamento ID" value={personaForm.departamento_id} onChange={(e) => setPersonaForm((p) => ({ ...p, departamento_id: e.target.value }))} required />
          <input placeholder="Nombres" value={personaForm.nombres} onChange={(e) => setPersonaForm((p) => ({ ...p, nombres: e.target.value }))} required />
          <input placeholder="Apellidos" value={personaForm.apellidos} onChange={(e) => setPersonaForm((p) => ({ ...p, apellidos: e.target.value }))} required />
          <input placeholder="Documento" value={personaForm.documento} onChange={(e) => setPersonaForm((p) => ({ ...p, documento: e.target.value }))} required />
          <input placeholder="Telefono" value={personaForm.telefono} onChange={(e) => setPersonaForm((p) => ({ ...p, telefono: e.target.value }))} />
        </>
      )
    }

    if (activeTab === 'reservas') {
      return (
        <>
          <input placeholder="Departamento ID" value={reservaForm.departamento_id} onChange={(e) => setReservaForm((p) => ({ ...p, departamento_id: e.target.value }))} required />
          <input type="date" value={reservaForm.fecha} onChange={(e) => setReservaForm((p) => ({ ...p, fecha: e.target.value }))} required />
          <select value={reservaForm.estado} onChange={(e) => setReservaForm((p) => ({ ...p, estado: e.target.value }))}>
            <option value="disponible">Disponible</option>
            <option value="en_proceso">En proceso</option>
            <option value="reservado">Reservado</option>
          </select>
          <input placeholder="Observaciones" value={reservaForm.observaciones} onChange={(e) => setReservaForm((p) => ({ ...p, observaciones: e.target.value }))} />
        </>
      )
    }

    if (activeTab === 'usuarios') {
      if (!canManageUsuarios) return null
      return (
        <>
          <input placeholder="Nombre" value={usuarioForm.nombre} onChange={(e) => setUsuarioForm((p) => ({ ...p, nombre: e.target.value }))} required />
          <input placeholder="Correo" type="email" value={usuarioForm.email} onChange={(e) => setUsuarioForm((p) => ({ ...p, email: e.target.value }))} required />
          <input placeholder={editingId ? 'Nuevo password (opcional)' : 'Password'} type="password" value={usuarioForm.password} onChange={(e) => setUsuarioForm((p) => ({ ...p, password: e.target.value }))} required={!editingId} />
          <select value={usuarioForm.role} onChange={(e) => setUsuarioForm((p) => ({ ...p, role: e.target.value }))}>
            <option value="admin_general">admin_general</option>
            <option value="admin_conjunto">admin_conjunto</option>
            <option value="condomino">condomino</option>
          </select>
        </>
      )
    }

    return null
  }

  const tabData = {
    torres: filteredItems.torres,
    departamentos: filteredItems.departamentos,
    personas: filteredItems.personas,
    reservas: filteredItems.reservas,
    usuarios: filteredItems.usuarios,
  }

  const currentData = tabData[activeTab] || []

  const hiddenTabs = user?.role === 'condomino' ? ['usuarios'] : []
  const tabs = [
    { key: 'torres', label: 'Torres' },
    { key: 'departamentos', label: 'Departamentos' },
    { key: 'personas', label: 'Personas' },
    { key: 'reservas', label: 'Reservas' },
    { key: 'usuarios', label: 'Usuarios' },
  ].filter((tab) => !hiddenTabs.includes(tab.key))

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CASALES SAN PEDRO</p>
          <h1>Hola, {user?.nombre}</h1>
          <p className="subtitle">Rol activo: {user?.role}</p>
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      {error ? <p className="error-box">{error}</p> : null}
      {message ? <p className="ok-box">{message}</p> : null}

      <section className="stats-grid">
        {cards.map((card) => (
          <article key={card.key} className="stat-card">
            <h2>{card.title}</h2>
            <p>{loading ? '...' : card.value}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="crud-head">
          <h3>Gestion de datos</h3>
          <input
            className="search-input"
            placeholder="Filtrar por cualquier campo..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="tabs-row">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={tab.key === activeTab ? 'tab-btn active' : 'tab-btn'}
              onClick={() => {
                setActiveTab(tab.key)
                setSearch('')
                resetForms()
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="crud-layout">
          <div className="table-wrap">
            {loading ? (
              <p>Cargando datos...</p>
            ) : currentData.length === 0 ? (
              <p>No hay registros para mostrar.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    {Object.keys(currentData[0]).slice(0, 6).map((key) => (
                      <th key={key}>{key}</th>
                    ))}
                    <th>acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((item) => (
                    <tr key={item.id}>
                      {Object.keys(item)
                        .slice(0, 6)
                        .map((key) => (
                          <td key={`${item.id}-${key}`}>{String(item[key] ?? '')}</td>
                        ))}
                      <td className="action-cell">
                        <button type="button" className="mini" onClick={() => startEdit(item)}>
                          Editar
                        </button>
                        {(activeTab !== 'usuarios' || canManageUsuarios) &&
                        (activeTab !== 'torres' || canManageTorres) &&
                        (activeTab !== 'departamentos' || canManageDepartamentos) ? (
                          <button type="button" className="mini danger" onClick={() => handleDelete(item.id)}>
                            Eliminar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {(activeTab === 'usuarios' && !canManageUsuarios) ||
          (activeTab === 'torres' && !canManageTorres) ||
          (activeTab === 'departamentos' && !canManageDepartamentos) ? null : (
            <form className="crud-form" onSubmit={handleSubmit}>
              <h4>{editingId ? 'Editar registro' : 'Nuevo registro'}</h4>
              {renderForm()}

              <div className="btn-row">
                <button type="submit">{editingId ? 'Actualizar' : 'Crear'}</button>
                {editingId ? (
                  <button type="button" className="ghost" onClick={resetForms}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

export default DashboardPage
