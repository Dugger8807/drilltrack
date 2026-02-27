import { theme, RIGS, CREWS, formatCurrency } from "./constants.js";
import { Icon } from "./ui.jsx";
import MapView from "./MapView.jsx";

export default function Dashboard({ workOrders, dailyReports, dbRigs, dbCrews }) {
  // Use DB rigs/crews if provided, fall back to constants
  const rigsToUse = dbRigs && dbRigs.length > 0 ? dbRigs.map(r => ({ ...r, gps: { lat: r.last_known_lat || 30.69, lng: r.last_known_lng || -88.04 } })) : RIGS;
  const crewsToUse = dbCrews && dbCrews.length > 0 ? dbCrews.map(c => ({ ...c, lead: c.lead ? `${c.lead.first_name} ${c.lead.last_name}` : 'Unassigned', members: 2 })) : CREWS;
  const activeJobs = workOrders.filter((w) => w.status === "in-progress").length;
  const scheduled = workOrders.filter((w) => w.status === "scheduled").length;
  const pending = workOrders.filter((w) => w.status === "pending").length;
  const rigsActive = workOrders.filter((w) => w.status === "in-progress" && w.assignedRig).length;
  const totalRevenue = dailyReports.reduce((sum, r) => sum + (r.billing || []).reduce((s, b) => s + (b.total || b.quantity * b.rate || 0), 0), 0);
  const totalEstimated = workOrders.reduce((s, w) => s + (w.estimatedCost || 0), 0);
  const totalFootage = dailyReports.reduce((sum, r) => sum + (r.production || []).reduce((s, b) => s + (b.footage || 0), 0), 0);
  const pendingReports = dailyReports.filter((r) => r.status === "submitted").length;

  const stats = [
    { label: "Active Jobs", value: activeJobs, icon: "drill", color: theme.info },
    { label: "Scheduled", value: scheduled, icon: "calendar", color: "#a78bfa" },
    { label: "Pending Approval", value: pending, icon: "clipboard", color: theme.accent },
    { label: "Rigs Deployed", value: `${rigsActive}/10`, icon: "truck", color: theme.success },
    { label: "Total Footage", value: `${totalFootage} ft`, icon: "drill", color: "#f472b6" },
    { label: "Reports Pending", value: pendingReports, icon: "report", color: pendingReports > 0 ? theme.danger : theme.success },
    { label: "Billed to Date", value: formatCurrency(totalRevenue), icon: "dollar", color: "#f472b6" },
    { label: "Pipeline Value", value: formatCurrency(totalEstimated), icon: "dollar", color: theme.accent },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 14, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 10, right: 12, opacity: 0.12 }}><Icon name={s.icon} size={32} color={s.color} /></div>
            <div style={{ fontSize: 10, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: theme.text, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="map" size={16} color={theme.accent} /> Fleet & Project Map
        </h3>
        <MapView workOrders={workOrders} rigs={rigsToUse} />
      </div>

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: theme.text, textTransform: "uppercase" }}><Icon name="truck" size={16} /> Rig Fleet</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {rigsToUse.map((rig) => {
            const wo = workOrders.find((w) => w.assignedRig === rig.id && w.status === "in-progress");
            const sc = wo ? theme.info : rig.status === "maintenance" ? theme.danger : theme.success;
            return (
              <div key={rig.id} style={{ background: theme.surface2, borderRadius: 8, padding: "12px 14px", borderLeft: `3px solid ${sc}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{rig.name}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{rig.type}</div>
                <div style={{ fontSize: 11, color: sc, marginTop: 4, fontWeight: 600 }}>{wo ? wo.projectName.slice(0, 22) : rig.status === "maintenance" ? "⚠ Maintenance" : "✓ Available"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: theme.text, textTransform: "uppercase" }}><Icon name="users" size={16} /> Crew Assignments</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {crewsToUse.map((crew) => {
            const wo = workOrders.find((w) => w.assignedCrew === crew.id && (w.status === "in-progress" || w.status === "scheduled"));
            return (
              <div key={crew.id} style={{ background: theme.surface2, borderRadius: 8, padding: "12px 14px", borderLeft: `3px solid ${wo ? theme.accent : theme.textMuted}40` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{crew.name}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>Lead: {typeof crew.lead === 'string' ? crew.lead : crew.lead?.first_name ? `${crew.lead.first_name} ${crew.lead.last_name}` : 'Unassigned'}</div>
                <div style={{ fontSize: 11, color: wo ? theme.accent : theme.textMuted, marginTop: 4, fontWeight: 500 }}>{wo ? (wo.projectName || wo.name || '').slice(0, 25) : "Unassigned"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
