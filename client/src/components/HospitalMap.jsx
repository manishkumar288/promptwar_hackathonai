import { useEffect } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';

const RISK_COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  WATCH: '#eab308',
  SAFE: '#16a34a',
  PLAIN: '#64748b',
};

function FitBounds({ hospitals }) {
  const map = useMap();

  useEffect(() => {
    if (!hospitals || hospitals.length === 0) return;
    const valid = hospitals.filter(
      (h) => Number.isFinite(h.lat) && Number.isFinite(h.lng)
    );
    if (valid.length === 0) return;
    const bounds = L.latLngBounds(valid.map((h) => [h.lat, h.lng]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }, [map, hospitals]);

  return null;
}

export default function HospitalMap({
  hospitals = [],
  highlightId = null,
  hoverId = null,
  lines = [],
  onSelect,
}) {
  const center =
    hospitals.length > 0
      ? [hospitals[0].lat, hospitals[0].lng]
      : [12.9716, 77.5946];

  return (
    <div className="hospital-map-wrap">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom={false}
        style={{ height: '350px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds hospitals={hospitals} />

        {lines.map((line, idx) => (
          <Polyline
            key={idx}
            positions={[line.from, line.to]}
            pathOptions={{
              color: line.best ? '#b91c1c' : '#2563eb',
              weight: line.best ? 5 : 2.5,
              opacity: line.best ? 0.9 : 0.7,
              dashArray: line.dashed ? '6 6' : undefined,
            }}
          />
        ))}

        {hospitals.map((h) => {
          const isHighlighted = highlightId != null && h.id === highlightId;
          const isHovered = hoverId != null && h.id === hoverId;
          const fill = RISK_COLORS[h.riskLevel] || RISK_COLORS.PLAIN;
          const radius = isHighlighted ? 12 : isHovered ? 11 : 8;

          return (
            <CircleMarker
              key={h.id}
              center={[h.lat, h.lng]}
              radius={radius}
              pathOptions={{
                fillColor: fill,
                fillOpacity: 0.9,
                color: isHighlighted || isHovered ? '#0f172a' : '#ffffff',
                weight: isHighlighted || isHovered ? 3 : 2,
              }}
              eventHandlers={
                onSelect
                  ? {
                      click: () => onSelect(h.id),
                    }
                  : undefined
              }
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <strong>{h.name}</strong>
                {h.riskLevel ? ` · ${h.riskLevel}` : ''}
                {h.label ? ` (${h.label})` : ''}
              </Tooltip>
              <Popup>
                <div className="map-popup">
                  <strong>{h.name}</strong>
                  {h.riskLevel && <div>Risk: {h.riskLevel}</div>}
                  {h.label && <div>{h.label}</div>}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
