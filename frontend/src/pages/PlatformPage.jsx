import { PageHeader } from "@/components/landing/PageHeader";
import { Platform } from "@/components/landing/Platform";
import { ModuleIndex } from "@/components/landing/ModuleIndex";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function PlatformPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="One operating system for the whole building."
        lede="Compliance, maintenance, leasing, inspections, financials and vendors are six views of the same record—so a violation, a work order, an invoice and an owner approval never drift apart."
        meta={[
          ["Modules", "6"],
          ["Buildings onboarded", "48"],
          ["Roles supported", "5"],
          ["Avg. clearance", "11 days"],
        ]}
      />
      <Platform />
      <ModuleIndex exclude="/platform" />
      <FinalCTA />
    </>
  );
}
