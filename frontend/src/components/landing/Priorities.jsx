import { useMemo, useState } from "react";
import { PRIORITY_ROWS, PRIORITY_FILTERS } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal, StatusBadge } from "./primitives";
import { cn } from "@/lib/utils";

export const Priorities = () => {
  const [active, setActive] = useState("all");

  const rows = useMemo(
    () => (active === "all" ? PRIORITY_ROWS : PRIORITY_ROWS.filter((r) => r.kind.includes(active))),
    [active],
  );

  return (
    <Section id="maintenance" label="Today's priorities" className="border-t border-line">
      <Reveal>
        <Eyebrow>Daily operations</Eyebrow>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <H2 className="max-w-2xl">Every morning starts with the work that actually matters.</H2>
          <Lede className="max-w-md">
            Obelix ranks the portfolio by legal exposure, deadline proximity and tenant impact—then
            names the person responsible for each item.
          </Lede>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-10 border border-line bg-surface">
          <div className="flex flex-col gap-4 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div
              role="group"
              aria-label="Filter priorities"
              className="flex flex-wrap gap-1.5"
              data-testid="priority-filters"
            >
              {PRIORITY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-testid={`filter-${f.id}`}
                  aria-pressed={active === f.id}
                  onClick={() => setActive(f.id)}
                  className={cn(
                    "border px-3 py-1.5 text-[12px] font-medium transition-colors duration-200",
                    active === f.id
                      ? "border-gold/60 bg-gold/[0.12] text-gold"
                      : "border-line text-neutral-400 hover:border-neutral-600 hover:text-white",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="label-xs" data-testid="priority-count">
              {rows.length} {rows.length === 1 ? "item" : "items"} · Aug 1, 2025
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <caption className="sr-only">
                Prioritized portfolio work items with property, deadline, assignee and status
              </caption>
              <thead>
                <tr className="border-b border-line">
                  {["Priority", "Property", "Deadline", "Assigned To", "Status"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-2.5 label-xs font-normal sm:px-5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody data-testid="priority-table-body">
                {rows.map((r, i) => (
                  <tr
                    key={r.priority}
                    data-testid={`priority-row-${r.kind[0]}-${i}`}
                    className="border-b border-line/60 transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3.5 sm:px-5">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                            r.status === "Urgent" ? "bg-red-500" : "bg-gold/70",
                          )}
                          aria-hidden="true"
                        />
                        <div>
                          <div className="text-[13px] text-neutral-100">{r.priority}</div>
                          <div className="mt-0.5 text-[11px] text-neutral-500">{r.ref}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <div className="text-[13px] text-neutral-300">{r.property}</div>
                      <div className="mt-0.5 text-[11px] text-neutral-500">{r.unit}</div>
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <span
                        className={cn(
                          "tnum text-[13px]",
                          r.deadline === "Today" ? "text-red-400" : "text-neutral-300",
                        )}
                      >
                        {r.deadline}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-neutral-300 sm:px-5">{r.assignee}</td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-500">
                      No open items in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </Section>
  );
};
