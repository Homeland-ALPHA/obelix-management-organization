import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Section, Eyebrow, Reveal } from "./primitives";
import { cn } from "@/lib/utils";

const FIELDS = [
  { id: "fullName", label: "Full name", type: "text", placeholder: "Daniel Restrepo", autoComplete: "name" },
  { id: "email", label: "Work email", type: "email", placeholder: "daniel@obelixmgmt.com", autoComplete: "email" },
  { id: "company", label: "Company", type: "text", placeholder: "Colonial Holdings LLC", autoComplete: "organization" },
  { id: "units", label: "Number of units managed", type: "number", placeholder: "192", autoComplete: "off" },
];

export const FinalCTA = () => {
  const [values, setValues] = useState({ fullName: "", email: "", company: "", units: "" });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const onChange = (id) => (e) => {
    setValues((v) => ({ ...v, [id]: e.target.value }));
    setErrors((p) => ({ ...p, [id]: undefined }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!values.fullName.trim()) next.fullName = "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Enter a valid work email.";
    if (!values.company.trim()) next.company = "Please enter your company.";
    if (!values.units || Number(values.units) < 1) next.units = "Enter the number of units managed.";
    setErrors(next);
    if (Object.keys(next).length === 0) setSubmitted(true);
  };

  return (
    <Section id="cta" label="Get started" className="border-t border-line">
      <div className="relative overflow-hidden border border-line bg-surface grain">
        <div
          className="pointer-events-none absolute -top-32 left-1/3 h-[380px] w-[620px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(199,163,107,0.12),transparent_65%)]"
          aria-hidden="true"
        />
        <div className="relative grid grid-cols-1 gap-12 p-6 sm:p-10 lg:grid-cols-[1fr_0.9fr] lg:gap-16 lg:p-14">
          <Reveal>
            <Eyebrow>Get started</Eyebrow>
            <h2 className="mt-5 font-serif text-3xl sm:text-4xl lg:text-[2.9rem] font-light leading-[1.06] tracking-tight text-white">
              Replace property-management chaos with operational control.
            </h2>
            <p className="mt-5 max-w-lg text-sm sm:text-base leading-relaxed text-neutral-400">
              See every building, deadline, repair, lease, vendor, and approval in one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#cta-form"
                data-testid="cta-book-demo"
                className="group inline-flex items-center justify-center gap-2 bg-gold px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-gold-hover"
              >
                Book a Demo
                <ArrowRight size={15} strokeWidth={1.75} className="transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="#cta-form"
                data-testid="cta-early-access"
                className="inline-flex items-center justify-center border border-line px-6 py-3 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-white/[0.03] hover:text-white"
              >
                Join the Early Access List
              </a>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-px border border-line bg-line">
              {[
                ["Buildings onboarded", "48"],
                ["Violations cleared", "610"],
                ["Avg. clearance", "11 days"],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface px-3 py-3.5">
                  <dd className="tnum text-base font-semibold text-white">{v}</dd>
                  <dt className="mt-1 text-[10px] uppercase tracking-[0.14em] text-neutral-500">{k}</dt>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={0.08}>
            <div id="cta-form" className="scroll-mt-24 border border-line bg-[#101010] p-6 sm:p-7">
              {submitted ? (
                <div data-testid="cta-confirmation" role="status" className="py-6 text-center">
                  <CheckCircle2 size={26} strokeWidth={1.25} className="mx-auto text-emerald-400" />
                  <h3 className="mt-4 font-serif text-2xl text-white">You’re on the list.</h3>
                  <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-neutral-400">
                    Thank you, {values.fullName.split(" ")[0]}. A member of our team will reach out to{" "}
                    <span className="text-neutral-200">{values.email}</span> within one business day to
                    schedule a walkthrough for {values.company}.
                  </p>
                  <button
                    type="button"
                    data-testid="cta-reset"
                    onClick={() => {
                      setSubmitted(false);
                      setValues({ fullName: "", email: "", company: "", units: "" });
                    }}
                    className="mt-6 text-[12px] font-medium text-gold transition-colors hover:text-gold-hover"
                  >
                    Submit another request
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit} noValidate data-testid="cta-form">
                  <h3 className="text-sm font-medium text-white">Request early access</h3>
                  <p className="mt-1.5 text-[12px] text-neutral-500">
                    Four fields. No credit card, no commitment.
                  </p>

                  <div className="mt-6 space-y-4">
                    {FIELDS.map((f) => (
                      <div key={f.id}>
                        <label
                          htmlFor={f.id}
                          className="block text-[11px] uppercase tracking-[0.16em] text-neutral-500"
                        >
                          {f.label}
                        </label>
                        <input
                          id={f.id}
                          name={f.id}
                          type={f.type}
                          min={f.type === "number" ? 1 : undefined}
                          autoComplete={f.autoComplete}
                          placeholder={f.placeholder}
                          value={values[f.id]}
                          onChange={onChange(f.id)}
                          data-testid={`input-${f.id}`}
                          aria-invalid={!!errors[f.id]}
                          aria-describedby={errors[f.id] ? `${f.id}-error` : undefined}
                          className={cn(
                            "mt-2 w-full border bg-surface px-3 py-2.5 text-[13px] text-white placeholder:text-neutral-600 transition-colors focus:outline-none focus:border-gold",
                            errors[f.id] ? "border-red-500/60" : "border-line",
                          )}
                        />
                        {errors[f.id] && (
                          <p
                            id={`${f.id}-error`}
                            data-testid={`error-${f.id}`}
                            className="mt-1.5 text-[11px] text-red-400"
                          >
                            {errors[f.id]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    data-testid="cta-submit"
                    className="mt-7 w-full bg-gold py-3 text-sm font-medium text-ink transition-colors hover:bg-gold-hover"
                  >
                    Request Early Access
                  </button>
                  <p className="mt-3 text-center text-[10px] text-neutral-600">
                    We use your details only to contact you about Obelix.
                  </p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
};
