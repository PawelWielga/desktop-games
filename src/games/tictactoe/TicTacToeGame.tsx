import React, { useCallback, useEffect, useMemo, useState } from "react";
import { InGameMultiplayerOverlay, MultiplayerPanel, useMultiplayerLobby } from "@/multiplayer";
import type { GameResetMessage, GameSpecificMessage } from "@/multiplayer";
import "./tictactoe.css";

type CellValue = "X" | "O" | null;
type PlayerSymbol = Exclude<CellValue, null>;
type GameMode = "menu" | "local" | "ai" | "onlineLobby" | "online";
type TicTacToeMoveMessage = GameSpecificMessage<"tictactoe:move", { cell: number; symbol: PlayerSymbol }>;
type TicTacToeMessage = TicTacToeMoveMessage | GameResetMessage;

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export default function TicTacToeGame(): React.ReactElement {
  const [mode, setMode] = useState<GameMode>("menu");
  const [board, setBoard] = useState<CellValue[]>(() => emptyBoard());
  const [turn, setTurn] = useState<PlayerSymbol>("X");

  const resetBoard = useCallback(() => {
    setBoard(emptyBoard());
    setTurn("X");
  }, []);

  const applyMove = useCallback((cell: number, symbol: PlayerSymbol) => {
    if (!Number.isInteger(cell) || cell < 0 || cell >= 9) return;

    setBoard((current) => {
      if (current[cell] !== null) return current;
      const next = current.slice();
      next[cell] = symbol;
      setTurn(symbol === "X" ? "O" : "X");
      return next;
    });
  }, []);

  const handleRemoteMessage = useCallback(
    (message: TicTacToeMessage) => {
      if (message.type === "game:reset") {
        resetBoard();
        return;
      }

      if (message.type === "tictactoe:move") {
        applyMove(message.cell, message.symbol);
      }
    },
    [applyMove, resetBoard]
  );

  const lobby = useMultiplayerLobby<TicTacToeMessage>({ onGameMessage: handleRemoteMessage });
  const winner = useMemo(() => getWinner(board), [board]);
  const draw = !winner && board.every(Boolean);
  const onlinePlayers = 1 + lobby.remotePlayers.length;
  const onlineReady = lobby.status === "connected" && onlinePlayers >= 2;
  const myOnlineSymbol: PlayerSymbol | null = lobby.role === "host" ? "X" : lobby.role === "guest" ? "O" : null;

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

  const backToMenu = () => {
    lobby.close();
    resetBoard();
    setMode("menu");
  };

  const resetGame = () => {
    resetBoard();
    if (mode === "online" && lobby.status === "connected") {
      lobby.sendMessage({ type: "game:reset" });
    }
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

  if (mode === "menu") {
    return (
      <div className="ttt-root ttt-root--menu">
        <section className="ttt-menu" aria-label="Menu gry Kółko i Krzyżyk">
          <span className="ttt-menu__eyebrow">Gra</span>
          <h1>Kółko i Krzyżyk</h1>
          <div className="ttt-menu__actions">
            <button type="button" onClick={() => startMode("local")}>
              Gra lokalna
            </button>
            <button type="button" onClick={() => startMode("ai")}>
              Gra z komputerem
            </button>
            <button type="button" onClick={() => startMode("onlineLobby")}>
              Gra online
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (mode === "onlineLobby") {
    return (
      <div className="ttt-root ttt-root--menu">
        <div className="ttt-screen-actions">
          <button type="button" className="ttt-link-button" onClick={backToMenu}>
            Wróć do menu
          </button>
        </div>

        <MultiplayerPanel lobby={lobby} title="Gra online" minPlayers={2} maxPlayers={2} />

        {onlineReady && (
          <button type="button" className="ttt-start-online" onClick={() => startMode("online")}>
            Rozpocznij grę
          </button>
        )}
      </div>
    );
  }

  const playerLabel = getPlayerLabel(mode, turn, myOnlineSymbol);
  const canPlay = canPlayInMode(mode, turn, myOnlineSymbol, lobby.status, winner, draw);

  return (
    <div className="ttt-root">
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

        <div className="ttt-board" role="grid" aria-label="Plansza 3 na 3">
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
        </div>

        <button type="button" className="ttt-reset" onClick={resetGame}>
          Reset gry
        </button>
      </section>
    </div>
  );
}

function emptyBoard(): CellValue[] {
  return Array<CellValue>(9).fill(null);
}

function getWinner(board: CellValue[]): PlayerSymbol | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
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

function chooseAiMove(board: CellValue[], ai: PlayerSymbol, human: PlayerSymbol): number | null {
  const firstEmptyCell = board.findIndex((value) => value === null);
  return findWinningMove(board, ai) ?? findWinningMove(board, human) ?? (firstEmptyCell >= 0 ? firstEmptyCell : null);
}

function findWinningMove(board: CellValue[], symbol: PlayerSymbol): number | null {
  for (const [a, b, c] of WIN_LINES) {
    const line = [a, b, c];
    const values = line.map((index) => board[index]);
    if (values.filter((value) => value === symbol).length === 2 && values.includes(null)) {
      return line[values.findIndex((value) => value === null)];
    }
  }

  return null;
}
