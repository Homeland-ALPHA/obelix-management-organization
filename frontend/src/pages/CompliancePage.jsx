import { PageHeader } from "@/components/landing/PageHeader";
import { Workflow } from "@/components/landing/Workflow";
import { ComplianceCalendar } from "@/components/landing/ComplianceCalendar";
import { ModuleIndex } from "@/components/landing/ModuleIndex";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function CompliancePage() {
  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="NYC compliance, from issuance to cleared."
        lede="HPD violations, DOB activity, registrations, filings and required inspections tracked per building—with the next required action assigned to a named person or vendor."
        meta={[
          ["Open violations", "8"],
          ["Cleared in July", "14"],
          ["Deadlines in August", "9"],
          ["Certification steps", "7"],
        ]}
      />
      <Workflow />
      <ComplianceCalendar />
      <ModuleIndex exclude="/compliance" />
      <FinalCTA />
    </>
  );
}
