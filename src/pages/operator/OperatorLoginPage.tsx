import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { OPERATOR_APPS, OPERATOR_HUB, type OperatorAppId } from "@/lib/operator-apps";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export function OperatorLoginPage({ appId = "separa_confere" }: { appId?: OperatorAppId | "hub" }) {
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const login = useAdminAuthStore((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const app = appId === "hub" ? null : OPERATOR_APPS[appId];

  if (isAuthenticated) return <Navigate to={app?.base ?? OPERATOR_HUB} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.success) setError(result.error ?? "E-mail ou senha inválidos");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-forest-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-3xl bg-cream-50 p-8 shadow-xl">
        {app && <img src={app.icon} alt="" className="mb-4 h-16 w-16 rounded-2xl" />}
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-700">Acesso operacional</span>
        <h1 className="mb-6 text-2xl font-extrabold text-forest-950">{app?.name ?? "Óris 360"}</h1>
        <div className="flex flex-col gap-4">
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
