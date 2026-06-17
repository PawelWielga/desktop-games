import type { JsonObject, JsonValue, MultiplayerMessageHandler } from "./multiplayer.types";

export type MessageMetadata = {
  requestId?: string;
  senderId?: string;
  sentAt?: number;
};

export type BaseMultiplayerMessage<TType extends string = string> = JsonObject &
  MessageMetadata & {
    type: TType;
  };

export type PlayerProfile = JsonObject & {
  id: string;
  name: string;
  color: string;
  emoji: string;
};

export type PlayerHelloMessage = BaseMultiplayerMessage<"player:hello"> & {
  player: PlayerProfile;
};

export type GameResetMessage = BaseMultiplayerMessage<"game:reset">;

export type GameReadyMessage = BaseMultiplayerMessage<"game:ready"> & {
  ready?: boolean;
};

export type GameErrorMessage = BaseMultiplayerMessage<"game:error"> & {
  message: string;
  code?: string;
};

export type CommonMultiplayerMessage = PlayerHelloMessage | GameResetMessage | GameReadyMessage | GameErrorMessage;

export type GameSpecificMessage<TType extends string, TPayload extends JsonObject = JsonObject> = BaseMultiplayerMessage<TType> &
  TPayload;

export type AnyMultiplayerMessage = CommonMultiplayerMessage | BaseMultiplayerMessage;

export type MessageSend<TMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = (message: TMessage) => boolean;

export function createMessage<TMessage extends BaseMultiplayerMessage>(
  message: Omit<TMessage, "sentAt"> & Partial<Pick<TMessage, "sentAt">>
): TMessage {
  return {
    ...message,
    sentAt: message.sentAt ?? Date.now(),
  } as TMessage;
}

export function sendMessage<TMessage extends BaseMultiplayerMessage>(
  send: MessageSend<TMessage>,
  message: Omit<TMessage, "sentAt"> & Partial<Pick<TMessage, "sentAt">>
): boolean {
  return send(createMessage<TMessage>(message));
}

export function onMessage<TMessage extends BaseMultiplayerMessage>(
  handler: MultiplayerMessageHandler<TMessage>,
  onInvalid?: (data: unknown) => void
): MultiplayerMessageHandler<JsonObject> {
  return (data) => {
    const message = parseMultiplayerMessage<TMessage>(data);
    if (!message) {
      onInvalid?.(data);
      return;
    }

    handler(message);
  };
}

export function parseMultiplayerMessage<TMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage>(
  data: unknown
): TMessage | null {
  let parsed: unknown = data;

  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      return null;
    }
  }

  if (!isJsonObject(parsed) || typeof parsed.type !== "string" || parsed.type.trim().length === 0) {
    return null;
  }

  if (parsed.requestId !== undefined && typeof parsed.requestId !== "string") return null;
  if (parsed.senderId !== undefined && typeof parsed.senderId !== "string") return null;
  if (parsed.sentAt !== undefined && typeof parsed.sentAt !== "number") return null;

  return parsed as TMessage;
}

export function isMessageOfType<TType extends string>(
  message: BaseMultiplayerMessage,
  type: TType
): message is BaseMultiplayerMessage<TType> {
  return message.type === type;
}

export function isPlayerProfile(value: unknown): value is PlayerProfile {
  return (
    isJsonObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    typeof value.emoji === "string"
  );
}

export function isPlayerHelloMessage(message: BaseMultiplayerMessage): message is PlayerHelloMessage {
  return message.type === "player:hello" && isPlayerProfile(message.player);
}

export function isRoomPlayersMessage(message: BaseMultiplayerMessage): message is RoomPlayersMessage {
  return message.type === "room:players" && Array.isArray(message.players) && message.players.every(isPlayerProfile);
}

export type RoomPlayersMessage = GameSpecificMessage<"room:players", { players: PlayerProfile[] }>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) && isJsonValue(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every((item) => item === undefined || isJsonValue(item));
  }
  return false;
}
