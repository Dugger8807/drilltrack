import { useState } from "react";
import { theme, inputStyle, selectStyle } from "./constants.js";
import { Icon, Btn, Field } from "./ui.jsx";
import { supabase } from "./supabaseClient.js";

const ORG_ID = 'a1b2c3d4-0000-0000-0000-000000000001';

const tabs = [
  { id: "rigs", label: "Rigs", icon: "truck" },
  { id: "staff", label: "Staff", icon: "users" },
  { id: "crews", label: "Crews", icon: "users" },
  { id: "billing", label: "Billing Units", icon: "dollar" },
  { id: "boring_types", label: "Boring Types", icon: "drill" },
  { id: "rate_templates", label: "Rate Templates", icon: "dollar" },
  { id: "clients", label: "Clients", icon: "clipboard" },
  { id: "projects", label: "Projects", icon: "home" },
];

// ─── Generic inline editor ───────────────────────────────────────────
function InlineEditor({ fields, item, onSave, onCancel }) {
  const [form, setForm] = useState({ ...item });
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ background: theme.bg, borderRadius: 8, padding: 16, border: `1px solid ${theme.accent}40` }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {fields.map(f => (
          <div key={f.key} style={{ flex: f.wide ? "1 1 100%" : "1 1 180px", minWidth: 140 }}>
            <label style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 3 }}>{f.label}</label>
            {f.type === "select" ? (
              <select style={{ ...selectStyle, fontSize: 12 }} value={form[f.key] || ''} onChange={e => update(f.key, e.target.value)}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea style={{ ...inputStyle, fontSize: 12, minHeight: 50, resize: "vertical" }} value={form[f.key] || ''} onChange={e => update(f.key, e.target.value)} />
            ) : (
              <input style={{ ...inputStyle, fontSize: 12 }} type={f.type || "text"} value={form[f.key] || ''} onChange={e => update(f.key, f.type === "number" ? e.target.value : e.target.value)} placeholder={f.placeholder || ''} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
        <Btn variant="secondary" small onClick={onCancel}>Cancel</Btn>
        <Btn small onClick={() => onSave(form)}><Icon name="check" size={12} /> Save</Btn>
      </div>
    </div>
  );
}

// ─── Rigs Section ────────────────────────────────────────────────────
function RigsSection({ rigs, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const fields = [
    { key: "name", label: "Name", placeholder: "Rig 11" },
    { key: "rig_type", label: "Type", placeholder: "CME-75" },
    { key: "vin_or_serial", label: "VIN / Serial" },
    { key: "year", label: "Year", type: "number" },
    { key: "status", label: "Status", type: "select", options: [
      { value: "available", label: "Available" }, { value: "maintenance", label: "Maintenance" },
      { value: "standby", label: "Standby" }, { value: "retired", label: "Retired" },
    ]},
    { key: "notes", label: "Notes", wide: true },
  ];

  const save = async (data) => {
    if (data.id) {
      await supabase.from('rigs').update({ name: data.name, rig_type: data.rig_type, vin_or_serial: data.vin_or_serial, year: Number(data.year) || null, status: data.status, notes: data.notes }).eq('id', data.id);
    } else {
      await supabase.from('rigs').insert({ ...data, org_id: ORG_ID, year: Number(data.year) || null, sort_order: rigs.length + 1 });
    }
    setEditing(null); setAdding(false); onRefresh();
  };

  const toggleActive = async (id, current) => {
    await supabase.from('rigs').update({ is_active: !current }).eq('id', id);
    onRefresh();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: theme.textMuted }}>{rigs.length} rigs configured</span>
        <Btn small onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" size={12} /> Add Rig</Btn>
      </div>
      {adding && <div style={{ marginBottom: 12 }}><InlineEditor fields={fields} item={{ status: "available" }} onSave={save} onCancel={() => setAdding(false)} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rigs.map(r => editing === r.id ? (
          <InlineEditor key={r.id} fields={fields} item={r} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <div key={r.id} style={{ background: theme.surface2, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: r.is_active === false ? 0.4 : 1, borderLeft: `3px solid ${r.status === "available" ? theme.success : r.status === "maintenance" ? theme.danger : theme.textMuted}` }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: theme.text, minWidth: 70 }}>{r.name}</span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>{r.rig_type}</span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>{r.year || ''}</span>
              <span style={{ fontSize: 11, color: r.status === "available" ? theme.success : r.status === "maintenance" ? theme.danger : theme.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{r.status}</span>
              {r.vin_or_serial && <span style={{ fontSize: 11, color: theme.textMuted, fontFamily: "monospace" }}>{r.vin_or_serial}</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="ghost" small onClick={() => { setEditing(r.id); setAdding(false); }}><Icon name="clipboard" size={12} /></Btn>
              <Btn variant="ghost" small onClick={() => toggleActive(r.id, r.is_active !== false)}><Icon name={r.is_active !== false ? "x" : "check"} size={12} color={r.is_active !== false ? theme.danger : theme.success} /></Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Staff Section ───────────────────────────────────────────────────
function StaffSection({ staff, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const fields = [
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "role_title", label: "Role", type: "select", options: [
      { value: "Lead Driller", label: "Lead Driller" }, { value: "Driller Helper", label: "Driller Helper" },
      { value: "CPT Operator", label: "CPT Operator" }, { value: "Equipment Operator", label: "Equipment Operator" },
      { value: "Geologist", label: "Geologist" }, { value: "Inspector", label: "Inspector" },
    ]},
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "hourly_rate", label: "Internal Rate ($/hr)", type: "number" },
  ];

  const save = async (data) => {
    const payload = { first_name: data.first_name, last_name: data.last_name, role_title: data.role_title, phone: data.phone, email: data.email, hourly_rate: Number(data.hourly_rate) || null };
    if (data.id) {
      await supabase.from('staff_members').update(payload).eq('id', data.id);
    } else {
      await supabase.from('staff_members').insert({ ...payload, org_id: ORG_ID });
    }
    setEditing(null); setAdding(false); onRefresh();
  };

  const toggleActive = async (id, current) => {
    await supabase.from('staff_members').update({ is_active: !current }).eq('id', id);
    onRefresh();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: theme.textMuted }}>{staff.length} staff members</span>
        <Btn small onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" size={12} /> Add Staff</Btn>
      </div>
      {adding && <div style={{ marginBottom: 12 }}><InlineEditor fields={fields} item={{ role_title: "Lead Driller" }} onSave={save} onCancel={() => setAdding(false)} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {staff.map(s => editing === s.id ? (
          <InlineEditor key={s.id} fields={fields} item={s} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <div key={s.id} style={{ background: theme.surface2, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: s.is_active === false ? 0.4 : 1 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{s.first_name} {s.last_name}</span>
              <span style={{ fontSize: 12, color: theme.info, fontWeight: 500 }}>{s.role_title}</span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>{s.phone}</span>
              {s.hourly_rate && <span style={{ fontSize: 12, color: theme.accent }}>${s.hourly_rate}/hr</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="ghost" small onClick={() => { setEditing(s.id); setAdding(false); }}><Icon name="clipboard" size={12} /></Btn>
              <Btn variant="ghost" small onClick={() => toggleActive(s.id, s.is_active !== false)}><Icon name={s.is_active !== false ? "x" : "check"} size={12} color={s.is_active !== false ? theme.danger : theme.success} /></Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Crews Section ───────────────────────────────────────────────────
function CrewsSection({ crews, staff, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const staffOpts = [{ value: '', label: 'None' }, ...staff.filter(s => s.is_active !== false).map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))];
  const fields = [
    { key: "name", label: "Crew Name", placeholder: "Crew F" },
    { key: "lead_id", label: "Crew Lead", type: "select", options: staffOpts },
  ];

  const save = async (data) => {
    const payload = { name: data.name, lead_id: data.lead_id || null };
    if (data.id) {
      await supabase.from('crews').update(payload).eq('id', data.id);
    } else {
      await supabase.from('crews').insert({ ...payload, org_id: ORG_ID });
    }
    setEditing(null); setAdding(false); onRefresh();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: theme.textMuted }}>{crews.length} crews</span>
        <Btn small onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" size={12} /> Add Crew</Btn>
      </div>
      {adding && <div style={{ marginBottom: 12 }}><InlineEditor fields={fields} item={{}} onSave={save} onCancel={() => setAdding(false)} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {crews.map(c => editing === c.id ? (
          <InlineEditor key={c.id} fields={fields} item={c} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <div key={c.id} style={{ background: theme.surface2, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{c.name}</span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>Lead: {c.lead ? `${c.lead.first_name} ${c.lead.last_name}` : '—'}</span>
            </div>
            <Btn variant="ghost" small onClick={() => { setEditing(c.id); setAdding(false); }}><Icon name="clipboard" size={12} /></Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Billing Units Section ───────────────────────────────────────────
function BillingUnitsSection({ units, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const fields = [
    { key: "name", label: "Name", placeholder: "Hourly Drilling" },
    { key: "default_unit", label: "Unit", type: "select", options: [
      { value: "hour", label: "Hour" }, { value: "foot", label: "Foot" }, { value: "each", label: "Each" },
      { value: "day", label: "Day" }, { value: "lump sum", label: "Lump Sum" },
    ]},
    { key: "default_rate", label: "Default Rate ($)", type: "number" },
    { key: "category", label: "Category", type: "select", options: [
      { value: "drilling", label: "Drilling" }, { value: "sampling", label: "Sampling" },
      { value: "mobilization", label: "Mobilization" }, { value: "testing", label: "Testing" },
      { value: "other", label: "Other" },
    ]},
    { key: "description", label: "Description", wide: true },
  ];

  const save = async (data) => {
    const payload = { name: data.name, default_unit: data.default_unit, default_rate: Number(data.default_rate) || null, category: data.category, description: data.description };
    if (data.id) {
      await supabase.from('billing_unit_types').update(payload).eq('id', data.id);
    } else {
      await supabase.from('billing_unit_types').insert({ ...payload, org_id: ORG_ID, sort_order: units.length + 1 });
    }
    setEditing(null); setAdding(false); onRefresh();
  };

  const toggleActive = async (id, current) => {
    await supabase.from('billing_unit_types').update({ is_active: !current }).eq('id', id);
    onRefresh();
  };

  const grouped = {};
  units.forEach(u => { const cat = u.category || 'other'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(u); });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: theme.textMuted }}>{units.length} billing units</span>
        <Btn small onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" size={12} /> Add Unit</Btn>
      </div>
      {adding && <div style={{ marginBottom: 12 }}><InlineEditor fields={fields} item={{ default_unit: "hour", category: "drilling" }} onSave={save} onCancel={() => setAdding(false)} /></div>}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.05em" }}>{cat}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map(u => editing === u.id ? (
              <InlineEditor key={u.id} fields={fields} item={u} onSave={save} onCancel={() => setEditing(null)} />
            ) : (
              <div key={u.id} style={{ background: theme.surface2, borderRadius: 6, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: u.is_active === false ? 0.4 : 1 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>{u.name}</span>
                  <span style={{ fontSize: 12, color: theme.accent, fontWeight: 600 }}>${u.default_rate || '—'}</span>
                  <span style={{ fontSize: 11, color: theme.textMuted }}>per {u.default_unit}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn variant="ghost" small onClick={() => { setEditing(u.id); setAdding(false); }}><Icon name="clipboard" size={12} /></Btn>
                  <Btn variant="ghost" small onClick={() => toggleActive(u.id, u.is_active !== false)}><Icon name={u.is_active !== false ? "x" : "check"} size={12} color={u.is_active !== false ? theme.danger : theme.success} /></Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Boring Types Section ────────────────────────────────────────────
function BoringTypesSection({ types, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const fields = [
    { key: "name", label: "Name", placeholder: "SPT Boring" },
    { key: "description", label: "Description", wide: true },
  ];

  const save = async (data) => {
    const payload = { name: data.name, description: data.description };
    if (data.id) {
      await supabase.from('boring_types').update(payload).eq('id', data.id);
    } else {
      await supabase.from('boring_types').insert({ ...payload, org_id: ORG_ID, sort_order: types.length + 1 });
    }
    setEditing(null); setAdding(false); onRefresh();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: theme.textMuted }}>{types.length} boring types</span>
        <Btn small onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" size={12} /> Add Type</Btn>
      </div>
      {adding && <div style={{ marginBottom: 12 }}><InlineEditor fields={fields} item={{}} onSave={save} onCancel={() => setAdding(false)} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {types.map(t => editing === t.id ? (
          <InlineEditor key={t.id} fields={fields} item={t} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <div key={t.id} style={{ background: theme.surface2, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{t.name}</span>{t.description && <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 12 }}>{t.description}</span>}</div>
            <Btn variant="ghost" small onClick={() => { setEditing(t.id); setAdding(false); }}><Icon name="clipboard" size={12} /></Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Clients Section ─────────────────────────────────────────────────
function ClientsSection({ clients, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const fields = [
    { key: "company_name", label: "Company Name" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "zip", label: "Zip" },
    { key: "phone", label: "Phone" },
    { key: "website", label: "Website" },
    { key: "notes", label: "Notes", wide: true },
  ];

  const save = async (data) => {
    const payload = { company_name: data.company_name, address: data.address, city: data.city, state: data.state, zip: data.zip, phone: data.phone, website: data.website, notes: data.notes };
    if (data.id) {
      await supabase.from('clients').update(payload).eq('id', data.id);
    } else {
      await supabase.from('clients').insert({ ...payload, org_id: ORG_ID });
    }
    setEditing(null); setAdding(false); onRefresh();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: theme.textMuted }}>{clients.length} clients</span>
        <Btn small onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" size={12} /> Add Client</Btn>
      </div>
      {adding && <div style={{ marginBottom: 12 }}><InlineEditor fields={fields} item={{}} onSave={save} onCancel={() => setAdding(false)} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {clients.map(c => editing === c.id ? (
          <InlineEditor key={c.id} fields={fields} item={c} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <div key={c.id} style={{ background: theme.surface2, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{c.company_name}</span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>{c.city}{c.state ? `, ${c.state}` : ''}</span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>{c.phone}</span>
              {c.contacts?.length > 0 && <span style={{ fontSize: 11, color: theme.info }}>{c.contacts.length} contact{c.contacts.length > 1 ? 's' : ''}</span>}
            </div>
            <Btn variant="ghost" small onClick={() => { setEditing(c.id); setAdding(false); }}><Icon name="clipboard" size={12} /></Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Projects Section ────────────────────────────────────────────────
function ProjectsSection({ projects, clients, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const clientOpts = [{ value: '', label: 'Select client...' }, ...clients.map(c => ({ value: c.id, label: c.company_name }))];
  const fields = [
    { key: "project_number", label: "Project Number", placeholder: "2026-0003" },
    { key: "name", label: "Project Name", placeholder: "New Highway Bridge" },
    { key: "client_id", label: "Client", type: "select", options: clientOpts },
    { key: "location", label: "Location", placeholder: "Mobile County, AL" },
    { key: "lat", label: "Latitude", type: "number", placeholder: "30.6954" },
    { key: "lng", label: "Longitude", type: "number", placeholder: "-88.0399" },
    { key: "status", label: "Status", type: "select", options: [
      { value: "active", label: "Active" }, { value: "on_hold", label: "On Hold" },
      { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" },
    ]},
    { key: "contract_value", label: "Contract Value ($)", type: "number" },
    { key: "po_number", label: "PO Number" },
    { key: "description", label: "Description", wide: true },
  ];

  const save = async (data) => {
    const payload = { project_number: data.project_number, name: data.name, client_id: data.client_id || null, location: data.location, lat: Number(data.lat) || null, lng: Number(data.lng) || null, status: data.status || 'active', contract_value: Number(data.contract_value) || null, po_number: data.po_number, description: data.description };
    if (data.id) {
      await supabase.from('projects').update(payload).eq('id', data.id);
    } else {
      await supabase.from('projects').insert({ ...payload, org_id: ORG_ID });
    }
    setEditing(null); setAdding(false); onRefresh();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: theme.textMuted }}>{projects.length} projects</span>
        <Btn small onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" size={12} /> Add Project</Btn>
      </div>
      {adding && <div style={{ marginBottom: 12 }}><InlineEditor fields={fields} item={{ status: "active" }} onSave={save} onCancel={() => setAdding(false)} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {projects.map(p => editing === p.id ? (
          <InlineEditor key={p.id} fields={fields} item={p} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <div key={p.id} style={{ background: theme.surface2, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: theme.accent, fontFamily: "monospace" }}>{p.project_number}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{p.name}</span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>{p.client?.company_name || ''}</span>
              <span style={{ fontSize: 12, color: theme.textMuted }}>{p.location}</span>
              <span style={{ fontSize: 11, color: p.status === 'active' ? theme.success : theme.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{p.status}</span>
            </div>
            <Btn variant="ghost" small onClick={() => { setEditing(p.id); setAdding(false); }}><Icon name="clipboard" size={12} /></Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rate Templates Section ──────────────────────────────────────────
function RateTemplatesSection({ templates, billingUnits, onRefresh }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13, color: theme.textMuted }}>{templates.length} rate templates</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {templates.map(t => (
          <div key={t.id} style={{ background: theme.surface2, borderRadius: 8, overflow: "hidden" }}>
            <div onClick={() => setExpanded(expanded === t.id ? null : t.id)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{t.name}</span>
                {t.description && <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 12 }}>{t.description}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: theme.info }}>{t.items?.length || 0} items</span>
                <span style={{ transform: expanded === t.id ? "rotate(180deg)" : "none", transition: "0.2s" }}><Icon name="chevDown" size={14} color={theme.textMuted} /></span>
              </div>
            </div>
            {expanded === t.id && t.items && (
              <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${theme.border}` }}>
                {t.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, padding: "6px 0", fontSize: 12, borderBottom: `1px solid ${theme.border}10` }}>
                    <span style={{ flex: 2, color: theme.text }}>{item.billing_unit?.name || '—'}</span>
                    <span style={{ color: theme.accent, fontWeight: 600 }}>${item.rate}</span>
                    <span style={{ color: theme.textMuted }}>{item.unit_label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Admin Config Component ─────────────────────────────────────
export default function AdminConfig({ orgData, projects }) {
  const [activeTab, setActiveTab] = useState("rigs");
  const { rigs, crews, staff, billingUnits, boringTypes, rateTemplates, clients, refresh } = orgData;

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: `1px solid ${activeTab === t.id ? theme.accent : theme.border}`, background: activeTab === t.id ? theme.accentDim : "transparent", color: activeTab === t.id ? theme.accent : theme.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <Icon name={t.icon} size={13} color={activeTab === t.id ? theme.accent : theme.textMuted} />
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24 }}>
        {activeTab === "rigs" && <RigsSection rigs={rigs} onRefresh={refresh} />}
        {activeTab === "staff" && <StaffSection staff={staff} onRefresh={refresh} />}
        {activeTab === "crews" && <CrewsSection crews={crews} staff={staff} onRefresh={refresh} />}
        {activeTab === "billing" && <BillingUnitsSection units={billingUnits} onRefresh={refresh} />}
        {activeTab === "boring_types" && <BoringTypesSection types={boringTypes} onRefresh={refresh} />}
        {activeTab === "rate_templates" && <RateTemplatesSection templates={rateTemplates} billingUnits={billingUnits} onRefresh={refresh} />}
        {activeTab === "clients" && <ClientsSection clients={clients} onRefresh={refresh} />}
        {activeTab === "projects" && <ProjectsSection projects={projects} clients={clients} onRefresh={refresh} />}
      </div>
    </div>
  );
}
