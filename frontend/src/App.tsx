import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileText, Home, LogOut, Menu, Plus, Settings, SlidersHorizontal, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react'
import {
  TransformationWorkspace,
  type GenerationConfig,
} from './components/transformation/TransformationWorkspace'
import { Button } from './components/ui/Button'
import {
  addFileSource,
  addTextSource,
  addUnsupportedSource,
  addUrlSource,
  createTransformation as createTransformationApi,
  deleteTransformation,
  generateTransformationOutputs,
  getTransformation,
  listTransformations,
  patchTransformationDNA,
  removeTransformationSource,
  renameTransformation,
  restoreTransformationVersion,
} from './lib/api/client'
import type { ContentDNAPatch, SourceType } from './types/content'
import type { Transformation } from './types/transformation'
import './App.css'
import './layout-fixes.css'
import './batch-source.css'
import './dna.css'
import './transformation.css'
import './rebrand.css'


type SaveState = 'saved' | 'dirty' | 'saving' | 'error'
type ViewState = 'workspace' | 'settings'
type ThemeMode = 'light' | 'dark' | 'aesthetic'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => window.localStorage.getItem('ev-authenticated') !== 'false')
  const [collapsed, setCollapsed] = useState(true)
  const [mobileNav, setMobileNav] = useState(false)
  const [transformations, setTransformations] = useState<Transformation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>('workspace')
  const [homeMenuOpen, setHomeMenuOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('aesthetic')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const renameTimers = useRef<Record<string, number>>({})
  const active = transformations.find((item) => item.id === activeId) || null

  useEffect(() => {
    void refreshTransformations()
  }, [])

  useEffect(() => {
    const savedMode = window.localStorage.getItem('ev-theme-mode')
    if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'aesthetic') {
      setThemeMode(savedMode)
    }
  }, [])

  function changeThemeMode(mode: ThemeMode) {
    setThemeMode(mode)
    window.localStorage.setItem('ev-theme-mode', mode)
  }

  function login() {
    window.localStorage.setItem('ev-authenticated', 'true')
    setIsAuthenticated(true)
  }

  function logout() {
    window.localStorage.removeItem('ev-authenticated')
    setIsAuthenticated(false)
  }

  async function refreshTransformations() {
    try {
      const response = await listTransformations()
      setTransformations(response.transformations)
      setActiveId((current) => current || response.transformations[0]?.id || null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load transformations.')
    }
  }

  function replaceTransformation(updated: Transformation) {
    setTransformations((items) => {
      const exists = items.some((item) => item.id === updated.id)
      const next = exists ? items.map((item) => item.id === updated.id ? updated : item) : [updated, ...items]
      return [...next].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    })
  }

  async function newTransformation() {
    if (busy) return

    setBusy(true)
    setError('')
    try {
      const created = await createTransformationApi()
      replaceTransformation(created)
      setActiveId(created.id)
      setView('workspace')
      setHomeMenuOpen(false)
      setMobileNav(false)
      setSaveState('saved')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a new transformation.')
    } finally {
      setBusy(false)
    }
  }

  async function selectTransformation(id: string) {
    setError('')
    setSaveState('saved')
    setView('workspace')
    setMobileNav(false)
    try {
      const item = await getTransformation(id)
      replaceTransformation(item)
      setActiveId(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to restore this transformation.')
    }
  }

  function goHome() {
    setHomeMenuOpen((open) => !open)
  }

  function openSettings() {
    setError('')
    setView('settings')
    setHomeMenuOpen(true)
    setMobileNav(false)
  }

  async function createTexts(drafts: { title: string; text: string }[]) {
    if (!active) return
    setBusy(true)
    setError('')
    try {
      let updated = active
      for (const draft of drafts) {
        updated = await addTextSource(updated.id, draft.title.trim() || 'Untitled source', draft.text)
      }
      replaceTransformation(updated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Content DNA generation failed.')
    } finally {
      setBusy(false)
    }
  }

  async function createFiles(files: File[]) {
    if (!active) return
    setBusy(true)
    setError('')
    try {
      let updated = active
      for (const file of files) {
        updated = await addFileSource(updated.id, file)
      }
      replaceTransformation(updated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'File processing failed.')
    } finally {
      setBusy(false)
    }
  }

  async function createUrl(url: string, title: string) {
    if (!active) return
    setBusy(true)
    setError('')
    try {
      replaceTransformation(await addUrlSource(active.id, url, title || 'URL source'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'URL processing failed.')
    } finally {
      setBusy(false)
    }
  }

  async function createUnsupported(sourceType: SourceType, title: string, note: string) {
    if (!active) return
    setBusy(true)
    setError('')
    try {
      replaceTransformation(await addUnsupportedSource(active.id, sourceType, title, note))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Source could not be recorded.')
    } finally {
      setBusy(false)
    }
  }

  async function savePatch(changes: ContentDNAPatch) {
    if (!active) return
    setSaveState('saving')
    setError('')
    try {
      const updated = await patchTransformationDNA(active.id, changes)
      replaceTransformation(updated)
      setSaveState('saved')
    } catch (cause) {
      setSaveState('error')
      setError(cause instanceof Error ? cause.message : 'Changes could not be saved.')
    }
  }

  async function removeSource(sourceId: string) {
    if (!active) return
    setBusy(true)
    setError('')
    try {
      replaceTransformation(await removeTransformationSource(active.id, sourceId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Source could not be removed.')
    } finally {
      setBusy(false)
    }
  }

  function rename(title: string) {
    if (!active) return
    const cleanTitle = title || 'Untitled Transformation'
    replaceTransformation({ ...active, title: cleanTitle, updated_at: new Date().toISOString() })
    setSaveState('dirty')
    window.clearTimeout(renameTimers.current[active.id])
    renameTimers.current[active.id] = window.setTimeout(async () => {
      try {
        const updated = await renameTransformation(active.id, cleanTitle)
        replaceTransformation(updated)
        setSaveState('saved')
      } catch (cause) {
        setSaveState('error')
        setError(cause instanceof Error ? cause.message : 'Title could not be saved.')
      }
    }, 450)
  }

  async function generateOutputs(
      types: string[],
      generationConfig: GenerationConfig,
    ) {
      if (!active) return

      setBusy(true)
      setError('')

      try {
        replaceTransformation(
          await generateTransformationOutputs(
            active.id,
            types,
            generationConfig,
          ),
        )
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Outputs could not be generated.',
        )
      } finally {
        setBusy(false)
      }
    } 

  async function restoreVersion(version: number) {
    if (!active) return
    setBusy(true)
    setError('')
    try {
      replaceTransformation(await restoreTransformationVersion(active.id, version))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'DNA version could not be restored.')
    } finally {
      setBusy(false)
    }
  }

  async function removeTransformation(id: string) {
    setBusy(true)
    setError('')
    try {
      await deleteTransformation(id)
      setDeleteTargetId(null)
      setTransformations((items) => {
        const remaining = items.filter((item) => item.id !== id)
        setActiveId((current) => current === id ? remaining[0]?.id || null : current)
        return remaining
      })
      setSaveState('saved')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Transformation could not be deleted.')
    } finally {
      setBusy(false)
    }
  }

  const pageTitle = view === 'settings' ? 'Settings' : active?.title || 'New transformation'

  if (!isAuthenticated) return <LoginPage onLogin={login} themeMode={themeMode} />

  return <div className={`app-shell theme-${themeMode}`}><Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} onHome={goHome} onNew={() => void newTransformation()} onSettings={openSettings} onLogout={logout} mobileOpen={mobileNav} onClose={() => setMobileNav(false)} active={active} homeOpen={homeMenuOpen} settingsActive={view === 'settings'} transformations={transformations} onSelect={(id) => void selectTransformation(id)} onDelete={setDeleteTargetId} /><main className="main-shell"><header className="topbar"><Button variant="ghost" className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={18} /></Button><div className="crumbs"><span>EV</span><span className="crumb-slash">/</span><span>{view === 'settings' ? 'Settings' : 'Transformations'}</span><span className="crumb-slash">/</span><strong>{pageTitle}</strong></div><div className="topbar-actions"><span className="sync-state"><span className="sync-icon"><span /></span>{saveState === 'saving' ? 'Saving...' : saveState === 'dirty' ? 'Unsaved changes' : saveState === 'error' ? 'Save failed' : 'Synced'}</span><Button variant="ghost" aria-label="Settings" onClick={openSettings}><Settings size={17} /></Button></div></header>{error && <div className="error-banner" role="alert"><TriangleAlert size={17} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}{view === 'settings' ? <SettingsDashboard transformationCount={transformations.length} activeTitle={active?.title} themeMode={themeMode} onThemeModeChange={changeThemeMode} /> : active ? <TransformationWorkspace key={active.id} transformation={active} busy={busy} saveState={saveState} onTexts={createTexts} onFiles={createFiles} onUrl={createUrl} onUnsupported={createUnsupported} onPatch={savePatch} onRename={rename} onRemoveSource={(id) => void removeSource(id)} onGenerateOutputs={(types, generationConfig) =>
  void generateOutputs(types, generationConfig)} onRestoreVersion={(version) => void restoreVersion(version)} /> : <EmptyHome onNew={() => void newTransformation()} busy={busy} />}</main>{deleteTargetId && <DeleteConfirmation target={transformations.find((item) => item.id === deleteTargetId)} busy={busy} onCancel={() => setDeleteTargetId(null)} onConfirm={() => void removeTransformation(deleteTargetId)} />}</div>
}

function DeleteConfirmation({ target, busy, onCancel, onConfirm }: { target?: Transformation; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!target) return null

  return <div className="delete-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}><section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-transformation-title"><div className="delete-modal-icon"><Trash2 size={18} /></div><div className="delete-modal-copy"><h2 id="delete-transformation-title">Delete transformation?</h2><p>Are you sure you want to delete <strong>{target.title}</strong>?</p></div><div className="delete-modal-actions"><button type="button" className="delete-cancel-button" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="delete-confirm-button" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</button></div></section></div>
}

function SettingsDashboard({ transformationCount, activeTitle, themeMode, onThemeModeChange }: { transformationCount: number; activeTitle?: string; themeMode: ThemeMode; onThemeModeChange: (mode: ThemeMode) => void }) { return <section className="home-dashboard settings-dashboard page-enter"><div className="home-header"><div className="eyebrow eyebrow-left"><span className="eyebrow-dot" /> SETTINGS</div><h1>Workspace settings</h1><p>Review the current workspace status and local configuration.</p></div><section className="home-module settings-module"><div className="home-module-icon"><SlidersHorizontal size={22} /></div><div><span className="home-module-kicker">SETTINGS</span><h2>Workspace settings</h2><p>Current workspace information for this local project.</p></div><div className="mode-setting"><span>Mode</span><div className="mode-options" role="group" aria-label="Display mode">{(['light', 'dark', 'aesthetic'] as const).map((mode) => <button key={mode} className={themeMode === mode ? 'active' : ''} aria-pressed={themeMode === mode} onClick={() => onThemeModeChange(mode)}>{mode === 'light' ? 'Light Mode' : mode === 'dark' ? 'Dark Mode' : 'Aesthetic Mode'}</button>)}</div></div><div className="settings-list"><div><span>Transformations</span><strong>{transformationCount}</strong></div><div><span>Active workspace</span><strong>{activeTitle || 'None selected'}</strong></div></div></section></section> }

function EmptyHome({ onNew, busy }: { onNew: () => void; busy: boolean }) { return <section className="empty-home page-enter"><img className="empty-home-mark" src="/ev-logo.svg" alt="EV workspace" /><div className="eyebrow eyebrow-left"><span className="eyebrow-dot" /> TRANSFORMATION WORKSPACE</div><h1>Make meaning from the material.</h1><p>Open a recent transformation or start a clean workspace for a new body of source material.</p><Button variant="primary" onClick={onNew} disabled={busy}><Plus size={16} />New Transformation</Button></section> }

function LoginPage({ onLogin, themeMode }: { onLogin: () => void; themeMode: ThemeMode }) {
  return <main className={`login-page theme-${themeMode}`}><section className="login-card"><img className="login-mark" src="/ev-logo.svg" alt="EV workspace" /><span className="eyebrow eyebrow-left"><span className="eyebrow-dot" /> EV WORKSPACE</span><h1>Welcome back</h1><p>Sign in to continue to your transformation workspace.</p><Button variant="primary" onClick={onLogin}>Sign in</Button></section></main>
}

function Sidebar({
  collapsed,
  onCollapsedChange,
  onHome,
  onNew,
  onSettings,
  onLogout,
  mobileOpen,
  onClose,
  active,
  homeOpen,
  settingsActive,
  transformations,
  onSelect,
  onDelete,
}: {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onHome: () => void
  onNew: () => void
  onSettings: () => void
  onLogout: () => void
  mobileOpen: boolean
  onClose: () => void
  active: Transformation | null
  homeOpen: boolean
  settingsActive: boolean
  transformations: Transformation[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  function expandSidebar() {
    if (!mobileOpen) onCollapsedChange(false)
  }

  function collapseSidebar() {
    if (!mobileOpen) onCollapsedChange(true)
  }

  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      onMouseEnter={expandSidebar}
      onMouseLeave={collapseSidebar}
    >
      <div className="brand-row">
        <img className="brand-mark" src="/ev-logo.svg" alt="EV workspace" />
        {!collapsed && <span className="brand-name">EV <small>WORKSPACE</small></span>}
        <button className="sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="home-nav-block">
        <button className={`nav-item home-nav-item ${homeOpen ? 'active' : ''}`} onClick={onHome}>
          <Home size={17} />
          <span className="nav-label">Home</span>
          {!collapsed && <ChevronDown className="home-parent-chevron" size={15} />}
        </button>
        <div className={`home-submodules ${homeOpen && !collapsed ? 'open' : ''}`} aria-hidden={!homeOpen || collapsed}>
          <button className="home-submodule-item" onClick={onNew} tabIndex={homeOpen && !collapsed ? 0 : -1}>
            <Sparkles size={15} />
            <span>New Transformation</span>
          </button>
          <button className={`home-submodule-item ${settingsActive ? 'active' : ''}`} onClick={onSettings} tabIndex={homeOpen && !collapsed ? 0 : -1}>
            <Settings size={15} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      <nav className="nav-groups" aria-label="Workspace navigation">
        <div className="nav-group">
          <div className="group-label">{!collapsed && `RECENT TRANSFORMATIONS · ${transformations.length}`}</div>
          {transformations.length ? transformations.map((item) => (
            <div className={`transformation-nav-row ${item.id === active?.id && !settingsActive ? 'active' : ''}`} key={item.id}>
              <button className="nav-item transformation-item" onClick={() => onSelect(item.id)}>
                <Sparkles size={16} />
                <span className="nav-label">{item.title}</span>
                <small>{item.sources.length}</small>
              </button>
              <button className="delete-transformation" aria-label={`Delete ${item.title}`} title="Delete transformation" onClick={() => onDelete(item.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          )) : (
            <button className="nav-item">
              <FileText size={17} />
              <span className="nav-label">No transformations yet</span>
            </button>
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="profile">
          <div className="avatar">K</div>
          {!collapsed && <div><strong>Operator</strong><span>EV workspace</span></div>}
        </div>
        <button className="logout-button" onClick={onLogout} aria-label="Logout">
          <LogOut size={16} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
export default App
