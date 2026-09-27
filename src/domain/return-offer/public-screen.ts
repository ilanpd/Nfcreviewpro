import { computeVoucherWindow } from "./lifecycle";
import { formatDayMonth } from "./time";
import { toPublicVoucherView, type PublicVoucherView, type ReturnTouchView } from "./view";

/**
 * O que a tela do cliente mostra sobre o brinde (ADR-080). Puro: recebe a
 * resposta do servidor e devolve qual tela e quais textos. A tela React só
 * desenha; nenhuma frase mora nela. Assim os estados do plano (J4) ficam
 * testáveis sem navegador e o modo de teste do dono usa exatamente o mesmo
 * caminho da tela real.
 */

export type TouchScreen =
  /** 1: primeiro toque. Brinde novo com o código. */
  | { kind: "VOUCHER_NEW"; voucher: PublicVoucherView }
  /** 2: toque com brinde ainda não liberado. */
  | { kind: "VOUCHER_WAITING"; voucher: PublicVoucherView }
  /** 3: brinde liberado, com o botão de resgatar. */
  | { kind: "VOUCHER_READY"; voucher: PublicVoucherView }
  /** 6: dentro da carência depois de resgatar. */
  | { kind: "USED_NOTICE"; nextEligibleLabel: string }
  /** 5: o brinde anterior venceu e a carência ainda não acabou. */
  | { kind: "EXPIRED_NOTICE"; nextEligibleLabel: string }
  /** 4, 10 e 14: só os botões (dentro da carência sem aviso, teto do dia, erro, Retorno pausado). */
  | { kind: "NO_OFFER" }
  /** 7 e 8: resultado de digitar um código de outro celular. */
  | { kind: "CODE_USED"; voucher: PublicVoucherView }
  | { kind: "CODE_EXPIRED"; voucher: PublicVoucherView }
  | { kind: "CODE_VOIDED"; voucher: PublicVoucherView };

/** A tela do toque a partir da resposta do servidor. `null` = sem brinde ou falha (nunca bloqueia o resto). */
export function screenForTouch(touch: ReturnTouchView | null): TouchScreen {
  if (!touch) return { kind: "NO_OFFER" };
  switch (touch.state) {
    case "ISSUED":
      return { kind: "VOUCHER_NEW", voucher: touch.voucher };
    case "EXISTING":
      return touch.voucher.phase === "AVAILABLE" ? { kind: "VOUCHER_READY", voucher: touch.voucher } : { kind: "VOUCHER_WAITING", voucher: touch.voucher };
    case "COOLDOWN":
      return touch.lastStatus === "REDEEMED"
        ? { kind: "USED_NOTICE", nextEligibleLabel: touch.nextEligibleLabel }
        : { kind: "EXPIRED_NOTICE", nextEligibleLabel: touch.nextEligibleLabel };
    case "CAP_REACHED":
      return { kind: "NO_OFFER" };
  }
}

/** A tela para um código digitado pelo cliente (estado 7). */
export function screenForLookedUpVoucher(voucher: PublicVoucherView): TouchScreen {
  switch (voucher.phase) {
    case "NOT_YET":
      return { kind: "VOUCHER_WAITING", voucher };
    case "AVAILABLE":
      return { kind: "VOUCHER_READY", voucher };
    case "REDEEMED":
      return { kind: "CODE_USED", voucher };
    case "EXPIRED":
      return { kind: "CODE_EXPIRED", voucher };
    case "VOIDED":
      return { kind: "CODE_VOIDED", voucher };
  }
}

export interface ScreenCopy {
  /** Linha pequena acima do texto do brinde. Vazia quando a tela não tem brinde para mostrar. */
  eyebrow: string;
  /** O que o cliente ganhou, ou o aviso principal. */
  title: string;
  /** A validade ou a explicação. */
  detail: string;
}

export function screenCopy(screen: TouchScreen): ScreenCopy | null {
  switch (screen.kind) {
    case "VOUCHER_NEW":
      return {
        eyebrow: "Seu brinde da próxima visita",
        title: screen.voucher.title,
        detail: `Vale de amanhã até ${screen.voucher.lastValidLabel}`,
      };
    case "VOUCHER_WAITING":
      return {
        eyebrow: "Seu brinde da próxima visita",
        title: screen.voucher.title,
        detail: `Libera amanhã, dia ${screen.voucher.availableLabel}. Vale até ${screen.voucher.lastValidLabel}`,
      };
    case "VOUCHER_READY":
      return {
        eyebrow: "Brinde liberado",
        title: screen.voucher.title,
        detail: `Vence em ${screen.voucher.lastValidLabel}`,
      };
    case "USED_NOTICE":
      return { eyebrow: "", title: "Este brinde já foi usado", detail: `O próximo fica disponível a partir de ${screen.nextEligibleLabel}` };
    case "EXPIRED_NOTICE":
      return { eyebrow: "", title: "Seu brinde anterior venceu", detail: `Um novo fica disponível a partir de ${screen.nextEligibleLabel}` };
    case "CODE_USED":
      return { eyebrow: "", title: "Este brinde já foi usado", detail: screen.voucher.title };
    case "CODE_EXPIRED":
      return { eyebrow: "", title: "Este brinde venceu", detail: `Valia até ${screen.voucher.lastValidLabel}` };
    case "CODE_VOIDED":
      return { eyebrow: "", title: "Este brinde foi cancelado", detail: "Fale com o estabelecimento se precisar de ajuda" };
    case "NO_OFFER":
      return null;
  }
}

/** Tem um código para mostrar (e portanto copiar, enviar e, se liberado, resgatar). */
export function screenHasCode(screen: TouchScreen): screen is Extract<TouchScreen, { kind: "VOUCHER_NEW" | "VOUCHER_WAITING" | "VOUCHER_READY" }> {
  return screen.kind === "VOUCHER_NEW" || screen.kind === "VOUCHER_WAITING" || screen.kind === "VOUCHER_READY";
}

/** O convite "Já tem um brinde? Digite o código" aparece quando a tela não mostra um código do próprio aparelho. */
export function showsCodeEntry(screen: TouchScreen): boolean {
  return !screenHasCode(screen);
}

/** O texto que o cliente envia para si (compartilhar do celular). Não cita avaliação em lugar nenhum. */
export function shareMessage(voucher: PublicVoucherView, companyName: string): string {
  return `Meu brinde em ${companyName}: ${voucher.title}. Código ${voucher.code}, vale até ${voucher.lastValidLabel}.`;
}

// --- catálogo dos 16 estados (J4 do plano) e o modo de teste do dono ---------

export type StateHandler = "tela" | "servidor" | "ambiente";

export interface PublicStateEntry {
  n: number;
  id: string;
  label: string;
  /** Onde o estado é tratado, para a auditoria dos 16 não deixar nenhum sem dono. */
  handledBy: StateHandler;
  /** Como é tratado, em uma frase. */
  how: string;
  /** Aparece no modo de teste do dono (uma tela distinta para simular). */
  demo: boolean;
}

export const PUBLIC_STATES: PublicStateEntry[] = [
  { n: 1, id: "FIRST_TOUCH", label: "Primeiro toque", handledBy: "tela", how: "Brinde novo com o código, copiar e enviar", demo: true },
  { n: 2, id: "WAITING", label: "Brinde ainda não liberou", handledBy: "tela", how: "O mesmo brinde e \"libera amanhã\"", demo: true },
  { n: 3, id: "READY", label: "Brinde liberado", handledBy: "tela", how: "Código e o botão Resgatar, que exige o PIN", demo: true },
  { n: 4, id: "COOLDOWN_QUIET", label: "Sem brinde agora (teto do dia ou carência)", handledBy: "tela", how: "Só os botões, sem oferta vazia", demo: true },
  { n: 5, id: "EXPIRED", label: "Brinde venceu", handledBy: "tela", how: "Aviso curto com a data do próximo", demo: true },
  { n: 6, id: "USED", label: "Já resgatado", handledBy: "tela", how: "\"Este brinde já foi usado\" e os botões", demo: true },
  { n: 7, id: "OTHER_DEVICE", label: "Outro celular ou navegador", handledBy: "tela", how: "\"Já tem um brinde? Digite o código\"", demo: true },
  { n: 8, id: "INVALID_CODE", label: "Código inválido, vencido ou usado", handledBy: "tela", how: "Mensagem específica, sem dados de outro negócio", demo: true },
  { n: 9, id: "WRONG_PIN", label: "PIN errado", handledBy: "tela", how: "\"PIN incorreto\" com as tentativas restantes", demo: true },
  { n: 10, id: "OFFLINE", label: "Sem internet ou erro do Retorno", handledBy: "tela", how: "Os botões normais aparecem sempre", demo: true },
  { n: 11, id: "NO_COOKIES", label: "Cookies bloqueados ou aba privada", handledBy: "tela", how: "O código é a identidade; o aviso para salvá-lo está sempre na tela", demo: false },
  { n: 12, id: "NO_NFC", label: "Celular sem NFC", handledBy: "ambiente", how: "O QR do cartão abre a mesma URL", demo: false },
  { n: 13, id: "IN_APP_BROWSER", label: "Navegador do Instagram ou do WhatsApp", handledBy: "tela", how: "Copiar com alternativa manual; compartilhar pelo WhatsApp se não houver menu nativo", demo: false },
  { n: 14, id: "PAUSED", label: "Retorno pausado pelo dono", handledBy: "servidor", how: "Só os botões; brindes já emitidos continuam válidos", demo: true },
  { n: 15, id: "CANCELED", label: "Plano cancelado", handledBy: "servidor", how: "Redireciona direto ao destino, sem brinde novo", demo: false },
  { n: 16, id: "UNAVAILABLE", label: "Cartão desativado ou inexistente", handledBy: "servidor", how: "\"Cartão indisponível\" com o contato do negócio", demo: false },
];

export interface DemoInput {
  title: string;
  timeZone: string;
  windowDays: number;
  now: Date;
}

/**
 * A resposta de servidor que cada estado simulável produziria, montada com as
 * regras reais (mesma janela, mesmos rótulos). O modo de teste do dono usa isto
 * e a MESMA tela do cliente: nada aqui grava brinde nem toca no banco.
 */
export function demoTouch(id: string, input: DemoInput): { touch: ReturnTouchView | null; forceOffline?: boolean } {
  const { availableAt, expiresAt } = computeVoucherWindow(input.now, input.timeZone, input.windowDays);
  const base = { code: "K7X4QM", title: input.title, availableAt, expiresAt };
  const view = (status: "ISSUED" | "REDEEMED", availableOffsetMs = 0) =>
    toPublicVoucherView({ ...base, status, availableAt: new Date(availableAt.getTime() + availableOffsetMs) }, input.timeZone, input.now);
  // Exemplo de carência: o próximo brinde daqui a 20 dias.
  const nextLabel = formatDayMonth(new Date(input.now.getTime() + 20 * 24 * 60 * 60 * 1000), input.timeZone);

  switch (id) {
    case "FIRST_TOUCH":
      return { touch: { state: "ISSUED", voucher: view("ISSUED") } };
    case "WAITING":
      return { touch: { state: "EXISTING", voucher: view("ISSUED") } };
    case "READY":
      // Liberado: a janela começa no passado, sem alterar as datas mostradas.
      return {
        touch: {
          state: "EXISTING",
          voucher: toPublicVoucherView({ ...base, status: "ISSUED", availableAt: new Date(input.now.getTime() - 60 * 60 * 1000) }, input.timeZone, input.now),
        },
      };
    case "COOLDOWN_QUIET":
    case "PAUSED":
      return { touch: null };
    case "EXPIRED":
      return { touch: { state: "COOLDOWN", nextEligibleLabel: nextLabel, lastStatus: "EXPIRED" } };
    case "USED":
      return { touch: { state: "COOLDOWN", nextEligibleLabel: nextLabel, lastStatus: "REDEEMED" } };
    case "OFFLINE":
      return { touch: null, forceOffline: true };
    default:
      return { touch: null };
  }
}
