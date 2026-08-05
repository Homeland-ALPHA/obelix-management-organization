import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useBuilding } from "@/context/BuildingContext";
import { useList, useSave } from "@/lib/hooks";
import { DatasetPanel, Panel, PageLoading } from "@/components/app/ui";
import { Modal, SourceTag, SubTabs, EmptyState } from "@/components/app/kit";
import { StatusBadge } from "@/components/landing/primitives";
import { ClassChip } from "@/components/app/ui";
import { ViolationTracker, effectiveStage, readiness, requirementsFor, stageLabel } from "@/components/app/ViolationTracker";
import { fmtDate } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const TABS = ["Violations", "Inspections", "Registration", "Compliance Calendar"];

/* HPD marks a violation Open/Close — anything not open is cleared. */
const HPD_FILTERS = [
  { key: "open", label: "Open", test: (it) => !!it.extra?.open },
  { key: "cleared", label: "Cleared", test: (it) => !it.extra?.open },
  { key: "all", label: "All", test: () => true },
];
const OPEN_FILTERS = [
  { key: "open", label: "Open", test: (it) => !!it.extra?.open },
  { key: "closed", label: "Closed", test: (it) => !it.extra?.open },
  { key: "all", label: "All", test: () => true },
];

const CalendarList = ({ buildingId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["compliance", buildingId],
    queryFn: () => api.get("/compliance", { params: { building_id: buildingId } }).then((r) => r.data),
  });
  if (isLoading) return <PageLoading label="Building the calendar…" />;
  const groups = new Map();
  for (const it of data?.items || []) {
    const key = it.date ? dayjs(it.date).format("MMMM YYYY") : "No fixed date";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  if (!groups.size) return <p className="py-10 text-center text-[12px] text-dim">No compliance items.</p>;
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([month, items]) => (
        <section key={month}>
          <div className="flex items-center gap-3">
            <h2 className="label-xs whitespace-nowrap text-gold/90">{month}</h2>
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            <span className="label-xs text-faint">{items.length}</span>
          </div>
          <Panel className="mt-2.5">
            <ul className="divide-y divide-line/70">
              {items.map((it, i) => (
                <li key={`${it.title}-${i}`} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="tnum mt-0.5 w-12 shrink-0 text-[11px] text-dim">{it.date ? dayjs(it.date).format("MMM D") : "—"}</span>
                    <span className="label-xs mt-0.5 w-28 shrink-0 truncate text-faint" title={it.kind}>{it.kind}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-body">{it.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-dim">{it.building}</p>
                    </div>
                  </div>
                  <StatusBadge status={it.status} />
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ))}
    </div>
  );
};

const CompliancePage = () => {
  const { selected, selectedId, isPortfolio, hasBuildings } = useBuilding();
  const [tab, setTab] = useState("Violations");
  const [tracked, setTracked] = useState(null);
  const qc = useQueryClient();
  const saveWo = useSave("work_orders");
  const { data: vendors = [] } = useList("vendors", null);

  const { data, isLoading } = useQuery({
    queryKey: ["building-data", selectedId],
    queryFn: () => api.get(`/buildings/${selectedId}/data`).then((r) => r.data),
    enabled: hasBuildings && !isPortfolio,
  });

  /* Remediation state for every violation of this building, keyed by id. */
  const { data: trackingMap = {} } = useQuery({
    queryKey: ["violation-tracking-map", selectedId],
    queryFn: () => api.get("/violations/tracking", { params: { building_id: selectedId } }).then((r) => r.data),
    enabled: hasBuildings && !isPortfolio,
  });

  const sync = useMutation({
    mutationFn: () => api.post(`/buildings/${selectedId}/sync`),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Re-synced from NYC Open Data");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const today = new Date().toISOString().slice(0, 10);

  /* Creates one work order covering all selected violations. */
  const createWorkOrder = (items, kind) => {
    if (!items.length) return Promise.resolve();
    const urgent = items.some((it) => it.tone === "urgent");
    const ids = items.map((it) => it.id);
    const LIST_CAP = 40;
    const lines = items
      .slice(0, LIST_CAP)
      .map((it) => `• #${it.id}${it.extra?.class ? ` · Class ${it.extra.class}` : ""} · ${(it.title || "").slice(0, 140)}`);
    if (items.length > LIST_CAP) lines.push(`…and ${items.length - LIST_CAP} more.`);
    return saveWo
      .mutateAsync({
        building_id: selectedId,
        title: items.length === 1 ? (items[0].title || "").slice(0, 120) : `Correct ${items.length} open ${kind}`,
        description: [...lines, "", `Generated from ${items.length} ${kind.replace(/s$/, "")} record${items.length === 1 ? "" : "s"}.`].join("\n"),
        priority: urgent ? "high" : "medium",
        related_violation: ids.slice(0, 15).join(", ") + (ids.length > 15 ? ` +${ids.length - 15} more` : ""),
        category: "other",
        status: "Submitted",
      })
      .then(() => {
        toast.success(
          items.length === 1 ? "Work order created from violation" : `Work order created for ${items.length} violations`,
        );
      });
  };

  /* Triage columns: what it is, where, by when, who owns it, where it stands. */
  const violationColumns = (showClass) => [
    {
      key: "priority",
      label: "Priority",
      render: (it) => (
        <div className="flex items-start gap-2.5">
          <span
            className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", it.tone === "urgent" ? "bg-alert" : it.extra?.open ? "bg-gold/70" : "bg-ok/60")}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {showClass ? <ClassChip k={it.extra?.class || "?"} /> : null}
              <span className="line-clamp-2 text-[12.5px] text-body">{it.title}</span>
            </div>
            <div className="tnum mt-0.5 text-[10.5px] text-dim">#{it.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: "property",
      label: "Property",
      render: (it) => (
        <>
          <div className="text-[12.5px] text-mid">{selected?.label || "—"}</div>
          <div className="mt-0.5 text-[10.5px] text-dim">
            {trackingMap[it.id]?.unit || it.extra?.apartment ? `Unit ${trackingMap[it.id]?.unit || it.extra?.apartment}` : "Building-wide"}
          </div>
        </>
      ),
    },
    {
      key: "deadline",
      label: "Deadline",
      render: (it) => {
        const due = trackingMap[it.id]?.target_date || it.extra?.correct_by;
        const overdue = due && due < today && it.extra?.open;
        return <span className={cn("tnum text-[12.5px]", overdue ? "text-alert" : "text-mid")}>{due ? fmtDate(due) : "—"}</span>;
      },
    },
    {
      key: "assignee",
      label: "Assigned to",
      render: (it) => {
        const t = trackingMap[it.id] || {};
        const name = vendors.find((v) => v.id === t.vendor_id)?.name || t.assignee;
        return <span className={cn("text-[12.5px]", name ? "text-mid" : "text-faint")}>{name || "Unassigned"}</span>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (it) => {
        const t = trackingMap[it.id];
        const stage = effectiveStage(it, t);
        const { met, total } = readiness(
          requirementsFor({
            item: it,
            tracking: t || {},
            buildingLabel: selected?.label,
            vendorName: vendors.find((v) => v.id === t?.vendor_id)?.name,
          }),
        );
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={stage === "cleared" ? "Cleared" : stage === "detected" ? "Not Started" : "In Progress"} />
            <span className="tnum text-[10px] text-dim">{stage === "cleared" ? stageLabel(stage) : `${stageLabel(stage)} · ${met}/${total}`}</span>
          </div>
        );
      },
    },
  ];

  if (!hasBuildings) {
    return <EmptyState icon={ShieldCheck} title="Connect a property first." body="Compliance pulls live HPD, DOB and OATH records for each building you add." />;
  }

  const ds = data?.datasets || {};
  const b = data?.building;

  const srcTag = (key) =>
    ds[key] ? (
      <SourceTag
        source={`data.cityofnewyork.us · ${ds[key].source}`}
        syncedAt={ds[key].fetched_at}
        status={ds[key].error ? "error" : "ok"}
        onRefresh={() => sync.mutate()}
        refreshing={sync.isPending}
      />
    ) : null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs text-gold/90">Compliance</p>
          <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">
            {isPortfolio ? "Portfolio compliance calendar." : `Live city record · ${selected?.label}`}
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-mid">
            Live agency data is labeled with its source and sync time; nothing here is user-entered unless marked.
          </p>
        </div>
        {!isPortfolio && b && (
          <SourceTag source="NYC Open Data" syncedAt={b.last_synced} onRefresh={() => sync.mutate()} refreshing={sync.isPending} />
        )}
      </div>

      <div className="mt-5">
        <SubTabs tabs={isPortfolio ? ["Compliance Calendar"] : TABS} active={isPortfolio ? "Compliance Calendar" : tab} onChange={setTab} />
      </div>

      <div className="mt-5 space-y-6">
        {isPortfolio || tab === "Compliance Calendar" ? (
          <CalendarList buildingId={selectedId} />
        ) : isLoading ? (
          <PageLoading label="Pulling live city records…" />
        ) : tab === "Violations" ? (
          <>
            <div className="space-y-1">{srcTag("hpd_violations")}</div>
            <DatasetPanel
              ds={ds.hpd_violations}
              filters={HPD_FILTERS}
              selectable
              onBulk={(sel) => createWorkOrder(sel, "HPD violations")}
              bulkBusy={saveWo.isPending}
              columns={violationColumns(true)}
              onRowClick={setTracked}
            />
            <DatasetPanel
              ds={ds.dob_violations}
              filters={OPEN_FILTERS}
              selectable
              onBulk={(sel) => createWorkOrder(sel, "DOB violations")}
              bulkBusy={saveWo.isPending}
              columns={violationColumns(false)}
              onRowClick={setTracked}
            />
            <DatasetPanel
              ds={ds.ecb_violations}
              filters={OPEN_FILTERS}
              selectable
              onBulk={(sel) => createWorkOrder(sel, "OATH/ECB violations")}
              bulkBusy={saveWo.isPending}
              columns={violationColumns(false)}
              onRowClick={setTracked}
            />
          </>
        ) : tab === "Inspections" ? (
          <>
            <DatasetPanel ds={ds.boiler} initial={5} />
            <DatasetPanel ds={ds.facades} initial={5} />
            <DatasetPanel ds={ds.hpd_complaints} initial={5} />
            <DatasetPanel ds={ds.c311} initial={5} />
            <DatasetPanel ds={ds.dob_complaints} initial={5} />
          </>
        ) : (
          <>
            <DatasetPanel ds={ds.registration} initial={3} />
            <DatasetPanel ds={ds.bedbugs} initial={3} />
            <DatasetPanel ds={ds.litigation} initial={5} />
            <DatasetPanel ds={ds.valuation} initial={3} />
          </>
        )}
      </div>

      <Modal open={!!tracked} onClose={() => setTracked(null)} title="Violation remediation" wide>
        {tracked && (
          <ViolationTracker
            item={tracked}
            buildingId={selectedId}
            buildingLabel={selected?.label}
            onCreateWorkOrder={(it) => createWorkOrder([it], "HPD violations").then(() => setTracked(null))}
          />
        )}
      </Modal>

      {!isPortfolio && (
        <p className="mt-6 text-[11px] text-faint">
          Sources: HPD, DOB, OATH/ECB, 311 and DOF via NYC Open Data. Refresh any panel with the sync control, or open{" "}
          <Link to="/app/work-orders" className="text-gold/80 hover:text-gold">Work Orders</Link> to track corrections.
        </p>
      )}
    </div>
  );
};

export default CompliancePage;
