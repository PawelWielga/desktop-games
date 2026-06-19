import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameStartMenu, type GameStartMenuAction } from "@/components/GameStartMenu";
import { useTranslation, type TranslationFunction } from "@/i18n/useTranslation";
import { InGameMultiplayerOverlay, MultiplayerPanel, useMultiplayerLobby } from "@/multiplayer";
import type {
  GameResetMessage,
  GameSpecificMessage,
  GameStartMessage,
  MultiplayerRole,
  OutgoingMultiplayerMessage,
} from "@/multiplayer";
import {
  BOARD_SIZE,
  FLEET,
  type BoardCell,
  type Orientation,
  type TargetCell,
  chooseAiShot,
  createEmptyBoard,
  createEmptyTargetBoard,
  createRandomFleetBoard,
  getPlacedShipIds,
  isFleetPlaced,
  isValidIndex,
  markTargetShot,
  placeShip,
  receiveShot,
  removeShip,
  toCoordinate,
} from "./battleships.logic";
import "./battleships.css";

type GameMode = "menu" | "singleSetup" | "single" | "onlineLobby" | "onlineSetup" | "online";
type PlayerTurn = "player" | "opponent";
type BattleshipsReadyMessage = GameSpecificMessage<"battleships:ready", { ready: boolean }>;
type BattleshipsShotMessage = GameSpecificMessage<"battleships:shot", { cell: number }>;
type BattleshipsShotResultMessage = GameSpecificMessage<
  "battleships:shot-result",
  {
    cell: number;
    hit: boolean;
    sunk: boolean;
    allSunk: boolean;
    shipCells: number[];
  }
>;
type BattleshipsMessage =
  | BattleshipsReadyMessage
  | BattleshipsShotMessage
  | BattleshipsShotResultMessage
  | GameResetMessage
  | GameStartMessage;

export default function BattleshipsGame(): React.ReactElement {
  const { t } = useTranslation();
  const [mode, setMode] = useState<GameMode>("menu");
  const [ownBoard, setOwnBoard] = useState<BoardCell[]>(() => createEmptyBoard());
  const [enemyBoard, setEnemyBoard] = useState<BoardCell[]>(() => createEmptyBoard());
  const [targetBoard, setTargetBoard] = useState<TargetCell[]>(() => createEmptyTargetBoard());
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [turn, setTurn] = useState<PlayerTurn>("player");
  const [turnRole, setTurnRole] = useState<MultiplayerRole>("host");
  const [winner, setWinner] = useState<PlayerTurn | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [pendingShot, setPendingShot] = useState<number | null>(null);

  const modeRef = useRef(mode);
  const ownBoardRef = useRef(ownBoard);
  const enemyBoardRef = useRef(enemyBoard);
  const targetBoardRef = useRef(targetBoard);
  const lobbyRoleRef = useRef<MultiplayerRole | null>(null);
  const localPlayerIdRef = useRef<string | null>(null);
  const opponentPlayerIdRef = useRef<string | null>(null);
  const pendingShotRef = useRef<number | null>(null);
  const sendMessageRef = useRef<((message: OutgoingMultiplayerMessage<BattleshipsMessage>) => boolean) | null>(null);

  const syncOwnBoard = useCallback((board: BoardCell[]) => {
    ownBoardRef.current = board;
    setOwnBoard(board);
  }, []);

  const syncEnemyBoard = useCallback((board: BoardCell[]) => {
    enemyBoardRef.current = board;
    setEnemyBoard(board);
  }, []);

  const syncTargetBoard = useCallback((board: TargetCell[]) => {
    targetBoardRef.current = board;
    setTargetBoard(board);
  }, []);

  const syncPendingShot = useCallback((cell: number | null) => {
    pendingShotRef.current = cell;
    setPendingShot(cell);
  }, []);

  const resetBoards = useCallback(() => {
    syncOwnBoard(createEmptyBoard());
    syncEnemyBoard(createEmptyBoard());
    syncTargetBoard(createEmptyTargetBoard());
    syncPendingShot(null);
    setLocalReady(false);
    setRemoteReady(false);
    setWinner(null);
    setTurn("player");
    setTurnRole("host");
  }, [syncEnemyBoard, syncOwnBoard, syncPendingShot, syncTargetBoard]);

  const resetOnlineSetup = useCallback(() => {
    syncOwnBoard(createEmptyBoard());
    syncTargetBoard(createEmptyTargetBoard());
    syncPendingShot(null);
    setLocalReady(false);
    setRemoteReady(false);
    setWinner(null);
    setTurnRole("host");
    setMode("onlineSetup");
  }, [syncOwnBoard, syncPendingShot, syncTargetBoard]);

  const handleRemoteMessage = useCallback(
    (message: BattleshipsMessage) => {
      const localRole = lobbyRoleRef.current;
      if (!localRole) return;

      if (message.senderId && message.senderId === localPlayerIdRef.current) return;

      if (message.type === "battleships:ready") {
        if (message.senderId === opponentPlayerIdRef.current || !opponentPlayerIdRef.current) {
          setRemoteReady(Boolean(message.ready));
        }
        return;
      }

      if (message.type === "game:start") {
        if (localRole === "guest") {
          syncTargetBoard(createEmptyTargetBoard());
          syncPendingShot(null);
          setWinner(null);
          setTurnRole("host");
          setMode("online");
        }
        return;
      }

      if (message.type === "game:reset") {
        resetOnlineSetup();
        return;
      }

      if (message.type === "battleships:shot") {
        if (modeRef.current !== "online" || !isValidIndex(message.cell)) return;

        const shot = receiveShot(ownBoardRef.current, message.cell);
        if (!shot.valid) return;

        syncOwnBoard(shot.board);
        sendMessageRef.current?.({
          type: "battleships:shot-result",
          cell: message.cell,
          hit: shot.hit,
          sunk: shot.sunk,
          allSunk: shot.allSunk,
          shipCells: shot.shipCells,
        });

        if (shot.allSunk) {
          setWinner("opponent");
          return;
        }

        setTurnRole(shot.hit ? getOpponentRole(localRole) : localRole);
        return;
      }

      if (message.type === "battleships:shot-result") {
        if (modeRef.current !== "online" || pendingShotRef.current !== message.cell) return;

        const nextTargetBoard = markTargetShot(
          targetBoardRef.current,
          message.cell,
          Boolean(message.hit),
          Boolean(message.sunk),
          Array.isArray(message.shipCells) ? message.shipCells : []
        );
        syncTargetBoard(nextTargetBoard);
        syncPendingShot(null);

        if (message.allSunk) {
          setWinner("player");
          return;
        }

        setTurnRole(message.hit ? localRole : getOpponentRole(localRole));
      }
    },
    [resetOnlineSetup, syncOwnBoard, syncPendingShot, syncTargetBoard]
  );

  const lobby = useMultiplayerLobby<BattleshipsMessage>({ onGameMessage: handleRemoteMessage });
  const placedShipIds = useMemo(() => getPlacedShipIds(ownBoard), [ownBoard]);
  const nextShip = FLEET.find((ship) => !placedShipIds.includes(ship.id)) ?? null;
  const ownFleetReady = isFleetPlaced(ownBoard);
  const onlinePlayers = 1 + lobby.remotePlayers.length;
  const onlineReady = lobby.status === "connected" && onlinePlayers >= 2;
  const isOnlineHost = lobby.role === "host";
  const isMyOnlineTurn = mode === "online" && lobby.role === turnRole && pendingShot === null && !winner;

  useEffect(() => {
    sendMessageRef.current = lobby.sendMessage;
  }, [lobby.sendMessage]);

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
    if (mode !== "single" || turn !== "opponent" || winner) return undefined;

    const timeoutId = window.setTimeout(() => {
      const cell = chooseAiShot(ownBoardRef.current);
      if (cell === null) return;

      const shot = receiveShot(ownBoardRef.current, cell);
      if (!shot.valid) return;

      syncOwnBoard(shot.board);

      if (shot.allSunk) {
        setWinner("opponent");
        return;
      }

      setTurn(shot.hit ? "opponent" : "player");
    }, 520);

    return () => window.clearTimeout(timeoutId);
  }, [mode, syncOwnBoard, turn, winner]);

  const startSingleSetup = () => {
    resetBoards();
    syncEnemyBoard(createRandomFleetBoard());
    setMode("singleSetup");
  };

  const startOnlineLobby = () => {
    resetBoards();
    setMode("onlineLobby");
  };

  const backToMenu = () => {
    lobby.close();
    resetBoards();
    setMode("menu");
  };

  const placeNextShip = (cell: number) => {
    if (!nextShip || (mode !== "singleSetup" && mode !== "onlineSetup")) return;

    const withoutCurrentShip = removeShip(ownBoardRef.current, nextShip.id);
    const placement = placeShip(withoutCurrentShip, nextShip, cell, orientation);
    if (placement.placed) {
      syncOwnBoard(placement.board);
      setLocalReady(false);
    }
  };

  const randomizeOwnFleet = () => {
    syncOwnBoard(createRandomFleetBoard());
    setLocalReady(false);
  };

  const clearOwnFleet = () => {
    syncOwnBoard(createEmptyBoard());
    setLocalReady(false);
    setRemoteReady(false);
    if (mode === "onlineSetup" && lobby.status === "connected") {
      lobby.sendMessage({ type: "battleships:ready", ready: false });
    }
  };

  const confirmSingleFleet = () => {
    if (!ownFleetReady) return;

    syncTargetBoard(createEmptyTargetBoard());
    setTurn("player");
    setWinner(null);
    setMode("single");
  };

  const confirmOnlineFleet = () => {
    if (!ownFleetReady || lobby.status !== "connected") return;
    const sent = lobby.sendMessage({ type: "battleships:ready", ready: true });
    if (sent) setLocalReady(true);
  };

  const startOnlineGame = () => {
    if (!onlineReady || !isOnlineHost || !localReady || !remoteReady) return;

    const sent = lobby.sendMessage({ type: "game:start" });
    if (!sent) return;

    syncTargetBoard(createEmptyTargetBoard());
    syncPendingShot(null);
    setWinner(null);
    setTurnRole("host");
    setMode("online");
  };

  const resetGame = () => {
    if (mode === "single") {
      startSingleSetup();
      return;
    }

    if ((mode === "online" || mode === "onlineSetup") && isOnlineHost && lobby.status === "connected") {
      lobby.sendMessage({ type: "game:reset" });
      resetOnlineSetup();
    }
  };

  const shootSingle = (cell: number) => {
    if (mode !== "single" || turn !== "player" || winner || targetBoard[cell] !== "unknown") return;

    const shot = receiveShot(enemyBoardRef.current, cell);
    if (!shot.valid) return;

    syncEnemyBoard(shot.board);
    syncTargetBoard(markTargetShot(targetBoardRef.current, cell, shot.hit, shot.sunk, shot.shipCells));

    if (shot.allSunk) {
      setWinner("player");
      return;
    }

    setTurn(shot.hit ? "player" : "opponent");
  };

  const shootOnline = (cell: number) => {
    if (!isMyOnlineTurn || targetBoard[cell] !== "unknown") return;

    const sent = lobby.sendMessage({ type: "battleships:shot", cell });
    if (!sent) return;

    const nextTargetBoard = targetBoardRef.current.slice();
    nextTargetBoard[cell] = "pending";
    syncTargetBoard(nextTargetBoard);
    syncPendingShot(cell);
  };

  const menuActions: GameStartMenuAction[] = [
    {
      id: "ai",
      title: t("battleships.ai.title"),
      description: t("battleships.ai.description"),
      icon: "⚓",
      variant: "green",
      onSelect: startSingleSetup,
    },
    {
      id: "online",
      title: t("battleships.online.title"),
      description: t("battleships.online.description"),
      icon: "🌊",
      actionLabel: t("battleships.online.join"),
      featured: true,
      variant: "blue",
      onSelect: startOnlineLobby,
    },
  ];

  if (mode === "menu") {
    return (
      <div className="battleships-root battleships-root--menu">
        <GameStartMenu title={t("apps.battleships")} subtitle={t("battleships.subtitle")} actions={menuActions} />
      </div>
    );
  }

  if (mode === "onlineLobby") {
    return (
      <div className="battleships-root battleships-root--lobby">
        <TopActions onBack={backToMenu} t={t} />
        <MultiplayerPanel lobby={lobby} title={t("battleships.online.title")} minPlayers={2} maxPlayers={2} />

        {onlineReady && (
          <button type="button" className="battleships-primary" onClick={() => setMode("onlineSetup")}>
            {t("battleships.placeFleet")}
          </button>
        )}
      </div>
    );
  }

  if (mode === "singleSetup" || mode === "onlineSetup") {
    const onlineConfirmed = mode === "onlineSetup" && localReady;
    const canStartOnline = mode === "onlineSetup" && isOnlineHost && localReady && remoteReady && onlineReady;

    return (
      <div className="battleships-root battleships-root--setup">
        <TopActions onBack={backToMenu} t={t} />
        {mode === "onlineSetup" && <InGameMultiplayerOverlay lobby={lobby} maxPlayers={2} />}

        <PlacementPanel
          board={ownBoard}
          nextShip={nextShip}
          orientation={orientation}
          placedCount={placedShipIds.length}
          ownFleetReady={ownFleetReady}
          remoteReady={remoteReady}
          onlineMode={mode === "onlineSetup"}
          onlineConfirmed={onlineConfirmed}
          canStartOnline={canStartOnline}
          onCellClick={placeNextShip}
          onRotate={() => setOrientation((value) => (value === "horizontal" ? "vertical" : "horizontal"))}
          onRandomize={randomizeOwnFleet}
          onClear={clearOwnFleet}
          onConfirm={mode === "singleSetup" ? confirmSingleFleet : confirmOnlineFleet}
          onStartOnline={startOnlineGame}
          t={t}
        />
      </div>
    );
  }

  const status = getStatusText(mode, turn, turnRole, lobby.role, winner, pendingShot, t);
  const canShoot = mode === "single" ? turn === "player" && !winner : isMyOnlineTurn;

  return (
    <div className="battleships-root battleships-root--play">
      <div className="battleships-topbar">
        <TopActions onBack={backToMenu} t={t} />
        {mode === "online" && <InGameMultiplayerOverlay lobby={lobby} maxPlayers={2} />}
        <button type="button" className="battleships-secondary" onClick={resetGame} disabled={mode === "online" && !isOnlineHost}>
          {t("battleships.reset")}
        </button>
      </div>

      <section className="battleships-status" aria-live="polite">
        <strong>{status}</strong>
        <span>{t("battleships.ruleHint")}</span>
      </section>

      <div className="battleships-boards">
        <BattleBoard
          title={t("battleships.yourBoard")}
          description={t("battleships.yourBoardDescription")}
          board={ownBoard}
          revealShips
          disabled
          t={t}
        />
        <BattleBoard
          title={t("battleships.targetBoard")}
          description={t("battleships.targetBoardDescription")}
          targetBoard={targetBoard}
          canShoot={canShoot}
          onCellClick={mode === "single" ? shootSingle : shootOnline}
          t={t}
        />
      </div>
    </div>
  );
}

type TopActionsProps = {
  onBack: () => void;
  t: TranslationFunction;
};

function TopActions({ onBack, t }: TopActionsProps): React.ReactElement {
  return (
    <button type="button" className="battleships-back" onClick={onBack}>
      {t("battleships.backToMenu")}
    </button>
  );
}

type PlacementPanelProps = {
  board: BoardCell[];
  nextShip: (typeof FLEET)[number] | null;
  orientation: Orientation;
  placedCount: number;
  ownFleetReady: boolean;
  remoteReady: boolean;
  onlineMode: boolean;
  onlineConfirmed: boolean;
  canStartOnline: boolean;
  onCellClick: (cell: number) => void;
  onRotate: () => void;
  onRandomize: () => void;
  onClear: () => void;
  onConfirm: () => void;
  onStartOnline: () => void;
  t: TranslationFunction;
};

function PlacementPanel({
  board,
  nextShip,
  orientation,
  placedCount,
  ownFleetReady,
  remoteReady,
  onlineMode,
  onlineConfirmed,
  canStartOnline,
  onCellClick,
  onRotate,
  onRandomize,
  onClear,
  onConfirm,
  onStartOnline,
  t,
}: PlacementPanelProps): React.ReactElement {
  return (
    <section className="battleships-setup-panel">
      <div className="battleships-setup-copy">
        <span className="battleships-eyebrow">{t("battleships.setupEyebrow")}</span>
        <h2>{t("battleships.setupTitle")}</h2>
        <p>
          {nextShip
            ? t("battleships.nextShip", { ship: t(nextShip.labelKey), length: nextShip.length })
            : t("battleships.allShipsPlaced")}
        </p>
        <span className="battleships-progress">
          {t("battleships.progress", { placed: placedCount, total: FLEET.length })}
        </span>
      </div>

      <BattleBoard
        title={t("battleships.yourBoard")}
        description={t("battleships.setupBoardDescription")}
        board={board}
        revealShips
        setupMode
        onCellClick={onCellClick}
        t={t}
      />

      <div className="battleships-controls">
        <button type="button" className="battleships-secondary" onClick={onRotate}>
          {t("battleships.orientation", { orientation: t(`battleships.orientation.${orientation}`) })}
        </button>
        <button type="button" className="battleships-secondary" onClick={onRandomize}>
          {t("battleships.randomFleet")}
        </button>
        <button type="button" className="battleships-secondary" onClick={onClear}>
          {t("battleships.clearFleet")}
        </button>
        <button type="button" className="battleships-primary" onClick={onConfirm} disabled={!ownFleetReady}>
          {onlineMode ? t("battleships.ready") : t("battleships.startBattle")}
        </button>
        {onlineMode && (
          <button type="button" className="battleships-primary" onClick={onStartOnline} disabled={!canStartOnline}>
            {t("battleships.startOnline")}
          </button>
        )}
      </div>

      {onlineMode && (
        <p className="battleships-online-note">
          {onlineConfirmed && remoteReady
            ? t("battleships.bothReady")
            : onlineConfirmed
              ? t("battleships.waitingForOpponentReady")
              : t("battleships.readyHint")}
        </p>
      )}
    </section>
  );
}

type BattleBoardProps = {
  title: string;
  description: string;
  board?: BoardCell[];
  targetBoard?: TargetCell[];
  revealShips?: boolean;
  setupMode?: boolean;
  disabled?: boolean;
  canShoot?: boolean;
  onCellClick?: (cell: number) => void;
  t: TranslationFunction;
};

function BattleBoard({
  title,
  description,
  board,
  targetBoard,
  revealShips = false,
  setupMode = false,
  disabled = false,
  canShoot = false,
  onCellClick,
  t,
}: BattleBoardProps): React.ReactElement {
  return (
    <section className="battleships-board-card">
      <header>
        <h3>{title}</h3>
        <p>{description}</p>
      </header>

      <div className="battleships-grid" role="grid" aria-label={title}>
        {Array.from({ length: BOARD_SIZE }, (_, index) => (
          <span key={`col-${index}`} className="battleships-axis battleships-axis--column">
            {String.fromCharCode(65 + index)}
          </span>
        ))}
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
          const rowLabel = index % BOARD_SIZE === 0 ? toCoordinate(index).row + 1 : null;
          const cell = board?.[index];
          const target = targetBoard?.[index] ?? "unknown";
          const hasShip = Boolean(cell?.shipId);
          const shot = Boolean(cell?.shot);
          const marker = getCellMarker(hasShip, shot, target, revealShips, t);
          const className = [
            "battleships-cell",
            hasShip && revealShips ? "battleships-cell--ship" : "",
            shot && hasShip ? "battleships-cell--hit" : "",
            shot && !hasShip ? "battleships-cell--miss" : "",
            target !== "unknown" ? `battleships-cell--${target}` : "",
            setupMode ? "battleships-cell--setup" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <React.Fragment key={index}>
              {rowLabel !== null && <span className="battleships-axis battleships-axis--row">{rowLabel}</span>}
              <button
                type="button"
                className={className}
                onClick={() => onCellClick?.(index)}
                disabled={disabled || (!setupMode && !canShoot) || target !== "unknown"}
                aria-label={getCellAriaLabel(index, marker, t)}
              >
                {marker}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

function getCellMarker(
  hasShip: boolean,
  shot: boolean,
  target: TargetCell,
  revealShips: boolean,
  t: TranslationFunction
): string {
  if (target === "pending") return "…";
  if (target === "miss") return "•";
  if (target === "hit") return "×";
  if (target === "sunk") return "✹";
  if (shot && hasShip) return "×";
  if (shot) return "•";
  if (hasShip && revealShips) return "■";
  return t("battleships.emptyCell");
}

function getCellAriaLabel(index: number, marker: string, t: TranslationFunction): string {
  const { row, col } = toCoordinate(index);
  return t("battleships.cellAria", {
    coordinate: `${String.fromCharCode(65 + col)}${row + 1}`,
    marker: marker.trim() || t("battleships.empty"),
  });
}

function getStatusText(
  mode: GameMode,
  turn: PlayerTurn,
  turnRole: MultiplayerRole,
  myRole: MultiplayerRole | null,
  winner: PlayerTurn | null,
  pendingShot: number | null,
  t: TranslationFunction
): string {
  if (winner === "player") return t("battleships.winner.player");
  if (winner === "opponent") return t("battleships.winner.opponent");
  if (pendingShot !== null) return t("battleships.waitingForShotResult");

  if (mode === "single") {
    return turn === "player" ? t("battleships.turn.player") : t("battleships.turn.ai");
  }

  return turnRole === myRole ? t("battleships.turn.player") : t("battleships.turn.opponent");
}

function getOpponentRole(role: MultiplayerRole): MultiplayerRole {
  return role === "host" ? "guest" : "host";
}
