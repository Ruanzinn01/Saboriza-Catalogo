import { useEffect, useState } from "react";
import { supabaseUntyped } from "@/lib/supabase-untyped";
import { AdminState } from "@/components/admin/AdminState";

interface ClientError {
  id: string;
  message: string;
  stack: string | null;
  url: string | null;
  severity: string;
  created_at: string;
}

export function ErrosSistemaPage() {
  const [errors, setErrors] = useState<ClientError[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    supabaseUntyped
      .rpc("get_client_errors", { p_limit: 100 })
      .then(({ data, error }: { data: ClientError[] | null; error: { message: string } | null }) => {
        if (error) {
          setErrorMsg(error.message);
          return;
        }
        setErrors(data ?? []);
      });
  }, []);

  if (errorMsg) return <AdminState variant="error" message={`Sem acesso: ${errorMsg}`} />;
  if (errors === null) return <AdminState variant="loading" message="Carregando erros..." />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Erros do Sistema</h1>
        <p className="text-sm text-ink-muted">Capturados automaticamente no navegador dos usuários — últimos 100.</p>
      </div>

      {errors.length === 0 ? (
        <div className="rounded-2xl border border-forest-950/10 bg-white p-5 text-sm text-ink-muted">Nenhum erro registrado. Bom sinal.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {errors.map((e) => (
            <div key={e.id} className="rounded-2xl border border-forest-950/10 bg-white p-4">
              <button type="button" onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="flex w-full items-center justify-between text-left">
                <div>
                  <p className="font-semibold text-forest-950">{e.message}</p>
                  <p className="text-xs text-ink-muted">
                    {new Date(e.created_at).toLocaleString("pt-BR")} · {e.url}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${e.severity === "ERROR" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {e.severity}
                </span>
              </button>
              {expanded === e.id && e.stack && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-forest-950/5 p-3 text-xs text-ink-muted">{e.stack}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
