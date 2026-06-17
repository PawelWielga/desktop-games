import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadPlayerSettings, subscribePlayerSettings } from "@/settings/player/playerSettings.storage";
import type { PlayerSettings } from "@/settings/player/playerSettings.types";
import { usePeerRoom } from "./usePeerRoom";
import type { JsonObject, MultiplayerConnectionStatus, MultiplayerRole, PeerRoomSnapshot } from "./multiplayer.types";
import type { LocalMultiplayerPlayer, RemotePlayer } from "./gameSession.types";
import {
  type AnyMultiplayerMessage,
  type BaseMultiplayerMessage,
  type PlayerHelloMessage,
  type PlayerProfile,
  isPlayerHelloMessage,
  sendMessage as sendTypedMessage,
} from "./messages";

export type MultiplayerLobbyStatus = MultiplayerConnectionStatus;

export type UseMultiplayerLobbyOptions<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = {
  onGameMessage?: (message: TGameMessage) => void;
};

export type UseMultiplayerLobbyResult<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = {
  status: MultiplayerLobbyStatus;
  role: MultiplayerRole | null;
  roomCode: string | null;
  error: PeerRoomSnapshot["error"];
  localPlayer: LocalMultiplayerPlayer;
  remotePlayers: RemotePlayer[];
  opponent: RemotePlayer | null;
  lastMessage: TGameMessage | null;
  host: () => Promise<PeerRoomSnapshot>;
  join: (roomCode: string) => Promise<PeerRoomSnapshot>;
  close: () => void;
  sendMessage: (message: Omit<TGameMessage, "sentAt" | "senderId"> & Partial<Pick<TGameMessage, "sentAt" | "senderId">>) => boolean;
};

export function useMultiplayerLobby<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage>(
  options: UseMultiplayerLobbyOptions<TGameMessage> = {}
): UseMultiplayerLobbyResult<TGameMessage> {
  const playerIdRef = useRef(createLocalPlayerId());
  const onGameMessageRef = useRef(options.onGameMessage);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>(() => loadPlayerSettings());
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const [lastGameMessage, setLastGameMessage] = useState<TGameMessage | null>(null);

  useEffect(() => {
    onGameMessageRef.current = options.onGameMessage;
  }, [options.onGameMessage]);

  useEffect(() => subscribePlayerSettings(setPlayerSettings), []);

  const handleIncomingMessage = useCallback((message: AnyMultiplayerMessage) => {
    if (isPlayerHelloMessage(message)) {
      const remote = toRemotePlayer(message.player);
      setRemotePlayers((players) => upsertRemotePlayer(players, remote));
      return;
    }

    const gameMessage = message as TGameMessage;
    setLastGameMessage(gameMessage);
    onGameMessageRef.current?.(gameMessage);
  }, []);

  const room = usePeerRoom<AnyMultiplayerMessage>({ onMessage: handleIncomingMessage });

  const localPlayer = useMemo<LocalMultiplayerPlayer>(
    () => ({
      id: playerIdRef.current,
      name: playerSettings.name,
      color: playerSettings.color,
      emoji: playerSettings.emoji,
      role: room.role,
    }),
    [playerSettings, room.role]
  );

  const sendHello = useCallback(() => {
    const helloMessage: PlayerHelloMessage = {
      type: "player:hello",
      senderId: localPlayer.id,
      sentAt: Date.now(),
      player: toPlayerProfile(localPlayer),
    };

    return room.send(helloMessage);
  }, [localPlayer, room.send]);

  useEffect(() => {
    if (room.status === "connected") {
      sendHello();
      return;
    }

    if (room.status === "idle" || room.status === "joining" || room.status === "hosting" || room.status === "closed") {
      setRemotePlayers([]);
    }
  }, [room.status, sendHello]);

  const host = useCallback(async () => {
    setRemotePlayers([]);
    return room.host();
  }, [room]);

  const join = useCallback(
    async (roomCode: string) => {
      setRemotePlayers([]);
      return room.join(roomCode);
    },
    [room]
  );

  const close = useCallback(() => {
    setRemotePlayers([]);
    room.close();
  }, [room]);

  const sendMessage = useCallback(
    (message: Omit<TGameMessage, "sentAt" | "senderId"> & Partial<Pick<TGameMessage, "sentAt" | "senderId">>) => {
      return sendTypedMessage(room.send as (value: TGameMessage) => boolean, {
        ...message,
        senderId: message.senderId ?? localPlayer.id,
      } as Omit<TGameMessage, "sentAt"> & Partial<Pick<TGameMessage, "sentAt">>);
    },
    [localPlayer.id, room.send]
  );

  return {
    status: room.status,
    role: room.role,
    roomCode: room.roomCode,
    error: room.error,
    localPlayer,
    remotePlayers,
    opponent: remotePlayers[0] ?? null,
    lastMessage: lastGameMessage,
    host,
    join,
    close,
    sendMessage,
  };
}

function toPlayerProfile(player: LocalMultiplayerPlayer): PlayerProfile {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    emoji: player.emoji,
  };
}

function toRemotePlayer(player: PlayerProfile): RemotePlayer {
  return {
    ...player,
    peerId: player.id,
    connectedAt: Date.now(),
  };
}

function upsertRemotePlayer(players: RemotePlayer[], player: RemotePlayer): RemotePlayer[] {
  const existingIndex = players.findIndex((item) => item.id === player.id);
  if (existingIndex < 0) return [...players, player];

  const next = players.slice();
  next[existingIndex] = { ...next[existingIndex], ...player };
  return next;
}

function createLocalPlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `player-${Math.random().toString(36).slice(2, 10)}`;
}

export type LobbyGameMessage<TType extends string, TPayload = JsonObject> = BaseMultiplayerMessage<TType> & TPayload;
