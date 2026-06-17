import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import { isValidRoomCode, normalizeRoomCode } from "./peerConnection";
import type { MultiplayerConnectionError } from "./multiplayer.types";
import { type BaseMultiplayerMessage, type PlayerHelloMessage, isRoomPlayersMessage, parseMultiplayerMessage } from "./messages";
import type { HostClientRoomEvent, HostClientRoomOptions, HostClientRoomStatus, RemotePlayer } from "./hostClientRoom.types";

export type UsePeerClientRoomResult<TMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = {
  status: HostClientRoomStatus;
  roomCode: string | null;
  localPeerId: string | null;
  players: RemotePlayer[];
  lastEvent: HostClientRoomEvent<TMessage> | null;
  error: MultiplayerConnectionError | null;
  join: (roomCode: string) => Promise<string | null>;
  close: () => void;
  send: (message: TMessage) => boolean;
};

export function usePeerClientRoom<TMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage>(
  options: HostClientRoomOptions<TMessage> = {}
): UsePeerClientRoomResult<TMessage> {
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
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

  const close = useCallback(() => {
    if (connectionRef.current?.open) {
      connectionRef.current.close();
    }
    connectionRef.current = null;

    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }
    peerRef.current = null;
    setPlayers([]);
    setRoomCode(null);
    setLocalPeerId(null);
    setStatus("closed");
    emit({ type: "room-closed" });
  }, [emit]);

  const bindConnection = useCallback(
    (connection: DataConnection) => {
      connectionRef.current = connection;

      connection.on("open", () => {
        setStatus("connected");
        if (options.localPlayer) {
          const helloMessage: PlayerHelloMessage = {
            type: "player:hello",
            senderId: options.localPlayer.id,
            sentAt: Date.now(),
            player: options.localPlayer,
          };
          sendRaw(connection, helloMessage);
        }
      });

      connection.on("data", (data: unknown) => {
        const message = parseMultiplayerMessage<TMessage>(data);
        if (!message) {
          const invalidError = { message: "Odebrano nieprawidłową wiadomość multiplayer." };
          setError(invalidError);
          emit({ type: "error", error: invalidError });
          return;
        }

        if (isRoomPlayersMessage(message)) {
          setPlayers(
            message.players.map((player) => ({
              ...player,
              peerId: player.id,
              connectedAt: Date.now(),
            }))
          );
          return;
        }

        emit({ type: "message-received", peerId: connection.peer, message });
      });

      connection.on("close", () => {
        setStatus("closed");
        emit({ type: "room-closed" });
      });

      connection.on("error", (cause: unknown) => {
        const connectionError = { message: "Wystąpił błąd połączenia z hostem.", cause };
        setError(connectionError);
        setStatus("error");
        emit({ type: "error", error: connectionError });
      });
    },
    [emit, options.localPlayer]
  );

  const join = useCallback(
    async (requestedRoomCode: string): Promise<string | null> => {
      const normalizedCode = normalizeRoomCode(requestedRoomCode);
      if (!isValidRoomCode(normalizedCode)) {
        const invalidError = { message: "Kod pokoju jest nieprawidłowy." };
        setError(invalidError);
        setStatus("error");
        emit({ type: "error", error: invalidError });
        return null;
      }

      close();
      setStatus("joining");
      setRoomCode(normalizedCode);
      setError(null);

      const peer = new Peer();
      peerRef.current = peer;
      peer.on("open", (id) => {
        setLocalPeerId(id);
        const connection = peer.connect(normalizedCode, { reliable: true, serialization: "json" });
        bindConnection(connection);
      });
      peer.on("error", (cause: unknown) => {
        const peerError = { message: "Nie udało się dołączyć do pokoju multiplayer.", cause };
        setError(peerError);
        setStatus("error");
        emit({ type: "error", error: peerError });
      });

      return normalizedCode;
    },
    [bindConnection, close, emit]
  );

  const send = useCallback((message: TMessage): boolean => {
    if (!connectionRef.current) return false;
    return sendRaw(connectionRef.current, message);
  }, []);

  useEffect(() => close, [close]);

  return {
    status,
    roomCode,
    localPeerId,
    players,
    lastEvent,
    error,
    join,
    close,
    send,
  };
}

function sendRaw(connection: DataConnection, message: BaseMultiplayerMessage): boolean {
  if (!connection.open) return false;
  connection.send(JSON.stringify(message));
  return true;
}
