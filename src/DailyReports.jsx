import { useState, useEffect } from "react";
import { theme, inputStyle, selectStyle } from "./constants.js";
import { Icon, Badge, Btn, Field } from "./ui.jsx";
import { downloadDailyReportPDF } from "./pdfGenerator.js";

// ─── Daily Report Form (writes to Supabase) ─────────────────────────
export function DailyReportForm({ onSubmit, onCancel, orgData, workOrders }) {
  const { rigs, crews, staff, boringTypes } = orgData;
  const activeWOs = workOrders.filter(w => w.status === "in_progress" || w.status === "scheduled");

  const [form, setForm] = useState({
    work_order_id: activeWOs[0]?.id || '', report_date: new Date().toISOString().split("T")[0],
    rig_id: '', crew_id: '', driller_id: '', start_time: '07:00', end_time: '17:00',
    weather_conditions: '', equipment_issues: 'None', safety_incidents: 'None', notes: '',
  });

  const [production, setProduction] = useState([
    { wo_boring_id: '', boring_type_id: boringTypes[0]?.id || '', start_depth: 0, end_depth: 0, description: '' }
  ]);

  const [billing, setBilling] = useState([]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill rig/crew when WO selected
  const selectedWO = workOrders.find(w => w.id === form.work_order_id);
  useEffect(() => {
    if (selectedWO) {
      setForm(f => ({
        ...f,
        rig_id: f.rig_id || selectedWO.assignedRig || '',
        crew_id: f.crew_id || selectedWO.assignedCrew || '',
      }));
      // Load rate schedule as billing options
      if (selectedWO.rateSchedule?.length && billing.length === 0) {
        setBilling(selectedWO.rateSchedule.map(r => ({
          wo_rate_schedule_id: r.id, rate: r.rate, quantity: 0, unitName: r.unitName, unitLabel: r.unitLabel,
        })));
      }
    }
  }, [form.work_order_id]);

  const addProd = () => setProduction(p => [...p, { wo_boring_id: '', boring_type_id: boringTypes[0]?.id || '', start_depth: 0, end_depth: 0, description: '' }]);
  const updateProd = (idx, field, val) => setProduction(p => p.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  const removeProd = (idx) => setProduction(p => p.filter((_, i) => i !== idx));

  const updateBill = (idx, field, val) => setBilling(b => b.map((x, i) => i === idx ? { ...x, [field]: val } : x));

  const handleSubmit = () => {
    if (!form.work_order_id || !form.report_date) return alert('Please select a work order and date.');
    const reportData = {
      ...form,
      rig_id: form.rig_id || null,
      crew_id: form.crew_id || null,
      driller_id: form.driller_id || null,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    };
    const prodData = production.filter(p => p.wo_boring_id || p.start_depth || p.end_depth).map((p, i) => ({
      wo_boring_id: p.wo_boring_id || null,
      boring_type_id: p.boring_type_id || null,
      start_depth: Number(p.start_depth) || 0,
      end_depth: Number(p.end_depth) || 0,
      description: p.description,
      sort_order: i,
    }));
    const billData = billing.filter(b => Number(b.quantity) > 0).map((b, i) => ({
      wo_rate_schedule_id: b.wo_rate_schedule_id || null,
      quantity: Number(b.quantity),
      rate: Number(b.rate),
      sort_order: i,
    }));
    onSubmit(reportData, prodData, billData);
  };

  // Get available borings from selected WO
  const availableBorings = selectedWO?.borings || [];
  const totalFootage = production.reduce((s, p) => s + Math.max(0, (Number(p.end_depth) || 0) - (Number(p.start_depth) || 0)), 0);
  const totalBilling = billing.reduce((s, b) => s + (Number(b.quantity) || 0) * (Number(b.rate) || 0), 0);

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.text }}>Daily Driller Report</h2>
        <Btn variant="ghost" onClick={onCancel}><Icon name="x" size={16} /> Close</Btn>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Field label="Work Order" required half>
          <select style={selectStyle} value={form.work_order_id} onChange={e => update("work_order_id", e.target.value)}>
            <option value="">Select work order...</option>
            {activeWOs.map(w => <option key={w.id} value={w.id}>{w.woNumber} — {w.name}</option>)}
          </select>
        </Field>
        <Field label="Date" required half><input style={inputStyle} type="date" value={form.report_date} onChange={e => update("report_date", e.target.value)} /></Field>
        <Field label="Rig" half>
          <select style={selectStyle} value={form.rig_id} onChange={e => update("rig_id", e.target.value)}>
            <option value="">Select rig...</option>
            {rigs.map(r => <option key={r.id} value={r.id}>{r.name} ({r.rig_type})</option>)}
          </select>
        </Field>
        <Field label="Crew" half>
          <select style={selectStyle} value={form.crew_id} onChange={e => update("crew_id", e.target.value)}>
            <option value="">Select crew...</option>
            {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Driller" half>
          <select style={selectStyle} value={form.driller_id} onChange={e => update("driller_id", e.target.value)}>
            <option value="">Select driller...</option>
            {staff.filter(s => s.role_title?.includes('Driller') || s.role_title?.includes('Operator')).map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role_title}</option>)}
          </select>
        </Field>
        <Field label="Weather" half><input style={inputStyle} value={form.weather_conditions} onChange={e => update("weather_conditions", e.target.value)} placeholder="Clear, 58°F" /></Field>
        <Field label="Start Time" half><input style={inputStyle} type="time" value={form.start_time} onChange={e => update("start_time", e.target.value)} /></Field>
        <Field label="End Time" half><input style={inputStyle} type="time" value={form.end_time} onChange={e => update("end_time", e.target.value)} /></Field>
        <Field label="Equipment Issues"><input style={inputStyle} value={form.equipment_issues} onChange={e => update("equipment_issues", e.target.value)} /></Field>
        <Field label="Safety Incidents"><input style={inputStyle} value={form.safety_incidents} onChange={e => update("safety_incidents", e.target.value)} /></Field>
      </div>

      {/* Production Entries */}
      <div style={{ marginTop: 24, background: theme.surface2, borderRadius: 10, padding: 18, border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.accent }}>
            <Icon name="drill" size={15} color={theme.accent} /> Production ({production.length} entries • {totalFootage} ft)
          </h3>
          <Btn variant="secondary" small onClick={addProd}><Icon name="plus" size={12} /> Add Entry</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {production.map((p, idx) => (
            <div key={idx} style={{ background: theme.bg, borderRadius: 8, padding: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 120px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Boring</label>
                <select style={{ ...selectStyle, fontSize: 12 }} value={p.wo_boring_id} onChange={e => updateProd(idx, 'wo_boring_id', e.target.value)}>
                  <option value="">Select...</option>
                  {availableBorings.map(b => <option key={b.id} value={b.id}>{b.boringLabel}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 130px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Type</label>
                <select style={{ ...selectStyle, fontSize: 12 }} value={p.boring_type_id} onChange={e => updateProd(idx, 'boring_type_id', e.target.value)}>
                  {boringTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 80px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>From (ft)</label>
                <input style={{ ...inputStyle, fontSize: 12 }} type="number" value={p.start_depth} onChange={e => updateProd(idx, 'start_depth', e.target.value)} />
              </div>
              <div style={{ flex: "0 0 80px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>To (ft)</label>
                <input style={{ ...inputStyle, fontSize: 12 }} type="number" value={p.end_depth} onChange={e => updateProd(idx, 'end_depth', e.target.value)} />
              </div>
              <div style={{ flex: "0 0 60px", textAlign: "center" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Footage</label>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>{Math.max(0, (Number(p.end_depth) || 0) - (Number(p.start_depth) || 0))} ft</div>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Notes</label>
                <input style={{ ...inputStyle, fontSize: 12 }} value={p.description} onChange={e => updateProd(idx, 'description', e.target.value)} placeholder="Brief note" />
              </div>
              {production.length > 1 && <div style={{ paddingTop: 14 }}><Btn variant="ghost" small onClick={() => removeProd(idx)}><Icon name="x" size={14} color={theme.danger} /></Btn></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Billing */}
      {billing.length > 0 && (
        <div style={{ marginTop: 20, background: theme.surface2, borderRadius: 10, padding: 18, border: `1px solid ${theme.border}` }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: theme.accent }}>
            <Icon name="dollar" size={15} color={theme.accent} /> Billing (from WO rate schedule)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {billing.map((b, idx) => (
              <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${theme.border}15` }}>
                <span style={{ flex: 2, fontSize: 13, color: theme.text }}>{b.unitName}</span>
                <span style={{ fontSize: 12, color: theme.textMuted }}>${b.rate} {b.unitLabel}</span>
                <input style={{ ...inputStyle, width: 80, fontSize: 12 }} type="number" value={b.quantity} onChange={e => updateBill(idx, 'quantity', e.target.value)} placeholder="Qty" />
                <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent, minWidth: 80, textAlign: "right" }}>${((Number(b.quantity) || 0) * (Number(b.rate) || 0)).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "right", marginTop: 12, fontSize: 15, fontWeight: 700, color: theme.accent }}>Total: ${totalBilling.toLocaleString()}</div>
        </div>
      )}

      <div style={{ marginTop: 16 }}><Field label="Daily Notes"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={e => update("notes", e.target.value)} /></Field></div>

      <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={handleSubmit}><Icon name="check" size={14} /> Submit Report</Btn>
      </div>
    </div>
  );
}

// ─── Daily Reports List with Approve/Reject ──────────────────────────
export function DailyReportsList({ reports, workOrders, onStatusChange }) {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("all");
  const [reviewNotes, setReviewNotes] = useState({});
  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", "draft", "submitted", "approved", "rejected"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter === f ? theme.accent : theme.border}`, background: filter === f ? theme.accentDim : "transparent", color: filter === f ? theme.accent : theme.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
            {f === "all" ? "All" : f} ({f === "all" ? reports.length : reports.filter(r => r.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>No daily reports match this filter.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(r => {
          const totalBilling = (r.billing || []).reduce((s, b) => s + (b.total || 0), 0);
          const totalFt = (r.production || []).reduce((s, p) => s + (p.footage || 0), 0);
          const isOpen = expanded === r.id;

          return (
            <div key={r.id} style={{ background: theme.surface, border: `1px solid ${r.status === "submitted" ? theme.accent + "40" : theme.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div onClick={() => setExpanded(isOpen ? null : r.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", cursor: "pointer", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent, fontFamily: "monospace" }}>{r.reportNumber}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{r.projectName || r.workOrderName}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{r.date}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{r.driller}</span>
                  <span style={{ fontSize: 11, color: theme.info, fontWeight: 600 }}>{totalFt} ft</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>${totalBilling.toLocaleString()}</span>
                  <Badge status={r.status} />
                  {r.status === "submitted" && <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(244,165,58,0.15)", color: theme.accent, borderRadius: 10, fontWeight: 700 }}>NEEDS REVIEW</span>}
                  <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }}><Icon name="chevDown" size={16} color={theme.textMuted} /></span>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, paddingTop: 14 }}>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Rig</span><div style={{ fontSize: 13, color: theme.text }}>{r.rigName} {r.rigType && `(${r.rigType})`}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Crew</span><div style={{ fontSize: 13, color: theme.text }}>{r.crewName}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Hours</span><div style={{ fontSize: 13, color: theme.text }}>{r.startTime} – {r.endTime}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Weather</span><div style={{ fontSize: 13, color: theme.text }}>{r.weatherConditions}</div></div>
                  </div>

                  {r.production?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: theme.info, textTransform: "uppercase" }}>Production ({r.production.length})</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                        {r.production.map((p, i) => (
                          <div key={i} style={{ background: theme.surface2, borderRadius: 6, padding: "8px 12px", borderLeft: `3px solid ${theme.info}`, display: "flex", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
                            <span style={{ color: theme.info, fontWeight: 700, fontFamily: "monospace" }}>{p.boringLabel || '—'}</span>
                            <span style={{ color: theme.textMuted }}>{p.typeName}</span>
                            <span style={{ color: theme.text }}>{p.startDepth}–{p.endDepth} ft</span>
                            <span style={{ color: theme.accent, fontWeight: 700 }}>{p.footage} ft</span>
                            {p.description && <span style={{ color: theme.textMuted }}>{p.description}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.billing?.length > 0 && (
                    <div style={{ marginTop: 14, background: theme.surface2, borderRadius: 8, padding: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase" }}>Billing</span>
                      {r.billing.map((b, i) => (
                        <div key={i} style={{ display: "flex", gap: 16, fontSize: 12, padding: "4px 0" }}>
                          <span style={{ flex: 2, color: theme.text }}>{b.unitName}</span>
                          <span style={{ color: theme.textMuted }}>{b.quantity} × ${b.rate}</span>
                          <span style={{ color: theme.accent, fontWeight: 600 }}>${(b.total || 0).toLocaleString()}</span>
                        </div>
                      ))}
                      <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: 6, paddingTop: 6, textAlign: "right", fontSize: 14, fontWeight: 700, color: theme.accent }}>Total: ${totalBilling.toLocaleString()}</div>
                    </div>
                  )}

                  {r.notes && <div style={{ marginTop: 10 }}><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Notes</span><div style={{ fontSize: 13, color: theme.text, marginTop: 2 }}>{r.notes}</div></div>}

                  {r.reviewNotes && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: r.status === "rejected" ? "rgba(239,68,68,0.1)" : "rgba(74,222,128,0.1)", borderRadius: 6 }}>
                      <span style={{ fontSize: 10, textTransform: "uppercase", color: r.status === "rejected" ? theme.danger : theme.success, fontWeight: 600 }}>Review Notes</span>
                      <div style={{ fontSize: 13, color: theme.text, marginTop: 2 }}>{r.reviewNotes}</div>
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <Btn variant="secondary" small onClick={() => downloadDailyReportPDF(r)}><Icon name="report" size={12} /> Download PDF</Btn>
                  </div>}

                  {r.status === "submitted" && (
                    <div style={{ marginTop: 16, padding: 14, background: "rgba(244,165,58,0.06)", border: `1px solid ${theme.accent}30`, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: theme.accent, marginBottom: 8, textTransform: "uppercase" }}>Review This Report</div>
                      <Field label="Review Notes">
                        <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={reviewNotes[r.id] || ""} onChange={e => setReviewNotes(prev => ({ ...prev, [r.id]: e.target.value }))} placeholder="Add review notes (required for rejection)..." />
                      </Field>
                      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                        <Btn variant="success" onClick={() => onStatusChange(r.id, "approved", reviewNotes[r.id] || '')}><Icon name="check" size={14} /> Approve</Btn>
                        <Btn variant="danger" onClick={() => { if (!reviewNotes[r.id]) return alert("Please add review notes for rejection."); onStatusChange(r.id, "rejected", reviewNotes[r.id]); }}><Icon name="reject" size={14} /> Reject</Btn>
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
