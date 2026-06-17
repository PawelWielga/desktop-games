import type { MultiplayerConnectionError, MultiplayerConnectionStatus, MultiplayerRole } from "./multiplayer.types";
import type { BaseMultiplayerMessage, PlayerProfile } from "./messages";

export type GameSessionRole = MultiplayerRole;

export type TurnOwner = "host" | "guest";

export type RemotePlayer = PlayerProfile & {
  peerId: string;
  connectedAt?: number;
};

export type LocalMultiplayerPlayer = PlayerProfile & {
  role: GameSessionRole | null;
};

export type GameSessionSnapshot<TMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = {
  role: GameSessionRole | null;
  localPlayer: LocalMultiplayerPlayer;
  remotePlayers: RemotePlayer[];
  opponent: RemotePlayer | null;
  status: MultiplayerConnectionStatus;
  roomCode: string | null;
  error: MultiplayerConnectionError | null;
  lastMessage: TMessage | null;
  sendMessage: (message: Omit<TMessage, "sentAt"> & Partial<Pick<TMessage, "sentAt">>) => boolean;
};

export function getStartingTurn(role: GameSessionRole | null): TurnOwner | null {
  if (!role) return null;
  return "host";
}
