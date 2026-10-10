// Amorce d'un fil de sim:balance : active le chargeur TypeScript de tsx dans ce thread, puis charge le fil.
import { register } from "tsx/esm/api";

register();
await import("./worker.ts");
