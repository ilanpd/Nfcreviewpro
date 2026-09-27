import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda do schema do Retorno (ADR-078). Lê `schema.prisma` e a migração e
 * falha se alguém afrouxar uma garantia de integridade que o domínio assume:
 * código único por empresa, uma configuração por empresa, limites no banco e
 * migração só de expansão.
 */

const ROOT = process.cwd();
const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8").replace(/\r\n/g, "\n");
const migrationDir = fs.readdirSync(path.join(ROOT, "prisma/migrations")).find((d) => d.endsWith("_retorno_fundacao"));
const migration = migrationDir
  ? fs.readFileSync(path.join(ROOT, "prisma/migrations", migrationDir, "migration.sql"), "utf8").replace(/\r\n/g, "\n")
  : "";

function model(name: string): string {
  const start = schema.indexOf(`model ${name} {`);
  if (start < 0) throw new Error(`model ${name} não encontrado`);
  return schema.slice(start, schema.indexOf("\n}", start));
}

describe("schema do Retorno", () => {
  it("o brinde tem código único por empresa (é o que impede dois brindes com o mesmo código)", () => {
    expect(model("Voucher")).toMatch(/@@unique\(\[companyId, code\]\)/);
  });

  it("cada empresa tem no máximo uma configuração de brinde", () => {
    expect(model("RewardOffer")).toMatch(/companyId\s+String\s+@unique/);
  });

  it("brinde e configuração somem junto com a empresa (sem dado órfão de cliente)", () => {
    expect(model("Voucher")).toMatch(/company\s+Company\s+@relation\(fields: \[companyId\], references: \[id\], onDelete: Cascade\)/);
    expect(model("RewardOffer")).toMatch(/company\s+Company\s+@relation\(fields: \[companyId\], references: \[id\], onDelete: Cascade\)/);
  });

  it("o PIN só existe como hash", () => {
    const offer = model("RewardOffer");
    expect(offer).toMatch(/pinHash\s+String\?/);
    expect(offer).not.toMatch(/\bpin\s+String/);
  });

  it("o interruptor do piloto começa desligado e o geral começa ligado", () => {
    expect(model("Company")).toMatch(/returnPilotEnabled\s+Boolean\s+@default\(false\)/);
    expect(model("SiteSettings")).toMatch(/returnOfferEnabled\s+Boolean\s+@default\(true\)/);
  });

  it("a mensagem privada pode existir sem nota", () => {
    expect(model("PrivateFeedback")).toMatch(/ratingEventId\s+String\?\s+@unique/);
  });
});

describe("migração retorno_fundacao", () => {
  it("existe", () => {
    expect(migrationDir).toBeDefined();
  });

  it("é só de expansão: nada é apagado nem renomeado", () => {
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE|INDEX)\b/i);
    expect(migration).not.toMatch(/\bRENAME\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("repete os limites no banco", () => {
    expect(migration).toMatch(/"windowDays" BETWEEN 1 AND 90/);
    expect(migration).toMatch(/"cooldownDays" BETWEEN 0 AND 365/);
    expect(migration).toMatch(/"dailyCap" IS NULL OR "dailyCap" > 0/);
  });
});
