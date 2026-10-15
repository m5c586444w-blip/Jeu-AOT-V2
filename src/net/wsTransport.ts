import { WebSocket, WebSocketServer } from "ws";
import type { Link } from "./transport";

/**
 * Transport WebSocket (Node) : même interface `Link` que le réseau en mémoire. L'hôte écoute sur l'adresse donnée (par défaut la boucle
 * locale : le jeu ne s'expose au réseau privé que si l'hôte le demande en passant une autre adresse, voir 27 §2).
 */
function wrap(sock: WebSocket): Link {
  let onMessage: ((m: string) => void) | null = null;
  let onClose: (() => void) | null = null;
  sock.on("message", (data) => onMessage?.(data.toString()));
  sock.on("close", () => onClose?.());
  sock.on("error", () => sock.terminate());
  return {
    send: (m) => {
      if (sock.readyState === WebSocket.OPEN) sock.send(m);
    },
    onMessage: (h) => {
      onMessage = h;
    },
    onClose: (h) => {
      onClose = h;
    },
    close: () => sock.close(),
  };
}

export class WsServer {
  private readonly server: WebSocketServer;
  /** Port effectivement ouvert (utile avec le port 0). */
  readonly listening: Promise<number>;

  constructor(onLink: (link: Link) => void, port: number, address = "127.0.0.1") {
    this.server = new WebSocketServer({ port, host: address, maxPayload: 8 * 1024 * 1024 });
    this.server.on("connection", (sock) => onLink(wrap(sock)));
    this.listening = new Promise((resolve, reject) => {
      this.server.once("listening", () => resolve((this.server.address() as { port: number }).port));
      this.server.once("error", reject);
    });
  }

  close(): Promise<void> {
    for (const c of this.server.clients) c.terminate();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

export function connectWs(url: string): Promise<Link> {
  return new Promise((resolve, reject) => {
    const sock = new WebSocket(url, { maxPayload: 8 * 1024 * 1024 });
    sock.once("open", () => resolve(wrap(sock)));
    sock.once("error", reject);
  });
}
