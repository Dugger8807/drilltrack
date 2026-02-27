import { useState, useEffect } from "react";
import { theme } from "./constants.js";
import { Icon, Btn } from "./ui.jsx";
import { useOrgData, useWorkOrders, useDailyReports, useProjects } from "./hooks.js";
import Dashboard from "./Dashboard.jsx";
import { WorkOrderForm, WorkOrdersList } from "./WorkOrders.jsx";
import GanttScheduler from "./GanttScheduler.jsx";
import { DailyReportForm, DailyReportsList } from "./DailyReports.jsx";
import BillingTracker from "./BillingTracker.jsx";

const ORG_ID = 'a1b2c3d4-0000-0000-0000-000000000001'; // placeholder org

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "workorders", label: "Work Orders", icon: "clipboard" },
  { id: "scheduler", label: "Scheduler", icon: "calendar" },
  { id: "reports", label: "Daily Reports", icon: "report" },
  { id: "billing", label: "Billing", icon: "dollar" },
];

const pageDesc = {
  dashboard: "Overview of all operations, rigs, and crew assignments",
  workorders: "Manage work orders from internal and external stakeholders",
  scheduler: "Gantt-style scheduling — assign work by available rig and crew",
  reports: "Daily driller reports linked to active work orders",
  billing: "Track billing units, estimated vs. actual costs, and invoicing status",
};

// Adapter: convert DB work orders to the format our existing components expect
function adaptWorkOrders(dbWorkOrders) {
  return dbWorkOrders.map(wo => ({
    id: wo.id,
    dbId: wo.id,
    woNumber: wo.wo_number || wo.id.slice(0, 8),
    projectName: wo.project?.name || wo.name,
    projectNumber: wo.project?.project_number || '',
    client: wo.project?.client?.company_name || '',
    name: wo.name,
    scope: wo.scope,
    status: wo.status,
    priority: wo.priority,
    submittedBy: wo.submitted_by_type || 'internal',
    assignedRig: wo.assigned_rig_id,
    assignedCrew: wo.assigned_crew_id,
    rigName: wo.rig?.name,
    rigType: wo.rig?.rig_type,
    crewName: wo.crew?.name,
    crewLead: wo.crew?.lead ? `${wo.crew.lead.first_name} ${wo.crew.lead.last_name}` : '',
    startDate: wo.scheduled_start,
    endDate: wo.scheduled_end,
    estimatedCost: wo.estimated_cost || 0,
    createdDate: wo.created_at?.split('T')[0],
    lat: wo.project?.lat,
    lng: wo.project?.lng,
    location: wo.project?.location || '',
    borings: (wo.borings || []).map(b => ({
      id: b.id,
      boringLabel: b.boring_id_label,
      type: b.boring_type?.name || '',
      plannedDepth: b.planned_depth,
      status: b.status,
    })),
    rateSchedule: (wo.rateSchedule || []).map(r => ({
      id: r.id,
      unitName: r.billing_unit?.name || '',
      rate: r.rate,
      unitLabel: r.unit_label,
      estimatedQty: r.estimated_quantity,
    })),
  }));
}

// Adapter: convert DB daily reports
function adaptDailyReports(dbReports) {
  return dbReports.map(dr => ({
    id: dr.id,
    dbId: dr.id,
    reportNumber: dr.report_number,
    workOrderId: dr.work_order_id,
    workOrderName: dr.work_order?.name || '',
    projectName: dr.work_order?.project?.name || '',
    date: dr.report_date,
    rigName: dr.rig?.name || '',
    rigType: dr.rig?.rig_type || '',
    crewName: dr.crew?.name || '',
    driller: dr.driller ? `${dr.driller.first_name} ${dr.driller.last_name}` : '',
    startTime: dr.start_time,
    endTime: dr.end_time,
    weatherConditions: dr.weather_conditions || '',
    equipmentIssues: dr.equipment_issues || '',
    safetyIncidents: dr.safety_incidents || '',
    notes: dr.notes || '',
    status: dr.status,
    reviewNotes: dr.review_notes || '',
    production: (dr.production || []).map(p => ({
      id: p.id,
      boringLabel: p.boring?.boring_id_label || '',
      typeName: p.boring_type?.name || '',
      startDepth: p.start_depth,
      endDepth: p.end_depth,
      footage: p.footage,
      description: p.description || '',
    })),
    billing: (dr.billing || []).map(b => ({
      id: b.id,
      unitName: b.rate_item?.billing_unit?.name || '',
      quantity: b.quantity,
      rate: b.rate,
      total: b.total,
      notes: b.notes || '',
    })),
  }));
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${theme.accent}, #e08520)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Icon name="drill" size={24} color="#0f1117" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginBottom: 8 }}>DRILLTRACK</div>
        <div style={{ fontSize: 13, color: theme.textMuted }}>Loading from database...</div>
        <div style={{ marginTop: 16, width: 120, height: 3, background: theme.surface2, borderRadius: 2, overflow: "hidden", margin: "0 auto" }}>
          <div style={{ width: "60%", height: "100%", background: theme.accent, borderRadius: 2, animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [showWOForm, setShowWOForm] = useState(false);
  const [showDRForm, setShowDRForm] = useState(false);
  const [editingWO, setEditingWO] = useState(null);

  // Real data from Supabase
  const orgData = useOrgData();
  const { workOrders: dbWorkOrders, loading: woLoading, refresh: refreshWOs, updateWOStatus } = useWorkOrders();
  const { reports: dbReports, loading: drLoading, refresh: refreshDRs, updateReportStatus } = useDailyReports();

  // Adapt to existing component format
  const workOrders = adaptWorkOrders(dbWorkOrders);
  const dailyReports = adaptDailyReports(dbReports);

  // Pass rigs/crews from DB to components that need them
  const rigs = orgData.rigs;
  const crews = orgData.crews;

  const isLoading = orgData.loading || woLoading || drLoading;

  if (isLoading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif" }}>
      {/* Top Bar */}
      <div style={{ background: theme.surface, borderBottom: `1px solid ${theme.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${theme.accent}, #e08520)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="drill" size={18} color="#0f1117" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: theme.text, letterSpacing: "-0.02em" }}>DRILLTRACK</div>
            <div style={{ fontSize: 9, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: -2 }}>Geotechnical Operations</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setPage(item.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6, border: "none", background: page === item.id ? theme.accentDim : "transparent", color: page === item.id ? theme.accent : theme.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              <Icon name={item.icon} size={15} color={page === item.id ? theme.accent : theme.textMuted} />
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small onClick={() => { setEditingWO(null); setShowWOForm(true); setPage("workorders"); }}>
            <Icon name="plus" size={14} /> Work Order
          </Btn>
          <Btn small variant="secondary" onClick={() => { setShowDRForm(true); setPage("reports"); }}>
            <Icon name="plus" size={14} /> Daily Report
          </Btn>
        </div>
      </div>

      {/* DB Connection indicator */}
      <div style={{ background: "rgba(74,222,128,0.08)", borderBottom: `1px solid rgba(74,222,128,0.2)`, padding: "4px 24px", display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.success }} />
        <span style={{ color: theme.success, fontWeight: 600 }}>Connected to Supabase</span>
        <span style={{ color: theme.textMuted }}>• {orgData.rigs.length} rigs • {orgData.crews.length} crews • {workOrders.length} work orders • {dailyReports.length} reports</span>
      </div>

      {/* Content */}
      <div style={{ padding: "24px 28px", maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: theme.text, letterSpacing: "-0.02em" }}>
            {navItems.find((n) => n.id === page)?.label}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: theme.textMuted }}>{pageDesc[page]}</p>
        </div>

        {page === "dashboard" && <Dashboard workOrders={workOrders} dailyReports={dailyReports} dbRigs={rigs} dbCrews={crews} />}

        {page === "workorders" && (
          <WorkOrdersList
            workOrders={workOrders}
            onStatusChange={async (id, status) => { await updateWOStatus(id, status); }}
            onEdit={(wo) => { setEditingWO(wo); setShowWOForm(true); }}
          />
        )}

        {page === "scheduler" && (
          <GanttScheduler
            workOrders={workOrders}
            onAssign={async (woId, rigId, crewId) => {
              const td = new Date().toISOString().split("T")[0];
              const ed = new Date(); ed.setDate(ed.getDate() + 14);
              await updateWOStatus(woId, "scheduled", {
                assigned_rig_id: rigId,
                assigned_crew_id: crewId,
                scheduled_start: td,
                scheduled_end: ed.toISOString().split("T")[0],
              });
            }}
          />
        )}

        {page === "reports" && (
          <DailyReportsList
            reports={dailyReports}
            workOrders={workOrders}
            onStatusChange={async (id, status, notes) => { await updateReportStatus(id, status, notes); }}
          />
        )}

        {page === "billing" && <BillingTracker workOrders={workOrders} dailyReports={dailyReports} />}
      </div>
    </div>
  );
}
