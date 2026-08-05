import { PageHeader } from "@/components/landing/PageHeader";
import { Priorities } from "@/components/landing/Priorities";
import { MobileField } from "@/components/landing/MobileField";
import { ModuleIndex } from "@/components/landing/ModuleIndex";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function MaintenancePage() {
  return (
    <>
      <PageHeader
        eyebrow="Maintenance"
        title="Requests in. Verified repairs out."
        lede="Tenant requests, emergencies and inspection findings enter one queue, get an owner and an access window, and close only when proof of completion has been captured."
        meta={[
          ["Open work orders", "38"],
          ["Due this week", "11"],
          ["Emergencies open", "2"],
          ["Avg. first visit", "1.4 days"],
        ]}
      />
      <Priorities />
      <MobileField />
      <ModuleIndex exclude="/maintenance" />
      <FinalCTA />
    </>
  );
}
