import { ImageOff } from "lucide-react";

export function ProductImage({ imageUrl, name }: { imageUrl: string; name: string }) {
  if (!imageUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-forest-950/5 text-forest-950/30">
        <ImageOff size={28} strokeWidth={1.5} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">Foto em breve</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      loading="lazy"
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}
