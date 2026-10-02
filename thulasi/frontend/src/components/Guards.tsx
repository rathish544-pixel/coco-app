import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Loading } from './Loading'
import { Login } from '../pages/Login'
import { useAuth } from '../state/AuthContext'

/** Keeps private screens out of reach until there is a signed-in user. */
export function ProtectedRoute() {
  const { user, booting } = useAuth()
  const location = useLocation()

  if (booting) {
    return <Loading label="Opening our little world…" />
  }

  if (!user) {
    // Remember where they were headed so login returns them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

/** The login screen: sends an already-signed-in user into the app. */
export function LoginRoute() {
  const { user, booting } = useAuth()

  if (booting) {
    return <Loading label="Checking your session…" />
  }
  if (user) {
    return <Navigate to="/" replace />
  }
  return <Login />
}
