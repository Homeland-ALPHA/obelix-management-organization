import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/* Shared frame for sign in / sign up — same visual language as the landing hero. */
export const AuthShell = ({ eyebrow, title, sub, children, footer }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) navigate(location.state?.from || "/app", { replace: true });
  }, [user, loading, navigate, location.state]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-70" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(199,163,107,0.13),transparent_65%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-2.5" aria-label="Obelix Property Management — home">
            <span className="flex items-center gap-2">
              <span className="h-4 w-[3px] bg-gold" aria-hidden="true" />
              <span className="font-serif text-[22px] leading-none tracking-[0.02em] text-strong">Obelix</span>
            </span>
            <span className="hidden sm:block label-xs text-dim">Property Management</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-[12px] text-mid transition-colors hover:text-strong"
          >
            <ArrowLeft size={12} strokeWidth={1.5} /> Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[420px]">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
              <span className="label-xs text-gold/90">{eyebrow}</span>
            </div>
            <h1 className="mt-4 font-serif text-4xl font-light leading-[1.05] tracking-tight text-strong">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-mid">{sub}</p>
            <div className="mt-8 border border-line bg-panel p-6 shadow-modal">
              {children}
            </div>
            <div className="mt-5 text-center text-[13px] text-dim">{footer}</div>
          </div>
        </div>

        <p className="text-center label-xs text-faint">
          Live HPD · DOB · OATH · 311 · DOF data — NYC Open Data
        </p>
      </div>
    </div>
  );
};
