import { PageHeader } from "@/components/landing/PageHeader";
import { Financials } from "@/components/landing/OwnerReporting";
import { ModuleIndex } from "@/components/landing/ModuleIndex";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function FinancialsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Financials"
        title="Building-level performance, not portfolio averages."
        lede="Rent collection, arrears aging, vendor spend, budget variance and NOI computed from the same records your team works in every day."
        meta={[
          ["Collections", "$284,600"],
          ["Arrears", "$18,420"],
          ["Monthly NOI", "$126,300"],
          ["Collection rate", "96.4%"],
        ]}
      />
      <Financials />
      <ModuleIndex exclude="/financials" />
      <FinalCTA />
    </>
  );
}
