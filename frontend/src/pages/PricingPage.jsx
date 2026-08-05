import { PageHeader } from "@/components/landing/PageHeader";
import { Pricing } from "@/components/landing/Pricing";
import { Differentiation } from "@/components/landing/Differentiation";
import { FinalCTA } from "@/components/landing/FinalCTA";

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Pay for the portfolio, not the headcount."
        lede="Three unit bands, unlimited roles and a scoping call before any number is quoted. Implementation and data migration are included in every agreement."
        meta={[
          ["Unit bands", "3"],
          ["Seat charges", "None"],
          ["Contract term", "Annual"],
          ["Implementation", "Included"],
        ]}
      />
      <Pricing />
      <Differentiation />
      <FinalCTA />
    </>
  );
}
