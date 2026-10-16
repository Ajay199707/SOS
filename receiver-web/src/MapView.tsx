import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface Loc {
  lat: number; lon: number; accuracy_m?: number; recorded_at?: string; is_stale?: boolean;
  provider?: string;
}

// Live map (Phase 4): latest position + route history, live vs stale badge, accuracy circle, directions link.
export function MapView({ locations }: { locations: Loc[] }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    mapRef.current = L.map(divRef.current).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapRef.current);
    layerRef.current = L.layerGroup().addTo(mapRef.current);
  }, []);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!locations.length) return;
    const latlngs = locations.map((l) => [l.lat, l.lon] as [number, number]);
    L.polyline(latlngs, { color: '#1976d2' }).addTo(layer);
    const last = locations[locations.length - 1];
    const color = last.is_stale ? 'gray' : 'red';
    L.circleMarker([last.lat, last.lon], { radius: 9, color }).addTo(layer)
      .bindPopup(`<b>${last.is_stale ? 'STALE' : 'LIVE'}</b><br/>${last.lat.toFixed(5)}, ${last.lon.toFixed(5)}<br/>±${Math.round(last.accuracy_m ?? 0)}m<br/>${last.recorded_at ?? ''}`);
    if (last.accuracy_m) L.circle([last.lat, last.lon], { radius: last.accuracy_m }).addTo(layer);
    map.setView([last.lat, last.lon], Math.max(map.getZoom(), 15));
  }, [locations]);

  const last = locations[locations.length - 1];
  const gmaps = last ? `https://www.google.com/maps/dir/?api=1&destination=${last.lat},${last.lon}` : null;

  return (
    <div>
      <div ref={divRef} style={{ height: 320, borderRadius: 8, border: '1px solid #ccc' }} />
      <div style={{ marginTop: 8, fontSize: 14 }}>
        {last ? (
          <>
            <span style={{ background: last.is_stale ? '#888' : '#d32f2f', color: '#fff', padding: '2px 8px', borderRadius: 12 }}>
              {last.is_stale ? 'STALE LOCATION' : 'LIVE'}
            </span>{' '}
            {last.lat.toFixed(5)}, {last.lon.toFixed(5)} ±{Math.round(last.accuracy_m ?? 0)}m{' '}
            {gmaps && <a href={gmaps} target="_blank" rel="noreferrer">Directions</a>}
          </>
        ) : 'No locations yet — sender GPS may be off or permission denied.'}
      </div>
    </div>
  );
}
