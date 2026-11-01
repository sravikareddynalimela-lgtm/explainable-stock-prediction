import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { INDEX_SYMBOLS, TickerTape, shortName } from '../components/TickerTape'
import { api } from '../lib/api'
import { authErrorMessage } from '../lib/auth'
import { supabase } from '../lib/supabase'

export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset'

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { data: markets = [] } = useQuery({ queryKey: ['markets'], queryFn: api.markets, refetchInterval: 15_000, retry: 1 })
  const ordered = INDEX_SYMBOLS.map((s) => markets.find((m) => m.symbol === s)).filter((q): q is NonNullable<typeof q> => Boolean(q))

  return (
    <div className="flex min-h-screen flex-col">
      <TickerTape quotes={ordered} />
      <div className="grid flex-1 lg:grid-cols-[1.15fr_1fr]">
        <section className="relative hidden overflow-hidden border-r border-line lg:block">
          <div className="grid-bg absolute inset-0" aria-hidden />
          <div className="relative flex h-full flex-col p-12">
            <Logo />
            <div className="my-auto max-w-xl">
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
                Live markets.<br />Every call explained.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-fg-2">
                Track NSE and US stocks tick by tick, and see exactly which signals push the model toward up or down before you decide.
              </p>
              <MarketBoard quotes={ordered.slice(0, 6)} />
            </div>
            <p className="text-xs text-fg-3">Market data from Yahoo Finance. For learning, not financial advice.</p>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-sm">
            <div className="mb-10 lg:hidden"><Logo /></div>
            {mode === 'login' && <LoginForm />}
            {mode === 'signup' && <SignupForm />}
            {mode === 'forgot' && <ForgotForm />}
            {mode === 'reset' && <ResetForm />}
          </div>
        </section>
      </div>
    </div>
  )
}

function MarketBoard({ quotes }: { quotes: { symbol: string; price: number; changePct: number }[] }) {
  if (!quotes.length) return null
  return (
    <dl className="mt-12 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
      {quotes.map((q) => (
        <div key={q.symbol} className="bg-panel/90 px-4 py-3">
          <dt className="text-xs font-medium text-fg-2">{shortName(q.symbol)}</dt>
          <dd className="num mt-1 text-lg text-fg">{q.price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</dd>
          <dd className={`num text-sm ${q.changePct >= 0 ? 'text-up' : 'text-down'}`}>{q.changePct >= 0 ? '+' : '−'}{Math.abs(q.changePct).toFixed(2)}%</dd>
        </div>
      ))}
    </dl>
  )
}

// ---------------------------------------------------------------------------

function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<{ error: { message: string } | null } | void>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if (res && res.error) setError(authErrorMessage(res.error.message))
    } catch (e) {
      setError(authErrorMessage((e as Error).message))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

function LoginForm() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useSubmit()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const res = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
      if (!res.error) nav('/', { replace: true })
      return res
    })
  }

  return (
    <form onSubmit={submit} noValidate>
      <Heading title="Log in" sub={<>New here? <Link to="/signup" className="text-brand hover:underline">Create an account</Link></>} />
      <div className="space-y-4">
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={setPassword}
          aside={<Link to="/forgot" className="text-xs text-fg-2 hover:text-fg">Forgot password?</Link>} />
      </div>
      <ErrorText error={error} />
      <Submit busy={busy} disabled={!email || !password}>Log in</Submit>
    </form>
  )
}

function SignupForm() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { busy, error, setError, run } = useSubmit()
  const strength = passwordStrength(password)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    run(async () => {
      const res = await supabase!.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: `${location.origin}/` },
      })
      if (res.error) return res
      if (res.data.session) nav('/', { replace: true })
      else setSentTo(email.trim()) // email confirmation is on
      return res
    })
  }

  if (sentTo) {
    return (
      <div>
        <MailCheck className="h-10 w-10 text-up" aria-hidden />
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Confirm your email</h2>
        <p className="mt-2 text-fg-2">We sent a confirmation link to <span className="text-fg">{sentTo}</span>. Open it to activate your account, then log in.</p>
        <Link to="/login" className="mt-8 inline-flex items-center gap-2 text-sm text-brand hover:underline"><ArrowLeft className="h-4 w-4" />Back to log in</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <Heading title="Create your account" sub={<>Already have one? <Link to="/login" className="text-brand hover:underline">Log in</Link></>} />
      <div className="space-y-4">
        <Field label="Full name" autoComplete="name" value={name} onChange={setName} required />
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
        <div>
          <PasswordField label="Password" autoComplete="new-password" value={password} onChange={setPassword} />
          {password && (
            <div className="mt-2 flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i < strength.score ? strength.bar : 'bg-line-2'}`} />
                ))}
              </div>
              <span className={`text-xs ${strength.text}`}>{strength.label}</span>
            </div>
          )}
        </div>
      </div>
      <ErrorText error={error} />
      <Submit busy={busy} disabled={!name || !email || !password}>Create account</Submit>
      <p className="mt-4 text-xs leading-relaxed text-fg-3">Predictions are educational and aren’t financial advice.</p>
    </form>
  )
}

function ForgotForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const { busy, error, run } = useSubmit()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const res = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/reset` })
      if (!res.error) setSent(true)
      return res
    })
  }
  if (sent) {
    return (
      <div>
        <MailCheck className="h-10 w-10 text-up" aria-hidden />
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Check your inbox</h2>
        <p className="mt-2 text-fg-2">If an account exists for <span className="text-fg">{email}</span>, a reset link is on its way.</p>
        <Link to="/login" className="mt-8 inline-flex items-center gap-2 text-sm text-brand hover:underline"><ArrowLeft className="h-4 w-4" />Back to log in</Link>
      </div>
    )
  }
  return (
    <form onSubmit={submit} noValidate>
      <Heading title="Reset your password" sub="Enter your account email and we’ll send you a reset link." />
      <Field label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
      <ErrorText error={error} />
      <Submit busy={busy} disabled={!email}>Send reset link</Submit>
      <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm text-fg-2 hover:text-fg"><ArrowLeft className="h-4 w-4" />Back to log in</Link>
    </form>
  )
}

function ResetForm() {
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const { busy, error, setError, run } = useSubmit()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    run(async () => {
      const res = await supabase!.auth.updateUser({ password })
      if (!res.error) nav('/', { replace: true })
      return res
    })
  }
  return (
    <form onSubmit={submit} noValidate>
      <Heading title="Choose a new password" sub="You’ll stay logged in after saving it." />
      <PasswordField label="New password" autoComplete="new-password" value={password} onChange={setPassword} />
      <ErrorText error={error} />
      <Submit busy={busy} disabled={!password}>Save password</Submit>
    </form>
  )
}

// ---------------------------------------------------------------------------

function Heading({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-fg-2">{sub}</p>
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-line-2 bg-raised px-3 py-2.5 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-brand focus:ring-1 focus:ring-brand'

function Field({ label, value, onChange, type = 'text', autoComplete, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string; required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg-2">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required={required} className={inputCls} />
    </label>
  )
}

function PasswordField({ label, value, onChange, autoComplete, aside }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string; aside?: ReactNode
}) {
  const [show, setShow] = useState(false)
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-fg-2">{label}</span>
        {aside}
      </span>
      <span className="relative block">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required className={`${inputCls} pr-10`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-fg-3 hover:text-fg">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  )
}

function ErrorText({ error }: { error: string | null }) {
  return error ? <p role="alert" className="mt-4 rounded-md border border-down/30 bg-down-dim px-3 py-2 text-sm text-down">{error}</p> : null
}

function Submit({ busy, disabled, children }: { busy: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={busy || disabled}
      className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 font-semibold text-white transition-colors hover:bg-[#5a9dff] disabled:cursor-not-allowed disabled:opacity-40">
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

function passwordStrength(p: string) {
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++
  const levels = [
    { label: 'Too short', bar: 'bg-down', text: 'text-down' },
    { label: 'Weak', bar: 'bg-down', text: 'text-down' },
    { label: 'Fair', bar: 'bg-hold', text: 'text-hold' },
    { label: 'Good', bar: 'bg-up', text: 'text-up' },
    { label: 'Strong', bar: 'bg-up', text: 'text-up' },
  ]
  return { score, ...levels[p.length < 8 ? 0 : score] }
}
