export function parseOsmReference(osmId) {
  const match = String(osmId || '').match(/^(node|way|relation)\/(\d+)$/);
  return match ? { type: match[1], id: match[2] } : null;
}

async function pocketBaseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldError = Object.values(data.data ?? {})[0]?.message;
    throw new Error(fieldError || data.message || `PocketBase returned ${response.status}`);
  }
  return data;
}

export async function uploadArchiveItem(collection, values) {
  const body = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') body.append(key, value);
  });
  const response = await fetch(`/api/heritage/uploads/${encodeURIComponent(collection)}`, {
    method: 'POST',
    body,
  });
  return pocketBaseResponse(response);
}

export async function getBuildingArchive(osmId, { signal, location } = {}) {
  const reference = parseOsmReference(osmId);
  if (!reference) return [];
  if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
    const updateResponse = await fetch(`/api/heritage/${reference.type}/${reference.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(location),
      signal,
    });
    if (!updateResponse.ok) throw new Error(`Coordinate update returned ${updateResponse.status}`);
  }
  const response = await fetch(`/api/heritage/${reference.type}/${reference.id}`, { signal });
  if (!response.ok) throw new Error(`PocketBase API returned ${response.status}`);
  const data = await response.json();
  return data.records ?? [];
}

export async function getArchiveContexts({ signal } = {}) {
  const response = await fetch('/api/heritage/contexts', { signal });
  if (!response.ok) throw new Error(`PocketBase API returned ${response.status}`);
  const data = await response.json();
  return data.contexts ?? [];
}
