import { useState, useRef } from "react";
import { theme, STATUS_COLORS, selectStyle } from "./constants.js";
import { Icon, Badge, Btn } from "./ui.jsx";

export default function GanttScheduler({ workOrders, onAssign, orgData, isMobile }) {
  const rigs = orgData?.rigs || [];
  const crews = orgData?.crews || [];

  // Split WOs into unscheduled vs scheduled
  const unscheduled = workOrders.filter(w => ['pending', 'approved'].includes(w.status));
  const scheduled = workOrders.filter(w => w.startDate && ['scheduled', 'in_progress', 'completed'].includes(w.status));

  // Drag state
  const [dragging, setDragging] = useState(null); // WO being dragged
  const [dragOver, setDragOver] = useState(null); // crew/rig being hovered

  // Assign modal state
  const [assignModal, setAssignModal] = useState(null); // WO to assign (mobile tap)
  const [assignRig, setAssignRig] = useState('');
  const [assignCrew, setAssignCrew] = useState('');

  // ── Drag handlers (desktop) ──
  const handleDragStart = (e, wo) => {
    setDragging(wo);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', wo.id);
  };

  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  const handleDrop = (e, rigId, crewId) => {
    e.preventDefault();
    setDragOver(null);
    if (dragging) {
      onAssign(dragging.id, rigId, crewId);
      setDragging(null);
    }
  };

  const handleDragOver = (e, key) => { e.preventDefault(); setDragOver(key); };

  // ── Tap assign (mobile) ──
  const handleTapAssign = (wo) => {
    setAssignModal(wo);
    setAssignRig(rigs.find(r => r.status === 'available')?.id || '');
    setAssignCrew(crews[0]?.id || '');
  };

  const confirmAssign = () => {
    if (assignModal && assignRig) {
      onAssign(assignModal.id, assignRig, assignCrew || null);
      setAssignModal(null);
    }
  };

  // ── Build crew/rig rows for the board ──
  const crewRows = crews.map(crew => {
    const crewWOs = scheduled.filter(w => w.assignedCrew === crew.id);
    const assignedRig = rigs.find(r => {
      const wo = crewWOs.find(w => w.assignedRig === r.id);
      return !!wo;
    });
    return { crew, rig: assignedRig, workOrders: crewWOs };
  });

  // WOs assigned to rigs but no crew
  const uncrewedWOs = scheduled.filter(w => w.assignedRig && !w.assignedCrew);

  return (
    <div>
      {/* Assign modal (mobile) */}
      {assignModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setAssignModal(null)}>
          <div style={{ background: theme.surface, borderRadius: 12, padding: 24, width: "100%", maxWidth: 360, border: `1px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: theme.text }}>Assign Work Order</h3>
            <div style={{ fontSize: 13, color: theme.accent, fontWeight: 600, marginBottom: 4 }}>{assignModal.woNumber}</div>
            <div style={{ fontSize: 13, color: theme.text, marginBottom: 2 }}>{assignModal.projectName}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16 }}>{assignModal.client} • {assignModal.borings?.length || 0} borings</div>

            <label style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Rig</label>
            <select style={{ ...selectStyle, marginBottom: 12 }} value={assignRig} onChange={e => setAssignRig(e.target.value)}>
              <option value="">Select rig...</option>
              {rigs.filter(r => r.status === 'available').map(r => <option key={r.id} value={r.id}>{r.name} ({r.rig_type})</option>)}
            </select>

            <label style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Crew</label>
            <select style={{ ...selectStyle, marginBottom: 16 }} value={assignCrew} onChange={e => setAssignCrew(e.target.value)}>
              <option value="">Select crew...</option>
              {crews.map(c => <option key={c.id} value={c.id}>{c.name}{c.lead ? ` (${c.lead.first_name} ${c.lead.last_name})` : ''}</option>)}
            </select>

            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setAssignModal(null)}>Cancel</Btn>
              <Btn style={{ flex: 1 }} onClick={confirmAssign}><Icon name="check" size={14} /> Assign</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Unscheduled work queue */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: isMobile ? 12 : 16, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: theme.accent, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="clipboard" size={14} color={theme.accent} />
          Work Queue ({unscheduled.length})
          {!isMobile && <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 400, marginLeft: 8 }}>Drag to a crew below to schedule</span>}
        </h3>

        {unscheduled.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: theme.textMuted, fontSize: 13 }}>All work orders are scheduled.</div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {unscheduled.map(wo => (
            <div
              key={wo.id}
              draggable={!isMobile}
              onDragStart={e => handleDragStart(e, wo)}
              onDragEnd={handleDragEnd}
              onClick={() => isMobile && handleTapAssign(wo)}
              style={{
                background: theme.surface2, border: `1px solid ${dragging?.id === wo.id ? theme.accent : theme.border}`,
                borderRadius: 8, padding: "10px 12px", minWidth: isMobile ? "100%" : 200, maxWidth: isMobile ? "100%" : 280,
                cursor: isMobile ? "pointer" : "grab", opacity: dragging?.id === wo.id ? 0.5 : 1,
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent, fontFamily: "monospace" }}>{wo.woNumber}</span>
                <Badge status={wo.status} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginTop: 4 }}>{wo.projectName}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                {wo.client} • {wo.borings?.length || 0} borings
                {wo.estimatedCost ? ` • $${Number(wo.estimatedCost).toLocaleString()}` : ''}
              </div>
              {wo.location && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{wo.location}</div>}
              {isMobile && <div style={{ fontSize: 11, color: theme.accent, fontWeight: 600, marginTop: 6 }}>Tap to assign →</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Crew board */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {crews.map(crew => {
          const crewWOs = scheduled.filter(w => w.assignedCrew === crew.id);
          const dropKey = `crew-${crew.id}`;
          const isOver = dragOver === dropKey;
          const leadName = crew.lead ? `${crew.lead.first_name} ${crew.lead.last_name}` : 'No lead';

          return (
            <div
              key={crew.id}
              onDragOver={e => handleDragOver(e, dropKey)}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => {
                const rigId = rigs.find(r => r.status === 'available')?.id || rigs[0]?.id;
                handleDrop(e, rigId, crew.id);
              }}
              style={{
                background: isOver ? "rgba(244,165,58,0.08)" : theme.surface,
                border: `1px solid ${isOver ? theme.accent : theme.border}`,
                borderRadius: 10, padding: isMobile ? 12 : 16,
                transition: "all 0.2s",
                minHeight: 70,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: crewWOs.length ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: crewWOs.length ? theme.accentDim : theme.surface2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="users" size={18} color={crewWOs.length ? theme.accent : theme.textMuted} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{crew.name}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted }}>{leadName}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: crewWOs.length ? theme.accent : theme.textMuted, fontWeight: 600 }}>
                    {crewWOs.length} job{crewWOs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Assigned WOs */}
              {crewWOs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {crewWOs.map(wo => {
                    const sc = STATUS_COLORS[wo.status] || STATUS_COLORS.scheduled;
                    const rig = rigs.find(r => r.id === wo.assignedRig);
                    return (
                      <div key={wo.id} style={{
                        background: `linear-gradient(135deg, ${sc.bg}, ${sc.border}15)`,
                        border: `1px solid ${sc.border}40`,
                        borderLeft: `3px solid ${sc.border}`,
                        borderRadius: 8, padding: "8px 12px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: sc.text, fontFamily: "monospace" }}>{wo.woNumber}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wo.projectName}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <Badge status={wo.status} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: theme.textMuted, flexWrap: "wrap" }}>
                          <span>{wo.client}</span>
                          {rig && <span style={{ color: theme.info }}>Rig: {rig.name}</span>}
                          <span>{wo.borings?.length || 0} borings</span>
                          {wo.startDate && <span>{wo.startDate} → {wo.endDate}</span>}
                          {wo.estimatedCost > 0 && <span style={{ color: theme.accent, fontWeight: 600 }}>${Number(wo.estimatedCost).toLocaleString()}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Drop zone hint */}
              {crewWOs.length === 0 && !isOver && (
                <div style={{ padding: isMobile ? "10px 0" : "16px 0", textAlign: "center", color: theme.textMuted, fontSize: 12 }}>
                  {isMobile ? "No jobs assigned" : "Drop work orders here to assign"}
                </div>
              )}
              {isOver && (
                <div style={{ padding: "16px 0", textAlign: "center", color: theme.accent, fontSize: 13, fontWeight: 600, borderRadius: 8, border: `2px dashed ${theme.accent}40`, marginTop: crewWOs.length ? 6 : 0 }}>
                  Drop to assign to {crew.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned to crew */}
      {uncrewedWOs.length > 0 && (
        <div style={{ marginTop: 16, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: theme.danger, textTransform: "uppercase" }}>
            <Icon name="alert" size={14} color={theme.danger} /> Assigned to Rig but No Crew ({uncrewedWOs.length})
          </h3>
          {uncrewedWOs.map(wo => (
            <div key={wo.id} style={{ fontSize: 12, color: theme.textMuted, padding: "4px 0" }}>
              {wo.woNumber} — {wo.projectName} (Rig: {rigs.find(r => r.id === wo.assignedRig)?.name || 'Unknown'})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
