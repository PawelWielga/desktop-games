import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameStartMenu, type GameStartMenuAction } from "@/components/GameStartMenu";
import { useTranslation, type TranslationFunction } from "@/i18n/useTranslation";
import { InGameMultiplayerOverlay, MultiplayerPanel, useMultiplayerLobby } from "@/multiplayer";
import type { GameResetMessage, GameSpecificMessage, GameStartMessage, MultiplayerRole } from "@/multiplayer";
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_LEFT,
  GOAL_RIGHT,
  applyPaperSoccerMove,
  chooseAiMove,
  createInitialPaperSoccerState,
  getAttackedGoal,
  getLegalMoves,
  isBoundaryPoint,
  samePoint,
  toPointKey,
  type PaperSoccerMoveResult,
  type PaperSoccerPlayer,
  type PaperSoccerPoint,
  type PaperSoccerState,
} from "./paperSoccer.logic";
import "./paperSoccer.css";

type GameMode = "menu" | "single" | "onlineLobby" | "online";
type PaperSoccerMoveMessage = GameSpecificMessage<"paper-soccer:move", { target: PaperSoccerPoint }>;
type PaperSoccerMessage = PaperSoccerMoveMessage | GameResetMessage | GameStartMessage;

const SVG_MARGIN = 34;
const SVG_CELL = 42;
const SVG_WIDTH = FIELD_WIDTH * SVG_CELL + SVG_MARGIN * 2;
const SVG_HEIGHT = (FIELD_HEIGHT + 2) * SVG_CELL + SVG_MARGIN * 2;

export default function PaperSoccerGame(): React.ReactElement {
  const { t } = useTranslation();
  const [mode, setMode] = useState<GameMode>("menu");
  const [state, setState] = useState<PaperSoccerState>(() => createInitialPaperSoccerState());
  const [lastMove, setLastMove] = useState<PaperSoccerMoveResult | null>(null);
  const stateRef = useRef(state);
  const modeRef = useRef(mode);
  const lobbyRoleRef = useRef<MultiplayerRole | null>(null);
  const localPlayerIdRef = useRef<string | null>(null);
  const opponentPlayerIdRef = useRef<string | null>(null);

  const syncState = useCallback((nextState: PaperSoccerState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const resetMatch = useCallback(() => {
    const nextState = createInitialPaperSoccerState();
    setLastMove(null);
    syncState(nextState);
  }, [syncState]);

  const applyMove = useCallback(
    (target: PaperSoccerPoint) => {
      const result = applyPaperSoccerMove(stateRef.current, target);
      if (!result.moved) return false;

      setLastMove(result);
      syncState(result.state);
      return true;
    },
    [syncState]
  );

  const handleRemoteMessage = useCallback(
    (message: PaperSoccerMessage) => {
      if (message.senderId && message.senderId === localPlayerIdRef.current) return;

      if (message.type === "game:start") {
        if (lobbyRoleRef.current === "guest") {
          resetMatch();
          setMode("online");
        }
        return;
      }

      if (message.type === "game:reset") {
        resetMatch();
        return;
      }

      if (message.type === "paper-soccer:move") {
        if (modeRef.current !== "online") return;
        if (message.senderId && opponentPlayerIdRef.current && message.senderId !== opponentPlayerIdRef.current) return;

        const remotePlayer = getPlayerForRole(getOpponentRole(lobbyRoleRef.current));
        if (!remotePlayer || stateRef.current.turn !== remotePlayer) return;

        applyMove(message.target);
      }
    },
    [applyMove, resetMatch]
  );

  const lobby = useMultiplayerLobby<PaperSoccerMessage>({ onGameMessage: handleRemoteMessage });
  const legalMoves = useMemo(() => getLegalMoves(state), [state]);
  const onlinePlayers = 1 + lobby.remotePlayers.length;
  const onlineReady = lobby.status === "connected" && onlinePlayers >= 2;
  const isOnlineHost = lobby.role === "host";
  const onlinePlayer = getPlayerForRole(lobby.role);
  const canPlay = getCanPlay(mode, state, onlinePlayer, lobby.status);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    lobbyRoleRef.current = lobby.role;
  }, [lobby.role]);

  useEffect(() => {
    localPlayerIdRef.current = lobby.localPlayer.id;
  }, [lobby.localPlayer.id]);

  useEffect(() => {
    opponentPlayerIdRef.current = lobby.opponent?.id ?? null;
  }, [lobby.opponent?.id]);

  useEffect(() => {
    if (mode !== "single" || state.turn !== "away" || state.winner) return undefined;

    const timeoutId = window.setTimeout(() => {
      const aiMove = chooseAiMove(stateRef.current, "away");
      if (aiMove) applyMove(aiMove);
    }, 420);

    return () => window.clearTimeout(timeoutId);
  }, [applyMove, mode, state]);

  const startSingle = () => {
    resetMatch();
    setMode("single");
  };

  const startOnlineLobby = () => {
    resetMatch();
    setMode("onlineLobby");
  };

  const startOnlineGame = () => {
    if (!onlineReady || !isOnlineHost) return;

    const sent = lobby.sendMessage({ type: "game:start" });
    if (sent) {
      resetMatch();
      setMode("online");
    }
  };

  const backToMenu = () => {
    lobby.close();
    resetMatch();
    setMode("menu");
  };

  const resetGame = () => {
    if (mode === "online") {
      if (!isOnlineHost || lobby.status !== "connected") return;
      const sent = lobby.sendMessage({ type: "game:reset" });
      if (!sent) return;
    }

    resetMatch();
  };

  const playPoint = (target: PaperSoccerPoint) => {
    if (!canPlay || !legalMoves.some((point) => samePoint(point, target))) return;

    if (mode === "online") {
      const sent = lobby.sendMessage({ type: "paper-soccer:move", target });
      if (!sent) return;
    }

    applyMove(target);
  };

  const menuActions: GameStartMenuAction[] = [
    {
      id: "ai",
      title: t("paperSoccer.ai.title"),
      description: t("paperSoccer.ai.description"),
      icon: "✎",
      variant: "green",
      onSelect: startSingle,
    },
    {
      id: "online",
      title: t("paperSoccer.online.title"),
      description: t("paperSoccer.online.description"),
      icon: "⚽",
      actionLabel: t("paperSoccer.online.join"),
      featured: true,
      variant: "blue",
      onSelect: startOnlineLobby,
    },
  ];

  if (mode === "menu") {
    return (
      <div className="paper-soccer-root paper-soccer-root--menu">
        <GameStartMenu title={t("apps.paperSoccer")} subtitle={t("paperSoccer.subtitle")} actions={menuActions} />
      </div>
    );
  }

  if (mode === "onlineLobby") {
    return (
      <div className="paper-soccer-root paper-soccer-root--lobby">
        <TopActions onBack={backToMenu} t={t} />
        <MultiplayerPanel lobby={lobby} title={t("paperSoccer.online.title")} minPlayers={2} maxPlayers={2} />

        {onlineReady && isOnlineHost && (
          <button type="button" className="paper-soccer-primary" onClick={startOnlineGame}>
            {t("paperSoccer.startOnline")}
          </button>
        )}

        {onlineReady && !isOnlineHost && <p className="paper-soccer-note">{t("paperSoccer.waitingForHost")}</p>}
      </div>
    );
  }

  return (
    <div className="paper-soccer-root paper-soccer-root--play">
      <div className="paper-soccer-topbar">
        <TopActions onBack={backToMenu} t={t} />
        {mode === "online" && <InGameMultiplayerOverlay lobby={lobby} maxPlayers={2} />}
        <button type="button" className="paper-soccer-secondary" onClick={resetGame} disabled={mode === "online" && !isOnlineHost}>
          {t("paperSoccer.reset")}
        </button>
      </div>

      <section className="paper-soccer-status" aria-live="polite">
        <strong>{getStatusText(mode, state, onlinePlayer, lastMove, t)}</strong>
        <span>{t("paperSoccer.ruleHint")}</span>
      </section>

      <PaperSoccerBoard state={state} legalMoves={canPlay ? legalMoves : []} onPointClick={playPoint} t={t} />
    </div>
  );
}

type TopActionsProps = {
  onBack: () => void;
  t: TranslationFunction;
};

function TopActions({ onBack, t }: TopActionsProps): React.ReactElement {
  return (
    <button type="button" className="paper-soccer-back" onClick={onBack}>
      {t("paperSoccer.backToMenu")}
    </button>
  );
}

type PaperSoccerBoardProps = {
  state: PaperSoccerState;
  legalMoves: PaperSoccerPoint[];
  onPointClick: (point: PaperSoccerPoint) => void;
  t: TranslationFunction;
};

function PaperSoccerBoard({ state, legalMoves, onPointClick, t }: PaperSoccerBoardProps): React.ReactElement {
  const legalMoveKeys = new Set(legalMoves.map(toPointKey));
  const points = createVisiblePoints();

  return (
    <section className="paper-soccer-board-card">
      <div className="paper-soccer-scoreboard">
        <span>{t("paperSoccer.homeGoal")}</span>
        <span>{t("paperSoccer.attacks", { side: t(`paperSoccer.goal.${getAttackedGoal(state.turn)}`) })}</span>
      </div>

      <svg
        className="paper-soccer-board"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        role="img"
        aria-label={t("paperSoccer.boardAria")}
      >
        <g className="paper-soccer-grid" aria-hidden="true">
          {Array.from({ length: FIELD_WIDTH + 1 }, (_, x) => (
            <line key={`v-${x}`} x1={toSvgX(x)} y1={toSvgY(0)} x2={toSvgX(x)} y2={toSvgY(FIELD_HEIGHT)} />
          ))}
          {Array.from({ length: FIELD_HEIGHT + 1 }, (_, y) => (
            <line key={`h-${y}`} x1={toSvgX(0)} y1={toSvgY(y)} x2={toSvgX(FIELD_WIDTH)} y2={toSvgY(y)} />
          ))}
        </g>

        <path className="paper-soccer-outline" d={getOutlinePath()} aria-hidden="true" />

        <g className="paper-soccer-segments" aria-hidden="true">
          {state.segments.map((segment, index) => (
            <line
              key={`${index}-${toPointKey(segment.from)}-${toPointKey(segment.to)}`}
              className={`paper-soccer-segment paper-soccer-segment--${segment.player}`}
              x1={toSvgX(segment.from.x)}
              y1={toSvgY(segment.from.y)}
              x2={toSvgX(segment.to.x)}
              y2={toSvgY(segment.to.y)}
            />
          ))}
        </g>

        <g className="paper-soccer-points">
          {points.map((point) => {
            const pointKey = toPointKey(point);
            const isLegal = legalMoveKeys.has(pointKey);
            const isVisited = state.visitedPoints.includes(pointKey) || isBoundaryPoint(point);

            return (
              <circle
                key={pointKey}
                className={[
                  "paper-soccer-point",
                  isVisited ? "paper-soccer-point--visited" : "",
                  isLegal ? "paper-soccer-point--legal" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                cx={toSvgX(point.x)}
                cy={toSvgY(point.y)}
                r={isLegal ? 7 : 3}
                role={isLegal ? "button" : undefined}
                tabIndex={isLegal ? 0 : undefined}
                aria-label={isLegal ? t("paperSoccer.moveTo", { x: point.x, y: point.y }) : undefined}
                onClick={isLegal ? () => onPointClick(point) : undefined}
                onKeyDown={isLegal ? (event) => handlePointKeyDown(event, point, onPointClick) : undefined}
              />
            );
          })}
        </g>

        <circle className="paper-soccer-ball" cx={toSvgX(state.ball.x)} cy={toSvgY(state.ball.y)} r="10" aria-hidden="true" />
      </svg>
    </section>
  );
}

function getCanPlay(
  mode: GameMode,
  state: PaperSoccerState,
  onlinePlayer: PaperSoccerPlayer | null,
  onlineStatus: string
): boolean {
  if (state.winner) return false;
  if (mode === "single") return state.turn === "home";
  if (mode === "online") return onlineStatus === "connected" && state.turn === onlinePlayer;
  return false;
}

function getStatusText(
  mode: GameMode,
  state: PaperSoccerState,
  onlinePlayer: PaperSoccerPlayer | null,
  lastMove: PaperSoccerMoveResult | null,
  t: TranslationFunction
): string {
  if (state.winner === "home") return t("paperSoccer.winner.home");
  if (state.winner === "away") return t("paperSoccer.winner.away");
  if (lastMove?.blockedLoser) return t("paperSoccer.blocked", { player: getPlayerName(lastMove.blockedLoser, t) });
  if (lastMove?.bounce) return t("paperSoccer.bounce", { player: getPlayerName(state.turn, t) });
  if (mode === "single") return state.turn === "home" ? t("paperSoccer.turn.player") : t("paperSoccer.turn.ai");
  if (mode === "online" && onlinePlayer) {
    return state.turn === onlinePlayer ? t("paperSoccer.turn.player") : t("paperSoccer.turn.opponent");
  }

  return t("paperSoccer.turn.player");
}

function getPlayerName(player: PaperSoccerPlayer, t: TranslationFunction): string {
  return player === "home" ? t("paperSoccer.player.home") : t("paperSoccer.player.away");
}

function getPlayerForRole(role: MultiplayerRole | null): PaperSoccerPlayer | null {
  if (role === "host") return "home";
  if (role === "guest") return "away";
  return null;
}

function getOpponentRole(role: MultiplayerRole | null): MultiplayerRole | null {
  if (role === "host") return "guest";
  if (role === "guest") return "host";
  return null;
}

function handlePointKeyDown(
  event: React.KeyboardEvent<SVGCircleElement>,
  point: PaperSoccerPoint,
  onPointClick: (point: PaperSoccerPoint) => void
): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onPointClick(point);
}

function createVisiblePoints(): PaperSoccerPoint[] {
  const points: PaperSoccerPoint[] = [];
  for (let y = 0; y <= FIELD_HEIGHT; y += 1) {
    for (let x = 0; x <= FIELD_WIDTH; x += 1) {
      points.push({ x, y });
    }
  }

  for (let x = GOAL_LEFT; x <= GOAL_RIGHT; x += 1) {
    points.push({ x, y: -1 }, { x, y: FIELD_HEIGHT + 1 });
  }

  return points;
}

function getOutlinePath(): string {
  return [
    `M ${toSvgX(0)} ${toSvgY(0)}`,
    `L ${toSvgX(GOAL_LEFT)} ${toSvgY(0)}`,
    `L ${toSvgX(GOAL_LEFT)} ${toSvgY(-1)}`,
    `L ${toSvgX(GOAL_RIGHT)} ${toSvgY(-1)}`,
    `L ${toSvgX(GOAL_RIGHT)} ${toSvgY(0)}`,
    `L ${toSvgX(FIELD_WIDTH)} ${toSvgY(0)}`,
    `L ${toSvgX(FIELD_WIDTH)} ${toSvgY(FIELD_HEIGHT)}`,
    `L ${toSvgX(GOAL_RIGHT)} ${toSvgY(FIELD_HEIGHT)}`,
    `L ${toSvgX(GOAL_RIGHT)} ${toSvgY(FIELD_HEIGHT + 1)}`,
    `L ${toSvgX(GOAL_LEFT)} ${toSvgY(FIELD_HEIGHT + 1)}`,
    `L ${toSvgX(GOAL_LEFT)} ${toSvgY(FIELD_HEIGHT)}`,
    `L ${toSvgX(0)} ${toSvgY(FIELD_HEIGHT)}`,
    "Z",
  ].join(" ");
}

function toSvgX(x: number): number {
  return SVG_MARGIN + x * SVG_CELL;
}

function toSvgY(y: number): number {
  return SVG_MARGIN + (y + 1) * SVG_CELL;
}
