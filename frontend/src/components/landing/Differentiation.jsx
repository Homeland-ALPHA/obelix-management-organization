import { Check, Minus } from "lucide-react";
import { COMPARISON } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal } from "./primitives";

export const Differentiation = () => (
  <Section id="differentiation" label="Differentiation" className="border-t border-line">
    <Reveal>
      <Eyebrow>Why Obelix</Eyebrow>
      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <H2 className="max-w-2xl">Built around New York—not adapted to it.</H2>
        <Lede className="max-w-md">
          National platforms treat NYC as an edge case. Obelix treats HPD classes, DHCR registration
          and rent regulation as the core data model.
        </Lede>
      </div>
    </Reveal>

    <Reveal delay={0.08}>
      <div className="mt-10 overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <caption className="sr-only">
            Comparison of generic property software capabilities against Obelix
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="w-1/2 px-5 py-3.5 label-xs font-normal">
                Generic property software
              </th>
              <th scope="col" className="w-1/2 border-l border-line px-5 py-3.5 label-xs font-normal text-gold/90">
                Obelix
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map(([generic, obelix]) => (
              <tr key={obelix} className="border-b border-line/60 last:border-b-0 group">
                <td className="px-5 py-4">
                  <span className="flex items-start gap-2.5 text-[13px] text-neutral-500">
                    <Minus size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-neutral-700" />
                    {generic}
                  </span>
                </td>
                <td className="border-l border-line px-5 py-4 transition-colors group-hover:bg-gold/[0.04]">
                  <span className="flex items-start gap-2.5 text-[13px] text-neutral-100">
                    <Check size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-gold" />
                    {obelix}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  </Section>
);
