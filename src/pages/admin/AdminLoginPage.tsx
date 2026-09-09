import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export function AdminLoginPage() {
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const login = useAdminAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const success = login(email, password);
    if (success) {
      navigate("/admin");
    } else {
      setError("E-mail ou senha inválidos");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-forest-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-3xl bg-cream-50 p-8 shadow-xl">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-700">Painel administrativo</span>
        <h1 className="mb-6 text-2xl font-extrabold text-forest-950">Saboriza</h1>
        <div className="flex flex-col gap-4">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@saboriza.com.br"
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" size="lg">
            Entrar
          </Button>
          <p className="text-center text-[11px] text-ink-700/50">Demonstração: admin@saboriza.com.br / saboriza123</p>
        </div>
      </form>
    </div>
  );
}
