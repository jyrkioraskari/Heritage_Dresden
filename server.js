import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = resolve(process.env.HERITAGE_ROOT || fileURLToPath(new URL('.', import.meta.url)));
const dataRoot = resolve(process.env.HERITAGE_DATA_ROOT || join(root, 'DataBaseRead', '09_Pocketbase-2D-3D', 'pb_data'));
const staticRoot = resolve(process.env.HERITAGE_STATIC_ROOT || join(root, 'dist'));
const databasePath = join(dataRoot, 'data.db');
let db;
let collections;
const port = Number(process.env.PORT || 3001);
const pocketBaseAddress = process.env.POCKETBASE_ADDRESS || '127.0.0.1:8090';
const pocketBaseUrl = `http://${pocketBaseAddress}`;
const heritageCollections = ['bldg_photographs', 'bldg_plans', 'bldg_3D', 'bldg_texts', 'maps'];
const uploadCollections = new Set(['bldg_photographs', 'bldg_plans', 'bldg_3D', 'bldg_texts']);
const demoUploadsEnabled = process.env.DEMO_UPLOADS !== '0' && Boolean(
  process.env.POCKETBASE_UPLOAD_TOKEN
  || (process.env.POCKETBASE_SUPERUSER_EMAIL && process.env.POCKETBASE_SUPERUSER_PASSWORD),
);

function ensureDatabase() {
  if (db) return;
  db = new DatabaseSync(databasePath);
  collections = new Map(db.prepare('SELECT id, name, fields FROM _collections').all().map((row) => [
    row.name,
    { ...row, fields: JSON.parse(row.fields) },
  ]));
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function demoUpload(req, res, collection) {
  if (!demoUploadsEnabled) {
    sendJson(res, 503, { error: 'Uploads are not available right now' });
    return;
  }
  const configuredToken = process.env.POCKETBASE_UPLOAD_TOKEN;
  const identity = process.env.POCKETBASE_SUPERUSER_EMAIL;
  const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;
  if (!configuredToken && (!identity || !password)) {
    sendJson(res, 503, { error: 'Uploads are not available right now' });
    return;
  }
  try {
    let token = configuredToken;
    if (!token) {
      const authResponse = await fetch(`${pocketBaseUrl}/api/collections/_superusers/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, password }),
      });
      const auth = await authResponse.json();
      if (!authResponse.ok || !auth.token) {
        sendJson(res, 502, { error: 'The upload service could not be reached' });
        return;
      }
      token = auth.token;
    }
    const uploadResponse = await fetch(`${pocketBaseUrl}/api/collections/${encodeURIComponent(collection)}/records`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': req.headers['content-type'],
      },
      body: req,
      duplex: 'half',
    });
    const responseBody = Buffer.from(await uploadResponse.arrayBuffer());
    res.writeHead(uploadResponse.status, {
      'Content-Type': uploadResponse.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(responseBody);
  } catch (error) {
    sendJson(res, 502, { error: 'The upload could not be completed' });
  }
}

function parseValue(value, type) {
  if (value == null || typeof value !== 'string') return value;
  if (!['json', 'relation', 'select', 'geoPoint'].includes(type)) return value;
  try { return JSON.parse(value); } catch { return value; }
}

function prepareRecord(collectionName, record) {
  const collection = collections.get(collectionName);
  const types = Object.fromEntries(collection.fields.map((field) => [field.name, field.type]));
  const result = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, parseValue(value, types[key])]));
  if (result.file) {
    result.fileUrl = `/api/files/${encodeURIComponent(collectionName)}/${encodeURIComponent(result.id)}/${encodeURIComponent(result.file)}`;
  }
  return result;
}

function recordsForBuilding(osmType, osmId) {
  return heritageCollections.flatMap((name) => {
    if (!collections.has(name)) return [];
    const rows = db.prepare(`SELECT * FROM "${name}" WHERE depicts_osm_type = ? AND depicts_osm_id = ? ORDER BY updated DESC`).all(osmType, osmId);
    return rows.map((row) => ({ collection: name, ...prepareRecord(name, row) }));
  });
}

function updateMissingCoordinates(osmType, osmId, latitude, longitude) {
  const updated = new Date().toISOString().replace('T', ' ');
  let count = 0;
  heritageCollections.forEach((name) => {
    const collection = collections.get(name);
    if (!collection) return;
    const fieldNames = new Set(collection.fields.map((field) => field.name));
    if (!fieldNames.has('lat') || !fieldNames.has('lon')) return;
    const result = db.prepare(`UPDATE "${name}" SET lat = ?, lon = ?, updated = ? WHERE depicts_osm_type = ? AND depicts_osm_id = ? AND lat = 0 AND lon = 0`)
      .run(latitude, longitude, updated, osmType, osmId);
    count += Number(result.changes);
  });
  return count;
}

function readJsonBody(req, callback) {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 4096) req.destroy();
  });
  req.on('end', () => {
    try { callback(null, JSON.parse(body || '{}')); } catch (error) { callback(error); }
  });
}

function buildingContextIndex() {
  const contexts = new Map();
  heritageCollections.forEach((name) => {
    if (!collections.has(name)) return;
    const rows = db.prepare(`SELECT depicts_osm_type type, depicts_osm_id id, COUNT(*) count FROM "${name}" WHERE depicts_osm_type != '' AND depicts_osm_id > 0 GROUP BY depicts_osm_type, depicts_osm_id`).all();
    rows.forEach(({ type, id, count }) => {
      const key = `${type}/${id}`;
      const current = contexts.get(key) || { osmId: key, type, id, count: 0, collections: {} };
      current.count += count;
      current.collections[name] = count;
      contexts.set(key, current);
    });
  });
  return [...contexts.values()].sort((a, b) => b.count - a.count || a.osmId.localeCompare(b.osmId));
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.pdf': 'application/pdf', '.glb': 'model/gltf-binary', '.odt': 'application/vnd.oasis.opendocument.text',
};

function serveFile(res, path) {
  if (!existsSync(path) || !statSync(path).isFile()) return sendJson(res, 404, { error: 'File not found' });
  res.writeHead(200, { 'Content-Type': mimeTypes[extname(path).toLowerCase()] || 'application/octet-stream' });
  createReadStream(path).pipe(res);
}

function zipEntry(buffer, wantedName) {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('Invalid ODT container');
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ODT directory');
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const filename = buffer.toString('utf8', offset + 46, offset + 46 + filenameLength);
    if (filename === wantedName) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Invalid ODT entry');
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const contents = buffer.subarray(start, start + compressedSize);
      if (compression === 0) return contents;
      if (compression === 8) return inflateRawSync(contents);
      throw new Error('Unsupported ODT compression');
    }
    offset += 46 + filenameLength + extraLength + commentLength;
  }
  throw new Error('ODT document content is missing');
}

function decodeXmlEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, value) => {
    if (value[0] === '#') {
      const hexadecimal = value[1]?.toLowerCase() === 'x';
      return String.fromCodePoint(Number.parseInt(value.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
    }
    return named[value] ?? entity;
  });
}

function odtText(path) {
  const xml = zipEntry(readFileSync(path), 'content.xml').toString('utf8');
  const body = xml.match(/<office:text\b[^>]*>([\s\S]*?)<\/office:text>/)?.[1] || xml;
  return decodeXmlEntities(body
    .replace(/<text:s(?:\s[^>]*)?\/>/g, ' ')
    .replace(/<text:tab(?:\s[^>]*)?\/>/g, '\t')
    .replace(/<text:line-break(?:\s[^>]*)?\/>/g, '\n')
    .replace(/<\/(?:text:p|text:h)>/g, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function handleApiRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (parts[0] === 'api') ensureDatabase();

  if (parts[0] === 'api' && parts[1] === 'heritage' && parts[2] === 'upload-config' && parts.length === 3) {
    sendJson(res, 200, { demo: demoUploadsEnabled });
    return true;
  }

  if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'heritage'
    && parts[2] === 'uploads' && parts.length === 4 && uploadCollections.has(parts[3])) {
    demoUpload(req, res, parts[3]);
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'heritage' && parts[2] === 'contexts' && parts.length === 3) {
    const contexts = buildingContextIndex();
    sendJson(res, 200, { contexts, count: contexts.length });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'heritage' && parts.length === 4) {
    const [, , osmType, osmId] = parts;
    if (!/^(node|way|relation)$/.test(osmType) || !/^\d+$/.test(osmId)) {
      sendJson(res, 400, { error: 'Invalid OSM reference' });
      return true;
    }
    if (req.method === 'PATCH') {
      readJsonBody(req, (bodyError, body) => {
        const latitude = Number(body?.latitude);
        const longitude = Number(body?.longitude);
        if (bodyError || !Number.isFinite(latitude) || !Number.isFinite(longitude)
          || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
          || (latitude === 0 && longitude === 0)) {
          sendJson(res, 400, { error: 'Invalid building coordinates' });
          return;
        }
        const updated = updateMissingCoordinates(osmType, Number(osmId), latitude, longitude);
        sendJson(res, 200, { updated });
      });
      return true;
    }
    const records = recordsForBuilding(osmType, Number(osmId));
    sendJson(res, 200, { records, count: records.length });
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'files' && parts.length === 5) {
    const [, , name, id, filename] = parts;
    const collection = collections.get(name);
    if (!collection || !heritageCollections.includes(name)) { sendJson(res, 404, { error: 'Unknown collection' }); return true; }
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || filename !== basename(filename)) { sendJson(res, 400, { error: 'Invalid file path' }); return true; }
    const path = resolve(dataRoot, 'storage', collection.id, id, filename);
    const storageRoot = resolve(dataRoot, 'storage');
    if (relative(storageRoot, path).startsWith('..')) { sendJson(res, 400, { error: 'Invalid file path' }); return true; }
    serveFile(res, path);
    return true;
  }

  if (parts[0] === 'api' && parts[1] === 'odt' && parts.length === 5) {
    const [, , name, id, filename] = parts;
    const collection = collections.get(name);
    if (!collection || !heritageCollections.includes(name) || extname(filename).toLowerCase() !== '.odt') { sendJson(res, 404, { error: 'Unknown ODT document' }); return true; }
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || filename !== basename(filename)) { sendJson(res, 400, { error: 'Invalid file path' }); return true; }
    const path = resolve(dataRoot, 'storage', collection.id, id, filename);
    if (relative(resolve(dataRoot, 'storage'), path).startsWith('..') || !existsSync(path)) { sendJson(res, 404, { error: 'ODT document not found' }); return true; }
    try { sendJson(res, 200, { text: odtText(path) }); } catch { sendJson(res, 422, { error: 'ODT document could not be read' }); }
    return true;
  }

  return false;
}

export function handleProductionRequest(req, res) {
  if (handleApiRequest(req, res)) return;
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (process.env.NODE_ENV === 'production') {
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const candidate = resolve(staticRoot, requested);
    if (relative(staticRoot, candidate) && !relative(staticRoot, candidate).startsWith('..') && existsSync(candidate) && statSync(candidate).isFile()) return serveFile(res, candidate);
    return serveFile(res, join(staticRoot, 'index.html'));
  }

  return sendJson(res, 404, { error: 'Not found' });
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  createServer(handleProductionRequest).listen(port, () => console.log(`Heritage app listening on http://localhost:${port}`));
}
