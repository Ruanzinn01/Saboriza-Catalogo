import { cn } from "@/lib/cn";

interface BrandEmblemProps {
  size?: "sm" | "lg";
  className?: string;
  logoUrl?: string | null;
  displayName?: string;
}

function Monogram({ displayName, size }: { displayName: string; size: "sm" | "lg" }) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-linear-to-br from-forest-700 to-forest-950 font-extrabold text-cream-50",
        size === "sm" ? "h-14 w-14 rounded-full text-xl" : "aspect-square w-full max-w-sm rounded-[2rem] text-7xl shadow-2xl"
      )}
    >
      {initial}
    </div>
  );
}

export function BrandEmblem({ size = "lg", className, logoUrl, displayName = "" }: BrandEmblemProps) {
  if (size === "sm") {
    return (
      <span className={cn("flex h-14 items-center", className)}>
        {logoUrl ? (
          <img src={logoUrl} alt={displayName} className="h-14 w-auto object-contain" />
        ) : (
          <Monogram displayName={displayName} size="sm" />
        )}
      </span>
    );
  }

  if (!logoUrl) {
    return (
      <div className={className}>
        <Monogram displayName={displayName} size="lg" />
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-sm shrink-0 overflow-hidden rounded-[2rem] shadow-2xl", className)}>
      <img src={logoUrl} alt={displayName} className="h-auto w-full object-contain" />
    </div>
  );
}
