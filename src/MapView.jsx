import { useState, useRef, useEffect } from "react";
import { theme, STATUS_COLORS } from "./constants.js";
import { Icon } from "./ui.jsx";

export default function MapView({ workOrders, rigs }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [mapSize, setMapSize] = useState({ w: 800, h: 400 });

  const bounds = { minLat: 30.25, maxLat: 30.85, minLng: -88.4, maxLng: -87.5 };
  const toXY = (lat, lng) => ({
    x: ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * mapSize.w,
    y: ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * mapSize.h,
  });

  useEffect(() => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setMapSize({ w: r.width, h: Math.max(350, r.width * 0.45) });
    }
  }, []);

  const projects = workOrders.filter((w) => w.lat && w.lng).map((w) => ({ ...w, pos: toXY(parseFloat(w.lat), parseFloat(w.lng)) }));
  const activeRigs = rigs.map((rig) => {
    const wo = workOrders.find((w) => w.assignedRig === rig.id && w.status === "in-progress");
    return { ...rig, activeWO: wo };
  });
  const rigPins = activeRigs.filter((r) => r.gps).map((r) => ({ ...r, pos: toXY(r.gps.lat, r.gps.lng) }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = mapSize.w * 2;
    canvas.height = mapSize.h * 2;
    ctx.scale(2, 2);

    ctx.fillStyle = "#0d1520";
    ctx.fillRect(0, 0, mapSize.w, mapSize.h);

    // Mobile Bay
    ctx.fillStyle = "#0a1825";
    ctx.beginPath();
    const bay = toXY(30.5, -87.93);
    ctx.ellipse(bay.x, bay.y, 60, 120, 0, 0, Math.PI * 2);
    ctx.fill();

    // Grid
    ctx.strokeStyle = "#1a2030";
    ctx.lineWidth = 0.5;
    for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += 0.1) {
      const y = toXY(lat, bounds.minLng).y;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(mapSize.w, y); ctx.stroke();
    }
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += 0.1) {
      const x = toXY(bounds.minLat, lng).x;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mapSize.h); ctx.stroke();
    }

    // Roads
    ctx.strokeStyle = "#252d3a"; ctx.lineWidth = 2;
    const drawRoad = (pts) => { ctx.beginPath(); pts.forEach((p, i) => { const xy = toXY(p[0], p[1]); i === 0 ? ctx.moveTo(xy.x, xy.y) : ctx.lineTo(xy.x, xy.y); }); ctx.stroke(); };
    drawRoad([[30.8, -88.07], [30.7, -88.07], [30.6, -88.05], [30.5, -88.1], [30.35, -88.15]]);
    drawRoad([[30.68, -88.35], [30.69, -88.1], [30.67, -87.9], [30.65, -87.6]]);
    drawRoad([[30.52, -88.2], [30.45, -88.0], [30.4, -87.8], [30.38, -87.6]]);

    // City labels
    ctx.font = "10px 'DM Sans', sans-serif";
    ctx.fillStyle = "#4a5068";
    [[30.69, -88.04, "Mobile"], [30.60, -87.90, "Daphne"], [30.52, -87.90, "Fairhope"],
     [30.54, -88.18, "Theodore"], [30.40, -87.68, "Foley"], [30.76, -88.13, "Saraland"]
    ].forEach(([lat, lng, name]) => { const xy = toXY(lat, lng); ctx.fillText(name, xy.x + 8, xy.y + 3); });

    // Project pins (diamonds)
    projects.forEach((p) => {
      const sc = STATUS_COLORS[p.status];
      ctx.save(); ctx.translate(p.pos.x, p.pos.y);
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      grd.addColorStop(0, sc.border + "30"); grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd; ctx.fillRect(-20, -20, 40, 40);
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0); ctx.closePath();
      ctx.fillStyle = sc.border; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = "bold 9px 'DM Sans', sans-serif"; ctx.fillStyle = "#fff";
      ctx.fillText(p.id.replace("WO-2026-", ""), 12, 3);
      ctx.restore();
    });

    // Rig pins (circles)
    rigPins.forEach((r) => {
      ctx.save(); ctx.translate(r.pos.x, r.pos.y);
      const isActive = !!r.activeWO;
      const isMaint = r.status === "maintenance";
      const pinColor = isActive ? theme.accent : isMaint ? theme.danger : theme.success;
      if (isActive) { ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.strokeStyle = pinColor + "40"; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = pinColor; ctx.fill(); ctx.strokeStyle = "#0f1117"; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = "bold 8px 'DM Sans', sans-serif"; ctx.fillStyle = "#0f1117";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(r.name.replace("Rig ", ""), 0, 0);
      ctx.restore();
    });
  }, [mapSize, workOrders, activeRigs]);

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    for (const r of rigPins) {
      if (Math.sqrt((mx - r.pos.x) ** 2 + (my - r.pos.y) ** 2) < 14) {
        setTooltip({ x: r.pos.x, y: r.pos.y - 20, content: `${r.name} (${r.type})${r.activeWO ? `\n📍 ${r.activeWO.projectName}` : `\n${r.status === "maintenance" ? "⚠ Maintenance" : "✓ Available"}`}`, type: "rig" });
        return;
      }
    }
    for (const p of projects) {
      if (Math.abs(mx - p.pos.x) < 12 && Math.abs(my - p.pos.y) < 12) {
        setTooltip({ x: p.pos.x, y: p.pos.y - 20, content: `${p.projectName}\n${p.client} • ${p.borings?.length || 0} borings\n${p.location}`, type: "project" });
        return;
      }
    }
    setTooltip(null);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, background: "rgba(15,17,23,0.9)", border: `1px solid ${theme.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 11 }}>
        <div style={{ fontWeight: 700, color: theme.text, marginBottom: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Map Legend</div>
        {[
          [theme.accent, "Active Rig", "circle"], [theme.success, "Available Rig", "circle"],
          [theme.danger, "Maintenance", "circle"], [theme.info, "Project Site", "diamond"],
        ].map(([color, label, shape]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: shape === "circle" ? "50%" : 0, background: color, display: "inline-block", transform: shape === "diamond" ? "rotate(45deg) scale(0.7)" : "none" }} />
            <span style={{ color: theme.textMuted }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, background: "rgba(244,165,58,0.12)", border: `1px solid ${theme.accent}40`, borderRadius: 6, padding: "4px 10px", fontSize: 10, color: theme.accent, fontWeight: 600 }}>
        GPS SIMULATED — API READY
      </div>
      <canvas ref={canvasRef} style={{ width: mapSize.w, height: mapSize.h, cursor: "crosshair" }} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)} />
      {tooltip && (
        <div style={{ position: "absolute", left: tooltip.x, top: tooltip.y - 10, transform: "translate(-50%, -100%)", background: "rgba(15,17,23,0.95)", border: `1px solid ${tooltip.type === "rig" ? theme.accent : theme.info}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: theme.text, whiteSpace: "pre-line", pointerEvents: "none", zIndex: 20, maxWidth: 250, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
