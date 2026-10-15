import { z } from "zod";
import { EnvelopeSchema, SeatIdSchema } from "../sim/commands/schema";

/**
 * Protocole du multijoueur privé (27 §1, C13) : lockstep déterministe, un hôte séquenceur. Messages JSON typés (Zod) ; aucune bibliothèque
 * réseau ici (le transport est une interface : `transport.ts`). Le jeu ne sort pas du cercle des amis : aucun message ne porte de donnée personnelle.
 */
export const PROTOCOL_VERSION = 1;

const tick = z.number().int().min(0);
const hash = z.string().regex(/^[0-9a-f]{8}$/);

/** Un tour de campagne : enveloppes ordonnées par l'hôte (ordre d'arrivée), puis avance du temps. Identique pour tous les clients. */
export const TurnSchema = z
  .object({
    tick: tick,
    /** Nombre de jours que la campagne avance après les enveloppes (0 = pas d'avance : tour de commandes seul). */
    advance: z.number().int().min(0).max(30),
    envs: z.array(z.object({ seq: z.number().int().min(1), env: EnvelopeSchema }).strict()),
  })
  .strict();
export type Turn = z.infer<typeof TurnSchema>;

export const ClientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hello"), v: z.literal(PROTOCOL_VERSION), seat: SeatIdSchema, password: z.string().max(64) }).strict(),
  z.object({ t: z.literal("cmd"), id: z.number().int().min(1), env: EnvelopeSchema }).strict(),
  z.object({ t: z.literal("hash"), tick, hash }).strict(),
  z.object({ t: z.literal("resync") }).strict(),
  z.object({ t: z.literal("bye") }).strict(),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const HostMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("welcome"), seat: SeatIdSchema, tick, snapshot: z.string() }).strict(),
  z.object({ t: z.literal("turn"), turn: TurnSchema }).strict(),
  z.object({ t: z.literal("reject"), id: z.number().int().min(1), code: z.string(), detail: z.string() }).strict(),
  z.object({ t: z.literal("snapshot"), tick, snapshot: z.string(), reason: z.enum(["desync", "resync", "reconnect"]) }).strict(),
  z.object({ t: z.literal("refused"), code: z.string() }).strict(),
  /** Message privé à UN siège (allégeance secrète) : jamais diffusé, jamais dans un instantané. */
  z.object({ t: z.literal("secret"), serves: z.string(), objective: z.string(), capital: z.number().min(0) }).strict(),
]);
export type HostMessage = z.infer<typeof HostMessageSchema>;
