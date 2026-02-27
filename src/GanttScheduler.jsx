import { theme, STATUS_COLORS, RIGS, CREWS, daysBetween, getDateRange, selectStyle } from "./constants.js";

export default function GanttScheduler({ workOrders, setWorkOrders }) {
  const scheduledOrders = workOrders.filter((w) => w.startDate && w.endDate);
  const unscheduledOrders = workOrders.filter((w) => !w.startDate && (w.status === "approved" || w.status === "pending"));
  const { start: rangeStart, end: rangeEnd } = getDateRange(scheduledOrders);
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  const dayWidth = 42;
  const dates = Array.from({ length: totalDays }, (_, i) => { const d = new Date(rangeStart); d.setDate(d.getDate() + i); return d; });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayOffset = daysBetween(rangeStart, today);
  const getBarPosition = (wo) => {
    const startOff = daysBetween(rangeStart, new Date(wo.startDate));
    const dur = daysBetween(new Date(wo.startDate), new Date(wo.endDate)) + 1;
    return { left: startOff * dayWidth, width: dur * dayWidth - 4 };
  };
  const rigRows = RIGS.map((rig) => ({ rig, orders: scheduledOrders.filter((w) => w.assignedRig === rig.id) }));

  const assignToRig = (woId, rigId, crewId) => {
    const td = new Date().toISOString().split("T")[0];
    const ed = new Date(); ed.setDate(ed.getDate() + 14);
    setWorkOrders((prev) => prev.map((w) => w.id === woId ? { ...w, assignedRig: rigId, assignedCrew: crewId, status: "scheduled", startDate: w.startDate || td, endDate: w.endDate || ed.toISOString().split("T")[0] } : w));
  };

  return (
    <div>
      {unscheduledOrders.length > 0 && (
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: theme.accent, textTransform: "uppercase" }}>Unscheduled Work Queue ({unscheduledOrders.length})</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {unscheduledOrders.map((wo) => (
              <div key={wo.id} style={{ background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "10px 14px", minWidth: 220 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>{wo.projectName}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{wo.client} • {wo.borings?.length || 0} borings</div>
                <select style={{ ...selectStyle, padding: "3px 6px", fontSize: 11, marginTop: 8 }} onChange={(e) => { const [r, c] = e.target.value.split("|"); if (r) assignToRig(wo.id, r, c); }} defaultValue="">
                  <option value="">Assign to Rig...</option>
                  {RIGS.filter((r) => r.status === "available").map((r, i) => <option key={r.id} value={`${r.id}|${CREWS[i]?.id || CREWS[0].id}`}>{r.name} + {CREWS[i]?.name || CREWS[0].name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 600 }}>
          <div style={{ display: "flex", minWidth: totalDays * dayWidth + 200 }}>
            {/* Left labels */}
            <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${theme.border}`, position: "sticky", left: 0, zIndex: 10, background: theme.surface }}>
              <div style={{ height: 56, borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", padding: "0 14px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase" }}>Rig / Equipment</span>
              </div>
              {rigRows.map(({ rig }) => (
                <div key={rig.id} style={{ height: 50, borderBottom: `1px solid ${theme.border}20`, display: "flex", alignItems: "center", padding: "0 14px", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: rig.status === "available" ? theme.success : rig.status === "maintenance" ? theme.danger : theme.textMuted }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>{rig.name}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted }}>{rig.type}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div style={{ flex: 1, minWidth: totalDays * dayWidth }}>
              <div style={{ height: 56, borderBottom: `1px solid ${theme.border}`, display: "flex", position: "relative" }}>
                {dates.map((d, i) => {
                  const isToday = d.getTime() === today.getTime();
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isFirst = d.getDate() === 1;
                  return (
                    <div key={i} style={{ width: dayWidth, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: `1px solid ${theme.border}15`, background: isToday ? "rgba(244,165,58,0.08)" : isWeekend ? "rgba(0,0,0,0.15)" : "transparent", borderLeft: isFirst ? `2px solid ${theme.accent}40` : "none" }}>
                      <span style={{ fontSize: 9, color: isToday ? theme.accent : theme.textMuted, fontWeight: 600 }}>{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                      <span style={{ fontSize: 12, color: isToday ? theme.accent : theme.text, fontWeight: isToday ? 700 : 400 }}>{d.getDate()}</span>
                      {isFirst && <span style={{ fontSize: 8, color: theme.accent, fontWeight: 700, position: "absolute", top: 2, textTransform: "uppercase" }}>{d.toLocaleDateString("en-US", { month: "short" })}</span>}
                    </div>
                  );
                })}
              </div>

              {rigRows.map(({ rig, orders }) => (
                <div key={rig.id} style={{ height: 50, borderBottom: `1px solid ${theme.border}20`, position: "relative" }}>
                  {dates.map((d, i) => {
                    const isWk = d.getDay() === 0 || d.getDay() === 6;
                    const isTd = d.getTime() === today.getTime();
                    return (isWk || isTd) ? <div key={i} style={{ position: "absolute", left: i * dayWidth, width: dayWidth, height: "100%", background: isTd ? "rgba(244,165,58,0.04)" : "rgba(0,0,0,0.08)", pointerEvents: "none" }} /> : null;
                  })}
                  {todayOffset >= 0 && todayOffset < totalDays && <div style={{ position: "absolute", left: todayOffset * dayWidth + dayWidth / 2, width: 2, height: "100%", background: theme.accent, opacity: 0.5, zIndex: 2, pointerEvents: "none" }} />}
                  {orders.map((wo) => {
                    const pos = getBarPosition(wo);
                    const crew = CREWS.find((c) => c.id === wo.assignedCrew);
                    const sc = STATUS_COLORS[wo.status] || STATUS_COLORS.scheduled;
                    return (
                      <div key={wo.id} title={`${wo.projectName}\n${wo.client}\n${wo.startDate} → ${wo.endDate}`} style={{ position: "absolute", top: 8, left: pos.left + 2, width: pos.width, height: 34, background: `linear-gradient(135deg, ${sc.bg}, ${sc.border}25)`, border: `1px solid ${sc.border}60`, borderRadius: 6, display: "flex", alignItems: "center", padding: "0 8px", cursor: "pointer", zIndex: 3, overflow: "hidden" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wo.projectName}</span>
                        {crew && <span style={{ fontSize: 10, color: sc.text, opacity: 0.7, marginLeft: 6 }}>({crew.lead})</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
