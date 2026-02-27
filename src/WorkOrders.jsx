import { useState } from "react";
import { theme, RIGS, CREWS, BORING_TYPES, SAMPLE_TYPES, formatCurrency, generateId, inputStyle, selectStyle } from "./constants.js";
import { Icon, Badge, Priority, Btn, Field } from "./ui.jsx";

// ─── Work Order Form ─────────────────────────────────────────────────
export function WorkOrderForm({ onSubmit, onCancel, editOrder }) {
  const [form, setForm] = useState(editOrder || {
    projectName: "", client: "", clientContact: "", clientEmail: "",
    location: "", lat: "", lng: "", scope: "", priority: "medium",
    estimatedCost: "", submittedBy: "internal",
    borings: [{ id: "B-1", type: "SPT Boring", plannedDepth: "", sampleTypes: ["SPT (Split Spoon)"], status: "planned" }],
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addBoring = () => {
    const n = form.borings.length + 1;
    setForm((f) => ({ ...f, borings: [...f.borings, { id: `B-${n}`, type: "SPT Boring", plannedDepth: "", sampleTypes: ["SPT (Split Spoon)"], status: "planned" }] }));
  };
  const updateBoring = (idx, field, val) => setForm((f) => ({ ...f, borings: f.borings.map((b, i) => i === idx ? { ...b, [field]: val } : b) }));
  const removeBoring = (idx) => setForm((f) => ({ ...f, borings: f.borings.filter((_, i) => i !== idx) }));
  const toggleSampleType = (idx, st) => {
    setForm((f) => ({ ...f, borings: f.borings.map((b, i) => {
      if (i !== idx) return b;
      const has = b.sampleTypes.includes(st);
      return { ...b, sampleTypes: has ? b.sampleTypes.filter((s) => s !== st) : [...b.sampleTypes, st] };
    })}));
  };

  const handleSubmit = () => {
    if (!form.projectName || !form.client || !form.scope) return;
    onSubmit({ ...form, id: form.id || generateId("WO"), status: form.status || "pending", createdDate: form.createdDate || new Date().toISOString().split("T")[0], estimatedCost: Number(form.estimatedCost) || 0, borings: form.borings.map((b) => ({ ...b, plannedDepth: Number(b.plannedDepth) || 0 })) });
  };

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.text }}>{editOrder ? "Edit Work Order" : "New Work Order"}</h2>
        <Btn variant="ghost" onClick={onCancel}><Icon name="x" size={16} /> Close</Btn>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["internal", "external"].map((t) => (
          <button key={t} onClick={() => update("submittedBy", t)} style={{ padding: "6px 16px", borderRadius: 20, border: `1px solid ${form.submittedBy === t ? theme.accent : theme.border}`, background: form.submittedBy === t ? theme.accentDim : "transparent", color: form.submittedBy === t ? theme.accent : theme.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{t} Stakeholder</button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Field label="Project Name" required><input style={inputStyle} value={form.projectName} onChange={(e) => update("projectName", e.target.value)} placeholder="e.g. I-65 Bridge Replacement" /></Field>
        <Field label="Client / Company" required half><input style={inputStyle} value={form.client} onChange={(e) => update("client", e.target.value)} /></Field>
        <Field label="Client Contact" half><input style={inputStyle} value={form.clientContact} onChange={(e) => update("clientContact", e.target.value)} /></Field>
        <Field label="Client Email" half><input style={inputStyle} value={form.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} type="email" /></Field>
        <Field label="Location" half><input style={inputStyle} value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="City, County, State" /></Field>
        <Field label="Latitude" half><input style={inputStyle} value={form.lat} onChange={(e) => update("lat", e.target.value)} placeholder="30.6954" /></Field>
        <Field label="Longitude" half><input style={inputStyle} value={form.lng} onChange={(e) => update("lng", e.target.value)} placeholder="-88.0399" /></Field>
        <Field label="Priority" half>
          <select style={selectStyle} value={form.priority} onChange={(e) => update("priority", e.target.value)}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </Field>
        <Field label="Estimated Cost ($)" half><input style={inputStyle} value={form.estimatedCost} onChange={(e) => update("estimatedCost", e.target.value)} type="number" /></Field>
        <Field label="Scope of Work" required><textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.scope} onChange={(e) => update("scope", e.target.value)} /></Field>
      </div>

      {/* Boring Schedule */}
      <div style={{ marginTop: 24, background: theme.surface2, borderRadius: 10, padding: 18, border: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.accent, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="drill" size={15} color={theme.accent} /> Boring / Sounding Schedule ({form.borings.length})
          </h3>
          <Btn variant="secondary" small onClick={addBoring}><Icon name="plus" size={12} /> Add Boring</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
          {form.borings.map((boring, idx) => (
            <div key={idx} style={{ background: theme.bg, borderRadius: 8, padding: "12px 14px", border: `1px solid ${theme.border}40`, display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 80px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>ID</label>
                <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} value={boring.id} onChange={(e) => updateBoring(idx, "id", e.target.value)} />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Type</label>
                <select style={{ ...selectStyle, padding: "5px 8px", fontSize: 12 }} value={boring.type} onChange={(e) => updateBoring(idx, "type", e.target.value)}>
                  {BORING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 90px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Depth (ft)</label>
                <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} type="number" value={boring.plannedDepth} onChange={(e) => updateBoring(idx, "plannedDepth", e.target.value)} />
              </div>
              <div style={{ flex: "1 1 250px" }}>
                <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Sample Types</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                  {SAMPLE_TYPES.map((st) => (
                    <button key={st} onClick={() => toggleSampleType(idx, st)} style={{ padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${boring.sampleTypes.includes(st) ? theme.accent : theme.border}`, background: boring.sampleTypes.includes(st) ? theme.accentDim : "transparent", color: boring.sampleTypes.includes(st) ? theme.accent : theme.textMuted }}>{st}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: "0 0 30px", paddingTop: 16 }}>
                <Btn variant="ghost" small onClick={() => removeBoring(idx)}><Icon name="x" size={14} color={theme.danger} /></Btn>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: "8px 12px", background: theme.surface, borderRadius: 6, display: "flex", gap: 20, fontSize: 12, flexWrap: "wrap" }}>
          <span style={{ color: theme.textMuted }}>SPT: <strong style={{ color: theme.text }}>{form.borings.filter((b) => b.type === "SPT Boring").length}</strong></span>
          <span style={{ color: theme.textMuted }}>CPT: <strong style={{ color: theme.text }}>{form.borings.filter((b) => b.type === "CPT Sounding").length}</strong></span>
          <span style={{ color: theme.textMuted }}>Core: <strong style={{ color: theme.text }}>{form.borings.filter((b) => b.type === "Rock Core Boring").length}</strong></span>
          <span style={{ color: theme.textMuted }}>MW: <strong style={{ color: theme.text }}>{form.borings.filter((b) => b.type === "Monitoring Well").length}</strong></span>
          <span style={{ color: theme.textMuted }}>Total Footage: <strong style={{ color: theme.accent }}>{form.borings.reduce((s, b) => s + (Number(b.plannedDepth) || 0), 0)} ft</strong></span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={handleSubmit}><Icon name="check" size={14} /> {editOrder ? "Update" : "Submit"} Work Order</Btn>
      </div>
    </div>
  );
}

// ─── Work Orders List ────────────────────────────────────────────────
export function WorkOrdersList({ workOrders, setWorkOrders, onEdit }) {
  const [filter, setFilter] = useState("all");
  const [expandedWO, setExpandedWO] = useState(null);
  const filtered = filter === "all" ? workOrders : workOrders.filter((w) => w.status === filter);
  const updateStatus = (id, status) => setWorkOrders((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", "pending", "approved", "scheduled", "in-progress", "completed", "invoiced"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filter === f ? theme.accent : theme.border}`, background: filter === f ? theme.accentDim : "transparent", color: filter === f ? theme.accent : theme.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
            {f === "all" ? "All" : f} {f !== "all" && `(${workOrders.filter((w) => w.status === f).length})`}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((wo) => {
          const isOpen = expandedWO === wo.id;
          const boringCount = wo.borings?.length || 0;
          const sptCount = wo.borings?.filter((b) => b.type === "SPT Boring").length || 0;
          const cptCount = wo.borings?.filter((b) => b.type === "CPT Sounding").length || 0;
          return (
            <div key={wo.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", cursor: "pointer", gap: 12 }} onClick={() => setExpandedWO(isOpen ? null : wo.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent, fontFamily: "monospace", flexShrink: 0 }}>{wo.id}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wo.projectName}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted, flexShrink: 0 }}>{wo.client}</span>
                  <Badge status={wo.status} />
                  <Priority level={wo.priority} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: theme.textMuted }}>{boringCount} borings</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{formatCurrency(wo.estimatedCost)}</span>
                  <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }}><Icon name="chevDown" size={16} color={theme.textMuted} /></span>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, paddingTop: 14 }}>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Contact</span><div style={{ fontSize: 13, color: theme.text }}>{wo.clientContact} • {wo.clientEmail}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Location</span><div style={{ fontSize: 13, color: theme.text }}>{wo.location} ({wo.lat}, {wo.lng})</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Rig / Crew</span><div style={{ fontSize: 13, color: theme.text }}>{wo.assignedRig ? RIGS.find((r) => r.id === wo.assignedRig)?.name : "—"} / {wo.assignedCrew ? CREWS.find((c) => c.id === wo.assignedCrew)?.name : "—"}</div></div>
                    <div><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Dates</span><div style={{ fontSize: 13, color: theme.text }}>{wo.startDate ? `${wo.startDate} → ${wo.endDate}` : "TBD"}</div></div>
                  </div>
                  <div style={{ marginTop: 10 }}><span style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase" }}>Scope</span><div style={{ fontSize: 13, color: theme.text, marginTop: 2 }}>{wo.scope}</div></div>

                  {wo.borings?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase" }}>Boring Schedule — {sptCount} SPT, {cptCount} CPT, {boringCount} Total</span>
                      <div style={{ overflowX: "auto", marginTop: 8 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead><tr>
                            {["ID", "Type", "Depth (ft)", "Sample Types", "Status"].map((h) => (
                              <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${theme.border}`, color: theme.textMuted, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {wo.borings.map((b, i) => (
                              <tr key={i} style={{ borderBottom: `1px solid ${theme.border}15` }}>
                                <td style={{ padding: "5px 8px", color: theme.info, fontWeight: 600, fontFamily: "monospace" }}>{b.id}</td>
                                <td style={{ padding: "5px 8px", color: theme.text }}>{b.type}</td>
                                <td style={{ padding: "5px 8px", color: theme.text }}>{b.plannedDepth}</td>
                                <td style={{ padding: "5px 8px" }}>
                                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                    {b.sampleTypes.map((st) => <span key={st} style={{ padding: "1px 6px", borderRadius: 10, fontSize: 10, background: theme.accentDim, color: theme.accent, border: `1px solid ${theme.accent}30` }}>{st}</span>)}
                                  </div>
                                </td>
                                <td style={{ padding: "5px 8px" }}><Badge status={b.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <Btn variant="secondary" small onClick={() => onEdit(wo)}>Edit</Btn>
                    {wo.status === "pending" && <Btn variant="success" small onClick={() => updateStatus(wo.id, "approved")}><Icon name="check" size={12} /> Approve</Btn>}
                    {wo.status === "pending" && <Btn variant="danger" small onClick={() => updateStatus(wo.id, "rejected")}><Icon name="reject" size={12} /> Reject</Btn>}
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
