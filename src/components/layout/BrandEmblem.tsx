import { cn } from "@/lib/cn";

interface BrandEmblemProps {
  size?: "sm" | "lg";
  className?: string;
}

export function BrandEmblem({ size = "lg", className }: BrandEmblemProps) {
  if (size === "sm") {
    return (
      <span className={cn("flex h-20 items-center", className)}>
        <img src="/brand/logo-saboriza-transparente.png" alt="Saboriza" className="h-20 w-auto object-contain" />
      </span>
    );
  }

  return (
    <div className={cn("w-full max-w-sm shrink-0 overflow-hidden rounded-[2rem] shadow-2xl", className)}>
      <img src="/brand/logo-saboriza-mascote.jpg" alt="Saboriza" className="h-auto w-full object-contain" />
    </div>
  );
}
