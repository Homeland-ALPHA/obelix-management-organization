import { PageHeader } from "@/components/landing/PageHeader";
import { Section, Reveal } from "@/components/landing/primitives";
import { FinalCTA } from "@/components/landing/FinalCTA";

const CONTENT = {
  privacy: {
    eyebrow: "Privacy",
    title: "How Obelix handles your data.",
    lede: "A plain summary of what we collect on this site and how portfolio data is treated inside the product.",
    blocks: [
      ["What this site collects", "The early-access form on this site collects your name, work email, company and number of units managed. We use those details only to contact you about Obelix."],
      ["Portfolio data in the product", "Building, unit, lease, tenant, vendor and financial records belong to the customer. Obelix processes them to operate the service and does not sell them."],
      ["Access inside Obelix", "Access is scoped by role and by building. Every view, upload, assignment and approval is recorded in an attributable activity log."],
      ["Retention and export", "Customers can export their violation, financial and inspection history on request. Records are retained for the term of the agreement and a defined wind-down period after it ends."],
      ["Contact", "Questions about data handling can be raised through the request form on this site and will be routed to our team."],
    ],
  },
  terms: {
    eyebrow: "Terms",
    title: "Terms of use, in summary.",
    lede: "This page summarises the terms that apply to this marketing site. Commercial terms are set out in each customer agreement.",
    blocks: [
      ["Marketing site only", "This site describes the Obelix Property Management product. Access to the product itself is governed by a separate written agreement."],
      ["Illustrative data", "Addresses, violation numbers, financial figures and vendor names shown in product previews on this site are illustrative examples, not real customer records."],
      ["No professional advice", "Obelix provides operational software. It does not provide legal, accounting, engineering or regulatory advice, and users remain responsible for verifying their own regulatory obligations."],
      ["No commercial offer", "Pricing information on this site is indicative. A binding quote is issued only after a scoping call and in writing."],
      ["Changes", "Content on this site may be updated at any time as the product evolves."],
    ],
  },
};

export default function LegalPage({ kind }) {
  const c = CONTENT[kind];
  return (
    <>
      <PageHeader eyebrow={c.eyebrow} title={c.title} lede={c.lede} />
      <Section id="legal" label={c.eyebrow} className="border-t border-line">
        <div className="max-w-3xl">
          {c.blocks.map(([heading, body], i) => (
            <Reveal key={heading} delay={i * 0.04}>
              <article className="border-b border-line py-7 first:pt-0">
                <h2 className="text-base font-medium text-white">{heading}</h2>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-neutral-400">{body}</p>
              </article>
            </Reveal>
          ))}
          <p className="mt-8 text-[11px] text-neutral-500">
            Last updated August 2025. This summary is provided for clarity and does not replace the
            executed agreement between Obelix and its customers.
          </p>
        </div>
      </Section>
      <FinalCTA />
    </>
  );
}
