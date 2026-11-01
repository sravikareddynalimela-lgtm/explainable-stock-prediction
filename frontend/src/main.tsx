import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Logo } from './components/Logo'
import './index.css'
import { AuthProvider, useAuth } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import { AuthPage } from './pages/AuthPage'
import Dashboard from './pages/Dashboard'

const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } } })

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-fg-3" aria-label="Loading" />
    </div>
  )
}

/** Only for logged-in users. */
function Private({ children }: { children: ReactNode }) {
  const { session, loading, recovering } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  if (recovering) return <Navigate to="/reset" replace />
  return children
}

/** Only for logged-out users (login, sign up, forgot password). */
function Public({ children }: { children: ReactNode }) {
  const { session, loading, recovering } = useAuth()
  if (loading) return <Splash />
  if (session) return <Navigate to={recovering ? '/reset' : '/'} replace />
  return children
}

function ResetRoute() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  // the reset link signs the user in with a recovery session; without one the link has expired
  if (!session) return <Navigate to="/forgot" replace />
  return <AuthPage mode="reset" />
}

function SetupNeeded() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <Logo />
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">Connect Supabase to turn on accounts</h1>
      <p className="mt-3 text-fg-2">Create <code className="num text-fg">frontend/.env.local</code> with your project’s URL and publishable key, then restart <code className="num text-fg">npm run dev</code>.</p>
      <pre className="num mt-6 overflow-x-auto rounded-lg border border-line bg-panel p-4 text-sm text-fg">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
      </pre>
      <p className="mt-4 text-sm text-fg-3">Find both in Supabase under Project Settings, API Keys. Full steps are in the README.</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      {supabaseConfigured ? (
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Public><AuthPage mode="login" /></Public>} />
              <Route path="/signup" element={<Public><AuthPage mode="signup" /></Public>} />
              <Route path="/forgot" element={<Public><AuthPage mode="forgot" /></Public>} />
              <Route path="/reset" element={<ResetRoute />} />
              <Route path="/" element={<Private><Dashboard /></Private>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      ) : (
        <SetupNeeded />
      )}
    </QueryClientProvider>
  </StrictMode>,
)
