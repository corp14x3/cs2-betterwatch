import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login.jsx'
import Demos from './pages/Demos.jsx'
import DownloadedDemos from './pages/DownloadedDemos.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Settings from './pages/Settings.jsx'
import Layout from './components/Layout.jsx'
import './index.css'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/demos" replace />} />
            <Route path="demos" element={<Demos />} />
            <Route path="downloaded" element={<DownloadedDemos />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
