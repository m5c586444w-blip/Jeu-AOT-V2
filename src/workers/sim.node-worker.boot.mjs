// Amorce du worker Node : active le chargeur TypeScript de tsx dans ce thread, puis charge le worker.
import { register } from "tsx/esm/api";

register();
await import("./sim.node-worker.ts");
