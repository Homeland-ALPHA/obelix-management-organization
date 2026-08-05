import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileBarChart2, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { fmtInt, fmtMoney } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { downloadReport } from "@/lib/hooks";
import { GhostButton, GoldButton, Modal } from "@/components/app/kit";
import { Panel } from "@/components/app/ui";

const REPORTS = [
  { kind: "owner", title: "Monthly owner report", body: "One monthly answer: occupancy, collections, arrears, NOI, violations and approvals.", print: true },
  { kind: "income_expense", title: "Income & expense statement", body: "Every revenue and expense entry for the period, categorized." },
  { kind: "rent_roll", title: "Rent roll", body: "Unit-by-unit lease, rent, subsidy and balance detail." },
  { kind: "arrears", title: "Arrears report", body: "Tenants with outstanding balances and last payment dates." },
  { kind: "work_orders", title: "Work-order report", body: "All maintenance activity with status, assignee and cost." },
  { kind: "violations", title: "Violation report", body: "Live HPD, DOB and OATH records from NYC Open Data." },
  { kind: "mortgage", title: "Mortgage summary", body: "Loan balances, rates, payments and maturities." },
];

const OwnerReportModal = ({ open, onClose, buildingId, label }) => {
  const { data: f = {} } = useQuery({
    queryKey: ["financials", "summary", buildingId],
    queryFn: () => api.get("/financials/summary", { params: { building_id: buildingId } }).then((r) => r.data),
    enabled: open,
  });
  const { data: ov } = useQuery({
    queryKey: ["overview", buildingId],
    queryFn: () => api.get("/overview", { params: { building_id: buildingId } }).then((r) => r.data),
    enabled: open,
  });
  return (
    <Modal open={open} onClose={onClose} title={`Owner report · ${label}`} wide>
      <div id="owner-report">
        <p className="label-xs">{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        <h2 className="mt-1 font-serif text-2xl font-light text-strong">{label}</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ["Units", fmtInt(f.units)],
            ["Occupancy", f.occupancy != null ? `${f.occupancy}%` : "—"],
            ["Collected this month", fmtMoney(f.collected_month)],
            ["Collection rate", f.collection_rate != null ? `${f.collection_rate}%` : "—"],
            ["Outstanding arrears", fmtMoney(f.arrears)],
            ["NOI (month)", f.noi_month != null ? fmtMoney(f.noi_month) : "—"],
            ["Open HPD violations", fmtInt(ov?.hpd_open)],
            ["Cleared violations", fmtInt(ov?.hpd_cleared)],
            ["Approvals waiting", fmtInt(ov?.approvals_waiting)],
            ["DOF market value", ov?.dof?.value ? fmtMoney(ov.dof.value) : "Unavailable"],
            ["Mortgage / month", f.debt_monthly != null ? fmtMoney(f.debt_monthly) : "—"],
            ["DSCR", f.dscr ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="border border-line px-3 py-2.5">
              <p className="label-xs">{k}</p>
              <p className="tnum mt-1 text-[15px] font-semibold text-strong">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10.5px] text-dim">
          Live agency values sourced from NYC Open Data (HPD / DOB / OATH / DOF); financial figures from recorded revenue and expenses.
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={() => window.print()}><Printer size={13} /> Print / PDF</GhostButton>
      </div>
    </Modal>
  );
};

const ReportsPage = () => {
  const { selectedId, selected, isPortfolio, buildings } = useBuilding();
  const [scope, setScope] = useState("current"); // current | portfolio
  const [ownerOpen, setOwnerOpen] = useState(false);
  const effective = scope === "portfolio" || isPortfolio ? "portfolio" : selectedId;
  const label = effective === "portfolio" ? `Portfolio · ${buildings.length} buildings` : selected?.label;

  return (
    <div>
      <p className="label-xs text-gold/90">Reports</p>
      <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">Generate and export.</h1>

      <div className="mt-4 flex items-center gap-2">
        <span className="label-xs">Scope</span>
        <select value={effective === "portfolio" ? "portfolio" : "current"} onChange={(e) => setScope(e.target.value)} disabled={isPortfolio} className="border border-line bg-panel px-2.5 py-1.5 text-[12px] text-strong outline-none">
          {!isPortfolio && <option value="current">{selected?.label}</option>}
          <option value="portfolio">Entire portfolio</option>
        </select>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <Panel key={r.kind} className="flex flex-col p-4">
            <FileBarChart2 size={15} strokeWidth={1.5} className="text-gold" />
            <h3 className="mt-2.5 text-[14px] font-medium text-strong">{r.title}</h3>
            <p className="mt-1 flex-1 text-[12px] leading-relaxed text-mid">{r.body}</p>
            <div className="mt-3">
              {r.print ? (
                <GoldButton className="px-3.5 py-1.5 text-[12px]" onClick={() => setOwnerOpen(true)}>
                  <Printer size={12} /> Generate
                </GoldButton>
              ) : (
                <GhostButton className="px-3.5 py-1.5 text-[12px]" onClick={() => downloadReport(r.kind, effective)}>
                  <Download size={12} /> Download CSV
                </GhostButton>
              )}
            </div>
          </Panel>
        ))}
      </div>

      <OwnerReportModal open={ownerOpen} onClose={() => setOwnerOpen(false)} buildingId={effective} label={label} />
    </div>
  );
};

export default ReportsPage;
