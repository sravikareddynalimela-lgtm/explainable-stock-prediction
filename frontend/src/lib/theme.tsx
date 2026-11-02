import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

/** Colours for canvas charts (they can't read CSS variables). Keep in sync with index.css. */
export const PALETTE = {
  dark: { text: '#5F6877', grid: '#171B22', line: '#1F242D', cross: '#9AA3B2', crossLabel: '#2C323D', up: '#19C37D', down: '#FF5468', sma20: '#5AA9FF', sma50: '#FF9A1F', bb: '#5F6877', why: '#A99BFF', muted: '#5F6877' },
  light: { text: '#8691A3', grid: '#EEF1F5', line: '#E1E5EB', cross: '#4A5466', crossLabel: '#4A5466', up: '#078A55', down: '#D32F43', sma20: '#1F6FEB', sma50: '#C96400', bb: '#8691A3', why: '#5A48D6', muted: '#8691A3' },
} as const

const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })

function initial(): Theme {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Wraps the dashboard only, so the login pages keep their own look. */
export function ThemeScope({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial)
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
    // html background shows on overscroll, so match it while the dashboard is mounted
    document.documentElement.dataset.theme = theme
    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])
  return (
    <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
      <div data-theme={theme} className="min-h-screen bg-void text-fg">{children}</div>
    </Ctx.Provider>
  )
}

export const useTheme = () => useContext(Ctx)
export const usePalette = () => PALETTE[useTheme().theme]
