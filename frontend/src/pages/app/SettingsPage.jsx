import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useBuilding } from "@/context/BuildingContext";
import { useSettings, useRemove } from "@/lib/hooks";
import { AutoForm, DataTable, GhostButton } from "@/components/app/kit";
import { Panel, PanelHead } from "@/components/app/ui";
import { fmtDate } from "@/lib/fmt";

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { buildings, setSelectedId } = useBuilding();
  const { data: settings } = useSettings();
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: (v) => api.put("/settings", v).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const removeBuilding = useMutation({
    mutationFn: (id) => api.delete(`/buildings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries();
      setSelectedId("portfolio");
      toast.success("Building removed");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <p className="label-xs text-gold/90">Settings</p>
      <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">Workspace settings.</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <h3 className="text-[14px] font-medium text-strong">Company & workflow</h3>
          <div className="mt-4">
            {settings && (
              <AutoForm
                fields={[
                  { name: "company_name", label: "Company / portfolio name" },
                  { name: "approval_threshold", label: "Work-order approval threshold ($)", type: "money", half: true },
                  { name: "default_cap_rate", label: "Default cap rate (%)", type: "number", half: true },
                ]}
                initial={settings}
                busy={save.isPending}
                onSubmit={(v) => save.mutate(v)}
              />
            )}
            <p className="mt-3 text-[11px] text-dim">
              Work orders with an estimated cost at or above the threshold are automatically routed for approval.
            </p>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="p-5">
            <h3 className="text-[14px] font-medium text-strong">Account</h3>
            <ul className="mt-3 space-y-2 text-[12.5px] text-mid">
              <li><span className="label-xs mr-2">Name</span>{user?.name}</li>
              <li><span className="label-xs mr-2">Email</span>{user?.email}</li>
              <li><span className="label-xs mr-2">Company</span>{user?.company || "—"}</li>
            </ul>
            <GhostButton className="mt-4" onClick={signOut}>Sign out</GhostButton>
          </Panel>

          <Panel>
            <PanelHead title="Buildings" meta={`${buildings.length} connected`} />
            <DataTable
              minWidth={420}
              columns={[
                { key: "label", label: "Building" },
                { key: "created_at", label: "Added", render: (r) => fmtDate(r.created_at) },
                {
                  key: "act", label: "", align: "right",
                  render: (r) => (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Remove ${r.label} and its cached city data? Your units, tenants and financial records for it will remain.`)) {
                          removeBuilding.mutate(r.id);
                        }
                      }}
                      className="border border-line px-2 py-1 text-[10.5px] text-mid hover:border-alert/40 hover:text-alert"
                    >
                      Remove
                    </button>
                  ),
                },
              ]}
              rows={buildings}
              empty="No buildings connected."
            />
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
