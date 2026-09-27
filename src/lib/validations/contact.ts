import { z } from "zod";

/** Formulário público /contato (C9/F6) — sem origem obrigatória (ao contrário de "Falar com a gente", que sempre se liga a um cartão/visita): quem escreve pode nem ter cartão nenhum ainda. */
export const createContactMessageSchema = z.object({
  name: z.string().trim().min(2, "Conte seu nome").max(80),
  email: z.string().trim().email("Digite um e-mail válido").max(160),
  message: z.string().trim().min(10, "Conte um pouco mais").max(2000),
});

export type CreateContactMessageInput = z.infer<typeof createContactMessageSchema>;
