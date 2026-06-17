import React, { useMemo, useState } from "react";
import type { BaseMultiplayerMessage } from "./messages";
import type { UseMultiplayerLobbyResult } from "./useMultiplayerLobby";
import "./multiplayer-panel.css";

export type MultiplayerPanelProps<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = {
  lobby: UseMultiplayerLobbyResult<TGameMessage>;
  title?: string;
};

export function MultiplayerPanel<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage>({
  lobby,
  title = "Multiplayer",
}: MultiplayerPanelProps<TGameMessage>): React.ReactElement {
  const [joinCode, setJoinCode] = useState("");
  const busy = lobby.status === "hosting" || lobby.status === "joining";
  const connected = lobby.status === "connected";
  const canJoin = joinCode.trim().length > 0 && !busy && !connected;

  const statusText = useMemo(() => getStatusText(lobby), [lobby]);

  return (
    <section className="mp-panel" aria-label={title}>
      <header className="mp-panel-header">
        <div>
          <h2>{title}</h2>
          <p>{statusText}</p>
        </div>
        <div className="mp-local-player" title={lobby.localPlayer.name}>
          <span aria-hidden style={{ color: lobby.localPlayer.color }}>
            {lobby.localPlayer.emoji}
          </span>
          <strong>{lobby.localPlayer.name}</strong>
        </div>
      </header>

      <div className="mp-actions">
        <button type="button" onClick={() => void lobby.host()} disabled={busy || connected}>
          Utwórz grę
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canJoin) void lobby.join(joinCode);
          }}
        >
          <label htmlFor="mp-room-code">Kod pokoju</label>
          <input
            id="mp-room-code"
            type="text"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="np. ABC12"
            disabled={busy || connected}
            autoComplete="off"
          />
          <button type="submit" disabled={!canJoin}>
            Dołącz do gry
          </button>
        </form>
      </div>

      {lobby.roomCode && (
        <div className="mp-room-code" role="status">
          Kod pokoju: <strong>{lobby.roomCode}</strong>
        </div>
      )}

      {lobby.error && <p className="mp-error">{lobby.error.message}</p>}

      <div className="mp-players">
        <span>Ty: {roleLabel(lobby.role)}</span>
        {lobby.remotePlayers.length > 0 ? (
          lobby.remotePlayers.map((player) => (
            <span key={player.id}>
              <span aria-hidden style={{ color: player.color }}>
                {player.emoji}
              </span>{" "}
              {player.name}
            </span>
          ))
        ) : (
          <span>Przeciwnik: jeszcze nie połączony</span>
        )}
      </div>

      {connected && (
        <button type="button" className="mp-secondary" onClick={lobby.close}>
          Rozłącz
        </button>
      )}
    </section>
  );
}

function getStatusText(lobby: UseMultiplayerLobbyResult): string {
  switch (lobby.status) {
    case "idle":
      return "Utwórz pokój albo wpisz kod od hosta.";
    case "hosting":
      return "Czekaj na gracza...";
    case "joining":
      return "Łączenie...";
    case "connected":
      return "Połączono. Możecie grać.";
    case "closed":
      return "Połączenie zostało zamknięte.";
    case "error":
      return "Nie udało się połączyć.";
    default:
      return "Status połączenia nieznany.";
  }
}

function roleLabel(role: UseMultiplayerLobbyResult["role"]): string {
  if (role === "host") return "host";
  if (role === "guest") return "gość";
  return "brak roli";
}

export default MultiplayerPanel;
