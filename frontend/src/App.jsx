import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/useAuth'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import OverviewPage from './pages/OverviewPage.jsx'
import ResourcePage from './pages/ResourcePage.jsx'
import DepartamentoDetallePage from './pages/DepartamentoDetallePage.jsx'
import PublicReservaPage from './pages/PublicReservaPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="app-loading">Cargando sesion...</div>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/reservas-publicas/:token" element={<PublicReservaPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="torres" element={<ResourcePage resource="torres" />} />
        <Route path="departamentos" element={<ResourcePage resource="departamentos" />} />
        <Route path="departamentos/:id" element={<DepartamentoDetallePage />} />
        <Route path="personas" element={<ResourcePage resource="personas" />} />
        <Route path="reservas" element={<ResourcePage resource="reservas" />} />
        <Route path="usuarios" element={<ResourcePage resource="usuarios" />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
