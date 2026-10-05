import { describe, expect, it } from "vitest";
import { detectWhitePanel, fitQrIntoPanel, type PixelImage } from "./panel-detect";

// Estoque de placas (ADR-092) — o botão "Encaixar no painel branco" do editor.
// Estes testes usam imagens sintéticas pequenas: o que importa é a regra (o que
// conta como painel) e a conta de pixels para milímetros.

function canvas(width: number, height: number, background: [number, number, number] = [30, 33, 38]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...background, 255], i * 4);
  const paint = (x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data.set([...rgb, 255], (y * width + x) * 4);
  };
  const image = (): PixelImage => ({ data, width, height });
  return { paint, image };
}
const WHITE: [number, number, number] = [255, 255, 255];

describe("detectWhitePanel", () => {
  it("acha o painel branco preenchido e devolve a caixa exata", () => {
    const c = canvas(200, 200);
    c.paint(120, 100, 169, 149, WHITE);
    expect(detectWhitePanel(c.image())).toEqual({ x0: 120, y0: 100, x1: 169, y1: 149 });
  });

  it("escolhe o MAIOR painel quando há mais de um bloco branco (letras e pontos não vencem)", () => {
    const c = canvas(200, 200);
    c.paint(10, 10, 14, 20, WHITE); // "letra"
    c.paint(60, 20, 64, 30, WHITE);
    c.paint(110, 90, 169, 149, WHITE); // painel
    expect(detectWhitePanel(c.image())).toEqual({ x0: 110, y0: 90, x1: 169, y1: 149 });
  });

  it("ignora uma moldura branca (um anel não é um painel), mas acha o painel dentro dela", () => {
    const c = canvas(200, 200);
    c.paint(100, 80, 179, 159, WHITE); // moldura externa
    c.paint(104, 84, 175, 155, [30, 33, 38]); // miolo escuro: vira um anel
    c.paint(110, 90, 169, 149, WHITE); // painel branco dentro, separado da moldura
    expect(detectWhitePanel(c.image())).toEqual({ x0: 110, y0: 90, x1: 169, y1: 149 });
  });

  it("branco que encosta na borda da imagem é fundo da arte, não painel", () => {
    const c = canvas(100, 100, [255, 255, 255]);
    expect(detectWhitePanel(c.image())).toBeNull();
    c.paint(40, 40, 59, 59, [10, 10, 10]);
    expect(detectWhitePanel(c.image())).toBeNull();
  });

  it("um painel que ainda tem um QR de exemplo dentro continua sendo achado (o branco em volta liga tudo)", () => {
    const c = canvas(200, 200);
    c.paint(100, 100, 159, 159, WHITE);
    // "módulos" pretos espalhados, com a margem branca (zona de silêncio) em volta
    for (const [x, y] of [[112, 112], [130, 112], [148, 112], [112, 130], [130, 130], [148, 130], [112, 148], [140, 148]]) c.paint(x, y, x + 6, y + 6, [0, 0, 0]);
    expect(detectWhitePanel(c.image())).toEqual({ x0: 100, y0: 100, x1: 159, y1: 159 });
  });

  it("um painel todo picotado de preto (quase sem branco ligado) não é aceito", () => {
    const c = canvas(200, 200);
    c.paint(100, 100, 159, 159, WHITE);
    for (let y = 100; y <= 159; y += 3) c.paint(100, y, 159, y + 1, [0, 0, 0]); // listras pretas grossas
    expect(detectWhitePanel(c.image())).toBeNull();
  });

  it("recusa blocos muito esticados (uma faixa branca não é um painel de QR)", () => {
    const c = canvas(200, 200);
    c.paint(20, 50, 179, 70, WHITE);
    expect(detectWhitePanel(c.image())).toBeNull();
  });

  it("sem nenhum branco, devolve null; imagem minúscula ou dados incompletos também", () => {
    expect(detectWhitePanel(canvas(100, 100).image())).toBeNull();
    expect(detectWhitePanel({ data: new Uint8ClampedArray(16), width: 2, height: 2 })).toBeNull();
    expect(detectWhitePanel({ data: new Uint8ClampedArray(10), width: 100, height: 100 })).toBeNull();
  });

  it("quase-branco (cinza muito claro) conta pelo limiar; cinza médio não", () => {
    const c = canvas(200, 200);
    c.paint(100, 100, 159, 159, [243, 243, 243]);
    expect(detectWhitePanel(c.image())).not.toBeNull();
    const d = canvas(200, 200);
    d.paint(100, 100, 159, 159, [200, 200, 200]);
    expect(detectWhitePanel(d.image())).toBeNull();
  });
});

describe("fitQrIntoPanel", () => {
  const layout = { widthMm: 100, heightMm: 100, bleedMm: 3 };

  it("converte pixels em milímetros pela proporção da página e desconta a sangria", () => {
    // imagem 1060x1060 cobre 106x106 mm: 10 px = 1 mm. Painel de (400..699) = 40 mm a 70 mm da PÁGINA -> 37 a 67 mm do corte.
    const fit = fitQrIntoPanel({ x0: 400, y0: 400, x1: 699, y1: 699 }, { width: 1060, height: 1060 }, layout, 0.05)!;
    expect(fit.qrSizeMm).toBe(27); // 30 mm * 0,9
    expect(fit.qrXMm).toBe(38.5); // centro em 52 mm do corte, menos metade do lado
    expect(fit.qrYMm).toBe(38.5);
  });

  it("o QR fica inteiro dentro do painel, com folga em todos os lados", () => {
    const panel = { x0: 400, y0: 380, x1: 690, y1: 660 };
    const fit = fitQrIntoPanel(panel, { width: 1060, height: 1060 }, layout)!;
    const left = 40 - 3, right = 69.1 - 3, top = 38 - 3, bottom = 66.1 - 3; // painel em mm do corte
    expect(fit.qrXMm).toBeGreaterThanOrEqual(left);
    expect(fit.qrXMm + fit.qrSizeMm).toBeLessThanOrEqual(right);
    expect(fit.qrYMm).toBeGreaterThanOrEqual(top);
    expect(fit.qrYMm + fit.qrSizeMm).toBeLessThanOrEqual(bottom);
  });

  it("usa o menor lado do painel e arredonda o tamanho PARA BAIXO em passos de 0,5 mm", () => {
    const fit = fitQrIntoPanel({ x0: 100, y0: 100, x1: 399, y1: 349 }, { width: 1060, height: 1060 }, layout)!;
    expect(fit.qrSizeMm * 2).toBe(Math.floor(fit.qrSizeMm * 2)); // múltiplo de 0,5
    expect(fit.qrSizeMm).toBeLessThanOrEqual(25); // lado menor = 25 mm
  });

  it("funciona com arte de qualquer resolução, inclusive não quadrada (a imagem é esticada na página)", () => {
    const a = fitQrIntoPanel({ x0: 400, y0: 400, x1: 699, y1: 699 }, { width: 1060, height: 1060 }, layout)!;
    const b = fitQrIntoPanel({ x0: 200, y0: 400, x1: 349, y1: 699 }, { width: 530, height: 1060 }, layout)!;
    expect(b).toEqual(a);
  });

  it("nunca deixa o QR sair da área de corte", () => {
    const fit = fitQrIntoPanel({ x0: 900, y0: 900, x1: 1059, y1: 1059 }, { width: 1060, height: 1060 }, layout)!;
    expect(fit.qrXMm + fit.qrSizeMm).toBeLessThanOrEqual(100);
    expect(fit.qrYMm + fit.qrSizeMm).toBeLessThanOrEqual(100);
    expect(fit.qrXMm).toBeGreaterThanOrEqual(0);
  });

  it("painel pequeno demais para um QR legível (menos de 10 mm) devolve null", () => {
    expect(fitQrIntoPanel({ x0: 400, y0: 400, x1: 459, y1: 459 }, { width: 1060, height: 1060 }, layout)).toBeNull();
  });
});
