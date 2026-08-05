import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { fmtDateTime, fmtInt, fmtMoney } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { FinanceChart } from "@/components/app/FinanceChart";
import { EmptyState, GoldButton, PriorityChip, priorityLabel, SourceTag, Spinner, SummaryCard } from "@/components/app/kit";
import { PageLoading, Panel, PanelHead, ToneBadge } from "@/components/app/ui";
import { StatusBadge } from "@/components/landing/primitives";

const ACTIVITY_VERBS = { created: "added", updated: "updated", deleted: "removed" };

const OverviewPage = () => {
  const { selected, selectedId, isPortfolio, hasBuildings, loading } = useBuilding();
  const { openAddBuilding } = useOutletContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["overview", selectedId],
    queryFn: () => api.get("/overview", { params: { building_id: selectedId } }).then((r) => r.data),
    enabled: hasBuildings,
    refetchInterval: 120_000,
  });

  const sync = useMutation({
    mutationFn: () => api.post(`/buildings/${selectedId}/sync`),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Re-synced with NYC Open Data");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (loading) return <PageLoading />;

  if (!hasBuildings) {
    return (
      <EmptyState
        icon={Building2}
        title="Connect your first property."
        body="Search any NYC address and Obelix imports the building profile, then keeps its violations, complaints, inspections and valuation live from the city."
      >
        <GoldButton onClick={openAddBuilding} className="px-6 py-2.5">
          <Plus size={14} strokeWidth={1.75} /> Add your first building
        </GoldButton>
      </EmptyState>
    );
  }

  if (isLoading || !data) return <PageLoading />;

  const f = data.financial || {};
  const noFin = !f.has_data;
  const finSub = noFin ? "Enter rent roll & expenses" : null;

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs text-gold/90">{isPortfolio ? "Portfolio overview" : "Building overview"}</p>
          <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">
            {isPortfolio ? `All buildings · ${data.buildings_count}` : selected?.label}
          </h1>
          {!isPortfolio && (
            <p className="mt-1 text-[12px] text-dim">
              {selected?.borough} {selected?.zip ? `· ${selected.zip}` : ""} · BBL <span className="tnum">{selected?.bbl}</span>
            </p>
          )}
        </div>
        <SourceTag
          source="HPD · DOB · OATH · 311 · DOF"
          syncedAt={isPortfolio ? data.dof?.synced_at : selected?.last_synced}
          onRefresh={!isPortfolio ? () => sync.mutate() : undefined}
          refreshing={sync.isPending}
        />
      </div>

      {/* summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Units" value={fmtInt(f.units)} unavailable={!f.units} sub={!f.units ? "Add units" : null} onClick={() => navigate("/app/tenants")} />
        <SummaryCard label="Occupancy" value={f.occupancy != null ? `${f.occupancy}%` : "—"} unavailable={f.occupancy == null} sub={f.occupancy == null ? "Add units & tenants" : null} onClick={() => navigate("/app/rent-roll")} />
        <SummaryCard label="Rent collected · month" value={fmtMoney(f.collected_month)} unavailable={noFin} sub={finSub || (f.collection_rate != null ? `${f.collection_rate}% of expected` : null)} onClick={() => navigate("/app/financials")} />
        <SummaryCard label="Outstanding arrears" value={fmtMoney(f.arrears)} tone={f.arrears ? "alert" : "default"} unavailable={noFin} sub={finSub} onClick={() => navigate("/app/rent-roll")} />
        <SummaryCard label="NOI · month" value={f.noi_month != null ? fmtMoney(f.noi_month) : "—"} unavailable={f.noi_month == null} sub={f.noi_month == null ? "Needs revenue & expenses" : null} onClick={() => navigate("/app/financials")} />
        <SummaryCard label="Open emergencies" value={fmtInt(data.emergencies)} tone={data.emergencies ? "alert" : "ok"} onClick={() => navigate("/app/work-orders")} />
        <SummaryCard label="Open HPD violations" value={fmtInt(data.hpd_open)} tone={data.hpd_open ? "alert" : "ok"} sub="Live · NYC Open Data" onClick={() => navigate("/app/compliance")} />
        <SummaryCard label="Cleared violations" value={fmtInt(data.hpd_cleared)} tone="ok" sub="Live · NYC Open Data" onClick={() => navigate("/app/compliance")} />
        <SummaryCard label="Approvals waiting" value={fmtInt(data.approvals_waiting)} tone={data.approvals_waiting ? "default" : "ok"} onClick={() => navigate("/app/work-orders")} />
        <SummaryCard
          label="DOF assessed market value"
          value={data.dof?.value ? fmtMoney(data.dof.value) : "Unavailable"}
          unavailable={!data.dof?.value}
          sub={
            data.dof?.value
              ? `${data.dof.tax_year ? `Tax year ${data.dof.tax_year} · ` : ""}${data.dof.source}`
              : "Source did not return a value"
          }
          onClick={() => navigate("/app/profile")}
        />
      </div>

      {/* chart + attention */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <FinanceChart buildingId={selectedId} />

        <Panel>
          <PanelHead title="Attention required" meta={`${data.attention_total} priority item${data.attention_total === 1 ? "" : "s"}`} />
          {data.attention.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-dim">Nothing needs your attention right now.</p>
          ) : (
            <ul className="max-h-[430px] divide-y divide-line/70 overflow-y-auto">
              {data.attention.map((a) => (
                <li key={a.key}>
                  <Link to={`/app/${a.tab === "overview" ? "" : a.tab}`} className="flex items-start justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-tint/[0.02]">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] text-body">{a.title}</p>
                      <p className="mt-0.5 truncate text-[10.5px] text-dim">
                        {isPortfolio && a.building ? `${a.building} · ` : ""}
                        {a.sub}
                        {a.due ? ` · due ${a.due}` : ""}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gold/80">→ {a.action}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <PriorityChip p={a.priority} />
                      {a.status && a.status.toLowerCase() !== priorityLabel(a.priority).toLowerCase() && (
                        <StatusBadge status={a.status} />
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data.hpd_open > 0 && (
            <Link
              to="/app/compliance"
              className="flex items-center justify-center gap-1 border-t border-line px-4 py-2 text-[11px] text-dim transition-colors hover:text-gold"
            >
              Urgent items only (Class C/I violations & deadlines) — review all {fmtInt(data.hpd_open)} open HPD violations →
            </Link>
          )}
        </Panel>
      </div>

      {/* recent activity */}
      <Panel className="mt-6">
        <PanelHead title="Recent activity" right={<Link to="/app/activity" className="label-xs text-dim hover:text-gold">View all</Link>} />
        {data.activity.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-dim">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {data.activity.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <p className="min-w-0 truncate text-[12.5px] text-mid">
                  <span className="text-body">{a.actor}</span> {ACTIVITY_VERBS[a.action] || a.action}{" "}
                  <span className="text-body">{a.label}</span>
                  <span className="label-xs ml-2 text-faint">{a.entity.replace("_", " ")}</span>
                </p>
                <span className="tnum shrink-0 text-[10.5px] text-dim">{fmtDateTime(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default OverviewPage;
