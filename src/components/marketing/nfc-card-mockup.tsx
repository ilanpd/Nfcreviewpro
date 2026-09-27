import { BRAND } from "@/lib/brand";
/**
 * Loja (Fase 15) — mockup ilustrativo do produto físico, desenhado em SVG em
 * vez de uma foto real: o Painel Admin (Fase 16) é onde o dono da marca
 * troca isto por fotos de verdade dos cartões físicos assim que existirem.
 * Até lá, uma ilustração consistente e premium vale mais que nenhuma imagem
 * — o pedido explícito era "parecer catálogo, não esboço".
 */
export function NfcCardMockup({ accent = "var(--brand)", className }: { accent?: string; className?: string }) {
  return (
    <svg viewBox="0 0 320 200" className={className} role="img" aria-label="Ilustração de um cartão NFC premium">
      <defs>
        <linearGradient id="card-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16191C" />
          <stop offset="100%" stopColor="#23272B" />
        </linearGradient>
        <radialGradient id="card-glow" cx="85%" cy="15%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="4" y="4" width="312" height="192" rx="20" fill="url(#card-gradient)" />
      <rect x="4" y="4" width="312" height="192" rx="20" fill="url(#card-glow)" />
      <rect x="4" y="4" width="312" height="192" rx="20" fill="none" stroke="rgba(255,255,255,0.08)" />

      {/* Ondas NFC */}
      <g stroke={accent} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M248 60 a14 14 0 0 1 0 20" />
        <path d="M258 52 a26 26 0 0 1 0 36" opacity="0.6" />
        <path d="M268 44 a38 38 0 0 1 0 52" opacity="0.35" />
      </g>
      <circle cx="238" cy="70" r="5" fill={accent} />

      {/* QR decorativo */}
      <g fill="white" opacity="0.9">
        {[0, 8, 16].map((dx) =>
          [0, 8, 16].map((dy) => (dx === 8 && dy === 8 ? null : <rect key={`${dx}-${dy}`} x={28 + dx} y={130 + dy} width="6" height="6" rx="1" />))
        )}
      </g>

      <text x="28" y="40" fill="white" fontSize="16" fontWeight="700" fontFamily="var(--font-serif, serif)">
        {BRAND.name}
      </text>
      <text x="28" y="176" fill="rgba(255,255,255,0.55)" fontSize="9" letterSpacing="1.5" fontFamily="ui-monospace, monospace">
        TAP · SCAN · REDIRECT
      </text>
    </svg>
  );
}
