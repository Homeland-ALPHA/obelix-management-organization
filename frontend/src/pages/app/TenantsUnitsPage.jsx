import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { useList, useSave, useRemove } from "@/lib/hooks";
import { RequireBuildingSelected } from "@/components/app/guards";
import { AutoForm, DataTable, GoldButton, Modal, SubTabs, ToneBadge } from "@/components/app/kit";
import { Panel, PanelHead } from "@/components/app/ui";

const UNIT_FIELDS = (unitOpts) => [
  { name: "number", label: "Unit number", required: true, half: true },
  { name: "floor", label: "Floor", type: "number", half: true },
  { name: "beds", label: "Bedrooms", type: "number", half: true },
  { name: "baths", label: "Bathrooms", type: "number", half: true },
  { name: "sqft", label: "Square feet", type: "number", half: true },
  { name: "status", label: "Status", type: "select", options: ["vacant", "occupied"], half: true },
  { name: "appliances", label: "Appliances", placeholder: "Fridge, stove, dishwasher…" },
  { name: "keys", label: "Keys & access", half: true },
  { name: "access_notes", label: "Access notes", half: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

const TENANT_FIELDS = (unitOpts) => [
  { name: "name", label: "Full name", required: true, half: true },
  { name: "unit_id", label: "Unit", type: "select", options: unitOpts, half: true },
  { name: "phone", label: "Phone", half: true },
  { name: "email", label: "Email", half: true },
  { name: "emergency_contact", label: "Emergency contact" },
  { name: "lease_start", label: "Lease start", type: "date", half: true },
  { name: "lease_end", label: "Lease end", type: "date", half: true },
  { name: "legal_rent", label: "Legal rent", type: "money", half: true },
  { name: "preferential_rent", label: "Preferential rent", type: "money", half: true },
  { name: "current_rent", label: "Current rent", type: "money", half: true },
  { name: "deposit", label: "Security deposit", type: "money", half: true },
  { name: "subsidy_program", label: "Subsidy program", placeholder: "Section 8, CityFHEPS…", half: true },
  { name: "subsidy_amount", label: "Subsidy amount", type: "money", half: true },
  { name: "tenant_portion", label: "Tenant portion", type: "money", half: true },
  { name: "stabilized", label: "Rent stabilized", type: "toggle", half: true },
  { name: "renewal_status", label: "Renewal status", type: "select", options: ["none", "offer sent", "signed", "declined", "holdover"], half: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

const TenantDrawer = ({ tenant, units, revenue, wos, onClose, onEdit }) => {
  if (!tenant) return null;
  const unit = units.find((u) => u.id === tenant.unit_id);
  const payments = revenue.filter((r) => r.tenant_id === tenant.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const balance = payments.reduce((a, r) => a + Math.max((r.expected || 0) - (r.received || 0), 0), 0);
  const requests = wos.filter((w) => w.unit_id === tenant.unit_id && !["Completed", "Inspected", "Closed"].includes(w.status));
  return (
    <Modal open onClose={onClose} title={tenant.name} wide>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Unit", unit ? `Unit ${unit.number}` : "—"],
          ["Phone", tenant.phone || "—"],
          ["Email", tenant.email || "—"],
          ["Lease", tenant.lease_end ? `${fmtDate(tenant.lease_start)} → ${fmtDate(tenant.lease_end)}` : "—"],
          ["Current rent", fmtMoney(tenant.current_rent)],
          ["Subsidy", tenant.subsidy_program || "—"],
          ["Balance", balance > 0 ? fmtMoney(balance) : "$0"],
          ["Open requests", requests.length],
        ].map(([k, v]) => (
          <div key={k} className="border border-line/70 px-3 py-2">
            <p className="label-xs">{k}</p>
            <p className="mt-0.5 truncate text-[13px] text-body">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="label-xs mb-2">Payment history</p>
        <DataTable
          minWidth={420}
          columns={[
            { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
            { key: "category", label: "Category", render: (r) => (r.category || "").replace(/_/g, " ") },
            { key: "expected", label: "Expected", align: "right", render: (r) => fmtMoney(r.expected) },
            { key: "received", label: "Received", align: "right", render: (r) => fmtMoney(r.received) },
          ]}
          rows={payments.slice(0, 10)}
          empty="No payments recorded for this tenant."
        />
      </div>
      <div className="mt-4 flex justify-end">
        <GoldButton className="px-4 py-2 text-[12px]" onClick={onEdit}>Edit tenant</GoldButton>
      </div>
    </Modal>
  );
};

const TenantsUnitsInner = () => {
  const { selectedId } = useBuilding();
  const location = useLocation();
  const [tab, setTab] = useState("Units");
  const [unitModal, setUnitModal] = useState(null);
  const [tenantModal, setTenantModal] = useState(null);
  const [viewTenant, setViewTenant] = useState(null);

  const { data: units = [] } = useList("units", selectedId);
  const { data: tenants = [] } = useList("tenants", selectedId);
  const { data: revenue = [] } = useList("revenue", selectedId);
  const { data: wos = [] } = useList("work_orders", selectedId);

  const saveUnit = useSave("units", { onDone: () => setUnitModal(null) });
  const removeUnit = useRemove("units", { onDone: () => setUnitModal(null) });
  const saveTenant = useSave("tenants", { onDone: () => setTenantModal(null) });
  const removeTenant = useRemove("tenants", { onDone: () => setTenantModal(null) });

  const unitOpts = units.map((u) => ({ value: u.id, label: `Unit ${u.number}` }));
  const tenantOfUnit = (uid) => tenants.find((t) => t.unit_id === uid);

  // deep-link from rent roll
  useEffect(() => {
    const st = location.state;
    if (st?.openTenant) {
      const t = tenants.find((x) => x.id === st.openTenant);
      if (t) {
        setTab("Tenants");
        setViewTenant(t);
      }
    }
  }, [location.state, tenants]);

  return (
    <div>
      <p className="label-xs text-gold/90">Tenants & units</p>
      <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">The people and the spaces.</h1>
      <div className="mt-5">
        <SubTabs tabs={["Units", "Tenants"]} active={tab} onChange={setTab} />
      </div>

      {tab === "Units" ? (
        <Panel className="mt-5">
          <PanelHead title="Units" meta={`${units.length} units`} right={<GoldButton className="px-3 py-1.5 text-[12px]" onClick={() => setUnitModal({})}><Plus size={12} /> Add unit</GoldButton>} />
          <DataTable
            columns={[
              { key: "number", label: "Unit", render: (r) => `Unit ${r.number}` },
              { key: "floor", label: "Floor" },
              { key: "beds", label: "Bd", align: "right" },
              { key: "baths", label: "Ba", align: "right" },
              { key: "sqft", label: "Sq ft", align: "right" },
              { key: "tenant", label: "Tenant", render: (r) => tenantOfUnit(r.id)?.name || <span className="italic text-faint">Vacant</span> },
              { key: "rent", label: "Rent", align: "right", render: (r) => fmtMoney(tenantOfUnit(r.id)?.current_rent) },
              { key: "wos", label: "Open WOs", align: "right", render: (r) => wos.filter((w) => w.unit_id === r.id && !["Completed", "Inspected", "Closed"].includes(w.status)).length || "—" },
            ]}
            rows={units}
            onRow={(r) => setUnitModal({ row: r })}
            empty="No units yet — add each apartment to build the rent roll."
          />
        </Panel>
      ) : (
        <Panel className="mt-5">
          <PanelHead title="Tenants" meta={`${tenants.length} tenants`} right={<GoldButton className="px-3 py-1.5 text-[12px]" onClick={() => setTenantModal({})}><Plus size={12} /> Add tenant</GoldButton>} />
          <DataTable
            columns={[
              { key: "name", label: "Tenant" },
              { key: "unit", label: "Unit", render: (r) => (units.find((u) => u.id === r.unit_id) ? `Unit ${units.find((u) => u.id === r.unit_id).number}` : "—") },
              { key: "phone", label: "Phone" },
              { key: "lease_end", label: "Lease ends", render: (r) => fmtDate(r.lease_end) },
              { key: "current_rent", label: "Rent", align: "right", render: (r) => fmtMoney(r.current_rent) },
              { key: "subsidy_program", label: "Subsidy", render: (r) => r.subsidy_program || "—" },
              { key: "stabilized", label: "RS", render: (r) => (r.stabilized ? <ToneBadge tone="warn">RS</ToneBadge> : "—") },
            ]}
            rows={tenants}
            onRow={(r) => setViewTenant(r)}
            empty="No tenants yet."
          />
        </Panel>
      )}

      <Modal open={!!unitModal} onClose={() => setUnitModal(null)} title={unitModal?.row ? `Edit unit ${unitModal.row.number}` : "Add unit"} wide>
        {unitModal && (
          <AutoForm
            fields={UNIT_FIELDS(unitOpts)}
            initial={unitModal.row || { status: "vacant" }}
            busy={saveUnit.isPending}
            onSubmit={(v) => saveUnit.mutate({ ...v, id: unitModal.row?.id, building_id: selectedId })}
            onDelete={unitModal.row ? () => removeUnit.mutate(unitModal.row.id) : undefined}
          />
        )}
      </Modal>

      <Modal open={!!tenantModal} onClose={() => setTenantModal(null)} title={tenantModal?.row ? "Edit tenant" : "Add tenant"} wide>
        {tenantModal && (
          <AutoForm
            fields={TENANT_FIELDS(unitOpts)}
            initial={tenantModal.row || {}}
            busy={saveTenant.isPending}
            onSubmit={(v) => saveTenant.mutate({ ...v, id: tenantModal.row?.id, building_id: selectedId })}
            onDelete={tenantModal.row ? () => removeTenant.mutate(tenantModal.row.id) : undefined}
          />
        )}
      </Modal>

      {viewTenant && (
        <TenantDrawer
          tenant={viewTenant}
          units={units}
          revenue={revenue}
          wos={wos}
          onClose={() => setViewTenant(null)}
          onEdit={() => {
            setTenantModal({ row: viewTenant });
            setViewTenant(null);
          }}
        />
      )}
    </div>
  );
};

const TenantsUnitsPage = () => (
  <RequireBuildingSelected pageName="Tenants & Units">
    <TenantsUnitsInner />
  </RequireBuildingSelected>
);

export default TenantsUnitsPage;
