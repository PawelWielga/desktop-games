import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import { createRoomCode, isValidRoomCode, normalizeRoomCode } from "./peerConnection";
import type { MultiplayerConnectionError } from "./multiplayer.types";
import {
  type BaseMultiplayerMessage,
  type PlayerHelloMessage,
  type PlayerProfile,
  isPlayerHelloMessage,
  parseMultiplayerMessage,
  sendMessage as sendTypedMessage,
} from "./messages";
import type { HostClientRoomEvent, HostClientRoomOptions, HostClientRoomStatus, RemotePlayer } from "./hostClientRoom.types";

export type UsePeerHostRoomResult<TMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = {
  status: HostClientRoomStatus;
  roomCode: string | null;
  localPeerId: string | null;
  players: RemotePlayer[];
  lastEvent: HostClientRoomEvent<TMessage> | null;
  error: MultiplayerConnectionError | null;
  host: (roomCode?: string) => Promise<string | null>;
  close: () => void;
  broadcast: (message: TMessage) => boolean;
  sendTo: (peerId: string, message: TMessage) => boolean;
};

export function usePeerHostRoom<TMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage>(
  options: HostClientRoomOptions<TMessage> = {}
): UsePeerHostRoomResult<TMessage> {
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef(new Map<string, DataConnection>());
  const playersRef = useRef(new Map<string, RemotePlayer>());
  const onEventRef = useRef(options.onEvent);
  const [status, setStatus] = useState<HostClientRoomStatus>("idle");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [localPeerId, setLocalPeerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<RemotePlayer[]>([]);
  const [lastEvent, setLastEvent] = useState<HostClientRoomEvent<TMessage> | null>(null);
  const [error, setError] = useState<MultiplayerConnectionError | null>(null);

  useEffect(() => {
    onEventRef.current = options.onEvent;
  }, [options.onEvent]);

  const emit = useCallback((event: HostClientRoomEvent<TMessage>) => {
    setLastEvent(event);
    onEventRef.current?.(event);
  }, []);

  const publishPlayers = useCallback(() => {
    const remotePlayers = Array.from(playersRef.current.values());
    const allPlayers = options.localPlayer ? [options.localPlayer, ...remotePlayers] : remotePlayers;
    const message = {
      type: "room:players",
      senderId: options.localPlayer?.id,
      players: allPlayers,
    } as Parameters<typeof sendTypedMessage>[1] & { players: PlayerProfile[] };

    for (const connection of connectionsRef.current.values()) {
      sendRaw(connection, message);
    }
  }, [options.localPlayer]);

  const syncPlayers = useCallback(
    (next: Map<string, RemotePlayer>) => {
      playersRef.current = next;
      setPlayers(Array.from(next.values()));
      publishPlayers();
    },
    [publishPlayers]
  );

  const removePlayer = useCallback(
    (peerId: string) => {
      const player = playersRef.current.get(peerId);
      connectionsRef.current.delete(peerId);
      if (!player) return;

      const next = new Map(playersRef.current);
      next.delete(peerId);
      syncPlayers(next);
      emit({ type: "player-left", player });
    },
    [emit, syncPlayers]
  );

  const bindConnection = useCallback(
    (connection: DataConnection) => {
      connectionsRef.current.set(connection.peer, connection);

      connection.on("open", () => {
        const fallbackPlayer: RemotePlayer = {
          id: connection.peer,
          peerId: connection.peer,
          name: `Gracz ${playersRef.current.size + 1}`,
          color: "#38bdf8",
          emoji: "🙂",
          connectedAt: Date.now(),
        };
        const next = new Map(playersRef.current);
        next.set(connection.peer, fallbackPlayer);
        syncPlayers(next);
        emit({ type: "player-joined", player: fallbackPlayer });
      });

      connection.on("data", (data: unknown) => {
        const message = parseMultiplayerMessage<TMessage | PlayerHelloMessage>(data);
        if (!message) {
          const invalidError = { message: "Odebrano nieprawidłową wiadomość multiplayer." };
          setError(invalidError);
          emit({ type: "error", error: invalidError });
          return;
        }

        if (isPlayerHelloMessage(message)) {
          const player: RemotePlayer = {
            ...message.player,
            peerId: connection.peer,
            connectedAt: playersRef.current.get(connection.peer)?.connectedAt ?? Date.now(),
          };
          const next = new Map(playersRef.current);
          next.set(connection.peer, player);
          syncPlayers(next);
          emit({ type: "player-joined", player });
          return;
        }

        emit({ type: "message-received", peerId: connection.peer, message: message as TMessage });
      });

      connection.on("close", () => removePlayer(connection.peer));
      connection.on("error", (cause: unknown) => {
        const connectionError = { message: "Wystąpił błąd połączenia z graczem.", cause };
        setError(connectionError);
        emit({ type: "error", error: connectionError });
      });
    },
    [emit, removePlayer, syncPlayers]
  );

  const close = useCallback(() => {
    for (const connection of connectionsRef.current.values()) {
      if (connection.open) connection.close();
    }
    connectionsRef.current.clear();
    playersRef.current.clear();
    setPlayers([]);

    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }
    peerRef.current = null;
    setRoomCode(null);
    setLocalPeerId(null);
    setStatus("closed");
    emit({ type: "room-closed" });
  }, [emit]);

  const host = useCallback(
    async (requestedRoomCode = createRoomCode()): Promise<string | null> => {
      const normalizedCode = normalizeRoomCode(requestedRoomCode);
      if (!isValidRoomCode(normalizedCode)) {
        const invalidError = { message: "Kod pokoju jest nieprawidłowy." };
        setError(invalidError);
        setStatus("error");
        emit({ type: "error", error: invalidError });
        return null;
      }

      close();
      setStatus("hosting");
      setRoomCode(normalizedCode);
      setError(null);

      const peer = new Peer(normalizedCode);
      peerRef.current = peer;
      peer.on("connection", bindConnection);
      peer.on("open", (id) => {
        setLocalPeerId(id);
        setStatus("connected");
      });
      peer.on("close", () => {
        setStatus("closed");
        emit({ type: "room-closed" });
      });
      peer.on("error", (cause: unknown) => {
        const peerError = { message: "Nie udało się utworzyć pokoju multiplayer.", cause };
        setError(peerError);
        setStatus("error");
        emit({ type: "error", error: peerError });
      });

      return normalizedCode;
    },
    [bindConnection, close, emit]
  );

  const sendTo = useCallback((peerId: string, message: TMessage): boolean => {
    const connection = connectionsRef.current.get(peerId);
    if (!connection) return false;
    return sendRaw(connection, message);
  }, []);

  const broadcast = useCallback((message: TMessage): boolean => {
    let sent = false;
    for (const connection of connectionsRef.current.values()) {
      sent = sendRaw(connection, message) || sent;
    }
    return sent;
  }, []);

  useEffect(() => close, [close]);

  return {
    status,
    roomCode,
    localPeerId,
    players,
    lastEvent,
    error,
    host,
    close,
    broadcast,
    sendTo,
  };
}

function sendRaw(connection: DataConnection, message: BaseMultiplayerMessage): boolean {
  if (!connection.open) return false;
  connection.send(JSON.stringify(message));
  return true;
}
