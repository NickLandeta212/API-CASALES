import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/useAuth'

function splitReservaObservaciones(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return { cleanedText: '', comprobantePath: '' }
  }

  const segments = raw.split('|').map((segment) => segment.trim()).filter(Boolean)
  const comprobanteSegment = segments.find((segment) => segment.toLowerCase().startsWith('comprobante:'))
  const comprobantePath = comprobanteSegment ? comprobanteSegment.slice('Comprobante:'.length).trim() : ''
  const cleanedText = segments.filter((segment) => !segment.toLowerCase().startsWith('comprobante:')).join(' | ')

  return { cleanedText, comprobantePath }
}

function buildApiAssetUrl(assetPath) {
  if (!assetPath) return ''
  if (/^https?:\/\//i.test(assetPath)) return assetPath

  const baseUrl = api.defaults.baseURL || window.location.origin
  return new URL(assetPath, `${baseUrl}/`).toString()
}

function parseDepartmentCode(value) {
  const match = String(value ?? '').match(/^T?(\d+)(D|PB|SS)(.+)$/i)

  if (match) {
    return {
      codigo_tipo: match[2].toUpperCase(),
      codigo_numero: match[3],
    }
  }

  return {
    codigo_tipo: 'D',
    codigo_numero: String(value ?? ''),
  }
}

function normalizeLegacySpecialDNumber(torreNumero, codigoTipo, codigoNumero) {
  const tower = Number(torreNumero)
  if (tower < 1 || tower > 4 || codigoTipo !== 'D') {
    return codigoNumero
  }

  if (!/^[0-9]{1,2}$/.test(codigoNumero)) {
    return codigoNumero
  }

  const raw = Number(codigoNumero)
  if (raw < 1 || raw > 56) {
    return codigoNumero
  }

  const floor = Math.floor((raw - 1) / 8) + 1
  const unit = ((raw - 1) % 8) + 1
  return `${floor}${String(unit).padStart(2, '0')}`
}

function getSpecialDepartmentNumbers() {
  const options = []

  for (let floor = 1; floor <= 7; floor += 1) {
    for (let unit = 1; unit <= 8; unit += 1) {
      options.push(`${floor}${String(unit).padStart(2, '0')}`)
    }
  }

  return options
}

const configMap = {
  torres: {
    title: 'Torres',
    endpoint: '/torres',
    allowedRoles: ['admin_general', 'admin_conjunto'],
    writeRoles: [],
    getEmptyForm: () => ({ numero: '', total_departamentos: '' }),
    columns: [
      { key: 'numero', label: 'Numero' },
      { key: 'total_departamentos', label: 'Departamentos' },
    ],
    fields: [
      { name: 'numero', label: 'Numero', type: 'number' },
      { name: 'total_departamentos', label: 'Total departamentos', type: 'number' },
    ],
    buildPayload: (form) => ({ numero: Number(form.numero), total_departamentos: Number(form.total_departamentos) }),
  },
  departamentos: {
    title: 'Departamentos',
    endpoint: '/departamentos',
    allowedRoles: ['admin_general', 'admin_conjunto', 'condomino'],
    writeRoles: ['admin_general'],
    dependencies: ['torres'],
    getEmptyForm: () => ({ torre_id: '', codigo_tipo: 'D', codigo_numero: '' }),
    columns: [
      { key: 'torre_numero', label: 'Torre' },
      { key: 'codigo_tipo', label: 'Tipo codigo' },
      { key: 'numero', label: 'Numero de departamento' },
    ],
    fields: [
      { name: 'torre_id', label: 'Torre', type: 'select', optionsKey: 'torres', optionLabel: (item) => `Torre ${item.numero}`, optionValue: 'id' },
      { name: 'codigo_tipo', label: 'Tipo de codigo', type: 'select', options: [
        { value: 'D', label: 'D' },
        { value: 'PB', label: 'PB' },
        { value: 'SS', label: 'SS' },
      ] },
      { name: 'codigo_numero', label: 'Numero de departamento', type: 'text' },
    ],
    buildPayload: (form) => ({
      torre_id: Number(form.torre_id),
      codigo_tipo: form.codigo_tipo,
      codigo_numero: form.codigo_numero.trim(),
    }),
  },
  personas: {
    title: 'Personas',
    endpoint: '/personas',
    allowedRoles: ['admin_general', 'admin_conjunto', 'condomino'],
    writeRoles: ['admin_general', 'admin_conjunto', 'condomino'],
    dependencies: ['torres', 'departamentos'],
    getEmptyForm: () => ({ torre_id: '', departamento_id: '', nombres: '', apellidos: '', documento: '', telefono: '', tipo_ocupacion: 'dueno' }),
    columns: [
      { key: 'torre_numero', label: 'Torre' },
      { key: 'departamento_numero', label: 'Depto' },
      { key: 'nombres', label: 'Nombres' },
      { key: 'apellidos', label: 'Apellidos' },
      { key: 'documento', label: 'Documento' },
      { key: 'tipo_ocupacion', label: 'Tipo' },
    ],
    fields: [
      { name: 'torre_id', label: 'Torre', type: 'select', optionsKey: 'torres', optionLabel: (item) => `Torre ${item.numero}`, optionValue: 'id' },
      { name: 'departamento_id', label: 'Departamento', type: 'select', optionsKey: 'departamentos', optionLabel: (item) => `Torre ${item.torre_numero} - Dpto ${item.numero}`, optionValue: 'id' },
      { name: 'nombres', label: 'Nombres', type: 'text' },
      { name: 'apellidos', label: 'Apellidos', type: 'text' },
      { name: 'documento', label: 'Documento', type: 'text' },
      { name: 'telefono', label: 'Telefono', type: 'text', optional: true },
      { name: 'tipo_ocupacion', label: 'Tipo', type: 'select', options: [
        { value: 'dueno', label: 'Dueno' },
        { value: 'arrendatario', label: 'Arrendatario' },
      ] },
    ],
    buildPayload: (form) => ({
      departamento_id: Number(form.departamento_id),
      nombres: form.nombres,
      apellidos: form.apellidos,
      documento: form.documento,
      telefono: form.telefono,
      tipo_ocupacion: form.tipo_ocupacion,
    }),
  },
  reservas: {
    title: 'Reservas',
    endpoint: '/reservas',
    allowedRoles: ['admin_general', 'admin_conjunto', 'condomino'],
    writeRoles: ['admin_general', 'admin_conjunto', 'condomino'],
    dependencies: ['departamentos'],
    getEmptyForm: () => ({ departamento_id: '', fecha: '', estado: 'disponible', observaciones: '' }),
    columns: [
      { key: 'fecha', label: 'Fecha' },
      { key: 'torre_numero', label: 'Torre' },
      { key: 'departamento_numero', label: 'Depto' },
      { key: 'estado', label: 'Estado' },
      { key: 'observaciones', label: 'Obs' },
      { key: 'comprobante', label: 'Comprobante' },
    ],
    fields: [
      { name: 'departamento_id', label: 'Departamento', type: 'select', optionsKey: 'departamentos', optionLabel: (item) => `Torre ${item.torre_numero} - Dpto ${item.numero}`, optionValue: 'id' },
      { name: 'fecha', label: 'Fecha', type: 'date' },
      { name: 'estado', label: 'Estado', type: 'select', options: [
        { value: 'disponible', label: 'Disponible' },
        { value: 'en_proceso', label: 'En proceso' },
        { value: 'reservado', label: 'Reservado' },
      ] },
      { name: 'observaciones', label: 'Observaciones', type: 'text', optional: true },
    ],
    buildPayload: (form) => ({
      departamento_id: Number(form.departamento_id),
      fecha: form.fecha,
      estado: form.estado,
      observaciones: form.observaciones,
    }),
  },
  usuarios: {
    title: 'Usuarios',
    endpoint: '/usuarios',
    allowedRoles: ['admin_general'],
    writeRoles: ['admin_general'],
    getEmptyForm: () => ({ nombre: '', email: '', password: '', role: 'condomino' }),
    columns: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'email', label: 'Usuario / apodo' },
      { key: 'role', label: 'Rol' },
    ],
    fields: [
      { name: 'nombre', label: 'Nombre', type: 'text' },
      { name: 'email', label: 'Usuario / apodo', type: 'text' },
      { name: 'password', label: 'Password', type: 'password', optionalOnEdit: true },
      { name: 'role', label: 'Rol', type: 'select', options: [
        { value: 'admin_general', label: 'admin_general' },
        { value: 'admin_conjunto', label: 'admin_conjunto' },
        { value: 'condomino', label: 'condomino' },
      ] },
    ],
    buildPayload: (form, isEdit) => ({
      nombre: form.nombre,
      email: form.email,
      role: form.role,
      ...(isEdit && !form.password ? {} : { password: form.password }),
    }),
  },
}

function ResourcePage({ resource }) {
  const { user } = useAuth()
  const config = configMap[resource]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [deptTowerSearch, setDeptTowerSearch] = useState('')
  const [deptNumberSearch, setDeptNumberSearch] = useState('')
  const [personaTowerSearch, setPersonaTowerSearch] = useState('')
  const [personaDepartmentSearch, setPersonaDepartmentSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(config.getEmptyForm())
  const [deps, setDeps] = useState({ torres: [], departamentos: [], usuarios: [] })
  const [reservaQrLink, setReservaQrLink] = useState('')
  const [reservaQrImage, setReservaQrImage] = useState('')
  const [reservaQrLoading, setReservaQrLoading] = useState(false)
  const [reservaQrMessage, setReservaQrMessage] = useState('')
  const [reservaQrError, setReservaQrError] = useState('')
  const [proofModalOpen, setProofModalOpen] = useState(false)
  const [proofModalUrl, setProofModalUrl] = useState('')
  const [proofZoom, setProofZoom] = useState(1)

  const canAccess = config.allowedRoles.includes(user?.role)
  const isDepartamentosReadOnly = resource === 'departamentos'
  const canManageRecords = !isDepartamentosReadOnly && (config.writeRoles || config.allowedRoles).includes(user?.role)
  const canInspectDepartment = resource === 'departamentos'
  const showActionsColumn = canManageRecords || canInspectDepartment
  const canManageReservaQr = resource === 'reservas' && ['admin_general', 'admin_conjunto'].includes(user?.role)

  useEffect(() => {
    if (!canAccess) return

    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      setMessage('')

      try {
        const requests = [api.get(config.endpoint)]
        const depKeys = config.dependencies || []

        if (depKeys.includes('torres')) requests.push(api.get('/torres'))
        if (depKeys.includes('departamentos')) requests.push(api.get('/departamentos'))
        if (depKeys.includes('usuarios')) requests.push(api.get('/usuarios'))

        const responses = await Promise.all(requests)
        if (!mounted) return

        setItems(responses[0].data)

        const nextDeps = { torres: [], departamentos: [], usuarios: [] }
        let index = 1
        if (depKeys.includes('torres')) nextDeps.torres = responses[index++].data
        if (depKeys.includes('departamentos')) nextDeps.departamentos = responses[index++].data
        if (depKeys.includes('usuarios')) nextDeps.usuarios = responses[index++].data

        setDeps(nextDeps)
      } catch (requestError) {
        if (!mounted) return
        setError(requestError?.response?.data?.message || 'No se pudo cargar el modulo')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [canAccess, config.dependencies, config.endpoint, resource, user?.role])

  useEffect(() => {
    if (!canManageReservaQr) return
    if (reservaQrLink) return

    handleGenerateReservaQr()
  }, [canManageReservaQr, reservaQrLink])

  const normalizedDepartmentItems = useMemo(() => {
    if (resource !== 'departamentos') return []

    const withDerived = items.map((item) => {
      const parsed = parseDepartmentCode(item.numero)
      const normalizedNumber = normalizeLegacySpecialDNumber(item.torre_numero ?? item.torre_id, parsed.codigo_tipo, parsed.codigo_numero)

      return {
        ...item,
        _codigoTipo: parsed.codigo_tipo,
        _codigoNumero: normalizedNumber,
      }
    })

    // Hide visual duplicates caused by legacy codes that map to the same requested numbering.
    const unique = []
    const seen = new Set()
    for (const item of withDerived) {
      const key = `${item.torre_numero}|${item._codigoTipo}|${item._codigoNumero}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(item)
    }

    return unique
  }, [items, resource])

  const filteredItems = useMemo(() => {
    const sourceItems = resource === 'departamentos' ? normalizedDepartmentItems : items
    const q = query.trim().toLowerCase()
    const towerQuery = resource === 'departamentos' ? deptTowerSearch.trim().toLowerCase() : ''
    const numberQuery = resource === 'departamentos' ? deptNumberSearch.trim().toLowerCase() : ''
    const personaTowerQuery = resource === 'personas' ? personaTowerSearch.trim().toLowerCase() : ''
    const personaDepartmentQuery = resource === 'personas' ? personaDepartmentSearch.trim().toLowerCase() : ''

    return sourceItems.filter((item) => {
      const matchesQuery = q ? JSON.stringify(item).toLowerCase().includes(q) : true
      const towerText = `torre ${item.torre_numero ?? item.torre_id}`.toLowerCase()
      const parsed = resource === 'departamentos'
        ? { codigo_tipo: item._codigoTipo, codigo_numero: item._codigoNumero }
        : parseDepartmentCode(item.numero)
      const normalizedNumber = normalizeLegacySpecialDNumber(item.torre_numero ?? item.torre_id, parsed.codigo_tipo, parsed.codigo_numero)
      const departmentText = String(normalizedNumber).toLowerCase()
      const matchesTower = towerQuery ? towerText.includes(towerQuery) : true
      const matchesNumber = numberQuery ? departmentText.includes(numberQuery) : true
      const personaDepartmentText = String(item.departamento_numero ?? '').toLowerCase()
      const matchesPersonaTower = personaTowerQuery ? towerText.includes(personaTowerQuery) : true
      const matchesPersonaDepartment = personaDepartmentQuery ? personaDepartmentText.includes(personaDepartmentQuery) : true

      if (resource === 'personas') {
        return matchesQuery && matchesPersonaTower && matchesPersonaDepartment
      }

      return matchesQuery && matchesTower && matchesNumber
    })
  }, [
    deptNumberSearch,
    deptTowerSearch,
    items,
    normalizedDepartmentItems,
    personaDepartmentSearch,
    personaTowerSearch,
    query,
    resource,
  ])

  const departamentoTowerOptions = useMemo(() => {
    if (resource !== 'departamentos') return []

    return deps.torres
      .map((torre) => ({
        value: `Torre ${torre.numero}`,
        label: `Torre ${torre.numero}`,
      }))
      .filter((option, index, array) => array.findIndex((current) => current.value === option.value) === index)
  }, [deps.torres, resource])

  const departamentoNumberOptions = useMemo(() => {
    if (resource !== 'departamentos') return []

    return normalizedDepartmentItems
      .filter((item) => {
        if (!deptTowerSearch.trim()) return true
        return `torre ${item.torre_numero ?? item.torre_id}`.toLowerCase().includes(deptTowerSearch.trim().toLowerCase())
      })
      .map((item) => ({
        value: String(item._codigoNumero),
        label: `Dpto ${item._codigoNumero}`,
      }))
      .filter((option, index, array) => array.findIndex((current) => current.value === option.value) === index)
  }, [deptTowerSearch, normalizedDepartmentItems, resource])

  const personaTowerOptions = useMemo(() => {
    if (resource !== 'personas') return []

    return items
      .map((item) => ({
        value: `Torre ${item.torre_numero}`,
        label: `Torre ${item.torre_numero}`,
      }))
      .filter((option, index, array) => array.findIndex((current) => current.value === option.value) === index)
  }, [items, resource])

  const personaDepartmentOptions = useMemo(() => {
    if (resource !== 'personas') return []

    return items
      .filter((item) => {
        if (!personaTowerSearch.trim()) return true
        return `torre ${item.torre_numero}`.toLowerCase().includes(personaTowerSearch.trim().toLowerCase())
      })
      .map((item) => ({
        value: String(item.departamento_numero ?? ''),
        label: `Dpto ${item.departamento_numero}`,
      }))
      .filter((option) => option.value)
      .filter((option, index, array) => array.findIndex((current) => current.value === option.value) === index)
  }, [items, personaTowerSearch, resource])

  const specialDepartmentNumbers = useMemo(() => {
    if (resource !== 'departamentos') return []

    const tower = deps.torres.find((item) => String(item.id) === String(form.torre_id))
    if (!tower || Number(tower.numero) < 1 || Number(tower.numero) > 4 || form.codigo_tipo !== 'D') {
      return []
    }

    return getSpecialDepartmentNumbers()
  }, [deps.torres, form.codigo_tipo, form.torre_id, resource])

  useEffect(() => {
    if (resource !== 'departamentos') return
    if (specialDepartmentNumbers.length === 0) return

    const exists = specialDepartmentNumbers.includes(form.codigo_numero)
    if (!exists && form.codigo_numero) {
      setForm((prev) => ({ ...prev, codigo_numero: '' }))
    }
  }, [form.codigo_numero, resource, specialDepartmentNumbers])

  function getDepartamentoCellValue(item, columnKey) {
    if (resource === 'departamentos' && columnKey === 'codigo_tipo') {
      return item._codigoTipo || parseDepartmentCode(item.numero).codigo_tipo
    }

    if (resource === 'departamentos' && columnKey === 'numero') {
      return item._codigoNumero || normalizeLegacySpecialDNumber(item.torre_numero ?? item.torre_id, parseDepartmentCode(item.numero).codigo_tipo, parseDepartmentCode(item.numero).codigo_numero)
    }

    if (resource === 'reservas' && columnKey === 'observaciones') {
      const { cleanedText } = splitReservaObservaciones(item.observaciones)
      return cleanedText || '-'
    }

    if (resource === 'reservas' && columnKey === 'comprobante') {
      const { comprobantePath } = splitReservaObservaciones(item.observaciones)

      if (!comprobantePath) {
        return <span className="muted-note">Sin comprobante</span>
      }

      const imageUrl = buildApiAssetUrl(comprobantePath)

      return (
        <div className="proof-actions">
          <button
            type="button"
            className="mini ghost"
            onClick={() => {
              setProofModalUrl(imageUrl)
              setProofModalOpen(true)
              setProofZoom(1)
            }}
          >
            Ver preview
          </button>
          <a href={imageUrl} target="_blank" rel="noreferrer" className="link-btn">
            Abrir
          </a>
        </div>
      )
    }

    return String(item[columnKey] ?? '')
  }

  async function handleGenerateReservaQr() {
    setReservaQrMessage('')
    setReservaQrError('')
    setReservaQrLoading(true)

    try {
      const { data } = await api.get('/reservas/public-token')
      const url = `${window.location.origin}/reservas-publicas/${data.token}`
      setReservaQrLink(url)
      setReservaQrImage(`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`)
      setReservaQrMessage('QR general permanente listo. Este codigo se mantiene igual para escanear siempre.')
    } catch (requestError) {
      setReservaQrError(requestError?.response?.data?.message || 'No se pudo generar el QR general de reservas')
    } finally {
      setReservaQrLoading(false)
    }
  }

  async function handleCopyReservaQrLink() {
    try {
      await navigator.clipboard.writeText(reservaQrLink)
      setReservaQrMessage('Enlace QR copiado al portapapeles')
      setReservaQrError('')
    } catch {
      setReservaQrError('No se pudo copiar automaticamente. Copialo manualmente.')
    }
  }

  const departmentCodePreview = useMemo(() => {
    if (resource !== 'departamentos') return ''
    const tower = deps.torres.find((item) => String(item.id) === String(form.torre_id))
    if (!tower || !form.codigo_tipo || !form.codigo_numero.trim()) return ''
    return `T${tower.numero}${form.codigo_tipo}${form.codigo_numero.trim()}`
  }, [deps.torres, form.codigo_numero, form.codigo_tipo, form.torre_id, resource])

  const selectedPersonaTowerNumber = useMemo(() => {
    if (resource !== 'personas') return null
    const selected = deps.torres.find((tower) => String(tower.id) === String(form.torre_id))
    return selected ? Number(selected.numero) : null
  }, [deps.torres, form.torre_id, resource])

  const filteredPersonaDepartments = useMemo(() => {
    if (resource !== 'personas') return []
    if (selectedPersonaTowerNumber === null) return []

    return deps.departamentos.filter((option) => Number(option.torre_numero) === selectedPersonaTowerNumber)
  }, [deps.departamentos, resource, selectedPersonaTowerNumber])

  const showRunningNumber = resource === 'personas'
  const persistedNumbers = showRunningNumber
    ? items
      .map((item) => Number(item.numero_consecutivo ?? item.id))
      .filter((value) => Number.isFinite(value) && value > 0)
    : []
  const totalAddedCount = persistedNumbers.length
  const lastAddedNumber = totalAddedCount > 0 ? Math.max(...persistedNumbers) : 0
  const nextAddedNumber = lastAddedNumber + 1

  function resetForm() {
    setEditingId(null)
    setForm(config.getEmptyForm())
    if (resource === 'departamentos') {
      setDeptTowerSearch('')
      setDeptNumberSearch('')
    }
    if (resource === 'personas') {
      setPersonaTowerSearch('')
      setPersonaDepartmentSearch('')
    }
  }

  function startEdit(item) {
    setEditingId(item.id)

    switch (resource) {
      case 'torres':
        setForm({ numero: String(item.numero ?? ''), total_departamentos: String(item.total_departamentos ?? '') })
        break
      case 'departamentos': {
        const parsedCode = parseDepartmentCode(item.numero)
        const towerMatch = deps.torres.find((torre) => String(torre.numero) === String(item.torre_numero ?? ''))
        const towerId = towerMatch?.id || String(item.torre_id ?? '')
        const normalizedNumber = normalizeLegacySpecialDNumber(item.torre_numero ?? item.torre_id, parsedCode.codigo_tipo, parsedCode.codigo_numero)

        setForm({
          torre_id: String(towerId),
          codigo_tipo: parsedCode.codigo_tipo,
          codigo_numero: normalizedNumber,
        })
        break
      }
      case 'personas':
        {
          const selectedDepartment = deps.departamentos.find((department) => String(department.id) === String(item.departamento_id ?? ''))
          const selectedTower = deps.torres.find((tower) => Number(tower.numero) === Number(item.torre_numero ?? selectedDepartment?.torre_numero))
        setForm({
          torre_id: selectedTower ? String(selectedTower.id) : '',
          departamento_id: String(item.departamento_id ?? ''),
          nombres: item.nombres ?? '',
          apellidos: item.apellidos ?? '',
          documento: item.documento ?? '',
          telefono: item.telefono ?? '',
          tipo_ocupacion: item.tipo_ocupacion ?? 'dueno',
        })
        break
        }
      case 'reservas':
        setForm({
          departamento_id: String(item.departamento_id ?? ''),
          fecha: item.fecha ?? '',
          estado: item.estado ?? 'disponible',
          observaciones: item.observaciones ?? '',
        })
        break
      case 'usuarios':
        setForm({
          nombre: item.nombre ?? '',
          email: item.email ?? '',
          password: '',
          role: item.role ?? 'condomino',
        })
        break
      default:
        break
    }

    setError('')
    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      if (resource === 'personas') {
        if (!form.torre_id) {
          setError('Debes seleccionar una torre antes de elegir el departamento')
          return
        }

        const selectedDepartment = deps.departamentos.find((department) => String(department.id) === String(form.departamento_id))
        if (!selectedDepartment || Number(selectedDepartment.torre_numero) !== selectedPersonaTowerNumber) {
          setError('El departamento seleccionado no pertenece a la torre elegida')
          return
        }
      }

      const payload = config.buildPayload(form, Boolean(editingId))

      if (editingId) {
        await api.put(`${config.endpoint}/${editingId}`, payload)
        setMessage(`${config.title} actualizado`)
      } else {
        await api.post(config.endpoint, payload)
        setMessage(`${config.title} creado`)
      }

      resetForm()
      const { data } = await api.get(config.endpoint)
      setItems(data)
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar')
    }
  }

  async function handleDelete(id) {
    setError('')
    setMessage('')

    try {
      await api.delete(`${config.endpoint}/${id}`)
      setMessage(`${config.title} eliminado`)
      const { data } = await api.get(config.endpoint)
      setItems(data)
      if (editingId === id) resetForm()
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo eliminar')
    }
  }

  function renderField(field) {
    const value = form[field.name] ?? ''

    if (resource === 'departamentos' && field.name === 'codigo_numero' && specialDepartmentNumbers.length > 0) {
      return (
        <select key={field.name} value={value} onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))}>
          <option value="">Selecciona una opcion</option>
          {specialDepartmentNumbers.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    }

    if (field.type === 'select') {
      let options = field.optionsKey ? deps[field.optionsKey] || [] : field.options || []

      if (resource === 'personas' && field.name === 'departamento_id') {
        options = filteredPersonaDepartments
      }

      const isDisabled = resource === 'personas' && field.name === 'departamento_id' && !form.torre_id

      return (
        <select
          key={field.name}
          value={value}
          disabled={isDisabled}
          onChange={(event) => {
            const nextValue = event.target.value
            if (resource === 'personas' && field.name === 'torre_id') {
              setForm((prev) => ({ ...prev, torre_id: nextValue, departamento_id: '' }))
              return
            }
            setForm((prev) => ({ ...prev, [field.name]: nextValue }))
          }}
        >
          <option value="">Selecciona una opcion</option>
          {options.map((option) => (
            <option key={option.id || option.value} value={field.optionValue ? option[field.optionValue] : option.value}>
              {field.optionLabel ? field.optionLabel(option) : option.label}
            </option>
          ))}
        </select>
      )
    }

    return (
      <input
        key={field.name}
        type={field.type}
        value={value}
        placeholder={field.label}
        onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))}
        required={!field.optional && !(editingId && field.optionalOnEdit)}
      />
    )
  }

  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Modulo</p>
          <h2>{config.title}</h2>
          <p className="subtitle">{resource === 'departamentos' ? 'Consulta registros con filtros.' : 'Gestiona registros con filtros, formularios y acciones por rol.'}</p>
        </div>
      </header>

      {error ? <p className="error-box">{error}</p> : null}
      {message ? <p className="ok-box">{message}</p> : null}

      {canManageReservaQr ? (
        <section className="panel" style={{ marginTop: 0 }}>
          <div className="crud-head">
            <div>
              <h3 style={{ marginBottom: 8 }}>QR general permanente para reservas</h3>
              <p className="muted-note" style={{ margin: 0 }}>Usa este mismo QR siempre. El residente escanea y selecciona torre/departamento en el formulario.</p>
            </div>
            <button type="button" onClick={handleGenerateReservaQr} disabled={reservaQrLoading}>
              {reservaQrLoading ? 'Cargando...' : 'Refrescar vista QR'}
            </button>
          </div>

          {reservaQrError ? <p className="error-box">{reservaQrError}</p> : null}
          {reservaQrMessage ? <p className="ok-box">{reservaQrMessage}</p> : null}

          {reservaQrLink ? (
            <div className="qr-wrap">
              <input type="text" readOnly value={reservaQrLink} />
              <div className="btn-row">
                <button type="button" className="ghost" onClick={handleCopyReservaQrLink}>
                  Copiar enlace
                </button>
                <a className="ghost link-btn" href={reservaQrLink} target="_blank" rel="noreferrer">
                  Abrir formulario
                </a>
              </div>
              {reservaQrImage ? <img className="qr-image" src={reservaQrImage} alt="QR general de reservas" /> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="crud-head">
          <input
            className="search-input"
            placeholder="Buscar en este modulo..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="ghost" onClick={resetForm}>
            {canManageRecords ? 'Limpiar formulario' : 'Limpiar filtros'}
          </button>
        </div>

        {resource === 'departamentos' ? (
          <div className="tabs-row" style={{ marginTop: 12 }}>
            <div className="filter-autocomplete">
              <input
                list="tower-autocomplete"
                placeholder="Buscar torre..."
                value={deptTowerSearch}
                onChange={(event) => {
                  setDeptTowerSearch(event.target.value)
                  setDeptNumberSearch('')
                }}
              />
              <datalist id="tower-autocomplete">
                {departamentoTowerOptions.map((option) => (
                  <option key={option.value} value={option.value} />
                ))}
              </datalist>
            </div>

            <div className="filter-autocomplete">
              <input
                list="department-autocomplete"
                placeholder="Buscar departamento..."
                value={deptNumberSearch}
                onChange={(event) => setDeptNumberSearch(event.target.value)}
                disabled={!deptTowerSearch.trim()}
              />
              <datalist id="department-autocomplete">
                {departamentoNumberOptions.map((option) => (
                  <option key={option.value} value={option.value} />
                ))}
              </datalist>
            </div>

            <button
              type="button"
              className="ghost"
              onClick={() => {
                setDeptTowerSearch('')
                setDeptNumberSearch('')
              }}
            >
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {resource === 'personas' ? (
          <div className="tabs-row" style={{ marginTop: 12 }}>
            <div className="filter-autocomplete">
              <input
                list="persona-tower-autocomplete"
                placeholder="Buscar torre..."
                value={personaTowerSearch}
                onChange={(event) => {
                  setPersonaTowerSearch(event.target.value)
                  setPersonaDepartmentSearch('')
                }}
              />
              <datalist id="persona-tower-autocomplete">
                {personaTowerOptions.map((option) => (
                  <option key={option.value} value={option.value} />
                ))}
              </datalist>
            </div>

            <div className="filter-autocomplete">
              <input
                list="persona-department-autocomplete"
                placeholder="Buscar departamento..."
                value={personaDepartmentSearch}
                onChange={(event) => setPersonaDepartmentSearch(event.target.value)}
                disabled={!personaTowerSearch.trim()}
              />
              <datalist id="persona-department-autocomplete">
                {personaDepartmentOptions.map((option) => (
                  <option key={option.value} value={option.value} />
                ))}
              </datalist>
            </div>

            <button
              type="button"
              className="ghost"
              onClick={() => {
                setPersonaTowerSearch('')
                setPersonaDepartmentSearch('')
              }}
            >
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {showRunningNumber ? (
          <p className="muted-note" style={{ marginTop: 12 }}>
            Total agregados: {totalAddedCount} | Siguiente numero: {nextAddedNumber}
          </p>
        ) : null}

        <div className="crud-layout">
          <div className="table-wrap">
            {loading ? (
              <p style={{ padding: 16 }}>Cargando...</p>
            ) : filteredItems.length === 0 ? (
              <p style={{ padding: 16 }}>No hay registros para mostrar.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    {showRunningNumber ? <th>N#</th> : null}
                    {config.columns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    {showActionsColumn ? <th>Acciones</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => (
                    <tr key={item.id}>
                      {showRunningNumber ? <td>{item.numero_consecutivo ?? item.id ?? index + 1}</td> : null}
                      {config.columns.map((column) => (
                        <td key={`${item.id}-${column.key}`}>{getDepartamentoCellValue(item, column.key)}</td>
                      ))}
                      {showActionsColumn ? (
                        <td className="action-cell">
                          {canInspectDepartment ? (
                            <Link to={`/departamentos/${item.id}`} className="mini link-mini">
                              Inspeccionar
                            </Link>
                          ) : null}
                          {canManageRecords ? (
                            <>
                              <button type="button" className="mini" onClick={() => startEdit(item)}>
                                Editar
                              </button>
                              <button type="button" className="mini danger" onClick={() => handleDelete(item.id)}>
                                Eliminar
                              </button>
                            </>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {canManageRecords ? (
            <form className="crud-form" onSubmit={handleSubmit}>
              <h3>{editingId ? 'Editar registro' : 'Nuevo registro'}</h3>
              {showRunningNumber ? (
                <p className="muted-note">Numero consecutivo actual: {editingId ? 'Edicion de registro existente' : nextAddedNumber}</p>
              ) : null}
              {config.fields.map((field) => renderField(field))}
              {resource === 'departamentos' && specialDepartmentNumbers.length > 0 ? (
                <p className="muted-note">Formato sugerido: 101-108, 201-208, 301-308, 401-408, 501-508, 601-608, 701-708</p>
              ) : null}
              {resource === 'departamentos' && departmentCodePreview ? (
                <p className="muted-note">Codigo generado: {departmentCodePreview}</p>
              ) : null}

              <div className="btn-row">
                <button type="submit">{editingId ? 'Actualizar' : 'Crear'}</button>
                {editingId ? (
                  <button type="button" className="ghost" onClick={resetForm}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="crud-form">
              <h3>{resource === 'departamentos' ? 'Solo consulta' : 'Solo lectura'}</h3>
              <p>{resource === 'departamentos' ? 'Agregar y editar departamentos esta deshabilitado.' : 'No tienes permisos para modificar este modulo.'}</p>
            </div>
          )}
        </div>
      </section>

      {proofModalOpen ? (
        <div
          className="proof-modal-backdrop"
          role="button"
          tabIndex={0}
          onClick={() => setProofModalOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
              setProofModalOpen(false)
              setProofZoom(1)
            }
          }}
        >
          <div className="proof-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="crud-head" style={{ marginBottom: 10 }}>
              <h3>Comprobante de pago</h3>
              <div className="proof-zoom-controls">
                <button type="button" className="ghost" onClick={() => setProofZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))))}>
                  -
                </button>
                <button type="button" className="ghost" onClick={() => setProofZoom(1)}>
                  100%
                </button>
                <button type="button" className="ghost" onClick={() => setProofZoom((prev) => Math.min(3, Number((prev + 0.1).toFixed(2))))}>
                  +
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setProofModalOpen(false)
                    setProofZoom(1)
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <p className="muted-note" style={{ marginTop: 0 }}>
              Zoom: {Math.round(proofZoom * 100)}% (tambien puedes usar la rueda del mouse)
            </p>

            {proofModalUrl ? (
              <div
                className="proof-modal-image-wrap"
                onWheel={(event) => {
                  event.preventDefault()
                  const direction = event.deltaY > 0 ? -1 : 1
                  setProofZoom((prev) => {
                    const next = prev + direction * 0.1
                    return Math.max(0.5, Math.min(3, Number(next.toFixed(2))))
                  })
                }}
              >
                <img
                  className="proof-modal-image"
                  src={proofModalUrl}
                  alt="Comprobante de pago"
                  style={{ transform: `scale(${proofZoom})` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default ResourcePage
