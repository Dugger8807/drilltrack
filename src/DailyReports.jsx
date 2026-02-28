import { useState, useEffect } from "react";
import { theme, inputStyle, selectStyle } from "./constants.js";
import { Icon, Badge, Btn, Field } from "./ui.jsx";
import { downloadDailyReportPDF } from "./pdfGenerator.js";
import { DRPhotos } from "./FileUpload.jsx";
import { supabase } from "./supabaseClient.js";

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
  const [activities, setActivities] = useState([]);
  const [pendingPhotos, setPendingPhotos] = useState([]); // { file, caption, preview }
  const [submitting, setSubmitting] = useState(false);

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

  const ACTIVITY_TYPES = [
    "Safety Training", "Standby", "Down Time — Mechanical", "Down Time — Weather",
    "Weather Delay", "Clearing / Access", "Boring Layout", "Mobilization",
    "Demobilization", "Equipment Setup", "Decontamination", "Traffic Control",
    "Grouting / Abandonment", "Concrete Coring", "Other",
  ];
  const addActivity = () => setActivities(a => [...a, { activity_type: ACTIVITY_TYPES[0], hours: '', description: '' }]);
  const updateActivity = (idx, field, val) => setActivities(a => a.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  const removeActivity = (idx) => setActivities(a => a.filter((_, i) => i !== idx));

  // ── Photo handling ──
  const addPhoto = (file) => {
    const preview = URL.createObjectURL(file);
    setPendingPhotos(p => [...p, { file, caption: '', preview }]);
  };

  const removePhoto = (idx) => {
    setPendingPhotos(p => {
      URL.revokeObjectURL(p[idx].preview);
      return p.filter((_, i) => i !== idx);
    });
  };

  const updatePhotoCaption = (idx, caption) => {
    setPendingPhotos(p => p.map((x, i) => i === idx ? { ...x, caption } : x));
  };

  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => { if (e.target.files?.[0]) addPhoto(e.target.files[0]); };
    input.click();
  };

  const handleGalleryPick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => { if (e.target.files) Array.from(e.target.files).forEach(addPhoto); };
    input.click();
  };

  // ── Submit with photos ──
  const handleSubmit = async () => {
    if (!form.work_order_id || !form.report_date) return alert('Please select a work order and date.');
    setSubmitting(true);

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
    const actData = activities.filter(a => a.activity_type && (Number(a.hours) > 0 || a.description)).map((a, i) => ({
      activity_type: a.activity_type,
      hours: Number(a.hours) || 0,
      description: a.description || '',
      sort_order: i,
    }));

    await onSubmit(reportData, prodData, billData, pendingPhotos, actData);
    setSubmitting(false);
  };

  const availableBorings = selectedWO?.borings || [];
  const totalFootage = production.reduce((s, p) => s + Math.max(0, (Number(p.end_depth) || 0) - (Number(p.start_depth) || 0)), 0);
  const totalBilling = billing.reduce((s, b) => s + (Number(b.quantity) || 0) * (Number(b.rate) || 0), 0);

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "20px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.text }}>Daily Driller Report</h2>
        <Btn variant="ghost" onClick={onCancel}><Icon name="x" size={16} /></Btn>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
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
      <div style={{ marginTop: 20, background: theme.surface2, borderRadius: 10, padding: "14px 12px", border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.accent }}>
            <Icon name="drill" size={15} color={theme.accent} /> Production ({production.length} • {totalFootage} ft)
          </h3>
          <Btn variant="secondary" small onClick={addProd}><Icon name="plus" size={12} /> Add</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {production.map((p, idx) => (
            <div key={idx} style={{ background: theme.bg, borderRadius: 8, padding: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "1 1 100px", minWidth: 90 }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Boring</label>
                <select style={{ ...selectStyle, fontSize: 13 }} value={p.wo_boring_id} onChange={e => updateProd(idx, 'wo_boring_id', e.target.value)}>
                  <option value="">Select...</option>
                  {availableBorings.map(b => <option key={b.id} value={b.id}>{b.boringLabel}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 120px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Type</label>
                <select style={{ ...selectStyle, fontSize: 13 }} value={p.boring_type_id} onChange={e => updateProd(idx, 'boring_type_id', e.target.value)}>
                  {boringTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 70px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>From</label>
                <input style={{ ...inputStyle, fontSize: 13 }} type="number" value={p.start_depth} onChange={e => updateProd(idx, 'start_depth', e.target.value)} />
              </div>
              <div style={{ flex: "0 0 70px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>To</label>
                <input style={{ ...inputStyle, fontSize: 13 }} type="number" value={p.end_depth} onChange={e => updateProd(idx, 'end_depth', e.target.value)} />
              </div>
              <div style={{ flex: "0 0 50px", textAlign: "center", paddingTop: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: theme.accent }}>{Math.max(0, (Number(p.end_depth) || 0) - (Number(p.start_depth) || 0))}′</span>
              </div>
              <div style={{ flex: "1 1 100%", minWidth: 0 }}>
                <input style={{ ...inputStyle, fontSize: 13 }} value={p.description} onChange={e => updateProd(idx, 'description', e.target.value)} placeholder="Notes..." />
              </div>
              {production.length > 1 && <Btn variant="ghost" small onClick={() => removeProd(idx)}><Icon name="x" size={14} color={theme.danger} /></Btn>}
            </div>
          ))}
        </div>
      </div>

      {/* Other Activities */}
      <div style={{ marginTop: 16, background: theme.surface2, borderRadius: 10, padding: "14px 12px", border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.accent }}>
            <Icon name="calendar" size={15} color={theme.accent} /> Other Activities ({activities.length}{activities.length > 0 ? ` • ${activities.reduce((s, a) => s + (Number(a.hours) || 0), 0)} hrs` : ''})
          </h3>
          <Btn variant="secondary" small onClick={addActivity}><Icon name="plus" size={12} /> Add</Btn>
        </div>
        {activities.length === 0 && (
          <div style={{ padding: "10px 0", textAlign: "center", color: theme.textMuted, fontSize: 12 }}>No activities — tap Add for standby, training, delays, etc.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activities.map((a, idx) => (
            <div key={idx} style={{ background: theme.bg, borderRadius: 8, padding: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "1 1 160px", minWidth: 140 }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Activity</label>
                <select style={{ ...selectStyle, fontSize: 13 }} value={a.activity_type} onChange={e => updateActivity(idx, 'activity_type', e.target.value)}>
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 80px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Hours</label>
                <input style={{ ...inputStyle, fontSize: 13 }} type="number" step="0.25" value={a.hours} onChange={e => updateActivity(idx, 'hours', e.target.value)} placeholder="0" />
              </div>
              <div style={{ flex: "1 1 100%", minWidth: 0 }}>
                <input style={{ ...inputStyle, fontSize: 13 }} value={a.description} onChange={e => updateActivity(idx, 'description', e.target.value)} placeholder="Details..." />
              </div>
              <Btn variant="ghost" small onClick={() => removeActivity(idx)}><Icon name="x" size={14} color={theme.danger} /></Btn>
            </div>
          ))}
        </div>
      </div>

      {/* Billing */}
      {billing.length > 0 && (
        <div style={{ marginTop: 16, background: theme.surface2, borderRadius: 10, padding: "14px 12px", border: `1px solid ${theme.border}` }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: theme.accent }}>
            <Icon name="dollar" size={15} color={theme.accent} /> Billing
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {billing.map((b, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "6px 0", borderBottom: `1px solid ${theme.border}15` }}>
                <span style={{ flex: "1 1 120px", fontSize: 13, color: theme.text }}>{b.unitName}</span>
                <span style={{ fontSize: 12, color: theme.textMuted, whiteSpace: "nowrap" }}>${b.rate} {b.unitLabel}</span>
                <input style={{ ...inputStyle, width: 80, flex: "0 0 80px" }} type="number" value={b.quantity} onChange={e => updateBill(idx, 'quantity', e.target.value)} placeholder="Qty" />
                <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent, minWidth: 70, textAlign: "right" }}>${((Number(b.quantity) || 0) * (Number(b.rate) || 0)).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "right", marginTop: 10, fontSize: 15, fontWeight: 700, color: theme.accent }}>Total: ${totalBilling.toLocaleString()}</div>
        </div>
      )}

      {/* Field Photos — inline in form */}
      <div style={{ marginTop: 16, background: theme.surface2, borderRadius: 10, padding: "14px 12px", border: `1px solid ${theme.border}` }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: theme.accent }}>
          <Icon name="camera" size={15} color={theme.accent} /> Field Photos ({pendingPhotos.length})
        </h3>

        {/* Photo previews */}
        {pendingPhotos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginBottom: 12 }}>
            {pendingPhotos.map((p, idx) => (
              <div key={idx} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${theme.border}` }}>
                <img src={p.preview} alt="" style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
                <input value={p.caption} onChange={e => updatePhotoCaption(idx, e.target.value)} placeholder="Caption" style={{ width: "100%", border: "none", borderTop: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 11, padding: "4px 6px", boxSizing: "border-box", fontFamily: "inherit" }} />
                <button onClick={() => removePhoto(idx)} style={{ position: "absolute", top: 2, right: 2, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Camera + gallery buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleCameraCapture} style={{ flex: 1, padding: "14px 10px", borderRadius: 8, border: `2px solid ${theme.accent}`, background: theme.accentDim, color: theme.accent, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="camera" size={18} color={theme.accent} /> Take Photo
          </button>
          <button onClick={handleGalleryPick} style={{ flex: 1, padding: "14px 10px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface2, color: theme.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="plus" size={16} color={theme.textMuted} /> Gallery
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}><Field label="Daily Notes"><textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.notes} onChange={e => update("notes", e.target.value)} /></Field></div>

      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={handleSubmit} disabled={submitting} style={{ flex: 1, maxWidth: 220 }}>
          <Icon name="check" size={14} /> {submitting ? "Submitting..." : "Submit Report"}
        </Btn>
      </div>
    </div>
  );
}

// ─── Daily Reports List with Approve/Reject ──────────────────────────
export function DailyReportsList({ reports, workOrders, onStatusChange, isMobile, canManage }) {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("all");
  const [reviewNotes, setReviewNotes] = useState({});
  const [photos, setPhotos] = useState({});

  const fetchPhotos = async (drId) => {
    const { data } = await supabase.from('daily_report_photos').select('*').eq('daily_report_id', drId).order('created_at', { ascending: false });
    setPhotos(prev => ({ ...prev, [drId]: data || [] }));
  };

  const handleExpand = (drId) => {
    if (expanded === drId) { setExpanded(null); return; }
    setExpanded(drId);
    if (!photos[drId]) fetchPhotos(drId);
  };
  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
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
              <div onClick={() => handleExpand(r.id)} style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", padding: isMobile ? "10px 12px" : "12px 18px", cursor: "pointer", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent, fontFamily: "monospace" }}>{r.reportNumber}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{isMobile ? r.workOrderName || r.projectName : r.projectName || r.workOrderName}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{r.date}</span>
                  {!isMobile && <span style={{ fontSize: 12, color: theme.textMuted }}>{r.driller}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {isMobile && r.driller && <span style={{ fontSize: 11, color: theme.textMuted }}>{r.driller}</span>}
                  <span style={{ fontSize: 11, color: theme.info, fontWeight: 600 }}>{totalFt} ft</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>${totalBilling.toLocaleString()}</span>
                  <Badge status={r.status} />
                  {r.status === "submitted" && !isMobile && <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(244,165,58,0.15)", color: theme.accent, borderRadius: 10, fontWeight: 700 }}>NEEDS REVIEW</span>}
                  <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }}><Icon name="chevDown" size={16} color={theme.textMuted} /></span>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: isMobile ? "0 12px 14px" : "0 18px 18px", borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, paddingTop: 12 }}>
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

                  {r.activities?.length > 0 && (
                    <div style={{ marginTop: 14, background: theme.surface2, borderRadius: 8, padding: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase" }}>Other Activities ({r.activities.length} • {r.activities.reduce((s, a) => s + (Number(a.hours) || 0), 0)} hrs)</span>
                      {r.activities.map((a, i) => (
                        <div key={i} style={{ display: "flex", gap: 12, fontSize: 12, padding: "4px 0", borderBottom: i < r.activities.length - 1 ? `1px solid ${theme.border}15` : "none" }}>
                          <span style={{ flex: 1, color: theme.text, fontWeight: 600 }}>{a.activity_type}</span>
                          <span style={{ color: theme.accent, fontWeight: 600, minWidth: 50 }}>{a.hours} hrs</span>
                          {a.description && <span style={{ flex: 2, color: theme.textMuted }}>{a.description}</span>}
                        </div>
                      ))}
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                      Field Photos ({(photos[r.id] || []).length})
                    </span>
                    <DRPhotos
                      dailyReportId={r.id}
                      photos={photos[r.id] || []}
                      onRefresh={() => fetchPhotos(r.id)}
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <Btn variant="secondary" small onClick={() => downloadDailyReportPDF(r)}><Icon name="report" size={12} /> Download PDF</Btn>
                  </div>}

                  {canManage && r.status === "submitted" && (
                    <div style={{ marginTop: 16, padding: 14, background: "rgba(244,165,58,0.06)", border: `1px solid ${theme.accent}30`, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: theme.accent, marginBottom: 8, textTransform: "uppercase" }}>Review This Report</div>
                      <Field label="Review Notes">
                        <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={reviewNotes[r.id] || ""} onChange={e => setReviewNotes(prev => ({ ...prev, [r.id]: e.target.value }))} placeholder="Add review notes (required for rejection)..." />
                      </Field>
                      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                        <Btn variant="success" style={{ flex: isMobile ? 1 : undefined }} onClick={() => onStatusChange(r.id, "approved", reviewNotes[r.id] || '')}><Icon name="check" size={14} /> Approve</Btn>
                        <Btn variant="danger" style={{ flex: isMobile ? 1 : undefined }} onClick={() => { if (!reviewNotes[r.id]) return alert("Please add review notes for rejection."); onStatusChange(r.id, "rejected", reviewNotes[r.id]); }}><Icon name="reject" size={14} /> Reject</Btn>
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
