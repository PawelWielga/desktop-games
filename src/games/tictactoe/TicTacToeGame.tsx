import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameStartMenu, type GameStartMenuAction } from "@/components/GameStartMenu";
import { InGameMultiplayerOverlay, MultiplayerPanel, useMultiplayerLobby } from "@/multiplayer";
import type { GameResetMessage, GameSpecificMessage, GameStartMessage, MultiplayerRole } from "@/multiplayer";
import {
  applyMove as applyTicTacToeMove,
  chooseAiMove,
  emptyBoard,
  getWinResult,
  isDraw,
  type CellValue,
  type PlayerSymbol,
  type WinningLine,
} from "./tictactoe.logic";
import "./tictactoe.css";

type GameMode = "menu" | "local" | "ai" | "onlineLobby" | "online";
type TicTacToeMoveMessage = GameSpecificMessage<"tictactoe:move", { cell: number; symbol: PlayerSymbol }>;
type TicTacToeMessage = TicTacToeMoveMessage | GameResetMessage | GameStartMessage;

export default function TicTacToeGame(): React.ReactElement {
  const [mode, setMode] = useState<GameMode>("menu");
  const [board, setBoard] = useState<CellValue[]>(() => emptyBoard());
  const [turn, setTurn] = useState<PlayerSymbol>("X");
  const lobbyRoleRef = useRef<MultiplayerRole | null>(null);

  const resetBoard = useCallback(() => {
    setBoard(emptyBoard());
    setTurn("X");
  }, []);

  const applyMove = useCallback((cell: number, symbol: PlayerSymbol) => {
    setBoard((current) => {
      const result = applyTicTacToeMove(current, cell, symbol);
      if (result.moved) setTurn(result.nextTurn);
      return result.board;
    });
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
        applyMove(message.cell, message.symbol);
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
    if (mode === "ai" && turn === "O" && !winner && !draw) {
      const timeoutId = window.setTimeout(() => {
        const aiCell = chooseAiMove(board, "O", "X");
        if (aiCell !== null) applyMove(aiCell, "O");
      }, 320);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [applyMove, board, draw, mode, turn, winner]);

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

    if (mode === "online" && myOnlineSymbol === turn && lobby.status === "connected") {
      const sent = lobby.sendMessage({ type: "tictactoe:move", cell, symbol: myOnlineSymbol });
      if (sent) applyMove(cell, myOnlineSymbol);
    }
  };

  const menuActions: GameStartMenuAction[] = [
    {
      id: "local",
      title: "Gra lokalna",
      description: "Zagraj ze znajomym na tym samym ekranie.",
      icon: "♟",
      variant: "mint",
      onSelect: () => startMode("local"),
    },
    {
      id: "ai",
      title: "Gra z komputerem",
      description: "Zmierz się z komputerem w szybkiej partii.",
      icon: "▣",
      variant: "green",
      onSelect: () => startMode("ai"),
    },
    {
      id: "online",
      title: "Gra online",
      description: "Rywalizuj z graczem z innego ekranu.",
      icon: "◎",
      actionLabel: "Dołącz do gry",
      featured: true,
      variant: "blue",
      onSelect: () => startMode("onlineLobby"),
    },
  ];

  if (mode === "menu") {
    return (
      <div className="ttt-root ttt-root--menu">
        <GameStartMenu
          title="Kółko i Krzyżyk"
          subtitle="Wybierz tryb i rozpocznij krótką partię w klasycznym stylu."
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
            Wróć do menu
          </button>
        </div>

        <MultiplayerPanel lobby={lobby} title="Gra online" minPlayers={2} maxPlayers={2} />

        {onlineReady && isOnlineHost && (
          <button type="button" className="ttt-start-online" onClick={startOnlineGame}>
            Rozpocznij grę
          </button>
        )}

        {onlineReady && !isOnlineHost && <p className="ttt-online-note">Czekamy, aż host rozpocznie grę.</p>}
      </div>
    );
  }

  const playerLabel = getPlayerLabel(mode, turn, myOnlineSymbol);
  const canPlay = canPlayInMode(mode, turn, myOnlineSymbol, lobby.status, winner, draw);

  return (
    <div className="ttt-root ttt-root--play">
      <div className="ttt-topbar">
        <button type="button" className="ttt-link-button" onClick={backToMenu}>
          Wróć do menu
        </button>
        {mode === "online" && <InGameMultiplayerOverlay lobby={lobby} maxPlayers={2} />}
      </div>

      <section className="ttt-game" aria-label="Plansza Kółko i Krzyżyk">
        <div className="ttt-status">
          <span>{playerLabel}</span>
          <span>Tura: {turn}</span>
          {winner && <strong>Wygrywa {winner}</strong>}
          {draw && <strong>Remis</strong>}
        </div>

        <div
          className={["ttt-board", winningLineClass ? "ttt-board--won" : "", winningLineClass].filter(Boolean).join(" ")}
          role="grid"
          aria-label="Plansza 3 na 3"
        >
          {board.map((value, index) => (
            <button
              key={index}
              type="button"
              className="ttt-cell"
              onClick={() => playCell(index)}
              disabled={!canPlay || value !== null}
              aria-label={`Pole ${index + 1}${value ? `, ${value}` : ""}`}
            >
              {value}
            </button>
          ))}
          {winningLineClass && <span className="ttt-winning-line" aria-hidden="true" />}
        </div>

        {mode !== "online" || isOnlineHost ? (
          <button type="button" className="ttt-reset" onClick={resetGame}>
            Reset gry
          </button>
        ) : (
          <p className="ttt-online-note">Reset gry może wykonać tylko host.</p>
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

function getPlayerLabel(mode: GameMode, turn: PlayerSymbol, myOnlineSymbol: PlayerSymbol | null): string {
  if (mode === "local") return "Gra lokalna: dwóch graczy";
  if (mode === "ai") return turn === "X" ? "Twój ruch" : "Ruch komputera";
  if (mode === "online") return `Twój znak: ${myOnlineSymbol ?? "brak"}`;
  return "Wybierz tryb gry";
}
