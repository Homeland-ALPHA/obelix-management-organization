import { PageHeader } from "@/components/landing/PageHeader";
import { Security } from "@/components/landing/Security";
import { ModuleIndex } from "@/components/landing/ModuleIndex";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function SecurityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Controlled access. Complete history."
        lede="Portfolio data is scoped by role and by building, every action is attributed and time-stamped, and your records export on request."
        meta={[
          ["Roles", "5"],
          ["Permission scope", "Per building"],
          ["Activity log", "Full history"],
          ["Exports", "CSV / PDF"],
        ]}
      />
      <Security />
      <ModuleIndex exclude="/security" />
      <FinalCTA />
    </>
  );
}
