import { useCallback, useEffect, useRef, useState } from "react";
import { PeerRoomConnection } from "./peerConnection";
import type {
  JsonObject,
  MultiplayerMessage,
  MultiplayerMessageHandler,
  PeerRoomConnectionOptions,
  PeerRoomSnapshot,
} from "./multiplayer.types";

export type UsePeerRoomOptions<TMessage extends JsonObject = MultiplayerMessage> = PeerRoomConnectionOptions & {
  onMessage?: MultiplayerMessageHandler<TMessage>;
};

export type UsePeerRoomResult<TMessage extends JsonObject = MultiplayerMessage> = PeerRoomSnapshot & {
  lastMessage: TMessage | null;
  host: (roomCode?: string) => Promise<PeerRoomSnapshot>;
  join: (roomCode: string) => Promise<PeerRoomSnapshot>;
  send: (message: TMessage) => boolean;
  close: () => void;
  onMessage: (handler: MultiplayerMessageHandler<TMessage>) => () => void;
};

export function usePeerRoom<TMessage extends JsonObject = MultiplayerMessage>(
  options: UsePeerRoomOptions<TMessage> = {}
): UsePeerRoomResult<TMessage> {
  const connectionRef = useRef<PeerRoomConnection<TMessage> | null>(null);
  const messageHandlerRef = useRef(options.onMessage);
  const [snapshot, setSnapshot] = useState<PeerRoomSnapshot>({
    status: "idle",
    role: null,
    roomCode: null,
    error: null,
  });
  const [lastMessage, setLastMessage] = useState<TMessage | null>(null);

  if (!connectionRef.current) {
    connectionRef.current = new PeerRoomConnection<TMessage>(options);
  }

  useEffect(() => {
    messageHandlerRef.current = options.onMessage;
  }, [options.onMessage]);

  useEffect(() => {
    const connection = connectionRef.current;
    if (!connection) return undefined;

    const unsubscribeStatus = connection.onStatusChange(setSnapshot);
    const unsubscribeMessage = connection.onMessage((message) => {
      setLastMessage(message);
      messageHandlerRef.current?.(message);
    });

    return () => {
      unsubscribeMessage();
      unsubscribeStatus();
      connection.close();
    };
  }, []);

  const host = useCallback((roomCode?: string) => connectionRef.current?.host(roomCode) ?? Promise.resolve(snapshot), [snapshot]);
  const join = useCallback((roomCode: string) => connectionRef.current?.join(roomCode) ?? Promise.resolve(snapshot), [snapshot]);
  const send = useCallback((message: TMessage) => connectionRef.current?.send(message) ?? false, []);
  const close = useCallback(() => connectionRef.current?.close(), []);
  const onMessage = useCallback((handler: MultiplayerMessageHandler<TMessage>) => {
    return connectionRef.current?.onMessage(handler) ?? (() => undefined);
  }, []);

  return {
    ...snapshot,
    lastMessage,
    host,
    join,
    send,
    close,
    onMessage,
  };
}
