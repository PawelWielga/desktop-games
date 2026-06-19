import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameStartMenu, type GameStartMenuAction } from "@/components/GameStartMenu";
import { useTranslation, type TranslationFunction } from "@/i18n/useTranslation";
import { InGameMultiplayerOverlay, MultiplayerPanel, useMultiplayerLobby } from "@/multiplayer";
import type { GameResetMessage, GameSpecificMessage, GameStartMessage, MultiplayerRole } from "@/multiplayer";
import {
  applyMove as applyTicTacToeMove,
  chooseAiMove,
  emptyBoard,
  getOpponentRole,
  getWinResult,
  isDraw,
  isLegalOnlineMove,
  type CellValue,
  type PlayerSymbol,
  type WinningLine,
} from "./tictactoe.logic";
import "./tictactoe.css";

type GameMode = "menu" | "local" | "ai" | "onlineLobby" | "online";
type TicTacToeMoveMessage = GameSpecificMessage<"tictactoe:move", { cell: number; symbol: PlayerSymbol }>;
type TicTacToeMessage = TicTacToeMoveMessage | GameResetMessage | GameStartMessage;

export default function TicTacToeGame(): React.ReactElement {
  const { t } = useTranslation();
  const [mode, setMode] = useState<GameMode>("menu");
  const [board, setBoard] = useState<CellValue[]>(() => emptyBoard());
  const [turn, setTurn] = useState<PlayerSymbol>("X");
  const boardRef = useRef<CellValue[]>(emptyBoard());
  const turnRef = useRef<PlayerSymbol>("X");
  const lobbyRoleRef = useRef<MultiplayerRole | null>(null);
  const localPlayerIdRef = useRef<string | null>(null);
  const opponentPlayerIdRef = useRef<string | null>(null);

  const resetBoard = useCallback(() => {
    const nextBoard = emptyBoard();
    boardRef.current = nextBoard;
    turnRef.current = "X";
    setBoard(nextBoard);
    setTurn("X");
  }, []);

  const applyMove = useCallback((cell: number, symbol: PlayerSymbol) => {
    const result = applyTicTacToeMove(boardRef.current, cell, symbol);
    if (!result.moved) return false;

    boardRef.current = result.board;
    turnRef.current = result.nextTurn;
    setBoard(result.board);
    setTurn(result.nextTurn);
    return true;
  }, []);

  const handleRemoteMessage = useCallback(
    (message: TicTacToeMessage) => {
      if (message.type === "game:start") {
        if (lobbyRoleRef.current === "guest") {
          resetBoard();
          setMode("online");
        }
        return;
      }

      if (message.type === "game:reset") {
        if (lobbyRoleRef.current === "guest") {
          resetBoard();
        }
        return;
      }

      if (message.type === "tictactoe:move") {
        const localRole = lobbyRoleRef.current;
        if (!localRole) return;

        const senderRole = getOpponentRole(localRole);
        const isLegalRemoteMove = isLegalOnlineMove({
          board: boardRef.current,
          cell: message.cell,
          symbol: message.symbol,
          turn: turnRef.current,
          senderRole,
          senderId: message.senderId,
          expectedSenderId: opponentPlayerIdRef.current,
        });

        if (isLegalRemoteMove) applyMove(message.cell, message.symbol);
      }
    },
    [applyMove, resetBoard]
  );

  const lobby = useMultiplayerLobby<TicTacToeMessage>({ onGameMessage: handleRemoteMessage });
  const winResult = useMemo(() => getWinResult(board), [board]);
  const winner = winResult?.symbol ?? null;
  const winningLineClass = winResult ? getWinningLineClass(winResult.line) : null;
  const draw = useMemo(() => isDraw(board), [board]);
  const onlinePlayers = 1 + lobby.remotePlayers.length;
  const onlineReady = lobby.status === "connected" && onlinePlayers >= 2;
  const myOnlineSymbol: PlayerSymbol | null = lobby.role === "host" ? "X" : lobby.role === "guest" ? "O" : null;
  const isOnlineHost = lobby.role === "host";

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
    if (mode === "ai" && turn === "O" && !winner && !draw) {
      const timeoutId = window.setTimeout(() => {
        const aiCell = chooseAiMove(boardRef.current, "O", "X");
        if (aiCell !== null) applyMove(aiCell, "O");
      }, 320);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [applyMove, draw, mode, turn, winner]);

  const startMode = (nextMode: GameMode) => {
    resetBoard();
    setMode(nextMode);
  };

  const startOnlineGame = () => {
    if (!onlineReady || !isOnlineHost) return;

    const sent = lobby.sendMessage({ type: "game:start" });
    if (sent) startMode("online");
  };

  const backToMenu = () => {
    lobby.close();
    resetBoard();
    setMode("menu");
  };

  const resetGame = () => {
    if (mode === "online") {
      if (!isOnlineHost || lobby.status !== "connected") return;

      const sent = lobby.sendMessage({ type: "game:reset" });
      if (sent) resetBoard();
      return;
    }

    resetBoard();
  };

  const playCell = (cell: number) => {
    if (board[cell] !== null || winner || draw) return;

    if (mode === "local") {
      applyMove(cell, turn);
      return;
    }

    if (mode === "ai") {
      if (turn === "X") applyMove(cell, "X");
      return;
    }

    if (mode === "online" && myOnlineSymbol === turn && lobby.status === "connected" && lobby.role) {
      const isLegalLocalMove = isLegalOnlineMove({
        board: boardRef.current,
        cell,
        symbol: myOnlineSymbol,
        turn: turnRef.current,
        senderRole: lobby.role,
        senderId: localPlayerIdRef.current ?? undefined,
        expectedSenderId: localPlayerIdRef.current,
      });

      if (!isLegalLocalMove) return;

      const sent = lobby.sendMessage({ type: "tictactoe:move", cell, symbol: myOnlineSymbol });
      if (sent) applyMove(cell, myOnlineSymbol);
    }
  };

  const menuActions: GameStartMenuAction[] = [
    {
      id: "local",
      title: t("tictactoe.local.title"),
      description: t("tictactoe.local.description"),
      icon: "♟",
      variant: "mint",
      onSelect: () => startMode("local"),
    },
    {
      id: "ai",
      title: t("tictactoe.ai.title"),
      description: t("tictactoe.ai.description"),
      icon: "▣",
      variant: "green",
      onSelect: () => startMode("ai"),
    },
    {
      id: "online",
      title: t("tictactoe.online.title"),
      description: t("tictactoe.online.description"),
      icon: "◎",
      actionLabel: t("tictactoe.online.join"),
      featured: true,
      variant: "blue",
      onSelect: () => startMode("onlineLobby"),
    },
  ];

  if (mode === "menu") {
    return (
      <div className="ttt-root ttt-root--menu">
        <GameStartMenu
          title={t("apps.tictactoe")}
          subtitle={t("tictactoe.subtitle")}
          actions={menuActions}
        />
      </div>
    );
  }

  if (mode === "onlineLobby") {
    return (
      <div className="ttt-root ttt-root--lobby">
        <div className="ttt-screen-actions">
          <button type="button" className="ttt-link-button" onClick={backToMenu}>
            {t("tictactoe.backToMenu")}
          </button>
        </div>

        <MultiplayerPanel lobby={lobby} title={t("tictactoe.online.title")} minPlayers={2} maxPlayers={2} />

        {onlineReady && isOnlineHost && (
          <button type="button" className="ttt-start-online" onClick={startOnlineGame}>
            {t("tictactoe.startGame")}
          </button>
        )}

        {onlineReady && !isOnlineHost && <p className="ttt-online-note">{t("tictactoe.waitingForHost")}</p>}
      </div>
    );
  }

  const playerLabel = getPlayerLabel(mode, turn, myOnlineSymbol, t);
  const canPlay = canPlayInMode(mode, turn, myOnlineSymbol, lobby.status, winner, draw);

  return (
    <div className="ttt-root ttt-root--play">
      <div className="ttt-topbar">
        <button type="button" className="ttt-link-button" onClick={backToMenu}>
          {t("tictactoe.backToMenu")}
        </button>
        {mode === "online" && <InGameMultiplayerOverlay lobby={lobby} maxPlayers={2} />}
      </div>

      <section className="ttt-game" aria-label={t("tictactoe.boardAria")}>
        <div className="ttt-status">
          <span>{playerLabel}</span>
          <span>{t("tictactoe.turn", { turn })}</span>
          {winner && <strong>{t("tictactoe.winner", { winner })}</strong>}
          {draw && <strong>{t("tictactoe.draw")}</strong>}
        </div>

        <div
          className={["ttt-board", winningLineClass ? "ttt-board--won" : "", winningLineClass].filter(Boolean).join(" ")}
          role="grid"
          aria-label={t("tictactoe.boardGridAria")}
        >
          {board.map((value, index) => (
            <button
              key={index}
              type="button"
              className="ttt-cell"
              onClick={() => playCell(index)}
              disabled={!canPlay || value !== null}
              aria-label={t("tictactoe.cellAria", { index: index + 1, value: value ? `, ${value}` : "" })}
            >
              {value}
            </button>
          ))}
          {winningLineClass && <span className="ttt-winning-line" aria-hidden="true" />}
        </div>

        {mode !== "online" || isOnlineHost ? (
          <button type="button" className="ttt-reset" onClick={resetGame}>
            {t("tictactoe.reset")}
          </button>
        ) : (
          <p className="ttt-online-note">{t("tictactoe.hostOnlyReset")}</p>
        )}
      </section>
    </div>
  );
}

function getWinningLineClass(line: WinningLine): string {
  const key = line.join("-");

  if (key === "0-1-2") return "ttt-board--win-row-0";
  if (key === "3-4-5") return "ttt-board--win-row-1";
  if (key === "6-7-8") return "ttt-board--win-row-2";
  if (key === "0-3-6") return "ttt-board--win-col-0";
  if (key === "1-4-7") return "ttt-board--win-col-1";
  if (key === "2-5-8") return "ttt-board--win-col-2";
  if (key === "0-4-8") return "ttt-board--win-diagonal-down";
  return "ttt-board--win-diagonal-up";
}

function canPlayInMode(
  mode: GameMode,
  turn: PlayerSymbol,
  myOnlineSymbol: PlayerSymbol | null,
  onlineStatus: string,
  winner: PlayerSymbol | null,
  draw: boolean
): boolean {
  if (winner || draw) return false;
  if (mode === "local") return true;
  if (mode === "ai") return turn === "X";
  if (mode === "online") return onlineStatus === "connected" && myOnlineSymbol === turn;
  return false;
}

function getPlayerLabel(mode: GameMode, turn: PlayerSymbol, myOnlineSymbol: PlayerSymbol | null, t: TranslationFunction): string {
  if (mode === "local") return t("tictactoe.label.local");
  if (mode === "ai") return turn === "X" ? t("tictactoe.label.yourMove") : t("tictactoe.label.aiMove");
  if (mode === "online") return t("tictactoe.label.onlineSymbol", { symbol: myOnlineSymbol ?? t("tictactoe.label.noSymbol") });
  return t("tictactoe.label.chooseMode");
}
