import Peer, { type DataConnection, type PeerError, type PeerErrorType } from "peerjs";
import type {
  JsonObject,
  MultiplayerConnectionError,
  MultiplayerErrorHandler,
  MultiplayerMessage,
  MultiplayerMessageHandler,
  MultiplayerStatusHandler,
  PeerRoomConnectionOptions,
  PeerRoomSnapshot,
} from "./multiplayer.types";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_ROOM_CODE_LENGTH = 5;
const DEFAULT_CONNECTION_TIMEOUT_MS = 15_000;
const ROOM_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

export function createRoomCode(length = DEFAULT_ROOM_CODE_LENGTH): string {
  const codeLength = Math.max(1, Math.floor(length));
  let code = "";

  for (let index = 0; index < codeLength; index++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }

  return code;
}

export function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
}

export function isValidRoomCode(roomCode: string): boolean {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(roomCode));
}

export class PeerRoomConnection<TMessage extends JsonObject = MultiplayerMessage> {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly messageHandlers = new Set<MultiplayerMessageHandler<TMessage>>();
  private readonly statusHandlers = new Set<MultiplayerStatusHandler>();
  private readonly errorHandlers = new Set<MultiplayerErrorHandler>();
  private snapshot: PeerRoomSnapshot = {
    status: "idle",
    role: null,
    roomCode: null,
    error: null,
  };

  constructor(private readonly options: PeerRoomConnectionOptions = {}) {}

  get state(): PeerRoomSnapshot {
    return this.snapshot;
  }

  onMessage(handler: MultiplayerMessageHandler<TMessage>): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: MultiplayerStatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.snapshot);
    return () => this.statusHandlers.delete(handler);
  }

  onError(handler: MultiplayerErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  async host(roomCode = createRoomCode(this.options.roomCodeLength)): Promise<PeerRoomSnapshot> {
    const normalizedCode = normalizeRoomCode(roomCode);
    if (!isValidRoomCode(normalizedCode)) {
      return this.fail("Kod pokoju jest nieprawidłowy.");
    }

    this.closeTransport();
    const peer = new Peer(normalizedCode, this.options.peerOptions);
    this.peer = peer;
    this.setSnapshot({ status: "hosting", role: "host", roomCode: normalizedCode, error: null });
    this.bindPeer(peer);

    try {
      await this.waitForPeerOpen(peer);
      return this.snapshot;
    } catch (error) {
      return this.fail("Nie udało się utworzyć pokoju multiplayer.", error);
    }
  }

  async join(roomCode: string): Promise<PeerRoomSnapshot> {
    const normalizedCode = normalizeRoomCode(roomCode);
    if (!isValidRoomCode(normalizedCode)) {
      return this.fail("Kod pokoju jest nieprawidłowy.");
    }

    this.closeTransport();
    const peer = this.createGuestPeer();
    this.peer = peer;
    this.setSnapshot({ status: "joining", role: "guest", roomCode: normalizedCode, error: null });
    this.bindPeer(peer);

    try {
      await this.waitForPeerOpen(peer);
      const connection = peer.connect(normalizedCode, { reliable: true, serialization: "json" });
      this.bindConnection(connection);
      await this.waitForConnectionOpen(connection);
      return this.snapshot;
    } catch (error) {
      return this.fail("Nie udało się dołączyć do pokoju multiplayer.", error);
    }
  }

  send(message: TMessage): boolean {
    if (!this.connection || !this.connection.open || this.snapshot.status !== "connected") {
      this.reportError("Połączenie multiplayer nie jest jeszcze gotowe.");
      return false;
    }

    try {
      this.connection.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.reportError("Nie udało się wysłać wiadomości multiplayer.", error);
      return false;
    }
  }

  close(): void {
    this.closeTransport();
    this.setSnapshot({ status: "closed", role: null, roomCode: null, error: null });
  }

  private createGuestPeer(): Peer {
    return this.options.peerOptions ? new Peer(this.options.peerOptions) : new Peer();
  }

  private bindPeer(peer: Peer): void {
    peer.on("connection", this.handleIncomingConnection);
    peer.on("close", this.handlePeerClose);
    peer.on("error", this.handlePeerError);
  }

  private bindConnection(connection: DataConnection): void {
    this.closeConnection();
    this.connection = connection;
    connection.on("open", this.handleConnectionOpen);
    connection.on("data", this.handleConnectionData);
    connection.on("close", this.handleConnectionClose);
    connection.on("error", this.handleConnectionError);
  }

  private readonly handleIncomingConnection = (connection: DataConnection): void => {
    if (this.connection) {
      connection.close();
      return;
    }

    this.bindConnection(connection);
  };

  private readonly handleConnectionOpen = (): void => {
    this.clearConnectionTimeout();
    this.setSnapshot({ status: "connected", error: null });
  };

  private readonly handleConnectionData = (data: unknown): void => {
    try {
      const message = this.parseMessage(data);
      for (const handler of this.messageHandlers) {
        handler(message);
      }
    } catch (error) {
      this.reportError("Odebrano nieprawidłową wiadomość multiplayer.", error);
    }
  };

  private readonly handleConnectionClose = (): void => {
    this.clearConnectionTimeout();
    if (this.snapshot.status !== "closed" && this.snapshot.status !== "error") {
      this.setSnapshot({ status: "closed" });
    }
  };

  private readonly handleConnectionError = (error: unknown): void => {
    this.fail("Wystąpił błąd połączenia multiplayer.", error);
  };

  private readonly handlePeerClose = (): void => {
    this.clearConnectionTimeout();
    if (this.snapshot.status !== "closed" && this.snapshot.status !== "error") {
      this.setSnapshot({ status: "closed" });
    }
  };

  private readonly handlePeerError = (error: PeerError<`${PeerErrorType}`>): void => {
    this.fail(this.mapPeerError(error), error);
  };

  private parseMessage(data: unknown): TMessage {
    const parsed = typeof data === "string" ? (JSON.parse(data) as unknown) : data;

    if (!isJsonObject(parsed)) {
      throw new Error("Wiadomość multiplayer musi być obiektem JSON.");
    }

    if (typeof parsed.type !== "string" || parsed.type.trim().length === 0) {
      throw new Error("Wiadomość multiplayer musi mieć typ.");
    }

    return parsed as TMessage;
  }

  private waitForPeerOpen(peer: Peer): Promise<string> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        peer.off("open", handleOpen);
        peer.off("error", handleError);
        this.clearConnectionTimeout();
      };
      const handleOpen = (id: string) => {
        cleanup();
        resolve(id);
      };
      const handleError = (error: PeerError<`${PeerErrorType}`>) => {
        cleanup();
        reject(error);
      };

      peer.once("open", handleOpen);
      peer.once("error", handleError);
      this.startConnectionTimeout(() => {
        cleanup();
        reject(new Error("Przekroczono czas oczekiwania na PeerJS."));
      });
    });
  }

  private waitForConnectionOpen(connection: DataConnection): Promise<void> {
    if (connection.open) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        connection.off("open", handleOpen);
        connection.off("error", handleError);
        connection.off("close", handleClose);
        this.clearConnectionTimeout();
      };
      const handleOpen = () => {
        cleanup();
        resolve();
      };
      const handleError = (error: unknown) => {
        cleanup();
        reject(error);
      };
      const handleClose = () => {
        cleanup();
        reject(new Error("Połączenie multiplayer zostało zamknięte przed otwarciem."));
      };

      connection.once("open", handleOpen);
      connection.once("error", handleError);
      connection.once("close", handleClose);
      this.startConnectionTimeout(() => {
        cleanup();
        reject(new Error("Przekroczono czas oczekiwania na połączenie z pokojem."));
      });
    });
  }

  private startConnectionTimeout(onTimeout: () => void): void {
    this.clearConnectionTimeout();
    this.connectionTimeout = setTimeout(onTimeout, this.options.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout !== null) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private fail(message: string, cause?: unknown): PeerRoomSnapshot {
    const error = this.reportError(message, cause);
    this.closeTransport();
    this.setSnapshot({ status: "error", error });
    return this.snapshot;
  }

  private reportError(message: string, cause?: unknown): MultiplayerConnectionError {
    const error: MultiplayerConnectionError = { message, cause };
    this.setSnapshot({ error });

    for (const handler of this.errorHandlers) {
      handler(error);
    }

    return error;
  }

  private setSnapshot(patch: Partial<PeerRoomSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const handler of this.statusHandlers) {
      handler(this.snapshot);
    }
  }

  private closeTransport(): void {
    this.clearConnectionTimeout();
    this.closeConnection();

    if (this.peer && !this.peer.destroyed) {
      this.peer.off("connection", this.handleIncomingConnection);
      this.peer.off("close", this.handlePeerClose);
      this.peer.off("error", this.handlePeerError);
      this.peer.destroy();
    }

    this.peer = null;
  }

  private closeConnection(): void {
    if (!this.connection) return;

    this.connection.off("open", this.handleConnectionOpen);
    this.connection.off("data", this.handleConnectionData);
    this.connection.off("close", this.handleConnectionClose);
    this.connection.off("error", this.handleConnectionError);

    if (this.connection.open) {
      this.connection.close();
    }

    this.connection = null;
  }

  private mapPeerError(error: PeerError<`${PeerErrorType}`>): string {
    switch (error.type) {
      case "peer-unavailable":
        return "Nie znaleziono pokoju o podanym kodzie.";
      case "unavailable-id":
        return "Ten kod pokoju jest już zajęty. Spróbuj utworzyć pokój ponownie.";
      case "browser-incompatible":
        return "Ta przeglądarka nie obsługuje wymaganego połączenia WebRTC.";
      case "network":
      case "server-error":
      case "socket-error":
        return "Nie udało się połączyć z serwerem PeerJS.";
      default:
        return "Wystąpił błąd PeerJS.";
    }
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
