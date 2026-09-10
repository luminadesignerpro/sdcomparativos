import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const activeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Location {
  id: string;
  trip_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  recorded_at: string;
}

// Fetch road-following route from OSRM (free, uses OpenStreetMap)
async function getRoutedPath(positions: [number, number][]): Promise<[number, number][]> {
  if (positions.length < 2) return positions;

  // We'll try 'match' for high-point traces (snaps to roads)
  // and 'route' for simple paths (finds best road path between A and B)
  const isTrace = positions.length > 5;
  const services = isTrace ? (['match', 'route'] as const) : (['route'] as const);

  // Sample points to fit OSRM limits if needed
  const maxPoints = 50;
  const step = Math.max(1, Math.floor(positions.length / maxPoints));
  const sampled: [number, number][] = [];
  for (let i = 0; i < positions.length; i++) {
    if (i === 0 || i === positions.length - 1 || (i % step === 0 && sampled.length < maxPoints)) {
      sampled.push(positions[i]);
    }
  }

  // OSRM expects [lon, lat] semicolon-separated
  const coords = sampled.map(([lat, lon]) => `${lon},${lat}`).join(';');

  for (const service of services) {
    const params = service === 'match' 
      ? 'overview=full&geometries=geojson&tidy=true' 
      : 'overview=full&geometries=geojson&alternatives=false';
    const url = `https://router.project-osrm.org/${service}/v1/driving/${coords}?${params}`;

    try {
      console.log(`[OSRM] Requesting ${service} for ${sampled.length} points...`);
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
          console.warn(`[OSRM] ${service} failed with status ${res.status}`);
          continue;
      }
      const data = await res.json();
      
      if (data.code !== 'Ok') {
          console.warn(`[OSRM] ${service} returned code:`, data.code);
          continue;
      }

      let allCoords: [number, number][] = [];

      if (service === 'match' && data.matchings) {
        // Concatenate ALL matching segments (OSRM might return multiple if there are large gaps)
        data.matchings.forEach((m: any) => {
          if (m.geometry?.coordinates) {
             m.geometry.coordinates.forEach((c: [number, number]) => {
               allCoords.push([c[1], c[0]]); // lon,lat -> lat,lon
             });
          }
        });
      } else if (service === 'route' && data.routes?.[0]?.geometry?.coordinates) {
        data.routes[0].geometry.coordinates.forEach((c: [number, number]) => {
          allCoords.push([c[1], c[0]]);
        });
      }

      if (allCoords.length > 0) {
        console.log(`[OSRM] ${service} success! Generated ${allCoords.length} points.`);
        return allCoords;
      }
    } catch (e) {
      console.error(`[OSRM] ${service} error:`, e);
    }
  }

  console.warn('[OSRM] All services failed. Falling back to raw GPS points.');
  return positions; 
}

const LocationMarker = ({ position, recordedAt, speed, accuracy }: { position: [number, number], recordedAt: string, speed: number | null, accuracy: number | null }) => {
  const time = new Date(recordedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const speedKmh = speed !== null ? (speed * 3.6).toFixed(0) : '0';
  
  return (
    `<div style="font-size:11px; min-width:140px">
      <p style="font-weight:bold; margin-bottom:4px; border-bottom:1px solid #eee">📍 Ponto de Passagem</p>
      <p><b>Horário:</b> ${time}</p>
      <p><b>Velocidade:</b> ${speedKmh} km/h</p>
      ${accuracy ? `<p><b>Precisão:</b> ${accuracy.toFixed(0)}m</p>` : ''}
    </div>`
  );
};

export default function FleetMap({ locations = [] }: { locations?: Location[] }) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const defaultCenter: [number, number] = [-3.7172, -38.5433];

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(defaultCenter, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers and polylines when locations change
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (locations.length === 0) {
      L.marker(defaultCenter).addTo(layer).bindPopup('Sede — Caucaia, CE');
      map.setView(defaultCenter, 13);
      return;
    }

    // Group by trip_id
    const tripGroups: Record<string, Location[]> = {};
    locations.forEach(loc => {
      if (!tripGroups[loc.trip_id]) tripGroups[loc.trip_id] = [];
      tripGroups[loc.trip_id].push(loc);
    });

    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    let idx = 0;

    // Draw each trip — fetch road route from OSRM first
    const drawTrips = async () => {
      try {
        for (const [tripId, locs] of Object.entries(tripGroups)) {
          if (!mapRef.current || !layerRef.current) return;

          const rawPositions = locs.map(l => [l.latitude, l.longitude] as [number, number]);
          const lastLoc = locs[locs.length - 1];
          const color = colors[idx % colors.length];
          idx++;

          if (rawPositions.length > 1) {
            // 🗺️ Get route following actual roads via OSRM
            const routedPositions = await getRoutedPath(rawPositions);
            
            if (!mapRef.current || !layerRef.current) return;

            // Se o roteamento retornou a mesma quantidade de pontos que o bruto (falhou),
            // desenha uma linha tracejada por baixo
            if (routedPositions.length === rawPositions.length) {
              L.polyline(rawPositions, { color: '#888', weight: 2, dashArray: '5, 10', opacity: 0.5 }).addTo(layer);
            }

            L.polyline(routedPositions, { color, weight: 5, opacity: 0.85, lineJoin: 'round' }).addTo(layer);
          }

          // Markers for EVERY raw position to show timing
          locs.forEach((l, i) => {
            if (!layerRef.current) return;
            const isStart = i === 0;
            const isEnd = i === locs.length - 1;
            
            // For general points, use small circle markers
            if (!isStart && !isEnd) {
              const dot = L.circleMarker([l.latitude, l.longitude], {
                radius: 4,
                color: 'white',
                fillColor: color,
                fillOpacity: 0.8,
                weight: 1
              }).addTo(layerRef.current);
              
              dot.bindPopup(LocationMarker({ 
                position: [l.latitude, l.longitude], 
                recordedAt: l.recorded_at, 
                speed: l.speed,
                accuracy: l.accuracy
              }));
            }
          });

          // Start marker (green dot)
          if (rawPositions.length > 0) {
            const startMarker = L.circleMarker(rawPositions[0], {
              radius: 7, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 2,
            }).addTo(layer);
            startMarker.bindPopup(`<b>🟢 Início da Rota</b><br>${new Date(locs[0].recorded_at).toLocaleString('pt-BR')}`);
          }

          // End marker
          const endMarker = L.marker([lastLoc.latitude, lastLoc.longitude], { icon: activeIcon }).addTo(layer);
          const speedText = lastLoc.speed !== null ? `<p>Vel: ${(lastLoc.speed * 3.6).toFixed(0)} km/h</p>` : '';
          endMarker.bindPopup(`
            <div style="font-size:13px">
              <p style="font-weight:bold; color:#22c55e">🏁 Última posição</p>
              <p>${new Date(lastLoc.recorded_at).toLocaleString('pt-BR')}</p>
              ${speedText}
              <p style="color:#888;font-size:11px;margin-top:4px">Total de pontos: ${locs.length}</p>
            </div>
          `);
        }

        if (!mapRef.current) return;

        // Fit map to all positions
        const allPositions = locations.map(l => [l.latitude, l.longitude] as [number, number]);
        if (allPositions.length === 1) {
          map.setView(allPositions[0], 15);
        } else if (allPositions.length > 1) {
          const bounds = L.latLngBounds(allPositions);
          if (bounds.isValid()) {
             map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
        }
      } catch (err) {
        console.error('[FleetMap] Error drawing trips:', err);
      }
    };

    drawTrips();
  }, [locations]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} className="rounded-2xl z-0" />;
}
