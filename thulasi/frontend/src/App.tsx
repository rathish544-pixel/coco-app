import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from './components/AppLayout'
import { LoginRoute, ProtectedRoute } from './components/Guards'
import { Home } from './pages/Home'
import { LoveNotes } from './pages/LoveNotes'
import { Memories } from './pages/Memories'
import { Photos } from './pages/Photos'
import { Setup } from './pages/Setup'
import { Songs } from './pages/Songs'
import { AuthProvider } from './state/AuthContext'
import { LoveProvider } from './state/LoveContext'
import { PlayerProvider } from './state/PlayerContext'
import { ToastProvider } from './components/Toast'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LoveProvider>
            <PlayerProvider>
              <Routes>
                <Route path="/login" element={<LoginRoute />} />

                {/* Everything below requires a signed-in user. */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/memories" element={<Memories />} />
                    <Route path="/photos" element={<Photos />} />
                    <Route path="/songs" element={<Songs />} />
                    <Route path="/notes" element={<LoveNotes />} />
                    <Route path="/setup" element={<Setup />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </PlayerProvider>
          </LoveProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
