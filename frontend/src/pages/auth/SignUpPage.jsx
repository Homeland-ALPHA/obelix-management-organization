import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Field, GoldButton, Spinner, inputCls } from "@/components/app/ui";
import { AuthShell } from "./AuthShell";

const SignUpPage = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", company: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signUp({ ...form, email: form.email.trim() });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(apiError(err, "Unable to create the account"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="New portfolio"
      title="Create your account."
      sub="Add your buildings and Obelix pulls their live violation, complaint, inspection and valuation records from the city."
      footer={
        <>
          Already an operator?{" "}
          <Link to="/signin" className="text-gold transition-colors hover:text-gold-hover">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input required value={form.name} onChange={set("name")} placeholder="Jane Doe" className={inputCls} data-testid="signup-name" />
          </Field>
          <Field label="Company">
            <input value={form.company} onChange={set("company")} placeholder="Optional" className={inputCls} data-testid="signup-company" />
          </Field>
        </div>
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            placeholder="you@company.com"
            className={inputCls}
            data-testid="signup-email"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            placeholder="At least 8 characters"
            className={inputCls}
            data-testid="signup-password"
          />
        </Field>
        {error ? <p className="text-[12px] text-alert">{error}</p> : null}
        <GoldButton type="submit" disabled={busy} className="w-full py-2.5" data-testid="signup-submit">
          {busy ? <Spinner className="border-ink/40 border-t-ink" /> : <>Create account <ArrowRight size={14} strokeWidth={1.75} /></>}
        </GoldButton>
      </form>
    </AuthShell>
  );
};

export default SignUpPage;
