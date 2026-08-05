import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Field, GoldButton, Spinner, inputCls } from "@/components/app/ui";
import { AuthShell } from "./AuthShell";

const SignInPage = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(location.state?.from || "/app", { replace: true });
    } catch (err) {
      setError(apiError(err, "Unable to sign in"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Operator access"
      title="Sign in to Obelix."
      sub="Your portfolio, synced against the live NYC databases — HPD, DOB, OATH, 311 and DOF."
      footer={
        <>
          New to Obelix?{" "}
          <Link to="/signup" className="text-gold transition-colors hover:text-gold-hover">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" data-testid="signin-form">
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={inputCls}
            data-testid="signin-email"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputCls}
            data-testid="signin-password"
          />
        </Field>
        {error ? <p className="text-[12px] text-alert">{error}</p> : null}
        <GoldButton type="submit" disabled={busy} className="w-full py-2.5" data-testid="signin-submit">
          {busy ? <Spinner className="border-ink/40 border-t-ink" /> : <>Sign in <ArrowRight size={14} strokeWidth={1.75} /></>}
        </GoldButton>
      </form>
    </AuthShell>
  );
};

export default SignInPage;
