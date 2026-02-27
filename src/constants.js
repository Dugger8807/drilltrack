// ─── Theme ───────────────────────────────────────────────────────────
export const theme = {
  bg: "#0f1117", surface: "#181b24", surface2: "#1e222d", border: "#2a2f3d",
  text: "#e8eaed", textMuted: "#8b909e", accent: "#f4a53a",
  accentDim: "rgba(244,165,58,0.12)", danger: "#ef4444", success: "#4ade80", info: "#38bdf8",
};

export const STATUS_COLORS = {
  pending: { bg: "#2a2420", text: "#f4a53a", border: "#f4a53a" },
  approved: { bg: "#1e2a20", text: "#4ade80", border: "#4ade80" },
  scheduled: { bg: "#1e2028", text: "#a78bfa", border: "#a78bfa" },
  "in-progress": { bg: "#1e2530", text: "#38bdf8", border: "#38bdf8" },
  in_progress: { bg: "#1e2530", text: "#38bdf8", border: "#38bdf8" },
  cancelled: { bg: "#2a1a1a", text: "#ef4444", border: "#ef4444" },
  completed: { bg: "#1a2420", text: "#34d399", border: "#34d399" },
  invoiced: { bg: "#2a2025", text: "#f472b6", border: "#f472b6" },
  submitted: { bg: "#1e2028", text: "#a78bfa", border: "#a78bfa" },
  rejected: { bg: "#2a1a1a", text: "#ef4444", border: "#ef4444" },
};

export const BILLING_UNITS = [
  "Hourly Drilling", "Per Foot", "Mobilization", "Demobilization",
  "Standby Time", "SPT Samples", "Shelby Tube", "Rock Coring",
  "Monitoring Well Install", "Grouting", "Traffic Control", "Per Diem",
  "CPT Sounding", "Vane Shear Test", "Piezometer Install",
];

export const SAMPLE_TYPES = [
  "SPT (Split Spoon)", "Shelby Tube", "Rock Core (NX)", "Rock Core (HQ)",
  "Grab Sample", "Bulk Sample", "Piston Sample", "CPT Data",
  "Vane Shear", "Pressuremeter", "Auger Cutting",
];

export const BORING_TYPES = ["SPT Boring", "CPT Sounding", "Rock Core Boring", "Auger Boring", "Monitoring Well", "Test Pit"];

// ─── Rigs & Crews ────────────────────────────────────────────────────
export const RIGS = Array.from({ length: 10 }, (_, i) => ({
  id: `rig-${i + 1}`,
  name: `Rig ${String(i + 1).padStart(2, "0")}`,
  type: ["CME-75", "CME-55", "Geoprobe 7822", "Diedrich D-120", "Mobile B-57"][i % 5],
  status: i < 7 ? "available" : i < 9 ? "maintenance" : "standby",
  gps: { lat: 30.6 + (Math.sin(i * 1.3) * 0.15), lng: -88.05 + (Math.cos(i * 1.7) * 0.2) },
}));

export const CREWS = Array.from({ length: 10 }, (_, i) => ({
  id: `crew-${i + 1}`,
  name: `Crew ${String.fromCharCode(65 + i)}`,
  lead: ["Martinez", "Johnson", "Williams", "Chen", "Patel", "Thompson", "Garcia", "Davis", "Wilson", "Lee"][i],
  members: Math.floor(Math.random() * 2) + 2,
}));

// ─── Helpers ─────────────────────────────────────────────────────────
export const formatCurrency = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export const daysBetween = (a, b) => Math.ceil((new Date(b) - new Date(a)) / 86400000);
export function generateId(prefix) { return `${prefix}-${Date.now().toString(36).toUpperCase()}`; }

export function getDateRange(workOrders) {
  const starts = workOrders.filter((w) => w.startDate).map((w) => new Date(w.startDate));
  const ends = workOrders.filter((w) => w.endDate).map((w) => new Date(w.endDate));
  if (!starts.length) { const t = new Date(); return { start: t, end: new Date(t.getTime() + 30 * 86400000) }; }
  const min = new Date(Math.min(...starts));
  const max = new Date(Math.max(...ends));
  min.setDate(min.getDate() - 3); max.setDate(max.getDate() + 7);
  return { start: min, end: max };
}

export const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", WebkitAppearance: "none" };
export const selectStyle = { ...inputStyle, cursor: "pointer" };
