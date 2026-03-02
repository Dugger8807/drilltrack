import { useState } from "react";
import { theme } from "./constants.js";
import { Icon, Btn } from "./ui.jsx";
import { useIsMobile } from "./useMediaQuery.js";
import { useAuth } from "./AuthProvider.jsx";
import { TE_LOGO } from "./logo.js";
import { supabase } from "./supabaseClient.js";
import { useOrgData, useWorkOrders, useDailyReports, useProjects } from "./hooks.js";
import Dashboard from "./Dashboard.jsx";
import { WorkOrderForm, WorkOrdersList } from "./WorkOrders.jsx";
import GanttScheduler from "./GanttScheduler.jsx";
import { DailyReportForm, DailyReportsList } from "./DailyReports.jsx";
import BillingTracker from "./BillingTracker.jsx";
import AdminConfig from "./AdminConfig.jsx";

const navItems = [
  { id: "dashboard", label: "Home", icon: "home" },
  { id: "workorders", label: "WOs", icon: "clipboard" },
  { id: "scheduler", label: "Schedule", icon: "calendar" },
  { id: "reports", label: "Reports", icon: "report" },
  { id: "admin", label: "Admin", icon: "settings" },
];
const desktopOnlyNav = [
  { id: "billing", label: "Billing", icon: "dollar" },
];

function adaptWorkOrders(dbWorkOrders) {
  return dbWorkOrders.map(wo => ({
    id: wo.id, woNumber: wo.wo_number || wo.id.slice(0, 8),
    projectName: wo.project?.name || wo.name, projectNumber: wo.project?.project_number || '',
    client: wo.project?.client?.company_name || '', name: wo.name, scope: wo.scope,
    status: wo.status, priority: wo.priority,
    submittedBy: wo.submitted_by_type || 'internal',
    assignedRig: wo.assigned_rig_id, assignedCrew: wo.assigned_crew_id,
    rigName: wo.rig?.name, rigType: wo.rig?.rig_type,
    crewName: wo.crew?.name,
    crewLead: wo.crew?.lead ? `${wo.crew.lead.first_name} ${wo.crew.lead.last_name}` : '',
    requestedStart: wo.requested_start, requestedEnd: wo.requested_end,
    startDate: wo.scheduled_start, endDate: wo.scheduled_end,
    actualStart: wo.actual_start, actualEnd: wo.actual_end,
    requestedBy: wo.requested_by || '', engineerRep: wo.engineer_rep || '',
    estimatedCost: wo.estimated_cost || 0,
    createdDate: wo.created_at?.split('T')[0],
    lat: wo.project?.lat || wo.site_lat, lng: wo.project?.lng || wo.site_lng, location: wo.project?.location || wo.site_address || '',
    siteAddress: wo.site_address || '', siteLat: wo.site_lat, siteLng: wo.site_lng,
    onecallNumber: wo.onecall_number || '', onecallDate: wo.onecall_date || '',
    borings: (wo.borings || []).map(b => ({
      id: b.id, boringLabel: b.boring_id_label, type: b.boring_type?.name || '',
      boring_type_id: b.boring_type_id,
      plannedDepth: b.planned_depth, status: b.status,
      samplingInterval: b.sampling_interval || 'standard',
      numTubes: b.num_tubes, boringLat: b.boring_lat, boringLng: b.boring_lng,
    })),
    rateSchedule: (wo.rateSchedule || []).map(r => ({
      id: r.id, unitName: r.billing_unit?.name || '', rate: r.rate,
      unitLabel: r.unit_label, estimatedQty: r.estimated_quantity,
    })),
    woActivities: (wo.woActivities || []).map(a => ({
      id: a.id, activity_type: a.activity_type, quantity: a.quantity,
      depth: a.depth, size: a.size, method: a.method, notes: a.notes || '',
    })),
  }));
}

function adaptDailyReports(dbReports) {
  return dbReports.map(dr => ({
    id: dr.id, reportNumber: dr.report_number, workOrderId: dr.work_order_id,
    workOrderName: dr.work_order?.name || '', projectName: dr.work_order?.project?.name || '',
    projectNumber: dr.work_order?.project?.project_number || '',
    date: dr.report_date, rigName: dr.rig?.name || '', rigType: dr.rig?.rig_type || '',
    crewName: dr.crew?.name || '',
    drillerId: dr.driller_id || '',
    driller: dr.driller ? `${dr.driller.first_name} ${dr.driller.last_name}` : '',
    startTime: dr.start_time, endTime: dr.end_time,
    weatherConditions: dr.weather_conditions || '', equipmentIssues: dr.equipment_issues || '',
    safetyIncidents: dr.safety_incidents || '', notes: dr.notes || '',
    status: dr.status, reviewNotes: dr.review_notes || '',
    _raw: dr, // keep raw for edit population
    production: (dr.production || []).map(p => ({
      id: p.id, boringLabel: p.boring?.boring_id_label || '', typeName: p.boring_type?.name || '',
      startDepth: p.start_depth, endDepth: p.end_depth, footage: p.footage, description: p.description || '',
      _raw: p,
    })),
    billing: (dr.billing || []).map(b => ({
      id: b.id, unitName: b.rate_item?.billing_unit?.name || '',
      quantity: b.quantity, rate: b.rate, total: b.total, notes: b.notes || '',
      _raw: b,
    })),
    activities: (dr.activities || []).map(a => ({
      id: a.id, activityType: a.activity_type, activity_type: a.activity_type,
      hours: a.hours, description: a.description || '',
    })),
  }));
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: theme.text, marginBottom: 4 }}>DRILLTRACK</div>
        <div style={{ fontSize: 10, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, fontWeight: 600 }}>Field Operations Management</div>
        <div style={{ fontSize: 13, color: theme.textMuted }}>Loading...</div>
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuth();
  const b = auth?.branding || {};
  const logoSrc = b.logo_url || TE_LOGO;
  const companyName = b.company_name || '';
  const tagline = b.tagline || 'Geotechnical Field Operations';
  useEffect(() => { if (companyName) document.title = `DrillTrack — ${companyName}`; }, [companyName]);
  const [page, setPage] = useState("dashboard");
  const [showWOForm, setShowWOForm] = useState(false);
  const [showDRForm, setShowDRForm] = useState(false);
  const [editingWO, setEditingWO] = useState(null);
  const [editingDR, setEditingDR] = useState(null);
  const isMobile = useIsMobile();

  const ORG_ID = auth?.orgId || 'a1b2c3d4-0000-0000-0000-000000000001';

  // Role-based nav filtering
  const canManage = auth?.isAdmin || auth?.isManager; // can approve, edit, see billing/admin
  const canCreate = auth?.isAdmin || auth?.isManager || auth?.isDriller; // can create WOs and DRs

  const orgData = useOrgData();
  const { projects, loading: projLoading } = useProjects();
  const { workOrders: dbWorkOrders, loading: woLoading, createWorkOrder, updateWorkOrder, updateWOStatus } = useWorkOrders();
  const { reports: dbReports, loading: drLoading, createReport, updateReport, updateReportStatus } = useDailyReports();

  const workOrders = adaptWorkOrders(dbWorkOrders);
  const dailyReports = adaptDailyReports(dbReports);
  const rigs = orgData.rigs;
  const crews = orgData.crews;

  const isLoading = orgData.loading || projLoading || woLoading || drLoading;
  if (isLoading) return <LoadingScreen />;

  const nav = (id) => { setPage(id); setShowWOForm(false); setShowDRForm(false); setEditingWO(null); setEditingDR(null); };

  const handleCreateWO = async (woData, borings, rateSchedule, activities) => {
    woData.org_id = ORG_ID; woData.status = 'pending';
    if (!woData.requested_by) woData.requested_by = auth.fullName;
    const result = await createWorkOrder(woData, borings, rateSchedule, activities);
    if (result) { setShowWOForm(false); setEditingWO(null); }
  };

  const handleEditWO = async (woData, borings, rateSchedule, activities) => {
    const result = await updateWorkOrder(editingWO.id, woData, borings, rateSchedule, activities);
    if (result) { setShowWOForm(false); setEditingWO(null); }
  };

  // Quick update — rig/crew/dates without full edit form
  const handleQuickUpdate = async (woId, updates) => {
    await updateWOStatus(woId, null, updates);
  };

  const startEditWO = (adaptedWO) => {
    // Find raw DB work order to pass to form
    const raw = dbWorkOrders.find(w => w.id === adaptedWO.id);
    if (raw) {
      setEditingWO(raw);
      setShowWOForm(true);
      setShowDRForm(false);
      setPage("workorders");
    }
  };

  const handleCreateDR = async (reportData, production, billing, pendingPhotos, activities) => {
    reportData.org_id = ORG_ID;
    const result = await createReport(reportData, production, billing, activities);
    if (result) {
      // Upload any pending photos
      if (pendingPhotos?.length && result.id) {
        for (const photo of pendingPhotos) {
          const path = `${result.id}/${Date.now()}-${photo.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { data: uploadData } = await supabase.storage.from('dr-photos').upload(path, photo.file, { upsert: true });
          if (uploadData) {
            const { data: urlData } = supabase.storage.from('dr-photos').getPublicUrl(path);
            if (urlData?.publicUrl) {
              await supabase.from('daily_report_photos').insert({
                daily_report_id: result.id,
                file_name: photo.file.name,
                file_url: urlData.publicUrl,
                file_size: photo.file.size,
                caption: photo.caption || '',
                taken_at: new Date().toISOString(),
              });
            }
          }
        }
      }
      setShowDRForm(false);
    }
  };

  const startEditDR = (adaptedDR) => {
    setEditingDR(adaptedDR);
    setShowDRForm(true);
    setShowWOForm(false);
    setPage("reports");
  };

  const handleEditDR = async (reportData, production, billing, pendingPhotos, activities) => {
    const result = await updateReport(editingDR.id, reportData, production, billing, activities);
    if (result) {
      // Upload any pending photos
      if (pendingPhotos?.length) {
        for (const photo of pendingPhotos) {
          const path = `${editingDR.id}/${Date.now()}-${photo.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { data: uploadData } = await supabase.storage.from('dr-photos').upload(path, photo.file, { upsert: true });
          if (uploadData) {
            const { data: urlData } = supabase.storage.from('dr-photos').getPublicUrl(path);
            if (urlData?.publicUrl) {
              await supabase.from('daily_report_photos').insert({
                daily_report_id: editingDR.id,
                file_name: photo.file.name,
                file_url: urlData.publicUrl,
                file_size: photo.file.size,
                caption: photo.caption || '',
                taken_at: new Date().toISOString(),
              });
            }
          }
        }
      }
      setShowDRForm(false);
      setEditingDR(null);
    }
  };

  // Filter nav based on role
  const mobileNav = navItems.filter(item => {
    if (item.id === 'admin' && !canManage) return false;
    return true;
  });

  const allNav = isMobile ? mobileNav : [...navItems.slice(0, 2), ...desktopOnlyNav, ...navItems.slice(2)].filter(item => {
    if (item.id === 'admin' && !canManage) return false;
    if (item.id === 'billing' && !canManage) return false;
    return true;
  });
  const pageLabel = [...navItems, ...desktopOnlyNav].find(n => n.id === page)?.label || '';

  // ─── MOBILE LAYOUT ──────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", paddingBottom: 72 }}>
        {/* Mobile top bar */}
        <div style={{ background: theme.surface, borderBottom: `1px solid ${theme.border}`, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 50, position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={logoSrc} alt={companyName} style={{ height: 24 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: theme.text }}>DRILLTRACK</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {canCreate && page === "workorders" && !showWOForm && (
              <button onClick={() => { setShowWOForm(true); setShowDRForm(false); }} style={{ background: theme.accent, border: "none", borderRadius: 8, padding: "8px 12px", color: "#0f1117", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="plus" size={13} color="#0f1117" /> WO
              </button>
            )}
            {canCreate && page === "reports" && !showDRForm && (
              <button onClick={() => { setShowDRForm(true); setShowWOForm(false); }} style={{ background: theme.accent, border: "none", borderRadius: 8, padding: "8px 12px", color: "#0f1117", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="plus" size={13} color="#0f1117" /> Report
              </button>
            )}
            {/* User avatar / sign out */}
            <button onClick={auth.signOut} title="Sign out" style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${theme.accent}40`, background: theme.accentDim, color: theme.accent, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
              {auth.fullName?.charAt(0) || '?'}
            </button>
          </div>
        </div>

        {/* Mobile content */}
        <div style={{ padding: "12px 12px 16px" }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800, color: theme.text }}>{pageLabel}</h1>

          {showWOForm && page === "workorders" && (
            <WorkOrderForm onSubmit={editingWO ? handleEditWO : handleCreateWO} onCancel={() => { setShowWOForm(false); setEditingWO(null); }} editOrder={editingWO} orgData={{ ...orgData, projects }} />
          )}
          {showDRForm && page === "reports" && (
            <DailyReportForm onSubmit={editingDR ? handleEditDR : handleCreateDR} onCancel={() => { setShowDRForm(false); setEditingDR(null); }} orgData={orgData} workOrders={workOrders} editReport={editingDR} />
          )}

          {page === "dashboard" && <Dashboard workOrders={workOrders} dailyReports={dailyReports} dbRigs={rigs} dbCrews={crews} isMobile />}
          {page === "workorders" && !showWOForm && <WorkOrdersList workOrders={workOrders} onStatusChange={async (id, s) => { await updateWOStatus(id, s); }} onEdit={startEditWO} isMobile canManage={canManage} orgData={orgData} onQuickUpdate={handleQuickUpdate} branding={b} />}
          {page === "scheduler" && <GanttScheduler workOrders={workOrders} orgData={orgData} isMobile onAssign={async (woId, rigId, crewId) => { const td = new Date().toISOString().split("T")[0]; const ed = new Date(); ed.setDate(ed.getDate() + 14); await updateWOStatus(woId, "scheduled", { assigned_rig_id: rigId, assigned_crew_id: crewId, scheduled_start: td, scheduled_end: ed.toISOString().split("T")[0] }); }} />}
          {page === "reports" && !showDRForm && <DailyReportsList reports={dailyReports} workOrders={workOrders} onStatusChange={async (id, s, n) => { await updateReportStatus(id, s, n); }} onEdit={startEditDR} isMobile canManage={canManage} branding={b} />}
          {page === "billing" && canManage && <BillingTracker workOrders={workOrders} dailyReports={dailyReports} isMobile />}
          {page === "admin" && canManage && <AdminConfig orgData={orgData} projects={projects} isMobile />}
        </div>

        {/* Bottom tab bar */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: theme.surface, borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-around", alignItems: "center", height: 62, zIndex: 200, paddingBottom: "env(safe-area-inset-bottom, 4px)" }}>
          {mobileNav.map(item => (
            <button key={item.id} onClick={() => nav(item.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 0", border: "none", background: "none", cursor: "pointer", minWidth: 52 }}>
              <Icon name={item.icon} size={20} color={page === item.id ? theme.accent : theme.textMuted} />
              <span style={{ fontSize: 10, fontWeight: page === item.id ? 700 : 500, color: page === item.id ? theme.accent : theme.textMuted }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT (unchanged) ─────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: theme.surface, borderBottom: `1px solid ${theme.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logoSrc} alt={companyName} style={{ height: 30 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: theme.text, letterSpacing: "-0.02em" }}>DRILLTRACK</div>
            <div style={{ fontSize: 8, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: -2, fontWeight: 600 }}>{tagline}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {allNav.map(item => (
            <button key={item.id} onClick={() => nav(item.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6, border: "none", background: page === item.id ? theme.accentDim : "transparent", color: page === item.id ? theme.accent : theme.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              <Icon name={item.icon} size={15} color={page === item.id ? theme.accent : theme.textMuted} />
              {item.label === "WOs" ? "Work Orders" : item.label === "Home" ? "Dashboard" : item.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canCreate && <Btn small onClick={() => { setShowWOForm(true); setShowDRForm(false); setEditingWO(null); setPage("workorders"); }}><Icon name="plus" size={14} /> Work Order</Btn>}
          {canCreate && <Btn small variant="secondary" onClick={() => { setShowDRForm(true); setShowWOForm(false); setPage("reports"); }}><Icon name="plus" size={14} /> Daily Report</Btn>}
          {/* User profile */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, paddingLeft: 12, borderLeft: `1px solid ${theme.border}` }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{auth.fullName}</div>
              <div style={{ fontSize: 10, color: theme.accent, textTransform: "uppercase", fontWeight: 600 }}>{auth.role}</div>
            </div>
            <button onClick={auth.signOut} title="Sign out" style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${theme.accent}40`, background: theme.accentDim, color: theme.accent, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
              {auth.fullName?.charAt(0) || '?'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: "rgba(74,222,128,0.08)", borderBottom: `1px solid rgba(74,222,128,0.2)`, padding: "4px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.success }} />
          <span style={{ color: theme.success, fontWeight: 600 }}>Connected</span>
          <span style={{ color: theme.textMuted }}>• {rigs.length} rigs • {crews.length} crews • {workOrders.length} WOs • {dailyReports.length} reports</span>
        </div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: theme.text, letterSpacing: "-0.02em" }}>
            {pageLabel === "Home" ? "Dashboard" : pageLabel === "WOs" ? "Work Orders" : pageLabel}
          </h1>
        </div>

        {showWOForm && page === "workorders" && <div style={{ marginBottom: 24 }}><WorkOrderForm onSubmit={editingWO ? handleEditWO : handleCreateWO} onCancel={() => { setShowWOForm(false); setEditingWO(null); }} editOrder={editingWO} orgData={{ ...orgData, projects }} /></div>}
        {showDRForm && page === "reports" && <div style={{ marginBottom: 24 }}><DailyReportForm onSubmit={editingDR ? handleEditDR : handleCreateDR} onCancel={() => { setShowDRForm(false); setEditingDR(null); }} orgData={orgData} workOrders={workOrders} editReport={editingDR} /></div>}

        {page === "dashboard" && <Dashboard workOrders={workOrders} dailyReports={dailyReports} dbRigs={rigs} dbCrews={crews} />}
        {page === "workorders" && !showWOForm && <WorkOrdersList workOrders={workOrders} onStatusChange={async (id, s) => { await updateWOStatus(id, s); }} onEdit={startEditWO} canManage={canManage} orgData={orgData} onQuickUpdate={handleQuickUpdate} branding={b} />}
        {page === "scheduler" && <GanttScheduler workOrders={workOrders} orgData={orgData} onAssign={async (woId, rigId, crewId) => { const td = new Date().toISOString().split("T")[0]; const ed = new Date(); ed.setDate(ed.getDate() + 14); await updateWOStatus(woId, "scheduled", { assigned_rig_id: rigId, assigned_crew_id: crewId, scheduled_start: td, scheduled_end: ed.toISOString().split("T")[0] }); }} />}
        {page === "reports" && !showDRForm && <DailyReportsList reports={dailyReports} workOrders={workOrders} onStatusChange={async (id, s, n) => { await updateReportStatus(id, s, n); }} onEdit={startEditDR} canManage={canManage} branding={b} />}
        {page === "billing" && canManage && <BillingTracker workOrders={workOrders} dailyReports={dailyReports} />}
        {page === "admin" && canManage && <AdminConfig orgData={orgData} projects={projects} />}
      </div>
    </div>
  );
}
