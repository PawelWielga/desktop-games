import type { PeerOptions } from "peerjs";

export type MultiplayerRole = "host" | "guest";

export type MultiplayerConnectionStatus = "idle" | "hosting" | "joining" | "connected" | "closed" | "error";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue | undefined };

export type MultiplayerMessage = JsonObject & { type: string };

export type MultiplayerMessageHandler<TMessage extends JsonObject = MultiplayerMessage> = (message: TMessage) => void;

export type MultiplayerStatusHandler = (state: PeerRoomSnapshot) => void;

export type MultiplayerErrorHandler = (error: MultiplayerConnectionError) => void;

export type PeerRoomSnapshot = {
  status: MultiplayerConnectionStatus;
  role: MultiplayerRole | null;
  roomCode: string | null;
  error: MultiplayerConnectionError | null;
};

export type MultiplayerConnectionError = {
  message: string;
  cause?: unknown;
};

export type PeerRoomConnectionOptions = {
  roomCodeLength?: number;
  connectionTimeoutMs?: number;
  peerOptions?: PeerOptions;
};
