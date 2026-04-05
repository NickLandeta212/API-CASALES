import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/casales-san-pedro-logo.svg'

function AppLayout() {
  const { user, logout } = useAuth()

  const links = [
    { to: '/', label: 'Resumen', roles: ['admin_general', 'admin_conjunto', 'condomino'] },
    { to: '/torres', label: 'Torres', roles: ['admin_general', 'admin_conjunto'] },
    { to: '/departamentos', label: 'Departamentos', roles: ['admin_general', 'admin_conjunto', 'condomino'] },
    { to: '/personas', label: 'Personas', roles: ['admin_general', 'admin_conjunto', 'condomino'] },
    { to: '/reservas', label: 'Reservas', roles: ['admin_general', 'admin_conjunto', 'condomino'] },
    { to: '/usuarios', label: 'Usuarios', roles: ['admin_general'] },
  ].filter((item) => item.roles.includes(user?.role))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src={logo} alt="Casales San Pedro" />
          <div>
            <p className="eyebrow eyebrow-inverse">CASALES SAN PEDRO</p>
            <h1>Panel</h1>
            <p className="subtitle subtitle-inverse">{user?.nombre}</p>
            <p className="role-pill role-pill-inverse">{user?.role}</p>
          </div>
        </div>

        <nav className="side-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="ghost logout-btn" onClick={logout}>
          Cerrar sesion
        </button>
      </aside>

      <main className="content-shell">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout
