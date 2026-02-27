import { useState } from "react";
import { theme, inputStyle, selectStyle } from "./constants.js";
import { Icon, Badge, Priority, Btn, Field } from "./ui.jsx";
import { downloadWorkOrderPDF } from "./pdfGenerator.js";

// ─── Work Order Form (writes to Supabase) ────────────────────────────
export function WorkOrderForm({ onSubmit, onCancel, editOrder, orgData }) {
  const { rigs, crews, boringTypes, billingUnits, rateTemplates, clients } = orgData;

  const [form, setForm] = useState(editOrder ? {
    project_id: editOrder.project_id || '',
    name: editOrder.name || '',
    scope: editOrder.scope || '',
    priority: editOrder.priority || 'medium',
    submitted_by_type: editOrder.submitted_by_type || 'internal',
    estimated_cost: editOrder.estimated_cost || '',
    assigned_rig_id: editOrder.assigned_rig_id || '',
    assigned_crew_id: editOrder.assigned_crew_id || '',
    scheduled_start: editOrder.scheduled_start || '',
    scheduled_end: editOrder.scheduled_end || '',
  } : {
    project_id: '', name: '', scope: '', priority: 'medium',
    submitted_by_type: 'internal', estimated_cost: '',
    assigned_rig_id: '', assigned_crew_id: '',
    scheduled_start: '', scheduled_end: '',
  });

  const [borings, setBorings] = useState(editOrder?.boringsRaw || [
    { boring_id_label: 'B-1', boring_type_id: boringTypes[0]?.id || '', planned_depth: '', status: 'planned' }
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [rateSchedule, setRateSchedule] = useState(editOrder?.rateScheduleRaw || []);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addBoring = () => {
    const n = borings.length + 1;
    setBorings(b => [...b, { boring_id_label: `B-${n}`, boring_type_id: boringTypes[0]?.id || '', planned_depth: '', status: 'planned' }]);
  };
  const updateBoring = (idx, field, val) => setBorings(b => b.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  const removeBoring = (idx) => setBorings(b => b.filter((_, i) => i !== idx));

  const applyTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const tmpl = rateTemplates.find(t => t.id === templateId);
    if (tmpl && tmpl.items) {
      setRateSchedule(tmpl.items.map(item => ({
        billing_unit_type_id: item.billing_unit_type_id,
        rate: item.rate,
        unit_label: item.unit_label || '',
        estimated_quantity: '',
        name: item.billing_unit?.name || '',
      })));
    }
  };

  const updateRate = (idx, field, val) => setRateSchedule(r => r.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  const addRateLine = () => setRateSchedule(r => [...r, { billing_unit_type_id: '', rate: '', unit_label: '', estimated_quantity: '', name: '' }]);
  const removeRateLine = (idx) => setRateSchedule(r => r.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (!form.project_id || !form.name) return alert('Please select a project and enter a name.');
    const woData = {
      ...form,
      estimated_cost: Number(form.estimated_cost) || 0,
      assigned_rig_id: form.assigned_rig_id || null,
      assigned_crew_id: form.assigned_crew_id || null,
      scheduled_start: form.scheduled_start || null,
      scheduled_end: form.scheduled_end || null,
    };
    const boringData = borings.filter(b => b.boring_id_label).map((b, i) => ({
      boring_id_label: b.boring_id_label,
      boring_type_id: b.boring_type_id || null,
      planned_depth: Number(b.planned_depth) || 0,
      status: b.status || 'planned',
      sort_order: i,
    }));
    const rateData = rateSchedule.filter(r => r.billing_unit_type_id).map((r, i) => ({
      billing_unit_type_id: r.billing_unit_type_id,
      rate: Number(r.rate) || 0,
      unit_label: r.unit_label,
      estimated_quantity: Number(r.estimated_quantity) || null,
      sort_order: i,
    }));
    onSubmit(woData, boringData, rateData);
  };

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.text }}>{editOrder ? "Edit Work Order" : "New Work Order"}</h2>
        <Btn variant="ghost" onClick={onCancel}><Icon name="x" size={16} /> Close</Btn>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["internal", "external"].map(t => (
          <button key={t} onClick={() => update("submitted_by_type", t)} style={{ padding: "6px 16px", borderRadius: 20, border: `1px solid ${form.submitted_by_type === t ? theme.accent : theme.border}`, background: form.submitted_by_type === t ? theme.accentDim : "transparent", color: form.submitted_by_type === t ? theme.accent : theme.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{t} Stakeholder</button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Field label="Project" required half>
          <select style={selectStyle} value={form.project_id} onChange={e => update("project_id", e.target.value)}>
            <option value="">Select project...</option>
            {orgData.projects?.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
          </select>
        </Field>
        <Field label="Work Order Name" required half><input style={inputStyle} value={form.name} onChange={e => update("name", e.target.value)} placeholder="Phase 1 - SPT Borings" /></Field>
        <Field label="Priority" half>
          <select style={selectStyle} value={form.priority} onChange={e => update("priority", e.target.value)}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </Field>
        <Field label="Estimated Cost / T&M Cap ($)" half><input style={inputStyle} value={form.estimated_cost} onChange={e => update("estimated_cost", e.target.value)} type="number" /></Field>
        <Field label="Assigned Rig" half>
          <select style={selectStyle} value={form.assigned_rig_id} onChange={e => update("assigned_rig_id", e.target.value)}>
            <option value="">None</option>
            {rigs.filter(r => r.status === 'available').map(r => <option key={r.id} value={r.id}>{r.name} ({r.rig_type})</option>)}
          </select>
        </Field>
        <Field label="Assigned Crew" half>
          <select style={selectStyle} value={form.assigned_crew_id} onChange={e => update("assigned_crew_id", e.target.value)}>
            <option value="">None</option>
            {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Scheduled Start" half><input style={inputStyle} type="date" value={form.scheduled_start} onChange={e => update("scheduled_start", e.target.value)} /></Field>
        <Field label="Scheduled End" half><input style={inputStyle} type="date" value={form.scheduled_end} onChange={e => update("scheduled_end", e.target.value)} /></Field>
        <Field label="Scope of Work" required><textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.scope} onChange={e => update("scope", e.target.value)} /></Field>
      </div>

      {/* Rate Schedule */}
      <div style={{ marginTop: 24, background: theme.surface2, borderRadius: 10, padding: 18, border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.accent }}>
            <Icon name="dollar" size={15} color={theme.accent} /> Rate Schedule
          </h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select style={{ ...selectStyle, width: 200, fontSize: 12 }} value={selectedTemplate} onChange={e => applyTemplate(e.target.value)}>
              <option value="">Apply rate template...</option>
              {rateTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Btn variant="secondary" small onClick={addRateLine}><Icon name="plus" size={12} /> Add Line</Btn>
          </div>
        </div>
        {rateSchedule.length === 0 && <div style={{ padding: 20, textAlign: "center", color: theme.textMuted, fontSize: 12 }}>No rates added. Select a template or add lines manually.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rateSchedule.map((item, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", background: theme.bg, padding: "8px 10px", borderRadius: 6 }}>
              <select style={{ ...selectStyle, flex: 2, fontSize: 12 }} value={item.billing_unit_type_id} onChange={e => {
                const bu = billingUnits.find(b => b.id === e.target.value);
                updateRate(idx, 'billing_unit_type_id', e.target.value);
                if (bu) { updateRate(idx, 'name', bu.name); updateRate(idx, 'rate', bu.default_rate); }
              }}>
                <option value="">Select unit...</option>
                {billingUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
              </select>
              <input style={{ ...inputStyle, flex: 1, fontSize: 12 }} type="number" value={item.rate} onChange={e => updateRate(idx, 'rate', e.target.value)} placeholder="Rate $" />
              <input style={{ ...inputStyle, flex: 1, fontSize: 12 }} value={item.unit_label} onChange={e => updateRate(idx, 'unit_label', e.target.value)} placeholder="per hour" />
              <input style={{ ...inputStyle, flex: 1, fontSize: 12 }} type="number" value={item.estimated_quantity} onChange={e => updateRate(idx, 'estimated_quantity', e.target.value)} placeholder="Est. Qty" />
              <Btn variant="ghost" small onClick={() => removeRateLine(idx)}><Icon name="x" size={14} color={theme.danger} /></Btn>
            </div>
          ))}
        </div>
      </div>

      {/* Boring Schedule */}
      <div style={{ marginTop: 20, background: theme.surface2, borderRadius: 10, padding: 18, border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.accent }}>
            <Icon name="drill" size={15} color={theme.accent} /> Boring Schedule ({borings.length})
          </h3>
          <Btn variant="secondary" small onClick={addBoring}><Icon name="plus" size={12} /> Add Boring</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {borings.map((b, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", background: theme.bg, padding: "8px 10px", borderRadius: 6 }}>
              <input style={{ ...inputStyle, width: 80, fontSize: 12 }} value={b.boring_id_label} onChange={e => updateBoring(idx, 'boring_id_label', e.target.value)} placeholder="B-1" />
              <select style={{ ...selectStyle, flex: 1, fontSize: 12 }} value={b.boring_type_id} onChange={e => updateBoring(idx, 'boring_type_id', e.target.value)}>
                {boringTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input style={{ ...inputStyle, width: 90, fontSize: 12 }} type="number" value={b.planned_depth} onChange={e => updateBoring(idx, 'planned_depth', e.target.value)} placeholder="Depth (ft)" />
              <Btn variant="ghost" small onClick={() => removeBoring(idx)}><Icon name="x" size={14} color={theme.danger} /></Btn>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: theme.textMuted }}>
          Total planned footage: <strong style={{ color: theme.accent }}>{borings.reduce((s, b) => s + (Number(b.planned_depth) || 0), 0)} ft</strong>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={handleSubmit}><Icon name="check" size={14} /> {editOrder ? "Update" : "Create"} Work Order</Btn>
      </div>
    </div>
  );
}

// ─── Work Orders List (reads adapted data) ───────────────────────────
export function WorkOrdersList({ workOrders, onStatusChange, onEdit }) {
  const [filter, setFilter] = useState("all");
  const [expandedWO, setExpandedWO] = useState(null);
  const filtered = filter === "all" ? workOrders : workOrders.filter(w => w.status === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", "pending", "approved", "scheduled", "in_progress", "completed", "invoiced"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter === f ? theme.accent : theme.border}`, background: filter === f ? theme.accentDim : "transparent", color: filter === f ? theme.accent : theme.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
            {f === "all" ? "All" : f.replace("_", " ")} {f !== "all" && `(${workOrders.filter(w => w.status === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>No work orders match this filter.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(wo => {
          const isOpen = expandedWO === wo.id;
          return (
            <div key={wo.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", cursor: "pointer", gap: 12 }} onClick={() => setExpandedWO(isOpen ? null : wo.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent, fontFamily: "monospace" }}>{wo.woNumber}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wo.projectName}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{wo.client}</span>
                  <Badge status={wo.status} />
                  <Priority level={wo.priority} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: theme.textMuted }}>{wo.borings.length} borings</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>${(wo.estimatedCost || 0).toLocaleString()}</span>
                  <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }}><Icon name="chevDown" size={16} color={theme.textMuted} /></span>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, paddingTop: 14 }}>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Name</span><div style={{ fontSize: 13, color: theme.text }}>{wo.name}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Rig / Crew</span><div style={{ fontSize: 13, color: theme.text }}>{wo.rigName || "—"} / {wo.crewName || "—"}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Dates</span><div style={{ fontSize: 13, color: theme.text }}>{wo.startDate ? `${wo.startDate} → ${wo.endDate}` : "TBD"}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Location</span><div style={{ fontSize: 13, color: theme.text }}>{wo.location || "—"}</div></div>
                  </div>
                  {wo.scope && <div style={{ marginTop: 10 }}><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Scope</span><div style={{ fontSize: 13, color: theme.text, marginTop: 2 }}>{wo.scope}</div></div>}

                  {wo.borings.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase" }}>Boring Schedule ({wo.borings.length})</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {wo.borings.map((b, i) => (
                          <div key={i} style={{ background: theme.surface2, borderRadius: 6, padding: "6px 10px", fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ color: theme.info, fontWeight: 700, fontFamily: "monospace" }}>{b.boringLabel}</span>
                            <span style={{ color: theme.textMuted }}>{b.type}</span>
                            <span style={{ color: theme.text }}>{b.plannedDepth} ft</span>
                            <Badge status={b.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {wo.rateSchedule.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase" }}>Rate Schedule</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                        {wo.rateSchedule.map((r, i) => (
                          <div key={i} style={{ display: "flex", gap: 16, fontSize: 12, padding: "4px 0" }}>
                            <span style={{ color: theme.text, flex: 2 }}>{r.unitName}</span>
                            <span style={{ color: theme.accent, fontWeight: 600 }}>${r.rate}</span>
                            <span style={{ color: theme.textMuted }}>{r.unitLabel}</span>
                            {r.estimatedQty && <span style={{ color: theme.textMuted }}>est. {r.estimatedQty}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    {wo.status === "pending" && <Btn variant="success" small onClick={() => onStatusChange(wo.id, "approved")}><Icon name="check" size={12} /> Approve</Btn>}
                    {wo.status === "pending" && <Btn variant="danger" small onClick={() => onStatusChange(wo.id, "cancelled")}><Icon name="reject" size={12} /> Reject</Btn>}
                    {wo.status === "approved" && <Btn variant="primary" small onClick={() => onStatusChange(wo.id, "scheduled")}><Icon name="calendar" size={12} /> Mark Scheduled</Btn>}
                    {wo.status === "scheduled" && <Btn variant="primary" small onClick={() => onStatusChange(wo.id, "in_progress")}><Icon name="drill" size={12} /> Start Work</Btn>}
                    {wo.status === "in_progress" && <Btn variant="success" small onClick={() => onStatusChange(wo.id, "completed")}><Icon name="check" size={12} /> Complete</Btn>}
                    <Btn variant="secondary" small onClick={() => downloadWorkOrderPDF(wo)}><Icon name="report" size={12} /> PDF</Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
