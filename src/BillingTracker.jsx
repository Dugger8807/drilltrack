import { theme, formatCurrency } from "./constants.js";
import { Badge } from "./ui.jsx";

export default function BillingTracker({ workOrders, dailyReports }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr>{["Work Order", "Client", "Status", "Estimated", "Billed to Date", "Footage", "Reports", "Variance"].map((h) => <th key={h} style={{ textAlign: "left", padding: "10px 12px", borderBottom: `2px solid ${theme.border}`, color: theme.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>
          {workOrders.map((wo) => {
            const reps = dailyReports.filter((r) => r.workOrderId === wo.id);
            const billed = reps.reduce((s, r) => s + (r.billing || []).reduce((s2, b) => s2 + (b.total || b.quantity * b.rate || 0), 0), 0);
            const footage = reps.reduce((s, r) => s + (r.production || []).reduce((s2, b) => s2 + (b.footage || 0), 0), 0);
            const variance = wo.estimatedCost - billed;
            const pct = wo.estimatedCost > 0 ? ((billed / wo.estimatedCost) * 100).toFixed(0) : 0;
            const approvedReps = reps.filter((r) => r.status === "approved").length;
            const pendingReps = reps.filter((r) => r.status === "submitted").length;
            return (
              <tr key={wo.id} style={{ borderBottom: `1px solid ${theme.border}20` }}>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 600, color: theme.text }}>{wo.projectName || wo.name}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: "monospace" }}>{wo.woNumber || wo.id.slice(0,8)}</div>
                </td>
                <td style={{ padding: "10px 12px", color: theme.textMuted }}>{wo.client}</td>
                <td style={{ padding: "10px 12px" }}><Badge status={wo.status} /></td>
                <td style={{ padding: "10px 12px", color: theme.text, fontWeight: 500 }}>{formatCurrency(wo.estimatedCost)}</td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ color: theme.accent, fontWeight: 700 }}>{formatCurrency(billed)}</div>
                  <div style={{ marginTop: 4, height: 4, width: 100, background: theme.surface2, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: Number(pct) > 90 ? theme.danger : theme.accent, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 10, color: theme.textMuted }}>{pct}% of estimate</span>
                </td>
                <td style={{ padding: "10px 12px", color: theme.info, fontWeight: 600 }}>{footage} ft</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ color: theme.success, fontWeight: 600 }}>{approvedReps} approved</span>
                  {pendingReps > 0 && <span style={{ color: theme.accent, fontWeight: 600, marginLeft: 6 }}>{pendingReps} pending</span>}
                </td>
                <td style={{ padding: "10px 12px", color: variance >= 0 ? theme.success : theme.danger, fontWeight: 600 }}>
                  {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
