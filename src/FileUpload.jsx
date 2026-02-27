import { useState, useRef } from "react";
import { theme } from "./constants.js";
import { Icon, Btn } from "./ui.jsx";
import { supabase } from "./supabaseClient.js";

// ─── File category options for WO attachments ───────────────────────
const WO_CATEGORIES = [
  { value: "boring_plan", label: "Boring Plan" },
  { value: "safety_doc", label: "Safety Document" },
  { value: "scope_doc", label: "Scope Document" },
  { value: "permit", label: "Permit" },
  { value: "location_map", label: "Location Map / KMZ" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" },
];

// ─── Upload helper ───────────────────────────────────────────────────
async function uploadFile(bucket, path, file) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) { console.error("Upload error:", error); return null; }
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return urlData?.publicUrl || null;
}

// ─── WO Attachment Uploader ──────────────────────────────────────────
export function WOAttachments({ workOrderId, attachments, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("boring_plan");
  const [description, setDescription] = useState("");
  const fileRef = useRef(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return alert("Please select a file.");
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `${workOrderId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const url = await uploadFile('wo-attachments', path, file);

    if (url) {
      await supabase.from('wo_attachments').insert({
        work_order_id: workOrderId,
        file_name: file.name,
        file_url: url,
        file_type: file.type,
        file_size: file.size,
        category: category,
        description: description,
      });
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      onRefresh();
    }
    setUploading(false);
  };

  const deleteAttachment = async (att) => {
    if (!confirm(`Delete ${att.file_name}?`)) return;
    // Extract path from URL for storage deletion
    const urlParts = att.file_url.split('/wo-attachments/');
    if (urlParts[1]) {
      await supabase.storage.from('wo-attachments').remove([decodeURIComponent(urlParts[1])]);
    }
    await supabase.from('wo_attachments').delete().eq('id', att.id);
    onRefresh();
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getCategoryColor = (cat) => {
    const colors = { boring_plan: theme.info, safety_doc: theme.danger, scope_doc: theme.accent, permit: theme.success, location_map: theme.info, contract: theme.textMuted, other: theme.textMuted };
    return colors[cat] || theme.textMuted;
  };

  return (
    <div>
      {/* Existing attachments */}
      {attachments && attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {attachments.map(att => (
            <div key={att.id} style={{ background: theme.bg, borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <FileIcon type={att.file_type} />
                <div style={{ minWidth: 0 }}>
                  <a href={att.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: theme.info, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.file_name}</a>
                  <div style={{ display: "flex", gap: 8, fontSize: 10, color: theme.textMuted }}>
                    <span style={{ color: getCategoryColor(att.category), fontWeight: 600, textTransform: "uppercase" }}>{(att.category || 'other').replace('_', ' ')}</span>
                    {att.file_size && <span>{formatSize(att.file_size)}</span>}
                    {att.description && <span>• {att.description}</span>}
                  </div>
                </div>
              </div>
              <Btn variant="ghost" small onClick={() => deleteAttachment(att)}><Icon name="x" size={12} color={theme.danger} /></Btn>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      <div style={{ background: theme.bg, borderRadius: 8, padding: 12, border: `1px dashed ${theme.border}` }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.kmz,.kml,.jpg,.jpeg,.png,.dwg,.dxf" style={{ fontSize: 11, color: theme.text, flex: "1 1 200px", minWidth: 0 }} />
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: "inherit" }}>
            {WO_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, flex: "1 1 150px", fontFamily: "inherit" }} />
          <Btn small onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading..." : <><Icon name="plus" size={12} /> Upload</>}
          </Btn>
        </div>
        <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>PDF, Word, Excel, KMZ/KML, Images, CAD files</div>
      </div>
    </div>
  );
}

// ─── Daily Report Photo Uploader ─────────────────────────────────────
export function DRPhotos({ dailyReportId, photos, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const fileRef = useRef(null);

  const handleUpload = async () => {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) return alert("Please select photos.");
    setUploading(true);

    for (const file of files) {
      const path = `${dailyReportId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const url = await uploadFile('dr-photos', path, file);
      if (url) {
        await supabase.from('daily_report_photos').insert({
          daily_report_id: dailyReportId,
          file_name: file.name,
          file_url: url,
          file_size: file.size,
          caption: caption,
          taken_at: new Date().toISOString(),
        });
      }
    }

    setCaption("");
    if (fileRef.current) fileRef.current.value = "";
    onRefresh();
    setUploading(false);
  };

  const deletePhoto = async (photo) => {
    if (!confirm(`Delete ${photo.file_name}?`)) return;
    const urlParts = photo.file_url.split('/dr-photos/');
    if (urlParts[1]) {
      await supabase.storage.from('dr-photos').remove([decodeURIComponent(urlParts[1])]);
    }
    await supabase.from('daily_report_photos').delete().eq('id', photo.id);
    onRefresh();
  };

  return (
    <div>
      {/* Existing photos */}
      {photos && photos.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {photos.map(p => (
            <div key={p.id} style={{ position: "relative", width: 140, background: theme.bg, borderRadius: 8, overflow: "hidden", border: `1px solid ${theme.border}` }}>
              <a href={p.file_url} target="_blank" rel="noopener noreferrer">
                <img src={p.file_url} alt={p.caption || p.file_name} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} onError={e => { e.target.style.display = 'none'; }} />
              </a>
              <div style={{ padding: "6px 8px" }}>
                <div style={{ fontSize: 10, color: theme.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.caption || p.file_name}</div>
              </div>
              <button onClick={() => deletePhoto(p)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      <div style={{ background: theme.bg, borderRadius: 8, padding: 12, border: `1px dashed ${theme.border}` }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ fontSize: 11, color: theme.text, flex: "1 1 200px" }} />
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption (optional)" style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, flex: "1 1 150px", fontFamily: "inherit" }} />
          <Btn small onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading..." : <><Icon name="plus" size={12} /> Upload Photos</>}
          </Btn>
        </div>
        <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>JPG, PNG — select multiple files at once</div>
      </div>
    </div>
  );
}

// ─── File type icon ──────────────────────────────────────────────────
function FileIcon({ type }) {
  const color = (type || '').includes('pdf') ? '#ef4444' : (type || '').includes('image') ? '#60a5fa' : (type || '').includes('kmz') || (type || '').includes('kml') ? '#4ade80' : theme.textMuted;
  const label = (type || '').includes('pdf') ? 'PDF' : (type || '').includes('image') ? 'IMG' : (type || '').includes('kmz') || (type || '').includes('kml') ? 'KMZ' : (type || '').includes('word') || (type || '').includes('doc') ? 'DOC' : 'FILE';
  return (
    <div style={{ width: 32, height: 32, borderRadius: 6, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: 8, fontWeight: 800, color, letterSpacing: "0.02em" }}>{label}</span>
    </div>
  );
}
