import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronLeft, ChevronRight, FileText, LayoutGrid, Menu, Plus, Settings, Sparkles, Target, TriangleAlert, X } from 'lucide-react'
import { TransformationWorkspace } from './components/transformation/TransformationWorkspace'
import { Badge } from './components/ui/Badge'
import { Button } from './components/ui/Button'
import {
  addFileSource,
  addTextSource,
  addUnsupportedSource,
  addUrlSource,
  createTransformation as createTransformationApi,
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

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [transformations, setTransformations] = useState<Transformation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const renameTimers = useRef<Record<string, number>>({})
  const active = transformations.find((item) => item.id === activeId) || null

  useEffect(() => {
    void refreshTransformations()
  }, [])

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
    setBusy(true)
    setError('')
    try {
      const created = await createTransformationApi()
      replaceTransformation(created)
      setActiveId(created.id)
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
    try {
      const item = await getTransformation(id)
      replaceTransformation(item)
      setActiveId(id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to restore this transformation.')
    }
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

  async function generateOutputs(types: string[]) {
    if (!active) return
    setBusy(true)
    setError('')
    try {
      replaceTransformation(await generateTransformationOutputs(active.id, types))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Outputs could not be generated.')
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

  return <div className="app-shell"><Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onNew={() => void newTransformation()} mobileOpen={mobileNav} onClose={() => setMobileNav(false)} active={active} transformations={transformations} onSelect={(id) => void selectTransformation(id)} /><main className="main-shell"><header className="topbar"><Button variant="ghost" className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={18} /></Button><div className="crumbs"><span>EV</span><span className="crumb-slash">/</span><span>Transformations</span><span className="crumb-slash">/</span><strong>{active?.title || 'New transformation'}</strong></div><div className="topbar-actions"><span className="sync-state"><span className="sync-icon"><span /></span>{saveState === 'saving' ? 'Saving...' : saveState === 'dirty' ? 'Unsaved changes' : saveState === 'error' ? 'Save failed' : 'Synced'}</span><Button variant="ghost" aria-label="Settings"><Settings size={17} /></Button></div></header>{error && <div className="error-banner" role="alert"><TriangleAlert size={17} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}{active ? <TransformationWorkspace key={active.id} transformation={active} busy={busy} saveState={saveState} onTexts={createTexts} onFiles={createFiles} onUrl={createUrl} onUnsupported={createUnsupported} onPatch={savePatch} onRename={rename} onRemoveSource={(id) => void removeSource(id)} onGenerateOutputs={(types) => void generateOutputs(types)} onRestoreVersion={(version) => void restoreVersion(version)} /> : <EmptyHome onNew={() => void newTransformation()} busy={busy} />}</main></div>
}

function EmptyHome({ onNew, busy }: { onNew: () => void; busy: boolean }) { return <section className="empty-home page-enter"><div className="empty-home-mark">EV</div><div className="eyebrow eyebrow-left"><span className="eyebrow-dot" /> TRANSFORMATION WORKSPACE</div><h1>Make meaning from the material.</h1><p>Open a recent transformation or start a clean workspace for a new body of source material.</p><Button variant="primary" onClick={onNew} disabled={busy}><Plus size={16} />New Transformation</Button></section> }

function Sidebar({ collapsed, onToggle, onNew, mobileOpen, onClose, active, transformations, onSelect }: { collapsed: boolean; onToggle: () => void; onNew: () => void; mobileOpen: boolean; onClose: () => void; active: Transformation | null; transformations: Transformation[]; onSelect: (id: string) => void }) { return <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}><div className="brand-row"><div className="brand-mark">EV</div>{!collapsed && <span className="brand-name">EV <small>WORKSPACE</small></span>}<button className="sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button></div><Button variant="primary" className="new-button" onClick={onNew}><Plus size={17} />{!collapsed && 'New Transformation'}</Button><nav className="nav-groups" aria-label="Workspace navigation"><NavGroup label="Workspace" collapsed={collapsed} items={[[LayoutGrid, 'Overview', false], [Sparkles, 'Content DNA', !active], [Target, 'Transformations', true]]} /><div className="nav-group"><div className="group-label">{!collapsed && `RECENT TRANSFORMATIONS · ${transformations.length}`}</div>{transformations.length ? transformations.map((item) => <button className={`nav-item transformation-item ${item.id === active?.id ? 'active' : ''}`} key={item.id} onClick={() => onSelect(item.id)}><Sparkles size={16} /><span className="nav-label">{item.title}</span><small>{item.sources.length}</small></button>) : <button className="nav-item"><FileText size={17} /><span className="nav-label">No transformations yet</span></button>}</div><NavGroup label="Outputs" collapsed={collapsed} items={[[BookOpen, 'Drafts', true], [Check, 'Published', true]]} /></nav><div className="sidebar-footer"><button className="nav-item"><Settings size={17} /><span className="nav-label">Settings</span></button><div className="profile"><div className="avatar">K</div>{!collapsed && <div><strong>Operator</strong><span>EV workspace</span></div>}</div></div><button className="collapse-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggle}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button></aside> }
function NavGroup({ label, collapsed, items }: { label: string; collapsed: boolean; items: [typeof LayoutGrid, string, boolean][] }) { return <div className="nav-group"><div className="group-label">{!collapsed && label}</div>{items.map(([Icon, name, disabled]) => <button className={`nav-item ${disabled ? 'disabled' : ''}`} key={name} disabled={disabled}><Icon size={17} /><span className="nav-label">{name}</span>{disabled && !collapsed && <Badge>Soon</Badge>}</button>)}</div> }
export default App
