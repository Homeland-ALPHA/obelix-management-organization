import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FolderOpen, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { fmtDate } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { useList } from "@/lib/hooks";
import { DataTable, GoldButton, Modal, Spinner } from "@/components/app/kit";
import { Panel, PanelHead, inputCls } from "@/components/app/ui";
import { cn } from "@/lib/utils";

const CATEGORIES = ["lease", "invoice", "insurance", "violation", "inspection", "loan", "other"];

const fmtSize = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

const DocumentsPage = () => {
  const { selectedId, isPortfolio, buildings, selected } = useBuilding();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [upOpen, setUpOpen] = useState(false);
  const [meta, setMeta] = useState({ category: "other", tags: "", unit_id: "", tenant_id: "", vendor_id: "", work_order_id: "" });
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");

  const { data: docs = [] } = useQuery({
    queryKey: ["documents", selectedId],
    queryFn: () => api.get("/documents", { params: isPortfolio ? {} : { building_id: selectedId } }).then((r) => r.data),
  });
  const { data: units = [] } = useList("units", selectedId, { enabled: !isPortfolio });
  const { data: tenants = [] } = useList("tenants", selectedId, { enabled: !isPortfolio });
  const { data: vendors = [] } = useList("vendors", null);

  const upload = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append("file", file);
      if (!isPortfolio) fd.append("building_id", selectedId);
      Object.entries(meta).forEach(([k, v]) => v && fd.append(k, v));
      return api.post("/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      setUpOpen(false);
      toast.success("Document uploaded");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
    onError: (e) => toast.error(apiError(e)),
  });

  const download = async (d) => {
    try {
      const res = await api.get(`/documents/${d.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(apiError(e, "Download failed"));
    }
  };

  const rows = useMemo(
    () =>
      docs
        .filter((d) => filter === "All" || d.category === filter.toLowerCase())
        .filter((d) => !q || `${d.name} ${(d.tags || []).join(" ")}`.toLowerCase().includes(q.toLowerCase())),
    [docs, filter, q],
  );

  const bname = (id) => buildings.find((b) => b.id === id)?.label || "—";
  const linkNames = (d) =>
    [
      d.unit_id && units.find((u) => u.id === d.unit_id) && `Unit ${units.find((u) => u.id === d.unit_id).number}`,
      d.tenant_id && tenants.find((t) => t.id === d.tenant_id)?.name,
      d.vendor_id && vendors.find((v) => v.id === d.vendor_id)?.name,
      d.work_order_id && "Work order",
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs text-gold/90">Documents</p>
          <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">One library, linked everywhere.</h1>
          <p className="mt-2 text-[12.5px] text-mid">
            A document is stored once and linked to buildings, units, tenants, vendors, loans or work orders.
          </p>
        </div>
        <GoldButton className="px-4 py-2 text-[12.5px]" onClick={() => setUpOpen(true)}>
          <Upload size={13} /> Upload document
        </GoldButton>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {["All", ...CATEGORIES.map((c) => c[0].toUpperCase() + c.slice(1))].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn("border px-2.5 py-1 text-[11px] font-medium transition-colors", filter === f ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-mid hover:text-strong")}
          >
            {f}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" className="ml-auto w-[200px] border border-line bg-panel px-3 py-1.5 text-[12px] text-strong placeholder:text-faint outline-none focus:border-gold/60" />
      </div>

      <Panel className="mt-4">
        <PanelHead title="Library" meta={`${rows.length} of ${docs.length}`} />
        <DataTable
          minWidth={760}
          columns={[
            { key: "name", label: "Document", render: (r) => (
                <span className="flex items-center gap-2"><FolderOpen size={13} strokeWidth={1.5} className="shrink-0 text-gold" /><span className="truncate">{r.name}</span></span>
              ) },
            { key: "category", label: "Category" },
            ...(isPortfolio ? [{ key: "b", label: "Building", render: (r) => bname(r.building_id) }] : []),
            { key: "links", label: "Linked to", render: linkNames },
            { key: "tags", label: "Tags", render: (r) => (r.tags || []).join(", ") || "—" },
            { key: "size", label: "Size", align: "right", render: (r) => fmtSize(r.size || 0) },
            { key: "uploaded_at", label: "Uploaded", render: (r) => fmtDate(r.uploaded_at) },
            {
              key: "act", label: "", align: "right",
              render: (r) => (
                <span className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button type="button" title="Download" onClick={() => download(r)} className="border border-line p-1.5 text-mid hover:text-gold"><Download size={12} strokeWidth={1.5} /></button>
                  <button type="button" title="Delete" onClick={() => del.mutate(r.id)} className="border border-line p-1.5 text-dim hover:border-alert/40 hover:text-alert"><Trash2 size={12} strokeWidth={1.5} /></button>
                </span>
              ),
            },
          ]}
          rows={rows}
          empty="No documents yet — upload leases, invoices, insurance certificates and inspection reports."
        />
      </Panel>

      <Modal open={upOpen} onClose={() => setUpOpen(false)} title="Upload document">
        <div className="space-y-4">
          {!isPortfolio && <p className="text-[12px] text-mid">Will be filed under <span className="text-body">{selected?.label}</span>.</p>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label-xs">Category</span>
              <select value={meta.category} onChange={(e) => setMeta((m) => ({ ...m, category: e.target.value }))} className={cn(inputCls, "mt-1.5")}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block"><span className="label-xs">Tags (comma separated)</span>
              <input value={meta.tags} onChange={(e) => setMeta((m) => ({ ...m, tags: e.target.value }))} className={cn(inputCls, "mt-1.5")} placeholder="boiler, 2026" />
            </label>
            {!isPortfolio && (
              <>
                <label className="block"><span className="label-xs">Link to unit</span>
                  <select value={meta.unit_id} onChange={(e) => setMeta((m) => ({ ...m, unit_id: e.target.value }))} className={cn(inputCls, "mt-1.5")}>
                    <option value="">None</option>
                    {units.map((u) => <option key={u.id} value={u.id}>Unit {u.number}</option>)}
                  </select>
                </label>
                <label className="block"><span className="label-xs">Link to tenant</span>
                  <select value={meta.tenant_id} onChange={(e) => setMeta((m) => ({ ...m, tenant_id: e.target.value }))} className={cn(inputCls, "mt-1.5")}>
                    <option value="">None</option>
                    {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
              </>
            )}
            <label className="block"><span className="label-xs">Link to vendor</span>
              <select value={meta.vendor_id} onChange={(e) => setMeta((m) => ({ ...m, vendor_id: e.target.value }))} className={cn(inputCls, "mt-1.5")}>
                <option value="">None</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          <GoldButton className="w-full py-2.5" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
            {upload.isPending ? <Spinner className="border-ink/40 border-t-ink" /> : <><Upload size={13} /> Choose file & upload</>}
          </GoldButton>
          <p className="label-xs text-center text-faint">25 MB max per file</p>
        </div>
      </Modal>
    </div>
  );
};

export default DocumentsPage;
