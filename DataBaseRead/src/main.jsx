import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const labels = {
  building: 'Buildings', bldg_photographs: 'Photographs', bldg_plans: 'Architectural plans',
  bldg_3D: '3D scans', bldg_texts: 'Texts', maps: 'Maps', persons: 'People', md_photograph: 'Photo metadata',
}

const icons = { building: '⌂', bldg_photographs: '◫', bldg_plans: '⌗', bldg_3D: '◇', bldg_texts: '≡', maps: '⌖', persons: '○', md_photograph: '◧' }
const hidden = new Set(['id', 'created', 'updated', 'file', 'fileUrl', 'tokenKey'])
const imageExtensions = /\.(jpe?g|png|gif|webp)$/i

const friendly = (key) => key.replace(/^LINK_|^DEPICTS_/, '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const titleFor = (record) => record.bldgname || record.name || record.attribute_name || record.id
const subtitleFor = (record) => record.description_en || record.description || record.description_ua || record.address || ''
const meaningful = (value) => value !== '' && value !== null && value !== undefined && value !== false && value !== 0 && value !== '[]'
const searchable = (record) => Object.values(record).map((v) => typeof v === 'object' ? JSON.stringify(v) : v).join(' ').toLowerCase()

function Value({ value }) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ')
  if (typeof value === 'string' && /^https?:\/\//.test(value)) return <a href={value} target="_blank" rel="noreferrer">Open source ↗</a>
  return String(value)
}

function RecordCard({ record, collection, onOpen }) {
  const image = record.file && imageExtensions.test(record.file)
  const date = record.creation_date_original || record.date
  return <article className="card" onClick={() => onOpen(record)} tabIndex="0" onKeyDown={(e) => e.key === 'Enter' && onOpen(record)}>
    {image ? <img src={record.fileUrl} alt="" loading="lazy" /> : <div className="file-preview"><span>{icons[collection]}</span><small>{record.format || (record.file?.split('.').pop()) || 'record'}</small></div>}
    <div className="card-body">
      <div className="eyebrow">{labels[collection]}</div>
      <h3>{titleFor(record)}</h3>
      {subtitleFor(record) && <p>{subtitleFor(record)}</p>}
      <div className="card-meta">
        {date && <span>{String(date).slice(0, 10)}</span>}
        {record.camera_bldg_orientation && <span>{record.camera_bldg_orientation}</span>}
        {record.capture_principle && <span>{record.capture_principle}</span>}
        {record.layout && <span>{record.layout}</span>}
      </div>
    </div>
  </article>
}

function Detail({ record, collection, onClose }) {
  const entries = Object.entries(record).filter(([key, value]) => !hidden.has(key) && meaningful(value))
  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="detail" role="dialog" aria-modal="true">
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      {record.file && imageExtensions.test(record.file) && <img className="hero-image" src={record.fileUrl} alt="" />}
      <div className="detail-content">
        <div className="eyebrow">{labels[collection]}</div>
        <h2>{titleFor(record)}</h2>
        {record.fileUrl && <a className="file-button" href={record.fileUrl} target="_blank" rel="noreferrer">Open {record.format?.toUpperCase() || 'file'} ↗</a>}
        <dl>{entries.map(([key, value]) => <div key={key}><dt>{friendly(key)}</dt><dd><Value value={value} /></dd></div>)}</dl>
        <div className="record-id">Record {record.id} · Updated {record.updated?.slice(0, 10)}</div>
      </div>
    </section>
  </div>
}

function App() {
  const [summary, setSummary] = useState(null)
  const [active, setActive] = useState('all')
  const [records, setRecords] = useState({})
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { fetch('/api/collections').then((r) => r.ok ? r.json() : Promise.reject()).then(setSummary).catch(() => setError('Could not connect to the database API.')) }, [])
  useEffect(() => {
    if (!summary) return
    const wanted = active === 'all' ? summary.collections.map((c) => c.name) : [active]
    wanted.filter((name) => !records[name]).forEach((name) => {
      fetch(`/api/records/${name}`).then((r) => r.json()).then((data) => setRecords((old) => ({ ...old, [name]: data.records }))).catch(() => setError(`Could not load ${labels[name]}.`))
    })
  }, [active, summary])

  const visible = useMemo(() => {
    const names = active === 'all' ? summary?.collections.map((c) => c.name) || [] : [active]
    return names.flatMap((name) => (records[name] || []).map((record) => ({ record, collection: name })))
      .filter(({ record }) => !query || searchable(record).includes(query.toLowerCase()))
  }, [active, records, query, summary])

  return <>
    <header>
      <nav><div className="brand-mark">DA</div><div className="brand">Dresden Archive <small>Digital heritage collection · Germany</small></div><div className="status"><i /> Read-only database</div></nav>
      <div className="intro"><p className="kicker">2D & 3D CULTURAL HERITAGE</p><h1>Fragments of place,<br/><em>preserved in detail.</em></h1><p>Explore photographs, architectural drawings, 3D captures and documentary records from Dresden, Germany’s built heritage.</p>
        <div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names, descriptions, formats…" /></div>
      </div>
    </header>
    <main>
      {error && <div className="error">{error}</div>}
      <section className="collection-bar">
        <button className={active === 'all' ? 'active' : ''} onClick={() => setActive('all')}><span>∞</span><b>All records</b><small>{summary?.total ?? '—'}</small></button>
        {summary?.collections.map((item) => <button key={item.name} className={active === item.name ? 'active' : ''} onClick={() => setActive(item.name)}><span>{icons[item.name]}</span><b>{labels[item.name]}</b><small>{item.count}</small></button>)}
      </section>
      <div className="results-head"><div><div className="eyebrow">THE COLLECTION</div><h2>{active === 'all' ? 'All archive records' : labels[active]}</h2></div><span>{visible.length} {visible.length === 1 ? 'item' : 'items'}</span></div>
      <section className="grid">{visible.map(({ record, collection }) => <RecordCard key={`${collection}-${record.id}`} record={record} collection={collection} onOpen={(item) => setSelected({ record: item, collection })} />)}</section>
      {!error && summary && !visible.length && <div className="empty">No records match your search.</div>}
      {!summary && !error && <div className="empty">Opening the archive…</div>}
    </main>
    <footer><span>Dresden, Germany Digital Heritage Archive</span><span>Powered by PocketBase data · Read-only view</span></footer>
    {selected && <Detail {...selected} onClose={() => setSelected(null)} />}
  </>
}

createRoot(document.getElementById('root')).render(<App />)
