// Amorce du fil de sim:balance : chargeur TypeScript de tsx dans ce thread, puis le fil lui-même.
import { register } from "tsx/esm/api";

register();
await import("./worker.ts");
