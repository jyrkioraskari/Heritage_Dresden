import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const dataRoot = join(root, '09_Pocketbase-2D-3D', 'pb_data')
const db = new DatabaseSync(join(dataRoot, 'data.db'), { readOnly: true })
const port = Number(process.env.PORT || 3001)
const domainCollections = ['building', 'bldg_photographs', 'bldg_plans', 'bldg_3D', 'bldg_texts', 'maps', 'persons', 'md_photograph']

const collections = new Map(
  db.prepare(`SELECT id, name, fields FROM _collections WHERE name IN (${domainCollections.map(() => '?').join(',')})`)
    .all(...domainCollections).map((row) => [row.name, { ...row, fields: JSON.parse(row.fields) }]),
)

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.pdf': 'application/pdf', '.glb': 'model/gltf-binary', '.odt': 'application/vnd.oasis.opendocument.text',
}

function parseValue(value, type) {
  if (value == null) return value
  if (['json', 'relation', 'select', 'geoPoint'].includes(type) && typeof value === 'string') {
    try { return JSON.parse(value) } catch { return value }
  }
  return value
}

function recordsFor(name) {
  const collection = collections.get(name)
  if (!collection) return null
  const fieldTypes = Object.fromEntries(collection.fields.map((f) => [f.name, f.type]))
  return db.prepare(`SELECT * FROM "${name}" ORDER BY updated DESC`).all().map((record) => {
    const result = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, parseValue(value, fieldTypes[key])]))
    if (result.file) result.fileUrl = `/api/files/${encodeURIComponent(name)}/${encodeURIComponent(result.id)}/${encodeURIComponent(result.file)}`
    return result
  })
}

function serveFile(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return sendJson(res, 404, { error: 'File not found' })
  res.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream' })
  createReadStream(filePath).pipe(res)
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)

  if (url.pathname === '/api/collections') {
    const items = domainCollections.filter((name) => collections.has(name)).map((name) => ({
      name,
      count: db.prepare(`SELECT COUNT(*) count FROM "${name}"`).get().count,
      fields: collections.get(name).fields.map(({ name: fieldName, type }) => ({ name: fieldName, type })),
    }))
    return sendJson(res, 200, { collections: items, total: items.reduce((sum, item) => sum + item.count, 0) })
  }

  if (parts[0] === 'api' && parts[1] === 'records' && parts.length === 3) {
    const records = recordsFor(parts[2])
    return records ? sendJson(res, 200, { records }) : sendJson(res, 404, { error: 'Unknown collection' })
  }

  if (parts[0] === 'api' && parts[1] === 'files' && parts.length === 5) {
    const [, , name, id, filename] = parts
    const collection = collections.get(name)
    if (!collection) return sendJson(res, 404, { error: `Unknown collection: ${name}` })
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return sendJson(res, 400, { error: 'Invalid record ID' })
    if (!filename || filename !== basename(filename) || filename === '.' || filename === '..') {
      return sendJson(res, 400, { error: 'Invalid filename' })
    }

    const filePath = resolve(dataRoot, 'storage', collection.id, id, filename)
    const storageRoot = resolve(dataRoot, 'storage')
    const storagePath = relative(storageRoot, filePath)
    if (storagePath.startsWith('..') || resolve(storageRoot, storagePath) !== filePath) {
      return sendJson(res, 400, { error: 'Invalid file path' })
    }
    return serveFile(res, filePath)
  }

  if (process.env.NODE_ENV === 'production') {
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const candidate = resolve(root, 'dist', requested)
    if (candidate.startsWith(resolve(root, 'dist')) && existsSync(candidate) && statSync(candidate).isFile()) return serveFile(res, candidate)
    return serveFile(res, join(root, 'dist', 'index.html'))
  }

  sendJson(res, 404, { error: 'Not found. Run the Vite frontend with npm run dev:ui.' })
}).listen(port, () => console.log(`Read-only database API listening on http://localhost:${port}`))
