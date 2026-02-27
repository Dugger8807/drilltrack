import { useState, useEffect } from "react";
import { theme, RIGS, CREWS, BORING_TYPES, SAMPLE_TYPES, BILLING_UNITS, formatCurrency, generateId, inputStyle, selectStyle } from "./constants.js";
import { Icon, Badge, Btn, Field } from "./ui.jsx";

// ─── Daily Report Form ───────────────────────────────────────────────
export function DailyReportForm({ workOrders, onSubmit, onCancel }) {
  const activeWOs = workOrders.filter((w) => w.status === "in-progress" || w.status === "scheduled");
  const emptyLog = { boringId: "", type: "SPT Boring", startDepth: 0, endDepth: 0, soilConditions: "", samplesCollected: 0, sampleTypes: ["SPT (Split Spoon)"], sptBlowCounts: "", waterLevel: "", footage: 0 };

  const [form, setForm] = useState({
    workOrderId: activeWOs[0]?.id || "", date: new Date().toISOString().split("T")[0],
    crew: "", rig: "", driller: "", startTime: "07:00", endTime: "17:00",
    weatherConditions: "", equipmentIssues: "None", safetyIncidents: "None", notes: "",
    boringLogs: [{ ...emptyLog }],
    billingEntries: [{ unit: "Hourly Drilling", quantity: 0, rate: 285 }],
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (form.workOrderId) {
      const wo = workOrders.find((w) => w.id === form.workOrderId);
      if (wo) {
        const crew = CREWS.find((c) => c.id === wo.assignedCrew);
        setForm((f) => ({ ...f, rig: wo.assignedRig || "", crew: wo.assignedCrew || "", driller: crew?.lead || "" }));
      }
    }
  }, [form.workOrderId]);

  const addLog = () => setForm((f) => ({ ...f, boringLogs: [...f.boringLogs, { ...emptyLog }] }));
  const updateLog = (idx, field, val) => setForm((f) => ({ ...f, boringLogs: f.boringLogs.map((b, i) => i === idx ? { ...b, [field]: ["samplesCollected", "startDepth", "endDepth", "footage"].includes(field) ? Number(val) : val } : b) }));
  const removeLog = (idx) => setForm((f) => ({ ...f, boringLogs: f.boringLogs.filter((_, i) => i !== idx) }));
  const toggleLogST = (idx, st) => setForm((f) => ({ ...f, boringLogs: f.boringLogs.map((b, i) => { if (i !== idx) return b; const has = b.sampleTypes.includes(st); return { ...b, sampleTypes: has ? b.sampleTypes.filter((s) => s !== st) : [...b.sampleTypes, st] }; }) }));

  const addBill = () => setForm((f) => ({ ...f, billingEntries: [...f.billingEntries, { unit: "", quantity: 0, rate: 0 }] }));
  const updateBill = (idx, field, val) => setForm((f) => ({ ...f, billingEntries: f.billingEntries.map((b, i) => (i === idx ? { ...b, [field]: field === "unit" ? val : Number(val) } : b)) }));
  const removeBill = (idx) => setForm((f) => ({ ...f, billingEntries: f.billingEntries.filter((_, i) => i !== idx) }));

  // Auto-calc footage
  useEffect(() => {
    setForm((f) => ({ ...f, boringLogs: f.boringLogs.map((b) => ({ ...b, footage: Math.max(0, (Number(b.endDepth) || 0) - (Number(b.startDepth) || 0)) })) }));
  }, [form.boringLogs.map((b) => `${b.startDepth}-${b.endDepth}`).join(",")]);

  const handleSubmit = () => {
    if (!form.workOrderId || !form.date) return;
    onSubmit({ ...form, id: generateId("DR"), status: "submitted", reviewNotes: "" });
  };

  const totalFootage = form.boringLogs.reduce((s, b) => s + (b.footage || 0), 0);
  const totalSamples = form.boringLogs.reduce((s, b) => s + (b.samplesCollected || 0), 0);
  const selectedWO = workOrders.find((w) => w.id === form.workOrderId);
  const availableBoringIds = selectedWO?.borings?.map((b) => b.id) || [];

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.text }}>Daily Driller Report</h2>
        <Btn variant="ghost" onClick={onCancel}><Icon name="x" size={16} /> Close</Btn>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Field label="Work Order" required half>
          <select style={selectStyle} value={form.workOrderId} onChange={(e) => update("workOrderId", e.target.value)}>
            <option value="">Select work order...</option>
            {activeWOs.map((w) => <option key={w.id} value={w.id}>{w.id} — {w.projectName}</option>)}
          </select>
        </Field>
        <Field label="Date" required half><input style={inputStyle} type="date" value={form.date} onChange={(e) => update("date", e.target.value)} /></Field>
        <Field label="Rig" half>
          <select style={selectStyle} value={form.rig} onChange={(e) => update("rig", e.target.value)}>
            <option value="">Select rig...</option>
            {RIGS.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
          </select>
        </Field>
        <Field label="Crew" half>
          <select style={selectStyle} value={form.crew} onChange={(e) => update("crew", e.target.value)}>
            <option value="">Select crew...</option>
            {CREWS.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.lead}</option>)}
          </select>
        </Field>
        <Field label="Driller" half><input style={inputStyle} value={form.driller} onChange={(e) => update("driller", e.target.value)} /></Field>
        <Field label="Weather" half><input style={inputStyle} value={form.weatherConditions} onChange={(e) => update("weatherConditions", e.target.value)} placeholder="Clear, 58°F" /></Field>
        <Field label="Start Time" half><input style={inputStyle} type="time" value={form.startTime} onChange={(e) => update("startTime", e.target.value)} /></Field>
        <Field label="End Time" half><input style={inputStyle} type="time" value={form.endTime} onChange={(e) => update("endTime", e.target.value)} /></Field>
        <Field label="Equipment Issues"><input style={inputStyle} value={form.equipmentIssues} onChange={(e) => update("equipmentIssues", e.target.value)} /></Field>
        <Field label="Safety Incidents"><input style={inputStyle} value={form.safetyIncidents} onChange={(e) => update("safetyIncidents", e.target.value)} /></Field>
      </div>

      {/* REPEATABLE BORING LOGS */}
      <div style={{ marginTop: 24, background: theme.surface2, borderRadius: 10, padding: 18, border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.accent, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="drill" size={15} color={theme.accent} /> Boring Logs
            <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 400 }}>({form.boringLogs.length} borings • {totalFootage} ft • {totalSamples} samples)</span>
          </h3>
          <Btn variant="secondary" small onClick={addLog}><Icon name="plus" size={12} /> Add Boring</Btn>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 500, overflowY: "auto" }}>
          {form.boringLogs.map((log, idx) => (
            <div key={idx} style={{ background: theme.bg, borderRadius: 8, padding: 14, border: `1px solid ${theme.border}40` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: theme.info }}>Boring #{idx + 1}</span>
                {form.boringLogs.length > 1 && <Btn variant="ghost" small onClick={() => removeLog(idx)}><Icon name="x" size={14} color={theme.danger} /></Btn>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: "0 0 100px" }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Boring ID</label>
                  {availableBoringIds.length > 0 ? (
                    <select style={{ ...selectStyle, padding: "5px 8px", fontSize: 12 }} value={log.boringId} onChange={(e) => updateLog(idx, "boringId", e.target.value)}>
                      <option value="">Select...</option>
                      {availableBoringIds.map((id) => <option key={id} value={id}>{id}</option>)}
                    </select>
                  ) : (
                    <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} value={log.boringId} onChange={(e) => updateLog(idx, "boringId", e.target.value)} placeholder="B-1" />
                  )}
                </div>
                <div style={{ flex: "1 1 130px" }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Type</label>
                  <select style={{ ...selectStyle, padding: "5px 8px", fontSize: 12 }} value={log.type} onChange={(e) => updateLog(idx, "type", e.target.value)}>
                    {BORING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ flex: "0 0 80px" }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>From (ft)</label>
                  <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} type="number" value={log.startDepth} onChange={(e) => updateLog(idx, "startDepth", e.target.value)} />
                </div>
                <div style={{ flex: "0 0 80px" }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>To (ft)</label>
                  <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} type="number" value={log.endDepth} onChange={(e) => updateLog(idx, "endDepth", e.target.value)} />
                </div>
                <div style={{ flex: "0 0 70px" }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Footage</label>
                  <div style={{ padding: "6px 8px", fontSize: 13, fontWeight: 700, color: theme.accent }}>{log.footage} ft</div>
                </div>
                <div style={{ flex: "0 0 80px" }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Samples</label>
                  <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} type="number" value={log.samplesCollected} onChange={(e) => updateLog(idx, "samplesCollected", e.target.value)} />
                </div>
                <div style={{ flex: "0 0 90px" }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Water Level</label>
                  <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} value={log.waterLevel} onChange={(e) => updateLog(idx, "waterLevel", e.target.value)} placeholder="18 ft" />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Sample Types</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                  {SAMPLE_TYPES.map((st) => (
                    <button key={st} onClick={() => toggleLogST(idx, st)} style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${log.sampleTypes.includes(st) ? theme.accent : theme.border}`, background: log.sampleTypes.includes(st) ? theme.accentDim : "transparent", color: log.sampleTypes.includes(st) ? theme.accent : theme.textMuted }}>{st}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Soil/Rock Conditions</label>
                  <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} value={log.soilConditions} onChange={(e) => updateLog(idx, "soilConditions", e.target.value)} placeholder="Sandy clay 0-25ft, limestone below 38ft" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>SPT Blow Counts / CPT Data</label>
                  <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} value={log.sptBlowCounts} onChange={(e) => updateLog(idx, "sptBlowCounts", e.target.value)} placeholder="12/15/18, 14/16/20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}><Field label="Daily Notes"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field></div>

      {/* Billing */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.accent }}>Billing Units</h3>
          <Btn variant="secondary" small onClick={addBill}><Icon name="plus" size={12} /> Add Line</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {form.billingEntries.map((entry, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select style={{ ...selectStyle, flex: 2 }} value={entry.unit} onChange={(e) => updateBill(idx, "unit", e.target.value)}>
                <option value="">Select unit...</option>
                {BILLING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <input style={{ ...inputStyle, flex: 1 }} type="number" value={entry.quantity} onChange={(e) => updateBill(idx, "quantity", e.target.value)} placeholder="Qty" />
              <input style={{ ...inputStyle, flex: 1 }} type="number" value={entry.rate} onChange={(e) => updateBill(idx, "rate", e.target.value)} placeholder="Rate $" />
              <span style={{ fontSize: 12, color: theme.accent, fontWeight: 600, minWidth: 80, textAlign: "right" }}>{formatCurrency(entry.quantity * entry.rate)}</span>
              <Btn variant="ghost" small onClick={() => removeBill(idx)}><Icon name="x" size={14} color={theme.danger} /></Btn>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "right", marginTop: 12, fontSize: 14, fontWeight: 700, color: theme.accent }}>Total: {formatCurrency(form.billingEntries.reduce((s, b) => s + b.quantity * b.rate, 0))}</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={handleSubmit}><Icon name="check" size={14} /> Submit Report</Btn>
      </div>
    </div>
  );
}

// ─── Daily Reports List with Approve/Reject ──────────────────────────
export function DailyReportsList({ reports, setReports, workOrders }) {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("all");
  const [reviewNotes, setReviewNotes] = useState({});
  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  const updateStatus = (id, status) => {
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status, reviewNotes: reviewNotes[id] || r.reviewNotes } : r));
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", "submitted", "approved", "rejected"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter === f ? theme.accent : theme.border}`, background: filter === f ? theme.accentDim : "transparent", color: filter === f ? theme.accent : theme.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
            {f === "all" ? "All" : f} ({f === "all" ? reports.length : reports.filter((r) => r.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>No daily reports match this filter.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((r) => {
          const wo = workOrders.find((w) => w.id === r.workOrderId);
          const rig = RIGS.find((x) => x.id === r.rig);
          const crew = CREWS.find((x) => x.id === r.crew);
          const total = r.billingEntries.reduce((s, b) => s + b.quantity * b.rate, 0);
          const totalFt = r.boringLogs.reduce((s, b) => s + (b.footage || 0), 0);
          const totalSmp = r.boringLogs.reduce((s, b) => s + (b.samplesCollected || 0), 0);
          const isOpen = expanded === r.id;

          return (
            <div key={r.id} style={{ background: theme.surface, border: `1px solid ${r.status === "submitted" ? theme.accent + "40" : theme.border}`, borderRadius: 10, overflow: "hidden" }}>
              {/* Header */}
              <div onClick={() => setExpanded(isOpen ? null : r.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", cursor: "pointer", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent, fontFamily: "monospace" }}>{r.id}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{wo?.projectName || r.workOrderId}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{r.date}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{r.driller}</span>
                  <span style={{ fontSize: 11, color: theme.info, fontWeight: 600 }}>{r.boringLogs.length} boring{r.boringLogs.length !== 1 ? "s" : ""}</span>
                  <span style={{ fontSize: 11, color: theme.textMuted }}>{totalFt} ft</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>{formatCurrency(total)}</span>
                  <Badge status={r.status} />
                  {r.status === "submitted" && <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(244,165,58,0.15)", color: theme.accent, borderRadius: 10, fontWeight: 700 }}>NEEDS REVIEW</span>}
                  <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }}><Icon name="chevDown" size={16} color={theme.textMuted} /></span>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, paddingTop: 14 }}>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Rig</span><div style={{ fontSize: 13, color: theme.text }}>{rig?.name} ({rig?.type})</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Crew</span><div style={{ fontSize: 13, color: theme.text }}>{crew?.name} — {crew?.lead}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Hours</span><div style={{ fontSize: 13, color: theme.text }}>{r.startTime} – {r.endTime}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Weather</span><div style={{ fontSize: 13, color: theme.text }}>{r.weatherConditions}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Total Footage</span><div style={{ fontSize: 13, color: theme.accent, fontWeight: 700 }}>{totalFt} ft</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Total Samples</span><div style={{ fontSize: 13, color: theme.text }}>{totalSmp}</div></div>
                  </div>

                  {/* Boring Logs */}
                  <div style={{ marginTop: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.info, textTransform: "uppercase" }}>Boring Logs ({r.boringLogs.length})</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      {r.boringLogs.map((log, i) => (
                        <div key={i} style={{ background: theme.surface2, borderRadius: 8, padding: 12, borderLeft: `3px solid ${theme.info}` }}>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: theme.info, fontFamily: "monospace" }}>{log.boringId}</span>
                            <span style={{ fontSize: 12, color: theme.textMuted }}>{log.type}</span>
                            <span style={{ fontSize: 12, color: theme.text }}>{log.startDepth}–{log.endDepth} ft</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>{log.footage} ft drilled</span>
                            <span style={{ fontSize: 12, color: theme.textMuted }}>{log.samplesCollected} samples</span>
                            <span style={{ fontSize: 12, color: theme.textMuted }}>GW: {log.waterLevel || "N/A"}</span>
                          </div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                            {log.sampleTypes.map((st) => <span key={st} style={{ padding: "1px 6px", borderRadius: 10, fontSize: 10, background: theme.accentDim, color: theme.accent, border: `1px solid ${theme.accent}30` }}>{st}</span>)}
                          </div>
                          <div style={{ fontSize: 12, color: theme.text }}><strong style={{ color: theme.textMuted }}>Soil:</strong> {log.soilConditions}</div>
                          <div style={{ fontSize: 12, color: theme.text, fontFamily: "monospace", marginTop: 2 }}><strong style={{ color: theme.textMuted, fontFamily: "inherit" }}>SPT/CPT:</strong> {log.sptBlowCounts}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {r.equipmentIssues !== "None" && <div style={{ marginTop: 10 }}><span style={{ fontSize: 10, color: theme.danger, textTransform: "uppercase" }}>Equipment Issues</span><div style={{ fontSize: 13, color: theme.danger }}>{r.equipmentIssues}</div></div>}
                  {r.notes && <div style={{ marginTop: 10 }}><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Notes</span><div style={{ fontSize: 13, color: theme.text, marginTop: 2 }}>{r.notes}</div></div>}

                  {/* Billing */}
                  <div style={{ marginTop: 14, background: theme.surface2, borderRadius: 8, padding: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase" }}>Billing Summary</span>
                    <table style={{ width: "100%", marginTop: 8, fontSize: 12, borderCollapse: "collapse" }}>
                      <thead><tr>{["Unit", "Qty", "Rate", "Total"].map((h) => <th key={h} style={{ textAlign: "left", padding: "4px 8px", color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, fontSize: 10, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {r.billingEntries.map((b, i) => (
                          <tr key={i}>
                            <td style={{ padding: "4px 8px", color: theme.text }}>{b.unit}</td>
                            <td style={{ padding: "4px 8px", color: theme.text }}>{b.quantity}</td>
                            <td style={{ padding: "4px 8px", color: theme.textMuted }}>{formatCurrency(b.rate)}</td>
                            <td style={{ padding: "4px 8px", color: theme.accent, fontWeight: 600 }}>{formatCurrency(b.quantity * b.rate)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: `2px solid ${theme.border}` }}>
                          <td colSpan={3} style={{ padding: "6px 8px", fontWeight: 700, color: theme.text, textAlign: "right" }}>Daily Total:</td>
                          <td style={{ padding: "6px 8px", fontWeight: 700, color: theme.accent, fontSize: 14 }}>{formatCurrency(total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {r.reviewNotes && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: r.status === "rejected" ? "rgba(239,68,68,0.1)" : "rgba(74,222,128,0.1)", borderRadius: 6, border: `1px solid ${r.status === "rejected" ? theme.danger : theme.success}30` }}>
                      <span style={{ fontSize: 10, textTransform: "uppercase", color: r.status === "rejected" ? theme.danger : theme.success, fontWeight: 600 }}>Review Notes</span>
                      <div style={{ fontSize: 13, color: theme.text, marginTop: 2 }}>{r.reviewNotes}</div>
                    </div>
                  )}

                  {/* APPROVE / REJECT */}
                  {r.status === "submitted" && (
                    <div style={{ marginTop: 16, padding: 14, background: "rgba(244,165,58,0.06)", border: `1px solid ${theme.accent}30`, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: theme.accent, marginBottom: 8, textTransform: "uppercase" }}>Review This Report</div>
                      <Field label="Review Notes (optional)">
                        <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={reviewNotes[r.id] || ""} onChange={(e) => setReviewNotes((prev) => ({ ...prev, [r.id]: e.target.value }))} placeholder="Add review notes (required for rejection)..." />
                      </Field>
                      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                        <Btn variant="success" onClick={() => updateStatus(r.id, "approved")}><Icon name="check" size={14} /> Approve Report</Btn>
                        <Btn variant="danger" onClick={() => { if (!reviewNotes[r.id]) { alert("Please add review notes for rejection."); return; } updateStatus(r.id, "rejected"); }}><Icon name="reject" size={14} /> Reject Report</Btn>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
