import type { MultiplayerConnectionError } from "./multiplayer.types";
import type { BaseMultiplayerMessage, PlayerProfile, RoomPlayersMessage } from "./messages";

export type HostClientRoomStatus = "idle" | "hosting" | "joining" | "connected" | "closed" | "error";

export type RemotePlayer = PlayerProfile & {
  peerId: string;
  connectedAt: number;
};

export type HostClientRoomEvent<TMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> =
  | { type: "player-joined"; player: RemotePlayer }
  | { type: "player-left"; player: RemotePlayer }
  | { type: "message-received"; peerId: string; message: TMessage }
  | { type: "room-closed" }
  | { type: "error"; error: MultiplayerConnectionError };

export type HostClientRoomMessage = BaseMultiplayerMessage | RoomPlayersMessage;

export type HostClientRoomOptions<TMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = {
  localPlayer?: PlayerProfile;
  onEvent?: (event: HostClientRoomEvent<TMessage>) => void;
};
