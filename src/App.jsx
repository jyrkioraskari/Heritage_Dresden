import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import geohash from 'ngeohash';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  getArchiveContexts,
  getBuildingArchive,
  parseOsmReference,
  uploadArchiveItem,
} from './pocketbase.js';

const DATA_URL = new URL('../export.geojson', import.meta.url).href;
const BRIDGES_URL = new URL('../bridges.geojson', import.meta.url).href;
const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const REVERSE_GEOCODER_URL = 'https://nominatim.openstreetmap.org/reverse';
const BUILDING_SOURCE = 'heritage-buildings';
const BUILDING_LAYER = 'heritage-buildings-3d';
const BRIDGE_SOURCE = 'heritage-bridges';
const BRIDGE_FILL_LAYER = 'heritage-bridges-fill';
const BRIDGE_LINE_LAYER = 'heritage-bridges-line';
const DRESDEN_CENTER_BUILDING_ID = 'way/22903446';
const DRESDEN_CENTER_GEOHASH = 'u31f23tbm';
const DRESDEN_BUILDING_ZOOM = 17;
const ARCHIVE_LABELS = {
  bldg_photographs: 'Photograph', bldg_plans: 'Plan', bldg_3D: '3D scan', bldg_texts: 'Text', maps: 'Map',
};
const IMAGE_FILE = /\.(?:jpe?g|png|gif|webp)$/i;
const PDF_FILE = /\.pdf$/i;
const GLB_FILE = /\.(?:glb|gltf)$/i;
const ODT_FILE = /\.odt$/i;
const HIDDEN_RECORD_FIELDS = new Set(['collection', 'collectionId', 'collectionName', 'expand', 'fileUrl', 'association']);

function hasRecordValue(key, value, record) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== '-' && value.trim() !== '—';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (value === 0) {
    if (key === 'floorplan_x' || key === 'floorplan_y') return record.placement_scope === 'point';
    return ['floor_plan_floor_number', 'building_level', 'depicts_osm_id'].includes(key);
  }
  return true;
}

function isPdfRecord(record) {
  return PDF_FILE.test(record.file || '') || String(record.format || '').toLowerCase() === 'pdf';
}

function pdfPreviewUrl(fileUrl) {
  return `${fileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
}

function isGlbRecord(record) {
  return GLB_FILE.test(record.file || '') || /^(?:glb|gltf)$/i.test(String(record.format || ''));
}

function isOdtRecord(record) {
  return ODT_FILE.test(record.file || '') || String(record.format || '').toLowerCase() === 'odt';
}

function OdtViewer({ fileUrl, title }) {
  const [content, setContent] = useState({ state: 'loading', text: '' });

  useEffect(() => {
    const controller = new AbortController();
    const previewUrl = fileUrl.replace('/api/files/', '/api/odt/');
    fetch(previewUrl, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('ODT preview failed')))
      .then((data) => setContent({ state: 'ready', text: data.text }))
      .catch((error) => {
        if (error.name !== 'AbortError') setContent({ state: 'error', text: '' });
      });
    return () => controller.abort();
  }, [fileUrl]);

  return (
    <section className="record-dialog-odt" aria-label={`Preview of ${title}`}>
      <div className="odt-preview-heading"><span>ODT document preview</span><b>ODT</b></div>
      {content.state === 'loading' && <p className="odt-message">Opening document…</p>}
      {content.state === 'error' && <p className="odt-message odt-error">The document preview could not be loaded.</p>}
      {content.state === 'ready' && <div className="odt-content">{content.text || 'This document contains no previewable text.'}</div>}
    </section>
  );
}

function GlbViewer({ fileUrl, title }) {
  const hostRef = useRef(null);
  const [viewerState, setViewerState] = useState('loading');

  useEffect(() => {
    const host = hostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1210);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.screenSpacePanning = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x344039, 2.5));
    const keyLight = new THREE.DirectionalLight(0xfff1d6, 3);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xa8cfff, 1.5);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    let model = null;
    let disposed = false;
    const loader = new GLTFLoader();
    loader.load(fileUrl, (gltf) => {
      if (disposed) return;
      model = gltf.scene;
      scene.add(model);
      const bounds = new THREE.Box3().setFromObject(model);
      if (bounds.isEmpty()) {
        setViewerState('error');
        return;
      }
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      model.position.sub(center);
      const radius = Math.max(size.length() / 2, 0.01);
      const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
      controls.target.set(0, 0, 0);
      camera.position.set(1, 0.65, 1).normalize().multiplyScalar(distance * 1.1);
      camera.near = Math.max(radius / 1000, 0.001);
      camera.far = radius * 100;
      camera.updateProjectionMatrix();
      controls.update();
      setViewerState('ready');
    }, undefined, () => {
      if (!disposed) setViewerState('error');
    });

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      model?.traverse((object) => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value?.isTexture) value.dispose();
          });
          material.dispose();
        });
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [fileUrl]);

  return (
    <div className="record-dialog-glb">
      <div ref={hostRef} className="glb-canvas" role="img" aria-label={`Interactive 3D preview of ${title}`} />
      {viewerState === 'loading' && <p className="glb-status">Loading 3D model…</p>}
      {viewerState === 'error' && <p className="glb-status glb-error">The 3D preview could not be loaded.</p>}
      {viewerState === 'ready' && <p className="glb-hint">Drag to rotate · Scroll to zoom · Right-drag to pan</p>}
    </div>
  );
}

function formatRecordLabel(key) {
  return key
    .replace(/^depicts_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRecordValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function RecordValue({ value }) {
  const text = formatRecordValue(value);
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/gi);
  return parts.map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    const match = part.match(/^(.*?)([),.;!?]*)$/);
    const url = match[1];
    const trailing = match[2];
    return (
      <span key={`${url}-${index}`}>
        <a href={url} target="_blank" rel="noreferrer">{url}</a>{trailing}
      </span>
    );
  });
}

function numericValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  return Number.parseFloat(value.replace(',', '.'));
}

function buildingHeight(properties) {
  const explicitHeight = numericValue(properties.height);
  if (Number.isFinite(explicitHeight)) return Math.max(explicitHeight, 1);
  const levels = numericValue(properties['building:levels']);
  if (Number.isFinite(levels)) return Math.max(levels * 3, 3);
  return 10;
}

function geometryPolygons(geometry) {
  if (geometry?.type === 'Polygon') return 1;
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates.length;
  return 0;
}

function geoJsonBounds(features) {
  const bounds = new maplibregl.LngLatBounds();
  const visit = (coordinates) => {
    if (typeof coordinates?.[0] === 'number') bounds.extend(coordinates);
    else coordinates?.forEach(visit);
  };
  features.forEach((feature) => visit(feature.geometry?.coordinates));
  return bounds;
}

function geometryLocation(geometry) {
  const points = [];
  const visit = (coordinates) => {
    if (typeof coordinates?.[0] === 'number') points.push(coordinates);
    else coordinates?.forEach(visit);
  };
  visit(geometry?.coordinates);
  if (!points.length) return null;

  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  return {
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
  };
}

function wikipediaDetails(tag) {
  if (!tag) return null;
  const separator = tag.indexOf(':');
  const language = separator > 0 ? tag.slice(0, separator) : 'de';
  const article = separator > 0 ? tag.slice(separator + 1) : tag;
  if (!article) return null;
  return {
    title: article.replaceAll('_', ' '),
    url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(article.replaceAll(' ', '_'))}`,
  };
}

function featureDetails(feature) {
  const properties = feature.properties ?? {};
  const location = geometryLocation(feature.geometry);
  const wikipedia = wikipediaDetails(properties.wikipedia);
  const description = properties['description:de'] || properties.description;
  const conciseDescription = description?.split(/[.;]\s/)[0].trim();
  const streetAddress = [
    properties['addr:street'] || properties['addr:place'],
    properties['addr:housenumber'],
  ].filter(Boolean).join(' ');
  const locality = [
    properties['addr:postcode'],
    properties['addr:city'] || properties['addr:suburb'],
  ].filter(Boolean).join(' ');
  const address = [streetAddress, locality].filter(Boolean).join(', ');
  const name = properties.name
    || properties['name:de']
    || properties['name:en']
    || properties['name:uk']
    || properties.official_name
    || properties.alt_name
    || properties.short_name
    || properties.old_name
    || wikipedia?.title
    || (conciseDescription?.length <= 100 ? conciseDescription : null)
    || address
    || (location
      ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
      : 'Unnamed building');
  return {
    kind: 'building',
    name,
    address: address || 'No address in OpenStreetMap',
    district: properties['addr:district'] || properties['is_in:district'] || properties['addr:suburb'],
    description,
    wikipediaUrl: wikipedia?.url,
    wikidataUrl: properties.wikidata
      ? `https://www.wikidata.org/wiki/${encodeURIComponent(properties.wikidata)}`
      : null,
    type: properties.building || 'building',
    levels: numericValue(properties['building:levels']) > 0
      ? String(Math.round(numericValue(properties['building:levels'])))
      : '1',
    height: properties.height,
    osmId: properties['@id'],
    renderHeight: properties._renderHeight,
    geometry: feature.geometry,
    location,
    geohash: location ? geohash.encode(location.latitude, location.longitude, 9) : null,
  };
}

function bridgeDetails(feature) {
  const properties = feature.properties ?? {};
  const location = geometryLocation(feature.geometry);
  const wikipedia = wikipediaDetails(properties.wikipedia);
  return {
    kind: 'bridge',
    name: properties.name || properties.official_name || properties.alt_name || wikipedia?.title || 'Unnamed bridge',
    description: properties.description || properties.note,
    type: properties['bridge:structure'] || properties.bridge || 'bridge',
    material: properties.material,
    date: properties.construction_date || properties.start_date,
    length: properties.length,
    osmId: properties['@id'],
    geometry: feature.geometry,
    location,
    geohash: location ? geohash.encode(location.latitude, location.longitude, 9) : null,
    wikipediaUrl: wikipedia?.url,
    wikidataUrl: properties.wikidata ? `https://www.wikidata.org/wiki/${encodeURIComponent(properties.wikidata)}` : null,
  };
}

function BuildingPreview({ building, levelAssociations = [], onLevelSelect, onRotationChange }) {
  const hostRef = useRef(null);
  const itemCountByLevel = new Map();
  levelAssociations.forEach((association) => {
    if (association.level === null || association.scope === 'building') return;
    itemCountByLevel.set(
      String(association.level),
      (itemCountByLevel.get(String(association.level)) || 0) + 1,
    );
  });
  const associatedItemCount = [...itemCountByLevel.values()].reduce((sum, count) => sum + count, 0);

  useEffect(() => {
    const host = hostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171e1a);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI / 2.05;
    const reportRotation = () => onRotationChange(controls.getAzimuthalAngle());
    controls.addEventListener('change', reportRotation);

    const coordinates = building.geometry.type === 'Polygon'
      ? [building.geometry.coordinates]
      : building.geometry.coordinates;
    const origin = coordinates[0][0][0];
    const latitudeScale = Math.cos(THREE.MathUtils.degToRad(origin[1]));
    const project = ([lon, lat]) => new THREE.Vector2(
      (lon - origin[0]) * 111320 * latitudeScale,
      (lat - origin[1]) * 111320,
    );
    const model = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x248cff, roughness: 0.68, metalness: 0.03 });
    const associatedMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9362b,
      emissive: 0x53100b,
      emissiveIntensity: 0.32,
      roughness: 0.58,
      metalness: 0.03,
    });
    const selectedMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc857,
      emissive: 0x5c3600,
      emissiveIntensity: 0.35,
      roughness: 0.55,
      metalness: 0.04,
    });

    const levelCount = Math.max(1, Math.round(Number(building.levels) || 1));
    const originalHeight = Number(building.renderHeight) || 10;
    const totalHeight = Math.max(originalHeight, levelCount * 3);
    const floorHeight = totalHeight / levelCount;
    const floorGap = Math.min(0.16, floorHeight * 0.04);
    coordinates.forEach((polygon) => {
      const shape = new THREE.Shape(polygon[0].map(project));
      polygon.slice(1).forEach((ring) => shape.holes.push(new THREE.Path(ring.map(project))));
      for (let level = 0; level < levelCount; level += 1) {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: Math.max(floorHeight - floorGap, floorHeight * 0.9),
          bevelEnabled: false,
          curveSegments: 1,
        });
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, level * floorHeight, 0);
        const itemCount = itemCountByLevel.get(String(level)) || 0;
        const mesh = new THREE.Mesh(geometry, itemCount ? associatedMaterial : material);
        mesh.userData.level = level;
        mesh.userData.itemCount = itemCount;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        model.add(mesh);
      }
    });
    scene.add(model);

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    model.position.sub(center);
    model.position.y += size.y / 2;
    const span = Math.max(size.x, size.y, size.z, 10);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(span * 0.85, 64),
      new THREE.MeshStandardMaterial({ color: 0x303a34, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x344039, 2.2));
    const sun = new THREE.DirectionalLight(0xffeed0, 3.4);
    sun.position.set(span, span * 1.8, span);
    sun.castShadow = true;
    scene.add(sun);

    controls.target.set(0, size.y * 0.35, 0);
    camera.position.set(span * 1.25, span * 0.9, span * 1.25);
    camera.near = Math.max(span / 1000, 0.05);
    camera.far = span * 20;
    camera.updateProjectionMatrix();
    controls.update();
    reportRotation();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown = null;
    const onPointerDown = (event) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event) => {
      if (!pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) {
        pointerDown = null;
        return;
      }
      pointerDown = null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(model.children, false)[0];
      const selectedLevel = hit?.object.userData.level ?? null;
      model.children.forEach((mesh) => {
        mesh.material = mesh.userData.level === selectedLevel
          ? selectedMaterial
          : (mesh.userData.itemCount ? associatedMaterial : material);
      });
      onLevelSelect(selectedLevel);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener('change', reportRotation);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.forceContextLoss();
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material && object.material !== material
          && object.material !== associatedMaterial && object.material !== selectedMaterial) {
          object.material.dispose();
        }
      });
      material.dispose();
      associatedMaterial.dispose();
      selectedMaterial.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [building, levelAssociations]);

  return (
    <>
      <div
        ref={hostRef}
        className="building-preview"
        aria-label={`Interactive 3D model of selected building. ${associatedItemCount} level-associated items.`}
      />
      {associatedItemCount > 0 && (
        <p className="level-data-legend"><i /> Red levels contain linked items ({associatedItemCount})</p>
      )}
    </>
  );
}

function FloorplanPreview({ building, level, rotation, placements = [] }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => setZoom(1), [building.osmId, level]);
  const polygons = building.geometry.type === 'Polygon'
    ? [building.geometry.coordinates]
    : building.geometry.coordinates;
  const points = polygons.flat(2);
  const minLon = Math.min(...points.map(([lon]) => lon));
  const maxLon = Math.max(...points.map(([lon]) => lon));
  const minLat = Math.min(...points.map(([, lat]) => lat));
  const maxLat = Math.max(...points.map(([, lat]) => lat));
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const longitudeScale = Math.cos(THREE.MathUtils.degToRad(centerLat));
  const spanX = (maxLon - minLon) * longitudeScale;
  const scale = Math.min(180 / Math.max(spanX, 1e-9), 180 / Math.max(maxLat - minLat, 1e-9));
  const pathData = polygons.map((polygon) => polygon.map((ring) => (
    `${ring.map(([lon, lat], index) => (
      `${index ? 'L' : 'M'} ${((lon - centerLon) * longitudeScale * scale).toFixed(2)} ${(-(lat - centerLat) * scale).toFixed(2)}`
    )).join(' ')} Z`
  )).join(' ')).join(' ');

  return (
    <div className="floorplan-wrap">
      <div className="floorplan-heading">
        <span>2D floorplan</span>
        <div className="floorplan-tools">
          <strong>Level {level}</strong>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value / 1.25))} aria-label="Zoom floorplan out">−</button>
          <button type="button" onClick={() => setZoom((value) => Math.min(6, value * 1.25))} aria-label="Zoom floorplan in">+</button>
        </div>
      </div>
      <svg className="floorplan" viewBox="-110 -110 220 220" role="img" aria-label={`Floorplan for level ${level}`}>
        <g transform={`rotate(${THREE.MathUtils.radToDeg(rotation)})`}>
          <g transform={`scale(${zoom})`}>
            <path d={pathData} fill="#ffc857" fillRule="evenodd" stroke="#ffe0a0" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {placements.map((placement) => (
              <circle
                key={placement.id}
                cx={placement.point.x * 200 - 100}
                cy={placement.point.y * 200 - 100}
                r="5"
                className="floorplan-marker"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </g>
        <circle cx="0" cy="0" r="2.5" fill="#f5f0e7" />
      </svg>
    </div>
  );
}

function hideBaseBuildingLayers(map) {
  map.getStyle().layers.forEach((layer) => {
    const isBuildingGeometry = layer['source-layer'] === 'building'
      && (layer.type === 'fill' || layer.type === 'fill-extrusion' || layer.type === 'line');
    if (isBuildingGeometry) map.setLayoutProperty(layer.id, 'visibility', 'none');
  });
}

function RecordDialog({ record, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const title = record.name || record.description_en || record.description || record.id;
  const fields = Object.entries(record).filter(([key, value]) => (
    !HIDDEN_RECORD_FIELDS.has(key) && hasRecordValue(key, value, record)
  ));

  return (
    <div className="record-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="record-dialog" role="dialog" aria-modal="true" aria-labelledby="record-dialog-title">
        <header className="record-dialog-header">
          <div>
            <p className="panel-label">{ARCHIVE_LABELS[record.collection] || record.collection}</p>
            <h2 id="record-dialog-title">{title}</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="record-dialog-close" onClick={onClose} aria-label="Close item details">×</button>
        </header>
        <div className="record-dialog-content">
          {record.fileUrl && IMAGE_FILE.test(record.file) && (
            <a href={record.fileUrl} target="_blank" rel="noreferrer" className="record-dialog-image">
              <img src={record.fileUrl} alt={title} />
            </a>
          )}
          {record.fileUrl && isPdfRecord(record) && (
            <a href={record.fileUrl} target="_blank" rel="noreferrer" className="record-dialog-pdf" aria-label={`Open ${title} PDF`}>
              <iframe src={pdfPreviewUrl(record.fileUrl)} title={`Preview of ${title}`} loading="lazy" />
            </a>
          )}
          {record.fileUrl && isGlbRecord(record) && <GlbViewer fileUrl={record.fileUrl} title={title} />}
          {record.fileUrl && isOdtRecord(record) && <OdtViewer fileUrl={record.fileUrl} title={title} />}
          <dl className="record-fields">
            {fields.map(([key, value]) => (
              <div key={key}>
                <dt>{formatRecordLabel(key)}</dt>
                <dd><RecordValue value={value} /></dd>
              </div>
            ))}
          </dl>
        </div>
        {record.fileUrl && (
          <footer className="record-dialog-footer">
            <a href={record.fileUrl} target="_blank" rel="noreferrer">Open original {record.format?.toUpperCase() || 'file'} ↗</a>
          </footer>
        )}
      </section>
    </div>
  );
}

const UPLOAD_COLLECTIONS = {
  bldg_photographs: { label: 'Photograph', accept: 'image/jpeg,image/png,image/webp,image/gif' },
  bldg_plans: { label: 'Plan or drawing', accept: 'image/jpeg,image/png,image/webp,application/pdf,.pdf' },
  bldg_3D: { label: '3D model', accept: '.glb,.gltf,.obj,model/gltf-binary,model/gltf+json' },
  bldg_texts: { label: 'Document', accept: 'application/pdf,.pdf,.odt' },
};
const UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.odt,.glb,.gltf,.obj,model/gltf-binary,model/gltf+json';

function collectionForFile(file) {
  const extension = file?.name.split('.').pop()?.toLowerCase();
  if (file?.type.startsWith('image/')) return 'bldg_photographs';
  if (file?.type === 'application/pdf' || extension === 'pdf') return 'bldg_plans';
  if (['glb', 'gltf', 'obj'].includes(extension)) return 'bldg_3D';
  if (extension === 'odt') return 'bldg_texts';
  return null;
}

function UploadDialog({ building, selectedLevel, onClose, onUploaded }) {
  const dialogRef = useRef(null);
  const [collection, setCollection] = useState('bldg_photographs');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    dialogRef.current?.focus();
    const closeOnEscape = (event) => { if (event.key === 'Escape' && state !== 'saving') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, state]);

  const upload = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reference = parseOsmReference(building.osmId);
    const file = form.get('file');
    if (!reference || !(file instanceof File) || !file.size) return;
    setState('saving');
    setError('');
    try {
      const descriptionField = collection === 'bldg_photographs' || collection === 'bldg_texts'
        ? 'description_en'
        : 'description';
      const sourceField = collection === 'bldg_photographs' ? 'source_url' : 'source';
      const values = {
        file,
        name: form.get('name'),
        [descriptionField]: form.get('description'),
        depicts_osm_type: reference.type,
        depicts_osm_id: reference.id,
        placement_scope: selectedLevel === null ? 'building' : 'level',
        building_level: selectedLevel === null ? '' : String(selectedLevel),
      };
      if (collection !== 'bldg_3D') values[sourceField] = form.get('source');
      if (collection === 'bldg_photographs' && building.location) {
        values.lat = building.location.latitude;
        values.lon = building.location.longitude;
      }
      await uploadArchiveItem(collection, values);
      onUploaded();
    } catch (requestError) {
      setError(requestError.message);
      setState('idle');
    }
  };

  return (
    <div className="record-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && state !== 'saving') onClose();
    }}>
      <section ref={dialogRef} className="upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-title" tabIndex="-1">
        <header className="record-dialog-header">
          <div><p className="panel-label">Add material</p><h2 id="upload-title">Add to {building.name}</h2></div>
          <button type="button" className="record-dialog-close" onClick={onClose} disabled={state === 'saving'} aria-label="Close upload dialog">×</button>
        </header>
        <form className="upload-form" onSubmit={upload}>
            <label>File
              <input
                name="file"
                type="file"
                accept={UPLOAD_ACCEPT}
                required
                onChange={(event) => {
                  const detectedCollection = collectionForFile(event.target.files?.[0]);
                  if (detectedCollection) setCollection(detectedCollection);
                }}
              />
            </label>
            <label>Material type
              <select value={collection} onChange={(event) => setCollection(event.target.value)}>
                {Object.entries(UPLOAD_COLLECTIONS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
              </select>
            </label>
            <p className="upload-association">
              {selectedLevel === null
                ? `Associated with the whole ${building.kind === 'bridge' ? 'bridge' : 'building'}`
                : `Associated with Level ${selectedLevel}`}
            </p>
            <label>Title<input name="name" type="text" required maxLength="300" /></label>
            <label>Description<textarea name="description" rows="3" /></label>
            {collection !== 'bldg_3D' && <label>Source URL<input name="source" type="url" /></label>}
            {error && <p className="upload-error">{error}</p>}
            <button className="upload-submit" type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Uploading…' : 'Upload item'}</button>
        </form>
      </section>
    </div>
  );
}

function recordAssociation(record) {
  const rawLevel = record.building_level !== undefined
    && record.building_level !== null
    && record.building_level !== ''
    ? record.building_level
    : record.floor_plan_floor_number;
  const hasLevel = rawLevel !== undefined && rawLevel !== null && rawLevel !== '';
  const declaredScope = record.placement_scope || record.association_scope;
  const x = Number(record.floorplan_x);
  const y = Number(record.floorplan_y);
  const hasPoint = declaredScope === 'point'
    && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1;
  const scope = hasPoint ? 'point' : (hasLevel ? 'level' : (declaredScope || 'building'));
  return {
    scope,
    level: hasLevel ? String(rawLevel) : null,
    point: hasPoint ? { x, y } : null,
  };
}

function associationLabel(association, kind = 'building') {
  if (association.scope === 'point') return association.level === null
    ? 'Located point'
    : `Level ${association.level} · located point`;
  if (association.scope === 'area') return association.level === null
    ? 'Located area'
    : `Level ${association.level} · located area`;
  if (association.scope === 'level') return `Level ${association.level}`;
  return kind === 'bridge' ? 'Whole bridge' : 'Whole building';
}

function ArchiveRecords({ building, selectedLevel, onAssociationsChange }) {
  const { osmId, location } = building;
  const [records, setRecords] = useState([]);
  const [state, setState] = useState('loading');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [filter, setFilter] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRecords([]);
    setSelectedRecord(null);
    setFilter('all');
    setState('loading');
    getBuildingArchive(osmId, { signal: controller.signal, location })
      .then((items) => { setRecords(items); setState('ready'); })
      .catch((requestError) => { if (requestError.name !== 'AbortError') setState('error'); });
    return () => controller.abort();
  }, [osmId, location, refreshIndex]);

  const associatedRecords = records.map((record) => ({
    ...record,
    association: recordAssociation(record),
  }));
  const visibleRecords = associatedRecords.filter((record) => {
    if (filter === 'building') return record.association.scope === 'building';
    if (filter === 'level') {
      return record.association.level === String(selectedLevel);
    }
    return true;
  });

  useEffect(() => {
    onAssociationsChange?.(associatedRecords.map((record) => ({
      id: `${record.collection}-${record.id}`,
      ...record.association,
    })));
    return () => onAssociationsChange?.([]);
  }, [records, onAssociationsChange]);

  return (
    <section className="archive-records">
      <div className="archive-heading">
        <span>Data collection {state === 'ready' && <strong>{records.length}</strong>}</span>
        <button type="button" className="archive-upload-button" onClick={() => setUploadOpen(true)}>+ Upload</button>
      </div>
      {state === 'ready' && records.length > 0 && (
        <div className="archive-filters" aria-label="Filter archive items by association">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={filter === 'building' ? 'active' : ''} onClick={() => setFilter('building')}>{building.kind === 'bridge' ? 'Bridge' : 'Building'}</button>
          {building.kind !== 'bridge' && (
            <button
              type="button"
              className={filter === 'level' ? 'active' : ''}
              disabled={selectedLevel === null}
              onClick={() => setFilter('level')}
            >
              {selectedLevel === null ? 'Select a level' : `Level ${selectedLevel}`}
            </button>
          )}
        </div>
      )}
      {state === 'loading' && <p className="archive-message">Looking for linked records…</p>}
      {state === 'error' && <p className="archive-message archive-error">The data collection could not be loaded.</p>}
      {state === 'ready' && !records.length && <p className="archive-message">No archive records are linked to this item.</p>}
      {state === 'ready' && records.length > 0 && !visibleRecords.length && (
        <p className="archive-message">No archive items match this association.</p>
      )}
      {visibleRecords.map((record) => (
        <article
          className="archive-card"
          key={`${record.collection}-${record.id}`}
          role="button"
          tabIndex="0"
          onClick={() => setSelectedRecord(record)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setSelectedRecord(record);
            }
          }}
          aria-label={`View details for ${record.name || record.description || record.id}`}
        >
          {record.fileUrl && IMAGE_FILE.test(record.file) && <img src={record.fileUrl} alt="" loading="lazy" />}
          {record.fileUrl && isPdfRecord(record) && (
            <div className="archive-card-pdf" aria-hidden="true">
              <iframe src={pdfPreviewUrl(record.fileUrl)} title="" loading="lazy" tabIndex="-1" />
              <span>PDF</span>
            </div>
          )}
          {record.fileUrl && isOdtRecord(record) && (
            <div className="archive-card-odt" aria-hidden="true"><span>ODT</span><i>≡</i></div>
          )}
          <div>
            <div className="archive-card-meta">
              <span>{ARCHIVE_LABELS[record.collection] || record.collection}</span>
              <span className={`association-badge ${record.association.scope}`}>{associationLabel(record.association, building.kind)}</span>
            </div>
            <h3>{record.name || record.description || record.id}</h3>
            {(record.description_en || record.description) && <p>{record.description_en || record.description}</p>}
            <button type="button" className="archive-card-action">View database record →</button>
          </div>
        </article>
      ))}
      {selectedRecord && <RecordDialog record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
      {uploadOpen && (
        <UploadDialog
          building={building}
          selectedLevel={selectedLevel}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            setRefreshIndex((current) => current + 1);
          }}
        />
      )}
    </section>
  );
}

export default function App() {
  const mapHostRef = useRef(null);
  const levelOverridesRef = useRef(new Map());
  const locationCacheRef = useRef(new Map());
  const [status, setStatus] = useState('Loading vector map…');
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [archiveContexts, setArchiveContexts] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedBridge, setSelectedBridge] = useState(null);
  const [onlineLocation, setOnlineLocation] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [archiveAssociations, setArchiveAssociations] = useState([]);
  const [previewRotation, setPreviewRotation] = useState(0);
  const selectedSubject = selectedBuilding || selectedBridge;

  useEffect(() => {
    setOnlineLocation(null);
    const { geohash: locationKey, location } = selectedSubject ?? {};
    if (!locationKey || !location || navigator.onLine === false) return undefined;

    const cached = locationCacheRef.current.get(locationKey);
    if (cached) {
      setOnlineLocation(cached);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          format: 'jsonv2',
          lat: String(location.latitude),
          lon: String(location.longitude),
          zoom: '18',
          addressdetails: '1',
          extratags: '1',
          namedetails: '1',
          'accept-language': navigator.language || 'de',
        });
        const response = await fetch(`${REVERSE_GEOCODER_URL}?${query}`, { signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json();
        const address = result.address ?? {};
        const details = {
          district: address.city_district || address.borough || address.suburb
            || address.quarter || address.neighbourhood,
          locality: address.city || address.town || address.village || address.municipality,
          displayName: result.display_name,
          category: result.type,
          website: result.extratags?.website || result.extratags?.['contact:website'],
        };
        locationCacheRef.current.set(locationKey, details);
        setOnlineLocation(details);
      } catch {
        // Online enrichment is optional; offline and blocked requests are intentionally silent.
      }
    }, 1100);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedSubject?.geohash]);

  useEffect(() => {
    let cancelled = false;
    let selectedId = null;
    let selectedBridgeId = null;
    let sourceFeatures = [];
    let sourceFeatureByOsmId = new Map();
    let bridgeFeatures = [];
    let bridgeFeatureByOsmId = new Map();
    let buildingHandlersAttached = false;
    const map = new maplibregl.Map({
      container: mapHostRef.current,
      style: VECTOR_STYLE_URL,
      center: [13.7373, 51.0504],
      zoom: 12,
      pitch: 58,
      bearing: -22,
      antialias: true,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');

    const selectBuilding = (feature) => {
      if (selectedBridgeId !== null) {
        map.setFeatureState({ source: BRIDGE_SOURCE, id: selectedBridgeId }, { selected: false });
        selectedBridgeId = null;
      }
      if (selectedId !== null) {
        map.setFeatureState({ source: BUILDING_SOURCE, id: selectedId }, { selected: false });
      }
      selectedId = feature?.id ?? null;
      if (selectedId !== null) {
        map.setFeatureState({ source: BUILDING_SOURCE, id: selectedId }, { selected: true });
      }
      const sourceFeature = feature && (
        sourceFeatureByOsmId.get(feature.properties?.['@id'])
        || sourceFeatures[Number(feature.id)]
      );
      if (!sourceFeature) {
        setSelectedBuilding(null);
        setSelectedBridge(null);
        setSelectedLevel(null);
        setArchiveAssociations([]);
        setPreviewRotation(0);
        return;
      }
      const details = featureDetails(sourceFeature);
      const overriddenLevels = levelOverridesRef.current.get(details.osmId);
      if (overriddenLevels !== undefined) details.levels = overriddenLevels;
      setSelectedBuilding(details);
      setSelectedBridge(null);
      setSelectedLevel(null);
      setArchiveAssociations([]);
      setPreviewRotation(0);
    };

    const selectBridge = (feature) => {
      if (selectedId !== null) {
        map.setFeatureState({ source: BUILDING_SOURCE, id: selectedId }, { selected: false });
        selectedId = null;
      }
      if (selectedBridgeId !== null) {
        map.setFeatureState({ source: BRIDGE_SOURCE, id: selectedBridgeId }, { selected: false });
      }
      selectedBridgeId = feature?.id ?? null;
      if (selectedBridgeId !== null) {
        map.setFeatureState({ source: BRIDGE_SOURCE, id: selectedBridgeId }, { selected: true });
      }
      const sourceFeature = feature && (
        bridgeFeatureByOsmId.get(feature.properties?.['@id'])
        || bridgeFeatures[Number(feature.id)]
      );
      setSelectedBuilding(null);
      setSelectedBridge(sourceFeature ? bridgeDetails(sourceFeature) : null);
      setSelectedLevel(null);
      setArchiveAssociations([]);
      setPreviewRotation(0);
    };

    const onBuildingMouseMove = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onBuildingMouseLeave = () => { map.getCanvas().style.cursor = ''; };
    const onMapClick = (event) => {
      if (!map.getLayer(BUILDING_LAYER)) return;
      const tolerance = 8;
      const hitBox = [
        [event.point.x - tolerance, event.point.y - tolerance],
        [event.point.x + tolerance, event.point.y + tolerance],
      ];
      const bridge = map.queryRenderedFeatures(hitBox, { layers: [BRIDGE_FILL_LAYER, BRIDGE_LINE_LAYER] })[0];
      if (bridge) {
        selectBridge(bridge);
        return;
      }
      const building = map.queryRenderedFeatures(event.point, { layers: [BUILDING_LAYER] })[0];
      selectBuilding(building ?? null);
    };

    map.on('load', async () => {
      try {
        setStatus('Loading buildings…');
        const [response, bridgesResponse, contexts] = await Promise.all([
          fetch(DATA_URL),
          fetch(BRIDGES_URL),
          getArchiveContexts().catch(() => []),
        ]);
        if (!response.ok) throw new Error(`Could not load export.geojson (${response.status})`);
        if (!bridgesResponse.ok) throw new Error(`Could not load bridges.geojson (${bridgesResponse.status})`);
        const geojson = await response.json();
        const bridgesGeojson = await bridgesResponse.json();
        if (cancelled) return;

        const contextByOsmId = new Map(contexts.map((context) => [context.osmId, context]));
        const features = geojson.features.filter((feature) => geometryPolygons(feature.geometry));
        features.forEach((feature) => {
          const context = contextByOsmId.get(feature.properties?.['@id']);
          feature.properties = {
            ...(feature.properties ?? {}),
            _renderHeight: buildingHeight(feature.properties ?? {}),
            _archiveCount: context?.count || 0,
          };
        });
        geojson.features = features;
        sourceFeatures = features;
        sourceFeatureByOsmId = new Map(features.map((feature) => [feature.properties?.['@id'], feature]));
        bridgeFeatures = bridgesGeojson.features ?? [];
        bridgeFeatureByOsmId = new Map(bridgeFeatures.map((feature) => [feature.properties?.['@id'], feature]));
        const mappedOsmIds = new Set([
          ...features.map((feature) => feature.properties?.['@id']),
          ...bridgeFeatures.map((feature) => feature.properties?.['@id']),
        ]);
        setArchiveContexts(contexts.map((context) => ({
          ...context,
          located: mappedOsmIds.has(context.osmId),
        })));

        hideBaseBuildingLayers(map);
        map.addSource(BUILDING_SOURCE, { type: 'geojson', data: geojson, generateId: true });
        const firstLabelLayer = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
        map.addLayer({
          id: BUILDING_LAYER,
          source: BUILDING_SOURCE,
          type: 'fill-extrusion',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              '#62b9ff',
              ['>', ['get', '_archiveCount'], 0],
              '#d9362b',
              [
                'any',
                ['has', 'historic'],
                ['has', 'heritage'],
                ['has', 'architect'],
                ['has', 'wikipedia'],
              ],
              '#8b5cf6',
              '#b9a990',
            ],
            'fill-extrusion-height': ['get', '_renderHeight'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.94,
            'fill-extrusion-vertical-gradient': true,
          },
        }, firstLabelLayer);
        map.addSource(BRIDGE_SOURCE, { type: 'geojson', data: bridgesGeojson, generateId: true });
        map.addLayer({
          id: BRIDGE_FILL_LAYER,
          source: BRIDGE_SOURCE,
          type: 'fill',
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#ffc857', '#20c7d9'],
            'fill-opacity': 0.68,
            'fill-outline-color': '#b8f7ff',
          },
        }, firstLabelLayer);
        map.addLayer({
          id: BRIDGE_LINE_LAYER,
          source: BRIDGE_SOURCE,
          type: 'line',
          paint: {
            'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#ffc857', '#35d8e8'],
            'line-opacity': 0.92,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2.5, 18, 6],
          },
        }, firstLabelLayer);

        const dresdenCenterFeature = sourceFeatureByOsmId.get(DRESDEN_CENTER_BUILDING_ID);
        if (dresdenCenterFeature) {
          const dresdenCenter = geohash.decode(DRESDEN_CENTER_GEOHASH);
          map.jumpTo({
            center: [dresdenCenter.longitude, dresdenCenter.latitude],
            zoom: DRESDEN_BUILDING_ZOOM,
          });
        } else {
          map.fitBounds(geoJsonBounds(features), { padding: 42, duration: 0 });
        }
        map.setPitch(58);
        map.setBearing(-22);
        setStats({
          buildings: features.length,
          polygons: features.reduce((sum, feature) => sum + geometryPolygons(feature.geometry), 0),
          bridges: bridgesGeojson.features?.length || 0,
        });
        setStatus('');

        map.on('mousemove', BUILDING_LAYER, onBuildingMouseMove);
        map.on('mouseleave', BUILDING_LAYER, onBuildingMouseLeave);
        map.on('mousemove', BRIDGE_FILL_LAYER, onBuildingMouseMove);
        map.on('mouseleave', BRIDGE_FILL_LAYER, onBuildingMouseLeave);
        map.on('mousemove', BRIDGE_LINE_LAYER, onBuildingMouseMove);
        map.on('mouseleave', BRIDGE_LINE_LAYER, onBuildingMouseLeave);
        map.on('click', onMapClick);
        buildingHandlersAttached = true;
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
          setStatus('');
        }
      }
    });

    map.once('error', (event) => {
      if (!cancelled && !map.isStyleLoaded()) {
        setError(event.error?.message || 'Could not load vector map');
        setStatus('');
      }
    });

    return () => {
      cancelled = true;
      if (buildingHandlersAttached) {
        map.off('mousemove', BUILDING_LAYER, onBuildingMouseMove);
        map.off('mouseleave', BUILDING_LAYER, onBuildingMouseLeave);
        map.off('mousemove', BRIDGE_FILL_LAYER, onBuildingMouseMove);
        map.off('mouseleave', BRIDGE_FILL_LAYER, onBuildingMouseLeave);
        map.off('mousemove', BRIDGE_LINE_LAYER, onBuildingMouseMove);
        map.off('mouseleave', BRIDGE_LINE_LAYER, onBuildingMouseLeave);
        map.off('click', onMapClick);
      }
      map.remove();
    };
  }, []);

  return (
    <main className="app">
      <div ref={mapHostRef} className="viewport" />
      <header className="title-card">
        <p className="eyebrow">RWTH Aachen: FAIR 3D Heritage</p>
        <h1>Dresden buildings</h1>
        <p className="hint">Drag to pan · Scroll to zoom · Right-drag to rotate</p>
      </header>
      {(status || error) && (
        <div className={`status ${error ? 'error' : ''}`}>
          <span className="status-dot" />
          {error || status}
        </div>
      )}
      {stats && (
        <aside className="stats">
          <span><strong>{stats.buildings.toLocaleString()}</strong> buildings</span>
          <span><strong>{stats.polygons.toLocaleString()}</strong> footprints</span>
          <span><strong>{stats.bridges.toLocaleString()}</strong> bridges</span>
          <span className="archive-stat"><i /><strong>{archiveContexts.filter((context) => context.located).length}</strong> database buildings</span>
        </aside>
      )}
      {archiveContexts.length > 0 && (
        <details className="context-list">
          <summary>Database OSM identifiers <strong>{archiveContexts.length}</strong></summary>
          <div>
            {archiveContexts.map((context) => (
              <span key={context.osmId} className={context.located ? 'located' : 'missing'}>
                <b>{context.osmId}</b><small>{context.count} {context.count === 1 ? 'item' : 'items'} · {context.located ? 'building located' : 'not in map'}</small>
              </span>
            ))}
          </div>
        </details>
      )}
      <aside className={`building-info ${selectedSubject ? 'selected' : ''}`} aria-live="polite">
        <p className="panel-label">{selectedBridge ? 'Bridge information' : 'Building information'}</p>
        {selectedBuilding ? (
          <>
            <BuildingPreview
              building={selectedBuilding}
              levelAssociations={archiveAssociations}
              onLevelSelect={setSelectedLevel}
              onRotationChange={setPreviewRotation}
            />
            <p className="preview-hint">Drag to rotate · Scroll to zoom</p>
            <h2>{selectedBuilding.name}</h2>
            <p className="building-address">{selectedBuilding.address}</p>
            {selectedBuilding.description && (
              <p className="building-description">{selectedBuilding.description}</p>
            )}
            <dl>
              <div><dt>Type</dt><dd>{selectedBuilding.type}</dd></div>
              <div className="levels-row">
                <dt>Levels</dt>
                <dd>
                  <input
                    className="levels-input"
                    type="number"
                    min="1"
                    max="200"
                    step="1"
                    value={selectedBuilding.levels || ''}
                    placeholder="Unknown"
                    aria-label="Number of building levels"
                    onChange={(event) => {
                      const levels = event.target.value;
                      if (selectedBuilding.osmId) {
                        levelOverridesRef.current.set(selectedBuilding.osmId, levels);
                      }
                      setSelectedBuilding((current) => ({
                        ...current,
                        levels,
                      }));
                    }}
                  />
                </dd>
              </div>
              <div><dt>Height</dt><dd>{selectedBuilding.height ? `${selectedBuilding.height} m` : 'Estimated'}</dd></div>
              {(selectedBuilding.district || onlineLocation?.district) && (
                <div><dt>District</dt><dd>{selectedBuilding.district || onlineLocation.district}</dd></div>
              )}
              {onlineLocation?.locality && <div><dt>Locality</dt><dd>{onlineLocation.locality}</dd></div>}
              {selectedBuilding.geohash && <div><dt>Geohash</dt><dd>{selectedBuilding.geohash}</dd></div>}
              {selectedBuilding.osmId && <div><dt>OSM ID</dt><dd>{selectedBuilding.osmId}</dd></div>}
              {onlineLocation?.displayName && (
                <div><dt>Online place</dt><dd>{onlineLocation.displayName}</dd></div>
              )}
              {onlineLocation?.category && (
                <div><dt>Place type</dt><dd>{onlineLocation.category.replaceAll('_', ' ')}</dd></div>
              )}
              {onlineLocation?.website && /^https?:\/\//i.test(onlineLocation.website) && (
                <div>
                  <dt>Website</dt>
                  <dd><a href={onlineLocation.website} target="_blank" rel="noreferrer">Visit website ↗</a></dd>
                </div>
              )}
              {(selectedBuilding.wikipediaUrl || selectedBuilding.wikidataUrl) && (
                <div>
                  <dt>More info</dt>
                  <dd className="knowledge-links">
                    {selectedBuilding.wikipediaUrl && (
                      <a href={selectedBuilding.wikipediaUrl} target="_blank" rel="noreferrer">Wikipedia ↗</a>
                    )}
                    {selectedBuilding.wikidataUrl && (
                      <a href={selectedBuilding.wikidataUrl} target="_blank" rel="noreferrer">Wikidata ↗</a>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            <div className="selected-level-row">
              <span>Selected</span>
              <strong>{selectedLevel !== null ? `Level ${selectedLevel}` : 'Click a level in the model'}</strong>
            </div>
            {selectedLevel !== null && (
              <FloorplanPreview
                building={selectedBuilding}
                level={selectedLevel}
                rotation={previewRotation}
                placements={archiveAssociations.filter((association) => (
                  association.scope === 'point' && association.level === String(selectedLevel)
                ))}
              />
            )}
            {selectedBuilding.osmId && (
              <ArchiveRecords
                building={selectedBuilding}
                selectedLevel={selectedLevel}
                onAssociationsChange={setArchiveAssociations}
              />
            )}
          </>
        ) : selectedBridge ? (
          <>
            <h2>{selectedBridge.name}</h2>
            {selectedBridge.description && <p className="building-description">{selectedBridge.description}</p>}
            <dl>
              <div><dt>Type</dt><dd>{selectedBridge.type}</dd></div>
              {selectedBridge.material && <div><dt>Material</dt><dd>{selectedBridge.material}</dd></div>}
              {selectedBridge.date && <div><dt>Date</dt><dd>{selectedBridge.date}</dd></div>}
              {selectedBridge.length && <div><dt>Length</dt><dd>{selectedBridge.length} m</dd></div>}
              {onlineLocation?.district && <div><dt>District</dt><dd>{onlineLocation.district}</dd></div>}
              {onlineLocation?.locality && <div><dt>Locality</dt><dd>{onlineLocation.locality}</dd></div>}
              {selectedBridge.geohash && <div><dt>Geohash</dt><dd>{selectedBridge.geohash}</dd></div>}
              {selectedBridge.osmId && <div><dt>OSM ID</dt><dd>{selectedBridge.osmId}</dd></div>}
              {(selectedBridge.wikipediaUrl || selectedBridge.wikidataUrl) && (
                <div>
                  <dt>More info</dt>
                  <dd className="knowledge-links">
                    {selectedBridge.wikipediaUrl && <a href={selectedBridge.wikipediaUrl} target="_blank" rel="noreferrer">Wikipedia ↗</a>}
                    {selectedBridge.wikidataUrl && <a href={selectedBridge.wikidataUrl} target="_blank" rel="noreferrer">Wikidata ↗</a>}
                  </dd>
                </div>
              )}
            </dl>
            {selectedBridge.osmId && (
              <ArchiveRecords building={selectedBridge} selectedLevel={null} onAssociationsChange={setArchiveAssociations} />
            )}
          </>
        ) : <p className="panel-empty">Click a building or bridge to inspect it.</p>}
      </aside>
      <footer>
        Heights use OSM data, building levels × 3 m, or a 10 m fallback. Map ©{' '}
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>,{' '}
        <a href="https://www.openmaptiles.org" target="_blank" rel="noreferrer">OpenMapTiles</a> and{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.
      </footer>
    </main>
  );
}
