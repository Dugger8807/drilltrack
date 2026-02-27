import { useState, useEffect, useRef } from "react";
import { theme, STATUS_COLORS } from "./constants.js";
import { Icon, Badge } from "./ui.jsx";

// Load Leaflet from CDN dynamically
const LEAFLET_LOADED = { promise: null };
function loadLeaflet() {
  if (LEAFLET_LOADED.promise) return LEAFLET_LOADED.promise;
  LEAFLET_LOADED.promise = new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    // JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return LEAFLET_LOADED.promise;
}

// Color for status pins
function pinColor(status) {
  const map = {
    pending: '#f4a53a', approved: '#4ade80', scheduled: '#a78bfa',
    in_progress: '#38bdf8', completed: '#34d399', invoiced: '#f472b6',
  };
  return map[status] || '#8b909e';
}

// Create a custom colored marker
function createPin(L, color, label) {
  return L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
    html: `<div style="position:relative;width:28px;height:36px;">
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="${color}"/>
        <circle cx="14" cy="13" r="6" fill="rgba(0,0,0,0.3)"/>
      </svg>
      ${label ? `<div style="position:absolute;top:7px;left:0;right:0;text-align:center;font-size:9px;font-weight:800;color:#fff;font-family:DM Sans,sans-serif;">${label}</div>` : ''}
    </div>`
  });
}

export default function MapView({ workOrders, rigs, isMobile }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // Filter to WOs with location data and active statuses
  const mappableWOs = workOrders.filter(w =>
    w.lat && w.lng && ['pending', 'approved', 'scheduled', 'in_progress'].includes(w.status)
  );

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;

      // Default center: Mobile, AL
      const defaultCenter = [30.6954, -88.0399];
      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: 10,
        zoomControl: !isMobile,
        attributionControl: true,
      });

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add zoom control for mobile at bottom right
      if (isMobile) {
        L.control.zoom({ position: 'bottomright' }).addTo(map);
      }

      mapInstanceRef.current = map;
      setMapReady(true);

      // Cleanup
      return () => { map.remove(); mapInstanceRef.current = null; };
    });

    return () => { cancelled = true; };
  }, []);

  // Add/update markers when data changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    // Clear existing markers
    map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });

    const bounds = [];

    // Add WO markers
    mappableWOs.forEach(wo => {
      const lat = parseFloat(wo.lat);
      const lng = parseFloat(wo.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      bounds.push([lat, lng]);
      const color = pinColor(wo.status);
      const icon = createPin(L, color, wo.borings?.length || '');

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      const popupContent = `
        <div style="font-family:DM Sans,sans-serif;min-width:180px;">
          <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:2px;">${wo.woNumber}</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${wo.projectName}</div>
          <div style="font-size:11px;color:#888;margin-bottom:2px;">${wo.client}</div>
          <div style="font-size:11px;color:#888;margin-bottom:4px;">${wo.location || ''}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;">
            <span style="color:${color};font-weight:600;text-transform:uppercase;">${(wo.status || '').replace('_',' ')}</span>
            <span>${wo.borings?.length || 0} borings</span>
            ${wo.rigName ? `<span>Rig: ${wo.rigName}</span>` : ''}
          </div>
          ${wo.estimatedCost ? `<div style="font-size:12px;font-weight:700;color:${color};margin-top:4px;">$${Number(wo.estimatedCost).toLocaleString()}</div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'drilltrack-popup',
        maxWidth: 260,
      });

      marker.on('click', () => setSelected(wo));
    });

    // Fit bounds if we have markers
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 12);
    }
  }, [mapReady, mappableWOs.length, workOrders]);

  // Status summary counts
  const statusCounts = {};
  mappableWOs.forEach(w => { statusCounts[w.status] = (statusCounts[w.status] || 0) + 1; });

  return (
    <div style={{ position: "relative" }}>
      {/* Map container */}
      <div ref={mapRef} style={{
        width: "100%",
        height: isMobile ? "calc(100vh - 180px)" : 500,
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${theme.border}`,
      }} />

      {/* Status legend overlay */}
      <div style={{
        position: "absolute", top: isMobile ? 8 : 12, right: isMobile ? 8 : 12, zIndex: 1000,
        background: "rgba(15,17,23,0.92)", border: `1px solid ${theme.border}`,
        borderRadius: 8, padding: isMobile ? "6px 8px" : "8px 12px",
        fontSize: isMobile ? 10 : 11, backdropFilter: "blur(8px)",
      }}>
        <div style={{ fontWeight: 700, color: theme.text, marginBottom: 4, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {mappableWOs.length} Active Sites
        </div>
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: pinColor(status), flexShrink: 0 }} />
            <span style={{ color: theme.textMuted, textTransform: "capitalize" }}>{status.replace('_', ' ')}</span>
            <span style={{ color: theme.text, fontWeight: 600, marginLeft: "auto" }}>{count}</span>
          </div>
        ))}
      </div>

      {/* Missing coordinates warning */}
      {workOrders.filter(w => !w.lat && !w.lng && ['pending', 'approved', 'scheduled', 'in_progress'].includes(w.status)).length > 0 && (
        <div style={{
          position: "absolute", bottom: isMobile ? 8 : 12, left: isMobile ? 8 : 12, zIndex: 1000,
          background: "rgba(244,165,58,0.12)", border: `1px solid ${theme.accent}40`,
          borderRadius: 6, padding: "4px 10px", fontSize: 10, color: theme.accent, fontWeight: 600,
        }}>
          <Icon name="alert" size={12} color={theme.accent} /> {workOrders.filter(w => !w.lat && !w.lng && ['pending', 'approved', 'scheduled', 'in_progress'].includes(w.status)).length} WOs missing coordinates — add lat/lng in project settings
        </div>
      )}

      {/* Inject popup styles */}
      <style>{`
        .drilltrack-popup .leaflet-popup-content-wrapper {
          background: rgba(24,27,36,0.96);
          color: #e8eaed;
          border-radius: 10px;
          border: 1px solid #2a2f3d;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          backdrop-filter: blur(8px);
        }
        .drilltrack-popup .leaflet-popup-tip {
          background: rgba(24,27,36,0.96);
          border: 1px solid #2a2f3d;
        }
        .drilltrack-popup .leaflet-popup-content { margin: 10px 12px; }
        .leaflet-control-zoom a {
          background: rgba(24,27,36,0.9) !important;
          color: #e8eaed !important;
          border-color: #2a2f3d !important;
        }
        .leaflet-control-attribution {
          background: rgba(24,27,36,0.7) !important;
          color: #555 !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: #666 !important; }
      `}</style>
    </div>
  );
}
