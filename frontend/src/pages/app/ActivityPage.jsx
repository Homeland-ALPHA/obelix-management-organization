import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { Panel, PanelHead, PageLoading } from "@/components/app/ui";
import { cn } from "@/lib/utils";

const fmtVal = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 120);
  return String(v).slice(0, 120);
};

const Row = ({ a, bname }) => {
  const [open, setOpen] = useState(false);
  const hasChanges = (a.changes || []).length > 0;
  return (
    <li>
      <button
        type="button"
        onClick={() => hasChanges && setOpen((v) => !v)}
        className={cn("flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left", hasChanges && "cursor-pointer transition-colors hover:bg-tint/[0.02]")}
      >
        <div className="min-w-0">
          <p className="truncate text-[12.5px] text-body">
            <span className="text-strong">{a.actor}</span> {a.action} <span className="text-strong">{a.label}</span>
          </p>
          <p className="mt-0.5 text-[10.5px] text-dim">
            {a.entity.replace(/_/g, " ")}
            {a.building_id && bname(a.building_id) ? ` · ${bname(a.building_id)}` : ""}
            {a.source && a.source !== "user" ? " · system" : ""}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tnum text-[10.5px] text-dim">{fmtDateTime(a.at)}</span>
          {hasChanges && <ChevronDown size={12} className={cn("text-faint transition-transform", open && "rotate-180")} />}
        </span>
      </button>
      {open && hasChanges && (
        <div className="border-t border-line/50 bg-black/[0.03] dark:bg-black/20 px-4 py-2.5">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="label-xs py-1 font-normal">Field</th>
                <th className="label-xs py-1 font-normal">Previous</th>
                <th className="label-xs py-1 font-normal">New</th>
              </tr>
            </thead>
            <tbody>
              {a.changes.map((c, i) => (
                <tr key={i} className="border-t border-line/40">
                  <td className="py-1.5 pr-3 text-[11.5px] text-mid">{c.field}</td>
                  <td className="py-1.5 pr-3 text-[11.5px] text-dim">{fmtVal(c.before)}</td>
                  <td className="py-1.5 text-[11.5px] text-body">{fmtVal(c.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
};

const ActivityPage = () => {
  const { selectedId, isPortfolio, buildings } = useBuilding();
  const { data, isLoading } = useQuery({
    queryKey: ["activity", selectedId],
    queryFn: () =>
      api.get("/activity", { params: isPortfolio ? { limit: 200 } : { building_id: selectedId, limit: 200 } }).then((r) => r.data),
  });
  const bname = (id) => buildings.find((b) => b.id === id)?.label || "";

  return (
    <div>
      <p className="label-xs text-gold/90">Activity</p>
      <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">The audit trail.</h1>
      <p className="mt-2 max-w-xl text-[12.5px] text-mid">
        Every change in the system — who made it, when, and the before / after values. Click a row to expand its changes.
      </p>

      <Panel className="mt-6">
        <PanelHead title={isPortfolio ? "Portfolio activity" : "Building activity"} meta={data ? `${data.length} events` : ""} />
        {isLoading ? (
          <PageLoading label="Loading activity…" />
        ) : (data || []).length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-dim">No activity yet — changes will be recorded here automatically.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {data.map((a) => (
              <Row key={a.id} a={a} bname={bname} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default ActivityPage;
