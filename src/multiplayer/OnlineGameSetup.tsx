import React, { useMemo, useState } from "react";
import type { BaseMultiplayerMessage } from "./messages";
import type { UseMultiplayerLobbyResult } from "./useMultiplayerLobby";
import "./online-game-setup.css";

export type OnlineGameSetupProps<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = {
  lobby: UseMultiplayerLobbyResult<TGameMessage>;
  title?: string;
  subtitle?: string;
  minPlayers: number;
  maxPlayers: number;
  createLabel?: string;
  joinLabel?: string;
};

type OnlineGameSetupStatus = UseMultiplayerLobbyResult<BaseMultiplayerMessage>["status"];
type OnlineGameSetupRole = UseMultiplayerLobbyResult<BaseMultiplayerMessage>["role"];

export function OnlineGameSetup<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage>({
  lobby,
  title = "Gra online",
  subtitle = "Utwórz pokój albo dołącz kodem od hosta.",
  minPlayers,
  maxPlayers,
  createLabel = "Utwórz grę online",
  joinLabel = "Dołącz",
}: OnlineGameSetupProps<TGameMessage>): React.ReactElement {
  const [joinCode, setJoinCode] = useState("");
  const busy = lobby.status === "hosting" || lobby.status === "joining";
  const connected = lobby.status === "connected";
  const currentPlayers = 1 + lobby.remotePlayers.length;
  const canStart = currentPlayers >= minPlayers && currentPlayers <= maxPlayers;
  const canCreate = !busy && !connected;
  const canJoin = joinCode.trim().length > 0 && !busy && !connected;
  const statusText = useMemo(() => getStatusText(lobby.status, canStart), [lobby.status, canStart]);

  return (
    <section className="online-setup" aria-label={title} data-status={lobby.status}>
      <header className="online-setup__hero">
        <div className="online-setup__badge" aria-hidden>
          ✨
        </div>
        <div className="online-setup__heading">
          <span className="online-setup__eyebrow">Multiplayer</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="online-setup__player-card" title={lobby.localPlayer.name}>
          <span className="online-setup__avatar" style={{ color: lobby.localPlayer.color }} aria-hidden>
            {lobby.localPlayer.emoji}
          </span>
          <span>
            <small>Grasz jako</small>
            <strong>{lobby.localPlayer.name}</strong>
          </span>
        </div>
      </header>

      <div className="online-setup__status-row">
        <div className="online-setup__status-pill">
          <span className="online-setup__dot" aria-hidden />
          {statusText}
        </div>
        <div className="online-setup__capacity" aria-label={`Gracze ${currentPlayers} z ${maxPlayers}`}>
          <strong>{currentPlayers}</strong>/<span>{maxPlayers}</span> graczy
        </div>
      </div>

      <div className="online-setup__player-meter" aria-hidden>
        {Array.from({ length: maxPlayers }, (_, index) => (
          <span
            key={index}
            data-active={index < currentPlayers ? "true" : undefined}
            data-required={index < minPlayers ? "true" : undefined}
          />
        ))}
      </div>

      <div className="online-setup__actions">
        <button type="button" className="online-setup__primary" onClick={() => void lobby.host()} disabled={!canCreate}>
          <span aria-hidden>🚀</span>
          {createLabel}
        </button>

        <form
          className="online-setup__join"
          onSubmit={(event) => {
            event.preventDefault();
            if (canJoin) void lobby.join(joinCode);
          }}
        >
          <label htmlFor="online-room-code">Kod pokoju</label>
          <div className="online-setup__join-row">
            <input
              id="online-room-code"
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              placeholder="ABC12"
              disabled={busy || connected}
              autoComplete="off"
            />
            <button type="submit" disabled={!canJoin}>
              {joinLabel}
            </button>
          </div>
        </form>
      </div>

      {lobby.roomCode && (
        <div className="online-setup__room" role="status">
          <span>Udostępnij kod pokoju</span>
          <strong>{lobby.roomCode}</strong>
        </div>
      )}

      {lobby.error && <p className="online-setup__error">{lobby.error.message}</p>}

      <div className="online-setup__players" aria-label="Lista graczy">
        <PlayerChip label="Ty" emoji={lobby.localPlayer.emoji} color={lobby.localPlayer.color} role={roleLabel(lobby.role)} />
        {lobby.remotePlayers.map((player) => (
          <PlayerChip key={player.id} label={player.name} emoji={player.emoji} color={player.color} role="połączony" />
        ))}
        {Array.from({ length: Math.max(0, minPlayers - currentPlayers) }, (_, index) => (
          <span key={`waiting-${index}`} className="online-setup__waiting-chip">
            Czekamy na gracza
          </span>
        ))}
      </div>

      {connected && (
        <button type="button" className="online-setup__disconnect" onClick={lobby.close}>
          Rozłącz
        </button>
      )}
    </section>
  );
}

type PlayerChipProps = {
  label: string;
  emoji: string;
  color: string;
  role: string;
};

function PlayerChip({ label, emoji, color, role }: PlayerChipProps): React.ReactElement {
  return (
    <span className="online-setup__player-chip">
      <span style={{ color }} aria-hidden>
        {emoji}
      </span>
      <span>
        <strong>{label}</strong>
        <small>{role}</small>
      </span>
    </span>
  );
}

function getStatusText(status: OnlineGameSetupStatus, canStart: boolean): string {
  switch (status) {
    case "idle":
      return "Gotowe do utworzenia pokoju";
    case "hosting":
      return "Pokój utworzony, czekamy na graczy";
    case "joining":
      return "Łączenie z pokojem";
    case "connected":
      return canStart ? "Komplet, można grać" : "Połączono, czekamy na graczy";
    case "closed":
      return "Połączenie zamknięte";
    case "error":
      return "Nie udało się połączyć";
    default:
      return "Status połączenia nieznany";
  }
}

function roleLabel(role: OnlineGameSetupRole): string {
  if (role === "host") return "host";
  if (role === "guest") return "gość";
  return "lokalny";
}

export default OnlineGameSetup;
