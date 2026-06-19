import React, { useMemo, useState } from "react";
import { useTranslation, type TranslationFunction } from "@/i18n/useTranslation";
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

export type InGameMultiplayerOverlayProps<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage> = {
  lobby: UseMultiplayerLobbyResult<TGameMessage>;
  maxPlayers: number;
};

type OnlineGameSetupStatus = UseMultiplayerLobbyResult<BaseMultiplayerMessage>["status"];
type OnlineGameSetupRole = UseMultiplayerLobbyResult<BaseMultiplayerMessage>["role"];

export function OnlineGameSetup<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage>({
  lobby,
  title,
  subtitle,
  minPlayers,
  maxPlayers,
  createLabel,
  joinLabel,
}: OnlineGameSetupProps<TGameMessage>): React.ReactElement {
  const { t } = useTranslation();
  const displayTitle = title ?? t("multiplayer.title");
  const displaySubtitle = subtitle ?? t("multiplayer.subtitle");
  const displayCreateLabel = createLabel ?? t("multiplayer.createRoom");
  const displayJoinLabel = joinLabel ?? t("multiplayer.join");
  const currentPlayers = getCurrentPlayers(lobby);
  const connected = lobby.status === "connected";
  const busy = lobby.status === "hosting" || lobby.status === "joining";
  const canStart = currentPlayers >= minPlayers && currentPlayers <= maxPlayers;
  const statusText = useMemo(() => getStatusText(lobby.status, canStart, t), [lobby.status, canStart, t]);

  if (connected || lobby.roomCode) {
    return (
      <MultiplayerLobbyScreen
        lobby={lobby}
        title={displayTitle}
        minPlayers={minPlayers}
        maxPlayers={maxPlayers}
        currentPlayers={currentPlayers}
        statusText={statusText}
      />
    );
  }

  return (
    <MultiplayerConnectScreen
      lobby={lobby}
      title={displayTitle}
      subtitle={displaySubtitle}
      busy={busy}
      createLabel={displayCreateLabel}
      joinLabel={displayJoinLabel}
    />
  );
}

type MultiplayerConnectScreenProps<TGameMessage extends BaseMultiplayerMessage> = Pick<
  OnlineGameSetupProps<TGameMessage>,
  "lobby" | "title" | "subtitle" | "createLabel" | "joinLabel"
> & {
  busy: boolean;
};

function MultiplayerConnectScreen<TGameMessage extends BaseMultiplayerMessage>({
  lobby,
  title,
  subtitle,
  busy,
  createLabel,
  joinLabel,
}: MultiplayerConnectScreenProps<TGameMessage>): React.ReactElement {
  const { t } = useTranslation();
  const [joinCode, setJoinCode] = useState("");
  const canCreate = !busy;
  const canJoin = joinCode.trim().length > 0 && !busy;

  return (
    <section className="online-setup online-setup--connect" aria-label={title} data-status={lobby.status}>
      <span className="online-setup__emblem" aria-hidden="true">
        <span>×</span>
        <span>○</span>
      </span>

      <header className="online-setup__header">
        <PlayerIdentity lobby={lobby} />
        <div className="online-setup__heading">
          <span className="online-setup__eyebrow">{t("multiplayer.eyebrow")}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>

      <div className="online-setup__actions">
        <button type="button" className="online-setup__primary" onClick={() => void lobby.host()} disabled={!canCreate}>
          {createLabel}
        </button>

        <form
          className="online-setup__join"
          onSubmit={(event) => {
            event.preventDefault();
            if (canJoin) void lobby.join(joinCode);
          }}
        >
          <label htmlFor="online-room-code">{t("multiplayer.roomCode")}</label>
          <div className="online-setup__join-row">
            <input
              id="online-room-code"
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              placeholder="ABC12"
              disabled={busy}
              autoComplete="off"
            />
            <button type="submit" disabled={!canJoin}>
              {joinLabel}
            </button>
          </div>
        </form>
      </div>

      {lobby.error && <p className="online-setup__error">{formatMultiplayerError(lobby.error, t)}</p>}
    </section>
  );
}

type MultiplayerLobbyScreenProps<TGameMessage extends BaseMultiplayerMessage> = Pick<
  OnlineGameSetupProps<TGameMessage>,
  "lobby" | "title" | "minPlayers" | "maxPlayers"
> & {
  currentPlayers: number;
  statusText: string;
};

function MultiplayerLobbyScreen<TGameMessage extends BaseMultiplayerMessage>({
  lobby,
  title,
  minPlayers,
  maxPlayers,
  currentPlayers,
  statusText,
}: MultiplayerLobbyScreenProps<TGameMessage>): React.ReactElement {
  const { t } = useTranslation();
  const waitingForPlayers = Math.max(0, minPlayers - currentPlayers);
  const roomCode = lobby.roomCode ?? "";
  const roomTitle = roomCode ? t("multiplayer.roomTitle", { code: roomCode }) : title;

  return (
    <section className="online-setup online-setup--lobby" aria-label={roomTitle} data-status={lobby.status}>
      <header className="online-setup__header online-setup__header--compact">
        <div className="online-setup__lobby-title">
          <span className="online-setup__eyebrow">{t("multiplayer.lobby")}</span>
          <div className="online-setup__room-heading">
            <h2>{t("multiplayer.room")}</h2>
            {roomCode && (
              <button
                type="button"
                className="online-setup__room-code"
                onClick={() => void navigator.clipboard?.writeText(roomCode)}
                aria-label={t("multiplayer.copyRoomCode", { code: roomCode })}
              >
                <span>{roomCode}</span>
                <span aria-hidden="true">⧉</span>
              </button>
            )}
          </div>
          <p>{statusText}</p>
        </div>

        <div className="online-setup__capacity" aria-label={t("multiplayer.capacityAria", { current: currentPlayers, max: maxPlayers })}>
          <span className="online-setup__capacity-count">
            <strong>{currentPlayers}</strong>/<span>{maxPlayers}</span> {t("multiplayer.playersCount")}
          </span>
          <span
            className="online-setup__capacity-meter"
            style={{ "--online-capacity-columns": maxPlayers } as React.CSSProperties}
            aria-hidden="true"
          >
            {Array.from({ length: maxPlayers }, (_, index) => (
              <span key={index} className={index < currentPlayers ? "is-filled" : undefined} />
            ))}
          </span>
        </div>
      </header>

      <div className="online-setup__players" aria-label={t("multiplayer.playersList")}>
        <PlayerChip label={lobby.localPlayer.name} emoji={lobby.localPlayer.emoji} color={lobby.localPlayer.color} role={roleLabel(lobby.role, t)} />
        {lobby.remotePlayers.map((player) => (
          <PlayerChip key={player.id} label={player.name} emoji={player.emoji} color={player.color} role={t("multiplayer.connected")} />
        ))}
      </div>

      <p className="online-setup__hint">
        {waitingForPlayers > 0 ? t("multiplayer.waitingForPlayers", { count: waitingForPlayers }) : t("multiplayer.playersReady")}
      </p>

      {lobby.error && <p className="online-setup__error">{formatMultiplayerError(lobby.error, t)}</p>}

      <button type="button" className="online-setup__disconnect" onClick={lobby.close}>
        {t("multiplayer.disconnect")}
      </button>
    </section>
  );
}

export function InGameMultiplayerOverlay<TGameMessage extends BaseMultiplayerMessage = BaseMultiplayerMessage>({
  lobby,
  maxPlayers,
}: InGameMultiplayerOverlayProps<TGameMessage>): React.ReactElement | null {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (lobby.status !== "connected") return null;

  const currentPlayers = getCurrentPlayers(lobby);

  return (
    <div className="multiplayer-overlay">
      <button
        type="button"
        className="multiplayer-overlay__badge"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        👥 {currentPlayers}/{maxPlayers}
      </button>

      {open && (
        <div className="multiplayer-overlay__popup" role="dialog" aria-label={t("multiplayer.players")}>
          <strong>{t("multiplayer.players")}</strong>
          <ul>
            <li>{lobby.localPlayer.name}</li>
            {lobby.remotePlayers.map((player) => (
              <li key={player.id}>{player.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type PlayerIdentityProps<TGameMessage extends BaseMultiplayerMessage> = {
  lobby: UseMultiplayerLobbyResult<TGameMessage>;
};

function PlayerIdentity<TGameMessage extends BaseMultiplayerMessage>({ lobby }: PlayerIdentityProps<TGameMessage>): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="online-setup__player-card" title={lobby.localPlayer.name}>
      <span className="online-setup__avatar" style={{ color: lobby.localPlayer.color }} aria-hidden>
        {lobby.localPlayer.emoji}
      </span>
      <span>
        <small>{t("multiplayer.playingAs")}</small>
        <strong>{lobby.localPlayer.name}</strong>
      </span>
    </div>
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

function getCurrentPlayers<TGameMessage extends BaseMultiplayerMessage>(lobby: UseMultiplayerLobbyResult<TGameMessage>): number {
  return 1 + lobby.remotePlayers.length;
}

function getStatusText(status: OnlineGameSetupStatus, canStart: boolean, t: TranslationFunction): string {
  switch (status) {
    case "idle":
      return t("multiplayer.status.idle");
    case "hosting":
      return t("multiplayer.status.hosting");
    case "joining":
      return t("multiplayer.status.joining");
    case "connected":
      return canStart ? t("multiplayer.status.connectedReady") : t("multiplayer.status.connectedWaiting");
    case "closed":
      return t("multiplayer.status.closed");
    case "error":
      return t("multiplayer.status.error");
    default:
      return t("multiplayer.status.unknown");
  }
}

function roleLabel(role: OnlineGameSetupRole, t: TranslationFunction): string {
  if (role === "host") return t("multiplayer.role.host");
  if (role === "guest") return t("multiplayer.role.guest");
  return t("multiplayer.role.local");
}

function formatMultiplayerError(error: { message: string; i18nKey?: string }, t: TranslationFunction): string {
  return error.i18nKey ? t(error.i18nKey) : error.message;
}

export default OnlineGameSetup;
