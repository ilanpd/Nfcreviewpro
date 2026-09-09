import {
  Nfc,
  Radar,
  Megaphone,
  MapPinned,
  Building2,
  Store,
  LayoutGrid,
  Users,
  ShieldCheck,
  History,
  SlidersHorizontal,
  FlaskConical,
  Ghost,
  BarChart3,
  Flame,
  Settings2,
  Wifi,
  WifiOff,
  Rewind,
  Play,
  Lightbulb,
  Trophy,
  TrendingUp,
  Wallet,
  Filter,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * NFC OS Design Language — camada de ícones.
 *
 * "Quando usar bibliotecas externas, encapsular": todo ícone que representa
 * um CONCEITO DE DOMÍNIO do produto (uma campanha, uma zona, o próprio
 * conceito de NFC, o Ghost Mode) é reexportado aqui sob um nome semântico
 * do NFC OS, nunca importado direto de `lucide-react` no ponto de uso —
 * assim, se um dia o NFC OS ganhar um conjunto de ícones próprio (SVG
 * autoral, não uma biblioteca de terceiros), só este arquivo muda, nenhum
 * componente que os usa precisa saber a diferença. Ícones puramente
 * genéricos de UI (fechar, voltar, mais) continuam vindo direto de
 * `lucide-react` nos componentes — encapsular esses não agregaria nada.
 */
export const NfcOsIcon = {
  /** O próprio conceito de ativo NFC/QR. */
  Nfc,
  /** O Campaign Resolution Engine / resolução em geral. */
  ResolutionEngine: Radar,
  Campaign: Megaphone,
  Zone: MapPinned,
  Branch: Building2,
  Organization: Store,
  TableMap: LayoutGrid,
  Team: Users,
  Permission: ShieldCheck,
  Audit: History,
  Rule: SlidersHorizontal,
  Variant: FlaskConical,
  GhostMode: Ghost,
  Analytics: BarChart3,
  Heatmap: Flame,
  Settings: Settings2,
  /** Live Mode conectado (Fase 6). */
  LiveConnected: Wifi,
  /** Live Mode reconectando ou offline (Fase 6). */
  LiveDisconnected: WifiOff,
  /** Time Machine — voltar no tempo. */
  TimeMachine: Rewind,
  /** Playback Mode — reproduzir a linha do tempo. */
  Playback: Play,
  /** Insights Automáticos (Fase 7). */
  Insight: Lightbulb,
  /** Ranking Engine — líder de uma categoria. */
  Ranking: Trophy,
  /** Forecast Engine — projeção. */
  Forecast: TrendingUp,
  /** ROI Mode — receita estimada. */
  Roi: Wallet,
  /** Funil Inteligente. */
  Funnel: Filter,
} as const satisfies Record<string, LucideIcon>;

export type NfcOsIconName = keyof typeof NfcOsIcon;
export type { LucideIcon, LucideProps };
