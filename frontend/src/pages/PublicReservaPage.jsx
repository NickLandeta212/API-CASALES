import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../lib/api'

const weekdayLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

function formatDateValue(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizeMonthValue(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

function buildMonthCalendar(monthValue, today, reservedSet) {
  const [yearText, monthText] = monthValue.split('-')
  const year = Number(yearText)
  const month = Number(monthText) - 1
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7
  const monthLabel = firstDay.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  const cells = []

  for (let i = 0; i < leadingEmptyDays; i += 1) {
    cells.push({
      key: `empty-${i}`,
      isEmpty: true,
    })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    const value = formatDateValue(date)
    const isPast = value < today

    cells.push({
      key: value,
      value,
      day,
      disabled: isPast || reservedSet.has(value),
      isEmpty: false,
    })
  }

  return {
    monthLabel,
    cells,
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

function PublicReservaPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [torres, setTorres] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [reservedDates, setReservedDates] = useState([])
  const [step, setStep] = useState(1)
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState('')
  const [visibleMonth, setVisibleMonth] = useState('')
  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    documento: '',
    telefono: '',
    observaciones: '',
    torre_id: '',
    departamento_id: '',
    fecha: '',
  })

  useEffect(() => {
    let mounted = true

    async function loadContext() {
      setLoading(true)
      setError('')

      try {
        const { data } = await api.get(`/reservas/public/${token}/context`)
        if (!mounted) return
        setTorres(data.torres || [])
        setDepartamentos(data.departamentos || [])
        setReservedDates(data.reserved_dates || [])
      } catch (requestError) {
        if (!mounted) return
        setError(requestError?.response?.data?.message || 'No se pudo cargar la reserva publica')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadContext()

    return () => {
      mounted = false
    }
  }, [token])

  const today = useMemo(() => {
    const date = new Date()
    return formatDateValue(date)
  }, [])

  const reservedSet = useMemo(() => new Set(reservedDates), [reservedDates])
  const filteredDepartments = useMemo(() => {
    if (!form.torre_id) return []
    return departamentos.filter((item) => String(item.torre_id) === String(form.torre_id))
  }, [departamentos, form.torre_id])

  const selectedTower = useMemo(
    () => torres.find((item) => String(item.id) === String(form.torre_id)),
    [form.torre_id, torres],
  )

  const selectedDepartment = useMemo(
    () => departamentos.find((item) => String(item.id) === String(form.departamento_id)),
    [departamentos, form.departamento_id],
  )

  const calendar = useMemo(() => {
    const month = visibleMonth || normalizeMonthValue(new Date(`${today}T00:00:00`))
    return buildMonthCalendar(month, today, reservedSet)
  }, [today, reservedSet, visibleMonth])

  useEffect(() => {
    if (!visibleMonth) {
      setVisibleMonth(normalizeMonthValue(new Date(`${today}T00:00:00`)))
    }
  }, [today, visibleMonth])

  useEffect(() => {
    return () => {
      if (proofPreview) {
        URL.revokeObjectURL(proofPreview)
      }
    }
  }, [proofPreview])

  function handleDataSubmit(event) {
    event.preventDefault()
    setError('')

    if (!form.nombres.trim() || !form.apellidos.trim() || !form.documento.trim()) {
      setError('Completa nombres, apellidos y documento para continuar')
      return
    }

    if (!form.torre_id || !form.departamento_id) {
      setError('Selecciona tu torre y departamento para continuar')
      return
    }

    setStep(2)
  }

  function navigateMonth(direction) {
    const base = visibleMonth || normalizeMonthValue(new Date(`${today}T00:00:00`))
    const [yearText, monthText] = base.split('-')
    const date = new Date(Number(yearText), Number(monthText) - 1, 1)
    date.setMonth(date.getMonth() + direction)
    setVisibleMonth(normalizeMonthValue(date))
  }

  async function handleReservaSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!form.fecha) {
      setError('Selecciona una fecha para continuar')
      return
    }

    if (reservedSet.has(form.fecha)) {
      setError('La fecha seleccionada ya no esta disponible, elige otra')
      return
    }

    setSubmitting(true)

    try {
      let comprobanteBase64 = ''

      if (proofFile) {
        comprobanteBase64 = await fileToDataUrl(proofFile)
      }

      const payload = {
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        documento: form.documento.trim(),
        telefono: form.telefono.trim(),
        observaciones: form.observaciones.trim(),
        departamento_id: Number(form.departamento_id),
        fecha: form.fecha,
        comprobante_base64: comprobanteBase64,
      }

      const { data } = await api.post(`/reservas/public/${token}`, payload)
      setMessage(data?.message || 'Reserva solicitada correctamente')
      setStep(1)
      setForm((prev) => ({ ...prev, fecha: '', observaciones: '' }))
      setProofFile(null)
      setProofPreview('')

      const refresh = await api.get(`/reservas/public/${token}/context`)
      setReservedDates(refresh.data.reserved_dates || [])
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo registrar la reserva')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="public-shell">
      <section className="public-card">
        <header className="public-header">
          <p className="eyebrow">Reserva por QR</p>
          <h1>Selecciona tu fecha de reserva</h1>
          <p className="subtitle">
            {loading
              ? 'Cargando formulario de reservas...'
              : selectedTower && selectedDepartment
                ? `Seleccion actual: Torre ${selectedTower.numero} · Dpto ${selectedDepartment.numero}`
                : 'QR general: selecciona tu torre y departamento dentro del formulario.'}
          </p>
        </header>

        {error ? <p className="error-box">{error}</p> : null}
        {message ? <p className="ok-box">{message}</p> : null}

        {loading ? <p>Cargando...</p> : null}

        {!loading ? (
          <>
            {step === 1 ? (
              <form className="public-form" onSubmit={handleDataSubmit}>
                <h3>Paso 1: tus datos</h3>
                <label>
                  Nombres
                  <input
                    type="text"
                    value={form.nombres}
                    onChange={(event) => setForm((prev) => ({ ...prev, nombres: event.target.value }))}
                    required
                  />
                </label>

                <label>
                  Apellidos
                  <input
                    type="text"
                    value={form.apellidos}
                    onChange={(event) => setForm((prev) => ({ ...prev, apellidos: event.target.value }))}
                    required
                  />
                </label>

                <label>
                  Documento
                  <input
                    type="text"
                    value={form.documento}
                    onChange={(event) => setForm((prev) => ({ ...prev, documento: event.target.value }))}
                    required
                  />
                </label>

                <label>
                  Telefono (opcional)
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={(event) => setForm((prev) => ({ ...prev, telefono: event.target.value }))}
                  />
                </label>

                <label>
                  Torre
                  <select
                    value={form.torre_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, torre_id: event.target.value, departamento_id: '' }))}
                    required
                  >
                    <option value="">Selecciona tu torre</option>
                    {torres.map((torre) => (
                      <option key={torre.id} value={torre.id}>
                        Torre {torre.numero}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Departamento
                  <select
                    value={form.departamento_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, departamento_id: event.target.value }))}
                    disabled={!form.torre_id}
                    required
                  >
                    <option value="">Selecciona tu departamento</option>
                    {filteredDepartments.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        Torre {dep.torre_numero} · Dpto {dep.numero}
                      </option>
                    ))}
                  </select>
                </label>

                <button type="submit">Continuar al calendario</button>
              </form>
            ) : (
              <form className="public-form" onSubmit={handleReservaSubmit}>
                <h3>Paso 2: seleccion de fecha</h3>
                <div>
                  <p className="muted-note" style={{ marginTop: 0 }}>
                    Calendario mensual: las fechas ocupadas o pasadas aparecen bloqueadas.
                  </p>
                  <div className="calendar-nav">
                    <button type="button" className="ghost" onClick={() => navigateMonth(-1)}>
                      Mes anterior
                    </button>
                    <p className="calendar-title">{calendar.monthLabel}</p>
                    <button type="button" className="ghost" onClick={() => navigateMonth(1)}>
                      Mes siguiente
                    </button>
                  </div>

                  <div className="weekday-row" aria-hidden="true">
                    {weekdayLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>

                  <div className="calendar-grid" role="listbox" aria-label="Seleccion de fecha">
                    {calendar.cells.map((cell) => {
                      if (cell.isEmpty) {
                        return <div key={cell.key} className="date-empty" />
                      }

                      return (
                        <button
                          key={cell.value}
                          type="button"
                          className={`date-chip${form.fecha === cell.value ? ' selected' : ''}`}
                          disabled={cell.disabled}
                          onClick={() => setForm((prev) => ({ ...prev, fecha: cell.value }))}
                        >
                          <span>{cell.day}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label>
                  Fecha seleccionada
                  <input type="text" value={form.fecha || 'Sin seleccionar'} readOnly />
                </label>

                <label>
                  Observaciones (opcional)
                  <input
                    type="text"
                    value={form.observaciones}
                    onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))}
                  />
                </label>

                <div className="proof-section">
                  <p className="proof-title">Enviar el comprobante de pago</p>
                  <label>
                    Foto del comprobante (opcional)
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null
                        setProofFile(file)

                        if (!file) {
                          setProofPreview('')
                          return
                        }

                        if (proofPreview) {
                          URL.revokeObjectURL(proofPreview)
                        }

                        const objectUrl = URL.createObjectURL(file)
                        setProofPreview(objectUrl)
                      }}
                    />
                  </label>

                  {proofPreview ? <img className="proof-preview" src={proofPreview} alt="Vista previa del comprobante" /> : null}
                </div>

                <div className="btn-row">
                  <button type="submit" disabled={submitting}>
                    {submitting ? 'Enviando...' : 'Solicitar reserva'}
                  </button>
                  <button type="button" className="ghost" onClick={() => setStep(1)} disabled={submitting}>
                    Volver a datos
                  </button>
                </div>

                <p className="muted-note" style={{ marginTop: 0 }}>
                  Fechas no disponibles: {reservedDates.length === 0 ? 'ninguna por ahora' : reservedDates.slice(0, 10).join(', ')}
                </p>
              </form>
            )}
          </>
        ) : null}
      </section>
    </main>
  )
}

export default PublicReservaPage
