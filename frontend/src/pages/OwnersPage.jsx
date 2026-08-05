import { PageHeader } from "@/components/landing/PageHeader";
import { OwnerReporting } from "@/components/landing/OwnerReporting";
import { ModuleIndex } from "@/components/landing/ModuleIndex";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function OwnersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Owners"
        title="Owners get answers. Managers keep control."
        lede="A single monthly view per building with occupancy, collections, arrears and NOI—plus the capital and repair decisions that are waiting on an owner."
        meta={[
          ["Occupancy", "97.8%"],
          ["Approvals waiting", "3"],
          ["Violations cleared", "14"],
          ["Reporting cadence", "Monthly"],
        ]}
      />
      <OwnerReporting />
      <ModuleIndex exclude="/owners" />
      <FinalCTA />
    </>
  );
}
