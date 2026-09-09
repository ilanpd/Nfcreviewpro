interface BrandHeaderProps {
  name: string;
  logoUrl?: string | null;
}

// Plain <img>, not next/image: company logos come from arbitrary,
// company-supplied URLs, so there's no fixed set of domains to allowlist
// in next.config for the optimizer.
export function BrandHeader({ name, logoUrl }: BrandHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={name}
          className="size-16 rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
        />
      ) : (
        <div className="flex size-16 items-center justify-center rounded-2xl bg-foreground/5 text-xl font-semibold ring-1 ring-black/5">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <h1 className="text-lg font-semibold tracking-tight text-center">{name}</h1>
    </div>
  );
}
