import { useState } from "react";
import { theme, inputStyle, selectStyle } from "./constants.js";
import { Icon, Badge, Priority, Btn, Field } from "./ui.jsx";
import { downloadWorkOrderPDF } from "./pdfGenerator.js";
import { WOAttachments } from "./FileUpload.jsx";
import { supabase } from "./supabaseClient.js";

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
    requested_start: editOrder.requested_start || editOrder.scheduled_start || '',
    requested_end: editOrder.requested_end || editOrder.scheduled_end || '',
    scheduled_start: editOrder.scheduled_start || '',
    scheduled_end: editOrder.scheduled_end || '',
    actual_start: editOrder.actual_start || '',
    actual_end: editOrder.actual_end || '',
    site_address: editOrder.site_address || '',
    site_lat: editOrder.site_lat || '',
    site_lng: editOrder.site_lng || '',
    onecall_number: editOrder.onecall_number || '',
    onecall_date: editOrder.onecall_date || '',
    requested_by: editOrder.requested_by || '',
    engineer_rep: editOrder.engineer_rep || '',
  } : {
    project_id: '', name: '', scope: '', priority: 'medium',
    submitted_by_type: 'internal', estimated_cost: '',
    assigned_rig_id: '', assigned_crew_id: '',
    requested_start: '', requested_end: '',
    scheduled_start: '', scheduled_end: '',
    actual_start: '', actual_end: '',
    site_address: '', site_lat: '', site_lng: '',
    onecall_number: '', onecall_date: '',
    requested_by: '', engineer_rep: '',
  });

  const [borings, setBorings] = useState(() => {
    if (editOrder?.borings?.length) {
      return editOrder.borings.map(b => ({
        boring_id_label: b.boring_id_label || '',
        boring_type_id: b.boring_type_id || boringTypes[0]?.id || '',
        planned_depth: b.planned_depth || '',
        status: b.status || 'planned',
      }));
    }
    return [{ boring_id_label: 'B-1', boring_type_id: boringTypes[0]?.id || '', planned_depth: '', status: 'planned' }];
  });

  // Other field activities (monitoring wells, test pits, etc.)
  const WO_ACTIVITY_TYPES = [
    "Monitoring Well", "Test Pit", "Clearing", "Boring Stake Out",
    "Concrete Coring", "Pavement Coring", "Hand Auger", "DCP Test",
    "Percolation Test", "Plate Load Test", "Other",
  ];
  const [woActivities, setWoActivities] = useState(editOrder?.woActivities || []);
  const addWoActivity = () => setWoActivities(a => [...a, { activity_type: WO_ACTIVITY_TYPES[0], quantity: 1, depth: '', size: '', method: '', notes: '' }]);
  const updateWoActivity = (idx, field, val) => setWoActivities(a => a.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  const removeWoActivity = (idx) => setWoActivities(a => a.filter((_, i) => i !== idx));

  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [rateSchedule, setRateSchedule] = useState(() => {
    if (editOrder?.rateSchedule?.length) {
      return editOrder.rateSchedule.map(r => ({
        billing_unit_type_id: r.billing_unit_type_id || '',
        rate: r.rate || '',
        unit_label: r.unit_label || '',
        estimated_quantity: r.estimated_quantity || '',
        name: r.billing_unit?.name || '',
      }));
    }
    return [];
  });

  // Geocoding
  const [geocoding, setGeocoding] = useState(false);
  const geocodeAddress = async () => {
    if (!form.site_address) return;
    setGeocoding(true);
    try {
      const q = encodeURIComponent(form.site_address);
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`, { headers: { 'User-Agent': 'DrillTrack/1.0' } });
      const results = await resp.json();
      if (results?.length > 0) {
        update('site_lat', parseFloat(results[0].lat).toFixed(6));
        update('site_lng', parseFloat(results[0].lon).toFixed(6));
      }
    } catch (e) { console.error('Geocode error:', e); }
    setGeocoding(false);
  };

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
      requested_start: form.requested_start || null,
      requested_end: form.requested_end || null,
      scheduled_start: form.scheduled_start || null,
      scheduled_end: form.scheduled_end || null,
      actual_start: form.actual_start || null,
      actual_end: form.actual_end || null,
      site_address: form.site_address || null,
      site_lat: form.site_lat ? parseFloat(form.site_lat) : null,
      site_lng: form.site_lng ? parseFloat(form.site_lng) : null,
      onecall_number: form.onecall_number || null,
      onecall_date: form.onecall_date || null,
      requested_by: form.requested_by || null,
      engineer_rep: form.engineer_rep || null,
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

        {/* Requestor & Engineer */}
        <Field label="Requested By" half><input style={inputStyle} value={form.requested_by} onChange={e => update("requested_by", e.target.value)} placeholder="Auto-filled on create" disabled={!editOrder && !!form.requested_by} /></Field>
        <Field label="Engineer / Project Rep" half><input style={inputStyle} value={form.engineer_rep} onChange={e => update("engineer_rep", e.target.value)} placeholder="Engineer or PM name" /></Field>

        {/* Requested Dates (from requestor) */}
        <Field label="Requested Start" half><input style={inputStyle} type="date" value={form.requested_start} onChange={e => update("requested_start", e.target.value)} /></Field>
        <Field label="Requested End" half><input style={inputStyle} type="date" value={form.requested_end} onChange={e => update("requested_end", e.target.value)} /></Field>

        {/* Scheduled Dates (set by management) */}
        <Field label="Scheduled Start (Mgmt)" half><input style={inputStyle} type="date" value={form.scheduled_start} onChange={e => update("scheduled_start", e.target.value)} /></Field>
        <Field label="Scheduled End (Mgmt)" half><input style={inputStyle} type="date" value={form.scheduled_end} onChange={e => update("scheduled_end", e.target.value)} /></Field>

        {/* Actual Dates (field reality) */}
        <Field label="Actual Start" half><input style={inputStyle} type="date" value={form.actual_start} onChange={e => update("actual_start", e.target.value)} /></Field>
        <Field label="Actual End" half><input style={inputStyle} type="date" value={form.actual_end} onChange={e => update("actual_end", e.target.value)} /></Field>
        <Field label="Scope of Work" required><textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.scope} onChange={e => update("scope", e.target.value)} /></Field>
      </div>

      {/* Site Address & Coordinates */}
      <div style={{ marginTop: 20, background: theme.surface2, borderRadius: 10, padding: 18, border: `1px solid ${theme.border}` }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: theme.accent }}>
          <Icon name="map" size={15} color={theme.accent} /> Site Location
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Field label="Site Address" wide>
            <div style={{ display: "flex", gap: 6 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={form.site_address} onChange={e => update("site_address", e.target.value)} placeholder="123 Main St, Mobile, AL 36602" />
              <button onClick={geocodeAddress} disabled={geocoding || !form.site_address} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${theme.accent}40`, background: theme.accentDim, color: theme.accent, cursor: geocoding ? "wait" : "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {geocoding ? '...' : '📍 Geocode'}
              </button>
            </div>
          </Field>
          <Field label="Latitude" half><input style={inputStyle} value={form.site_lat} onChange={e => update("site_lat", e.target.value)} placeholder="30.6954" /></Field>
          <Field label="Longitude" half><input style={inputStyle} value={form.site_lng} onChange={e => update("site_lng", e.target.value)} placeholder="-88.0399" /></Field>
        </div>
      </div>

      {/* One-Call / Utility Locate */}
      <div style={{ marginTop: 16, background: theme.surface2, borderRadius: 10, padding: 18, border: `1px solid ${theme.border}` }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: theme.accent }}>
          <Icon name="alert" size={15} color={theme.accent} /> One-Call / Utility Locate
        </h3>
        <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600, marginBottom: 12, padding: "6px 10px", background: "rgba(239,68,68,0.08)", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
          ⚠ One-Call must be completed on all projects at least 3 business days before field work begins.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Field label="One-Call Ticket Number" half><input style={inputStyle} value={form.onecall_number} onChange={e => update("onecall_number", e.target.value)} placeholder="AL-2026-00123" /></Field>
          <Field label="One-Call Date" half><input style={inputStyle} type="date" value={form.onecall_date} onChange={e => update("onecall_date", e.target.value)} /></Field>
        </div>
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

      {/* Other Field Activities */}
      <div style={{ marginTop: 16, background: theme.surface2, borderRadius: 10, padding: 18, border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>
            <Icon name="clipboard" size={15} color="#a78bfa" /> Other Field Activities ({woActivities.length})
          </h3>
          <Btn variant="secondary" small onClick={addWoActivity}><Icon name="plus" size={12} /> Add Activity</Btn>
        </div>
        {woActivities.length === 0 && <div style={{ padding: 12, textAlign: "center", color: theme.textMuted, fontSize: 12 }}>No additional activities. Add monitoring wells, test pits, etc.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {woActivities.map((a, idx) => (
            <div key={idx} style={{ background: theme.bg, borderRadius: 8, padding: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "1 1 140px", minWidth: 120 }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Type</label>
                <select style={{ ...selectStyle, fontSize: 12 }} value={a.activity_type} onChange={e => updateWoActivity(idx, 'activity_type', e.target.value)}>
                  {WO_ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 60px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Qty</label>
                <input style={{ ...inputStyle, fontSize: 12 }} type="number" value={a.quantity} onChange={e => updateWoActivity(idx, 'quantity', e.target.value)} />
              </div>
              {(a.activity_type === 'Monitoring Well' || a.activity_type === 'Test Pit') && (
                <div style={{ flex: "0 0 80px" }}>
                  <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Depth (ft)</label>
                  <input style={{ ...inputStyle, fontSize: 12 }} type="number" value={a.depth} onChange={e => updateWoActivity(idx, 'depth', e.target.value)} />
                </div>
              )}
              {a.activity_type === 'Monitoring Well' && (
                <>
                  <div style={{ flex: "0 0 80px" }}>
                    <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Size (in)</label>
                    <input style={{ ...inputStyle, fontSize: 12 }} value={a.size} onChange={e => updateWoActivity(idx, 'size', e.target.value)} placeholder='2"' />
                  </div>
                  <div style={{ flex: "1 1 120px" }}>
                    <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Finishing</label>
                    <select style={{ ...selectStyle, fontSize: 12 }} value={a.method} onChange={e => updateWoActivity(idx, 'method', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="flush_mount">Flush Mount</option>
                      <option value="stick_up">Stick Up</option>
                      <option value="monument">Monument</option>
                      <option value="bollard">Bollard Protected</option>
                    </select>
                  </div>
                </>
              )}
              <div style={{ flex: "1 1 100%", minWidth: 0 }}>
                <input style={{ ...inputStyle, fontSize: 12 }} value={a.notes} onChange={e => updateWoActivity(idx, 'notes', e.target.value)} placeholder="Notes..." />
              </div>
              <Btn variant="ghost" small onClick={() => removeWoActivity(idx)}><Icon name="x" size={14} color={theme.danger} /></Btn>
            </div>
          ))}
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
export function WorkOrdersList({ workOrders, onStatusChange, onEdit, isMobile, canManage, orgData, onQuickUpdate }) {
  const [filter, setFilter] = useState("all");
  const [expandedWO, setExpandedWO] = useState(null);
  const [attachments, setAttachments] = useState({});
  const [quickEdit, setQuickEdit] = useState(null); // WO id being quick-edited
  const [qe, setQe] = useState({}); // quick edit fields

  const fetchAttachments = async (woId) => {
    const { data } = await supabase.from('wo_attachments').select('*').eq('work_order_id', woId).order('created_at', { ascending: false });
    setAttachments(prev => ({ ...prev, [woId]: data || [] }));
  };

  const handleExpand = (woId) => {
    if (expandedWO === woId) { setExpandedWO(null); return; }
    setExpandedWO(woId);
    if (!attachments[woId]) fetchAttachments(woId);
  };
  const filtered = filter === "all" ? workOrders : workOrders.filter(w => w.status === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
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
              <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", padding: isMobile ? "10px 12px" : "12px 18px", cursor: "pointer", gap: 8, flexDirection: isMobile ? "column" : "row" }} onClick={() => handleExpand(wo.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent, fontFamily: "monospace" }}>{wo.woNumber}</span>
                  {wo.projectNumber && <span style={{ fontSize: 11, fontWeight: 600, color: theme.info, fontFamily: "monospace" }}>{wo.projectNumber}</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}>{isMobile ? wo.name : wo.projectName}</span>
                  {!isMobile && <span style={{ fontSize: 12, color: theme.textMuted }}>{wo.client}</span>}
                  <Badge status={wo.status} />
                  <Priority level={wo.priority} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {isMobile && <span style={{ fontSize: 11, color: theme.textMuted }}>{wo.client}</span>}
                  <span style={{ fontSize: 11, color: theme.textMuted }}>{wo.borings.length} borings</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>${(wo.estimatedCost || 0).toLocaleString()}</span>
                  <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }}><Icon name="chevDown" size={16} color={theme.textMuted} /></span>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: isMobile ? "0 12px 14px" : "0 18px 18px", borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, paddingTop: 12 }}>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Name</span><div style={{ fontSize: 13, color: theme.text }}>{wo.name}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Rig / Crew</span><div style={{ fontSize: 13, color: theme.text }}>{wo.rigName || "—"} / {wo.crewName || "—"}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Requested By</span><div style={{ fontSize: 13, color: theme.text }}>{wo.requestedBy || "—"}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Engineer / Rep</span><div style={{ fontSize: 13, color: theme.text }}>{wo.engineerRep || "—"}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Requested Dates</span><div style={{ fontSize: 13, color: theme.textMuted }}>{wo.requestedStart ? `${wo.requestedStart} → ${wo.requestedEnd || 'TBD'}` : "—"}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.info, textTransform: "uppercase", fontWeight: 600 }}>Scheduled Dates</span><div style={{ fontSize: 13, color: theme.info, fontWeight: 600 }}>{wo.startDate ? `${wo.startDate} → ${wo.endDate || 'TBD'}` : "TBD"}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.success, textTransform: "uppercase", fontWeight: 600 }}>Actual Dates</span><div style={{ fontSize: 13, color: theme.success, fontWeight: 600 }}>{wo.actualStart ? `${wo.actualStart} → ${wo.actualEnd || 'ongoing'}` : "—"}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Location</span><div style={{ fontSize: 13, color: theme.text }}>{wo.siteAddress || wo.location || "—"}</div></div>
                    {wo.onecallNumber && <div><span style={{ fontSize: 10, color: theme.danger, textTransform: "uppercase", fontWeight: 600 }}>One-Call #</span><div style={{ fontSize: 13, color: theme.text }}>{wo.onecallNumber} {wo.onecallDate && <span style={{ color: theme.textMuted, fontSize: 11 }}>({wo.onecallDate})</span>}</div></div>}
                  </div>
                  {wo.scope && <div style={{ marginTop: 10 }}><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Scope</span><div style={{ fontSize: 13, color: theme.text, marginTop: 2 }}>{wo.scope}</div></div>}

                  {/* Quick Assignment Panel */}
                  {canManage && quickEdit === wo.id && (
                    <div style={{ marginTop: 14, padding: 14, background: "rgba(96,165,250,0.06)", border: `1px solid rgba(96,165,250,0.2)`, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: theme.info, marginBottom: 10, textTransform: "uppercase" }}>Quick Assignment Update</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        <Field label="Rig" half>
                          <select style={{ ...selectStyle, fontSize: 12 }} value={qe.assigned_rig_id ?? ''} onChange={e => setQe(q => ({ ...q, assigned_rig_id: e.target.value }))}>
                            <option value="">None</option>
                            {(orgData?.rigs || []).map(r => <option key={r.id} value={r.id}>{r.name} ({r.rig_type})</option>)}
                          </select>
                        </Field>
                        <Field label="Crew" half>
                          <select style={{ ...selectStyle, fontSize: 12 }} value={qe.assigned_crew_id ?? ''} onChange={e => setQe(q => ({ ...q, assigned_crew_id: e.target.value }))}>
                            <option value="">None</option>
                            {(orgData?.crews || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </Field>
                        <Field label="Scheduled Start" half><input style={{ ...inputStyle, fontSize: 12 }} type="date" value={qe.scheduled_start ?? ''} onChange={e => setQe(q => ({ ...q, scheduled_start: e.target.value }))} /></Field>
                        <Field label="Scheduled End" half><input style={{ ...inputStyle, fontSize: 12 }} type="date" value={qe.scheduled_end ?? ''} onChange={e => setQe(q => ({ ...q, scheduled_end: e.target.value }))} /></Field>
                        <Field label="Actual Start" half><input style={{ ...inputStyle, fontSize: 12 }} type="date" value={qe.actual_start ?? ''} onChange={e => setQe(q => ({ ...q, actual_start: e.target.value }))} /></Field>
                        <Field label="Actual End" half><input style={{ ...inputStyle, fontSize: 12 }} type="date" value={qe.actual_end ?? ''} onChange={e => setQe(q => ({ ...q, actual_end: e.target.value }))} /></Field>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <Btn small onClick={() => {
                          const updates = {};
                          if (qe.assigned_rig_id !== undefined) updates.assigned_rig_id = qe.assigned_rig_id || null;
                          if (qe.assigned_crew_id !== undefined) updates.assigned_crew_id = qe.assigned_crew_id || null;
                          if (qe.scheduled_start !== undefined) updates.scheduled_start = qe.scheduled_start || null;
                          if (qe.scheduled_end !== undefined) updates.scheduled_end = qe.scheduled_end || null;
                          if (qe.actual_start !== undefined) updates.actual_start = qe.actual_start || null;
                          if (qe.actual_end !== undefined) updates.actual_end = qe.actual_end || null;
                          onQuickUpdate(wo.id, updates);
                          setQuickEdit(null); setQe({});
                        }}><Icon name="check" size={12} /> Save Changes</Btn>
                        <Btn variant="ghost" small onClick={() => { setQuickEdit(null); setQe({}); }}>Cancel</Btn>
                      </div>
                    </div>
                  )}

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

                  {/* Attachments */}
                  <div style={{ marginTop: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase" }}>
                      Attachments ({(attachments[wo.id] || []).length})
                    </span>
                    <div style={{ marginTop: 8 }}>
                      <WOAttachments
                        workOrderId={wo.id}
                        attachments={attachments[wo.id] || []}
                        onRefresh={() => fetchAttachments(wo.id)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    {/* Forward status actions */}
                    {canManage && wo.status === "pending" && <Btn variant="success" small onClick={() => onStatusChange(wo.id, "approved")}><Icon name="check" size={12} /> Approve</Btn>}
                    {canManage && wo.status === "pending" && <Btn variant="danger" small onClick={() => onStatusChange(wo.id, "cancelled")}><Icon name="reject" size={12} /> Reject</Btn>}
                    {canManage && wo.status === "approved" && <Btn variant="primary" small onClick={() => onStatusChange(wo.id, "scheduled")}><Icon name="calendar" size={12} /> Mark Scheduled</Btn>}
                    {canManage && wo.status === "scheduled" && <Btn variant="primary" small onClick={() => onStatusChange(wo.id, "in_progress")}><Icon name="drill" size={12} /> Start Work</Btn>}
                    {canManage && wo.status === "in_progress" && <Btn variant="success" small onClick={() => onStatusChange(wo.id, "completed")}><Icon name="check" size={12} /> Complete</Btn>}
                    {/* Rollback status actions */}
                    {canManage && wo.status === "approved" && <Btn variant="ghost" small onClick={() => onStatusChange(wo.id, "pending")}><Icon name="reject" size={12} /> → Back to Pending</Btn>}
                    {canManage && wo.status === "scheduled" && <Btn variant="ghost" small onClick={() => onStatusChange(wo.id, "approved")}><Icon name="reject" size={12} /> → Back to Approved</Btn>}
                    {canManage && wo.status === "in_progress" && <Btn variant="ghost" small onClick={() => onStatusChange(wo.id, "scheduled")}><Icon name="reject" size={12} /> → Back to Scheduled</Btn>}
                    {canManage && wo.status === "completed" && <Btn variant="ghost" small onClick={() => onStatusChange(wo.id, "in_progress")}><Icon name="reject" size={12} /> → Reopen</Btn>}
                    {canManage && wo.status === "cancelled" && <Btn variant="ghost" small onClick={() => onStatusChange(wo.id, "pending")}><Icon name="reject" size={12} /> → Reactivate</Btn>}
                    {/* Tools */}
                    <Btn variant="secondary" small onClick={() => downloadWorkOrderPDF(wo)}><Icon name="report" size={12} /> PDF</Btn>
                    {canManage && <Btn variant="secondary" small onClick={() => {
                      setQuickEdit(quickEdit === wo.id ? null : wo.id);
                      setQe({ assigned_rig_id: wo.assignedRig || '', assigned_crew_id: wo.assignedCrew || '', scheduled_start: wo.startDate || '', scheduled_end: wo.endDate || '', actual_start: wo.actualStart || '', actual_end: wo.actualEnd || '' });
                    }}><Icon name="calendar" size={12} /> {quickEdit === wo.id ? 'Close' : 'Reassign'}</Btn>}
                    {canManage && <Btn variant="secondary" small onClick={() => onEdit(wo)}><Icon name="clipboard" size={12} /> Full Edit</Btn>}
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
