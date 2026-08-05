import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { downloadReport } from "@/lib/hooks";
import { RequireBuildingSelected } from "@/components/app/guards";
import { DataTable, GhostButton, ToneBadge } from "@/components/app/kit";
import { Panel, PanelHead } from "@/components/app/ui";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "Occupied", "Vacant", "Rent stabilized", "Market rate", "Lease expiring", "Balance due"];

const RentRollInner = () => {
  const { selectedId } = useBuilding();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");

  const { data } = useQuery({
    queryKey: ["rentroll", selectedId],
    queryFn: () => api.get("/rentroll", { params: { building_id: selectedId } }).then((r) => r.data),
  });

  const soon90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    const all = data?.rows || [];
    switch (filter) {
      case "Occupied": return all.filter((r) => r.status === "Occupied");
      case "Vacant": return all.filter((r) => r.status === "Vacant");
      case "Rent stabilized": return all.filter((r) => r.stabilized);
      case "Market rate": return all.filter((r) => r.tenant && !r.stabilized);
      case "Lease expiring": return all.filter((r) => r.lease_end && r.lease_end >= today && r.lease_end <= soon90);
      case "Balance due": return all.filter((r) => (r.balance || 0) > 0);
      default: return all;
    }
  }, [data, filter, soon90, today]);

  const totals = useMemo(
    () => ({
      rent: rows.reduce((a, r) => a + (parseFloat(r.current_rent) || 0), 0),
      balance: rows.reduce((a, r) => a + (parseFloat(r.balance) || 0), 0),
    }),
    [rows],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs text-gold/90">Rent roll</p>
          <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">Every unit, one operational table.</h1>
        </div>
        <GhostButton className="px-3 py-1.5 text-[12px]" onClick={() => downloadReport("rent_roll", selectedId)}>
          <Download size={12} strokeWidth={1.5} /> Export CSV
        </GhostButton>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "border px-2.5 py-1 text-[11px] font-medium transition-colors",
              filter === f ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-mid hover:text-strong",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <Panel className="mt-4">
        <PanelHead
          title={`${rows.length} unit${rows.length === 1 ? "" : "s"}`}
          meta={`monthly rent ${fmtMoney(totals.rent)} · balances ${fmtMoney(totals.balance)}`}
        />
        <DataTable
          minWidth={980}
          columns={[
            { key: "unit", label: "Unit" },
            { key: "tenant", label: "Tenant", render: (r) => r.tenant || <span className="italic text-faint">Vacant</span> },
            { key: "status", label: "Status", render: (r) => <ToneBadge tone={r.status === "Occupied" ? "ok" : "neutral"}>{r.status}</ToneBadge> },
            { key: "lease_start", label: "Lease start", render: (r) => fmtDate(r.lease_start) },
            { key: "lease_end", label: "Lease end", render: (r) => (r.lease_end ? <span className={r.lease_end <= soon90 ? "text-gold" : ""}>{fmtDate(r.lease_end)}</span> : "—") },
            { key: "legal_rent", label: "Legal", align: "right", render: (r) => fmtMoney(r.legal_rent) },
            { key: "preferential_rent", label: "Pref.", align: "right", render: (r) => fmtMoney(r.preferential_rent) },
            { key: "current_rent", label: "Current", align: "right", render: (r) => fmtMoney(r.current_rent) },
            { key: "subsidy_amount", label: "Subsidy", align: "right", render: (r) => fmtMoney(r.subsidy_amount) },
            { key: "tenant_portion", label: "Tenant pays", align: "right", render: (r) => fmtMoney(r.tenant_portion) },
            { key: "deposit", label: "Deposit", align: "right", render: (r) => fmtMoney(r.deposit) },
            { key: "balance", label: "Balance", align: "right", render: (r) => ((r.balance || 0) > 0 ? <span className="font-medium text-alert">{fmtMoney(r.balance)}</span> : "—") },
            { key: "last_payment", label: "Last paid", render: (r) => fmtDate(r.last_payment) },
            { key: "stabilized", label: "Stab.", render: (r) => (r.stabilized ? <ToneBadge tone="warn">RS</ToneBadge> : "—") },
          ]}
          rows={rows}
          onRow={(r) => navigate("/app/tenants", { state: { openTenant: r.tenant_id, openUnit: r.unit_id } })}
          empty="No units yet — add units and tenants under Tenants & Units to build the rent roll."
        />
      </Panel>
    </div>
  );
};

const RentRollPage = () => (
  <RequireBuildingSelected pageName="Rent Roll">
    <RentRollInner />
  </RequireBuildingSelected>
);

export default RentRollPage;
