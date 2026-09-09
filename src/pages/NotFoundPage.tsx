import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-50 px-4 text-center">
      <span className="font-mono text-sm text-ink-700/50">404</span>
      <h1 className="text-2xl font-extrabold text-forest-950">Página não encontrada</h1>
      <Link to="/">
        <Button>Voltar ao catálogo</Button>
      </Link>
    </div>
  );
}
