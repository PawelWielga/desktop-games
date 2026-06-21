import React, { useCallback, useEffect, useRef, useState } from "react";
import "./memo.css";

type MemoCard = {
  id: number;
  symbol: string;
  isRevealed: boolean;
  isMatched: boolean;
};

const SYMBOL_SETS: readonly (readonly string[])[] = [
  ["🍎", "🍌", "🍇", "🍒", "🍋", "🍓", "🍊", "🍉"],
  ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼"],
  ["😀", "😂", "😎", "😍", "🤩", "🤖", "👻", "🚀"],
] as const;

const TOTAL_PAIRS = 8;
const FLIP_BACK_DELAY_MS = 720;

function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function createDeck(): MemoCard[] {
  const selectedSet = SYMBOL_SETS[Math.floor(Math.random() * SYMBOL_SETS.length)] ?? SYMBOL_SETS[0];
  const cards = selectedSet.flatMap((symbol, pairIndex) => [
    { id: pairIndex * 2, symbol, isRevealed: false, isMatched: false },
    { id: pairIndex * 2 + 1, symbol, isRevealed: false, isMatched: false },
  ]);

  return shuffle(cards).map((card, index) => ({ ...card, id: index }));
}

export default function MemoGame(): React.ReactElement {
  const [cards, setCards] = useState<MemoCard[]>(() => createDeck());
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [pairsFound, setPairsFound] = useState(0);
  const timeoutRef = useRef<number | null>(null);

  const clearFlipTimeout = useCallback(() => {
    if (timeoutRef.current === null) return;

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const startNewGame = useCallback(() => {
    clearFlipTimeout();
    setCards(createDeck());
    setSelectedIds([]);
    setIsLocked(false);
    setMoves(0);
    setPairsFound(0);
  }, [clearFlipTimeout]);

  useEffect(() => clearFlipTimeout, [clearFlipTimeout]);

  const handleCardClick = useCallback(
    (cardId: number) => {
      if (isLocked) return;

      const clickedCard = cards.find((card) => card.id === cardId);
      if (!clickedCard || clickedCard.isRevealed || clickedCard.isMatched) return;

      const revealedCards = cards.map((card) =>
        card.id === cardId ? { ...card, isRevealed: true } : card,
      );

      if (selectedIds.length === 0) {
        setCards(revealedCards);
        setSelectedIds([cardId]);
        return;
      }

      const firstCardId = selectedIds[0];
      const firstCard = cards.find((card) => card.id === firstCardId);
      if (!firstCard) {
        setCards(revealedCards);
        setSelectedIds([]);
        return;
      }

      setMoves((currentMoves) => currentMoves + 1);

      if (firstCard.symbol === clickedCard.symbol) {
        setCards(
          revealedCards.map((card) =>
            card.id === firstCard.id || card.id === clickedCard.id
              ? { ...card, isMatched: true, isRevealed: true }
              : card,
          ),
        );
        setSelectedIds([]);
        setPairsFound((currentPairs) => currentPairs + 1);
        return;
      }

      setCards(revealedCards);
      setIsLocked(true);
      timeoutRef.current = window.setTimeout(() => {
        setCards((currentCards) =>
          currentCards.map((card) =>
            card.id === firstCard.id || card.id === clickedCard.id
              ? { ...card, isRevealed: false }
              : card,
          ),
        );
        setSelectedIds([]);
        setIsLocked(false);
        timeoutRef.current = null;
      }, FLIP_BACK_DELAY_MS);
    },
    [cards, isLocked, selectedIds],
  );

  const isWon = pairsFound === TOTAL_PAIRS;
  const statusText = isWon
    ? `Wygrana w ${moves} ruchach!`
    : selectedIds.length === 1
      ? "Wybierz drugą kartę."
      : "Odkryj dwie takie same karty.";

  return (
    <div className="memo-root">
      <header className="memo-header">
        <div>
          <p className="memo-eyebrow">Gra pamięciowa</p>
          <h1>Memo</h1>
          <p className="memo-intro">
            Odkrywaj po dwie karty i znajdź wszystkie pary w jak najmniejszej liczbie ruchów.
          </p>
        </div>
        <button className="memo-reset" type="button" onClick={startNewGame}>
          Nowa gra
        </button>
      </header>

      <section className="memo-stats" aria-label="Statystyki gry memo">
        <div className="memo-stat">
          <span>Ruchy</span>
          <strong>{moves}</strong>
        </div>
        <div className="memo-stat">
          <span>Pary</span>
          <strong>
            {pairsFound}/{TOTAL_PAIRS}
          </strong>
        </div>
        <div className="memo-stat memo-stat--wide">
          <span>Status</span>
          <strong>{statusText}</strong>
        </div>
      </section>

      <main className="memo-board-wrap">
        <div className="memo-board" aria-label="Plansza memo 4 na 4">
          {cards.map((card) => {
            const isVisible = card.isRevealed || card.isMatched;

            return (
              <button
                key={card.id}
                className="memo-card"
                type="button"
                data-visible={isVisible}
                data-matched={card.isMatched}
                disabled={isLocked || isVisible}
                aria-label={isVisible ? `Karta ${card.symbol}` : "Zakryta karta"}
                aria-pressed={isVisible}
                onClick={() => handleCardClick(card.id)}
              >
                <span className="memo-card-inner">
                  <span className="memo-card-face memo-card-face--front">{card.symbol}</span>
                  <span className="memo-card-face memo-card-face--back">?</span>
                </span>
              </button>
            );
          })}
        </div>
      </main>

      {isWon ? (
        <p className="memo-win" role="status">
          Brawo! Wszystkie pary znalezione.
        </p>
      ) : null}
    </div>
  );
}
