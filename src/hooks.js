import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient.js';

// ─── Generic fetch helper ────────────────────────────────────────────
async function fetchTable(table, options = {}) {
  let query = supabase.from(table).select(options.select || '*');
  if (options.order) query = query.order(options.order, { ascending: options.asc !== false });
  if (options.eq) Object.entries(options.eq).forEach(([k, v]) => { query = query.eq(k, v); });
  if (options.neq) Object.entries(options.neq).forEach(([k, v]) => { query = query.neq(k, v); });
  if (options.in_) Object.entries(options.in_).forEach(([k, v]) => { query = query.in(k, v); });
  const { data, error } = await query;
  if (error) { console.error(`Error fetching ${table}:`, error); return []; }
  return data || [];
}

// ─── Organization data (config lists) ────────────────────────────────
export function useOrgData() {
  const [rigs, setRigs] = useState([]);
  const [crews, setCrews] = useState([]);
  const [staff, setStaff] = useState([]);
  const [billingUnits, setBillingUnits] = useState([]);
  const [boringTypes, setBoringTypes] = useState([]);
  const [rateTemplates, setRateTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [r, c, s, bu, bt, rt, cl] = await Promise.all([
      fetchTable('rigs', { order: 'sort_order' }),
      fetchTable('crews', { select: '*, lead:staff_members!crews_lead_id_fkey(first_name, last_name)' }),
      fetchTable('staff_members', { order: 'last_name' }),
      fetchTable('billing_unit_types', { order: 'sort_order' }),
      fetchTable('boring_types', { order: 'sort_order' }),
      fetchTable('rate_templates', { select: '*, items:rate_template_items(*, billing_unit:billing_unit_types(name))' }),
      fetchTable('clients', { select: '*, contacts:client_contacts(*)' }),
    ]);
    setRigs(r); setCrews(c); setStaff(s); setBillingUnits(bu);
    setBoringTypes(bt); setRateTemplates(rt); setClients(cl);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { rigs, crews, staff, billingUnits, boringTypes, rateTemplates, clients, loading, refresh };
}

// ─── Projects ────────────────────────────────────────────────────────
export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchTable('projects', {
      select: '*, client:clients(company_name), contact:client_contacts(first_name, last_name)',
      order: 'created_at',
      asc: false,
    });
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createProject = async (project) => {
    const { data, error } = await supabase.from('projects').insert(project).select().single();
    if (error) { console.error('Error creating project:', error); return null; }
    await refresh();
    return data;
  };

  const updateProject = async (id, updates) => {
    const { error } = await supabase.from('projects').update(updates).eq('id', id);
    if (error) { console.error('Error updating project:', error); return false; }
    await refresh();
    return true;
  };

  return { projects, loading, refresh, createProject, updateProject };
}

// ─── Work Orders ─────────────────────────────────────────────────────
export function useWorkOrders() {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const wos = await fetchTable('work_orders', {
      select: `*,
        project:projects(name, project_number, location, lat, lng, client:clients(company_name)),
        rig:rigs(name, rig_type),
        crew:crews(name, lead:staff_members!crews_lead_id_fkey(first_name, last_name))`,
      order: 'created_at',
      asc: false,
    });

    // Fetch borings and rate schedules for each WO
    const woIds = wos.map(w => w.id);
    let borings = [];
    let rates = [];
    let woActs = [];
    if (woIds.length) {
      borings = await fetchTable('wo_borings', {
        select: '*, boring_type:boring_types(name)',
        order: 'sort_order',
      });
      rates = await fetchTable('wo_rate_schedule', {
        select: '*, billing_unit:billing_unit_types(name, default_unit)',
        order: 'sort_order',
      });
      woActs = await fetchTable('wo_activities', {
        select: '*',
        order: 'sort_order',
      });
    }

    const enriched = wos.map(wo => {
      const woBorings = borings.filter(b => b.work_order_id === wo.id);
      const woRates = rates.filter(r => r.work_order_id === wo.id);
      const woAct = woActs.filter(a => a.work_order_id === wo.id);
      if (woBorings.length > 0) console.log(`WO ${wo.wo_number || wo.id.slice(0,8)}: ${woBorings.length} borings found`);
      return {
        ...wo,
        borings: woBorings,
        rateSchedule: woRates,
        woActivities: woAct,
      };
    });
    console.log(`Total borings fetched: ${borings.length}, WOs: ${wos.length}`);

    setWorkOrders(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createWorkOrder = async (wo, borings = [], rateSchedule = [], activities = []) => {
    const { data, error } = await supabase.from('work_orders').insert(wo).select().single();
    if (error) { console.error('Error creating WO:', error); return null; }

    if (borings.length) {
      const boringRows = borings.map(b => ({ ...b, work_order_id: data.id }));
      await supabase.from('wo_borings').insert(boringRows);
    }
    if (rateSchedule.length) {
      const rateRows = rateSchedule.map(r => ({ ...r, work_order_id: data.id }));
      await supabase.from('wo_rate_schedule').insert(rateRows);
    }
    if (activities.length) {
      const actRows = activities.map(a => ({ ...a, work_order_id: data.id }));
      await supabase.from('wo_activities').insert(actRows);
    }

    await refresh();
    return data;
  };

  const updateWorkOrder = async (id, updates, borings, rateSchedule, activities) => {
    const { error } = await supabase.from('work_orders').update(updates).eq('id', id);
    if (error) { console.error('Error updating WO:', error); return false; }
    // Replace borings if provided
    if (borings) {
      await supabase.from('wo_borings').delete().eq('work_order_id', id);
      if (borings.length) {
        const rows = borings.map(b => ({ ...b, work_order_id: id }));
        await supabase.from('wo_borings').insert(rows);
      }
    }
    // Replace rate schedule if provided
    if (rateSchedule) {
      await supabase.from('wo_rate_schedule').delete().eq('work_order_id', id);
      if (rateSchedule.length) {
        const rows = rateSchedule.map(r => ({ ...r, work_order_id: id }));
        await supabase.from('wo_rate_schedule').insert(rows);
      }
    }
    // Replace activities if provided
    if (activities) {
      await supabase.from('wo_activities').delete().eq('work_order_id', id);
      if (activities.length) {
        const rows = activities.map(a => ({ ...a, work_order_id: id }));
        await supabase.from('wo_activities').insert(rows);
      }
    }
    await refresh();
    return true;
  };

  const updateWOStatus = async (id, status, extra = {}) => {
    const updates = { ...extra };
    if (status) updates.status = status;
    return updateWorkOrder(id, updates);
  };

  return { workOrders, loading, refresh, createWorkOrder, updateWorkOrder, updateWOStatus };
}

// ─── Daily Reports ───────────────────────────────────────────────────
export function useDailyReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const drs = await fetchTable('daily_reports', {
      select: `*,
        work_order:work_orders(wo_number, name, project:projects(name)),
        rig:rigs(name, rig_type),
        crew:crews(name),
        driller:staff_members(first_name, last_name)`,
      order: 'report_date',
      asc: false,
    });

    const drIds = drs.map(d => d.id);
    let production = [];
    let billing = [];
    let activities = [];
    if (drIds.length) {
      production = await fetchTable('daily_report_production', {
        select: '*, boring:wo_borings(boring_id_label), boring_type:boring_types(name)',
        order: 'sort_order',
      });
      billing = await fetchTable('daily_report_billing', {
        select: '*, rate_item:wo_rate_schedule(billing_unit:billing_unit_types(name, default_unit))',
        order: 'sort_order',
      });
      activities = await fetchTable('daily_report_activities', {
        select: '*',
        order: 'sort_order',
      });
    }

    const enriched = drs.map(dr => ({
      ...dr,
      production: production.filter(p => p.daily_report_id === dr.id),
      billing: billing.filter(b => b.daily_report_id === dr.id),
      activities: activities.filter(a => a.daily_report_id === dr.id),
    }));

    setReports(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createReport = async (report, productionEntries = [], billingEntries = [], activityEntries = []) => {
    const { data, error } = await supabase.from('daily_reports').insert(report).select().single();
    if (error) { console.error('Error creating report:', error); return null; }

    if (productionEntries.length) {
      const rows = productionEntries.map(p => ({ ...p, daily_report_id: data.id }));
      await supabase.from('daily_report_production').insert(rows);
    }
    if (billingEntries.length) {
      const rows = billingEntries.map(b => ({ ...b, daily_report_id: data.id }));
      await supabase.from('daily_report_billing').insert(rows);
    }
    if (activityEntries.length) {
      const rows = activityEntries.map(a => ({ ...a, daily_report_id: data.id }));
      await supabase.from('daily_report_activities').insert(rows);
    }

    await refresh();
    return data;
  };

  const updateReportStatus = async (id, status, reviewNotes = '') => {
    const updates = {
      status,
      review_notes: reviewNotes,
      reviewed_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('daily_reports').update(updates).eq('id', id);
    if (error) { console.error('Error updating report:', error); return false; }
    await refresh();
    return true;
  };

  const updateReport = async (id, reportData, productionEntries, billingEntries) => {
    const { error } = await supabase.from('daily_reports').update(reportData).eq('id', id);
    if (error) { console.error('Error updating report:', error); return false; }
    // Replace production entries
    if (productionEntries) {
      await supabase.from('daily_report_production').delete().eq('daily_report_id', id);
      if (productionEntries.length) {
        const rows = productionEntries.map(p => ({ ...p, daily_report_id: id }));
        await supabase.from('daily_report_production').insert(rows);
      }
    }
    // Replace billing entries
    if (billingEntries) {
      await supabase.from('daily_report_billing').delete().eq('daily_report_id', id);
      if (billingEntries.length) {
        const rows = billingEntries.map(b => ({ ...b, daily_report_id: id }));
        await supabase.from('daily_report_billing').insert(rows);
      }
    }
    await refresh();
    return true;
  };

  return { reports, loading, refresh, createReport, updateReport, updateReportStatus };
}
