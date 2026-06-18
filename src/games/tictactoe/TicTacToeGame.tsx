import React, { useCallback, useMemo, useState } from "react";
import { MultiplayerPanel, useMultiplayerLobby } from "@/multiplayer";
import type { GameResetMessage, GameSpecificMessage } from "@/multiplayer";
import "./tictactoe.css";

type CellValue = "X" | "O" | null;
type PlayerSymbol = Exclude<CellValue, null>;
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

  const mySymbol: PlayerSymbol | null = lobby.role === "host" ? "X" : lobby.role === "guest" ? "O" : null;
  const winner = useMemo(() => getWinner(board), [board]);
  const draw = !winner && board.every(Boolean);
  const canPlay = lobby.status === "connected" && mySymbol === turn && !winner && !draw;

  const playCell = (cell: number) => {
    if (!canPlay || !mySymbol || board[cell] !== null) return;
    const sent = lobby.sendMessage({ type: "tictactoe:move", cell, symbol: mySymbol });
    if (sent) applyMove(cell, mySymbol);
  };

  const resetGame = () => {
    resetBoard();
    if (lobby.status === "connected") {
      lobby.sendMessage({ type: "game:reset" });
    }
  };

  return (
    <div className="ttt-root">
      <MultiplayerPanel lobby={lobby} title="Kółko i Krzyżyk online" minPlayers={2} maxPlayers={2} />

      <section className="ttt-game" aria-label="Plansza Kółko i Krzyżyk">
        <div className="ttt-status">
          <span>Twój znak: {mySymbol ?? "połącz się"}</span>
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
