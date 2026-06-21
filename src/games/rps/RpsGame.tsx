import React, { useRef, useState } from "react";
import "./rps.css";

type Choice = "rock" | "paper" | "scissors";
type RoundResult = "player" | "computer" | "draw";

type Score = {
  player: number;
  computer: number;
  draws: number;
};

type RoundHistoryItem = {
  id: number;
  playerChoice: Choice;
  computerChoice: Choice;
  result: RoundResult;
};

const CHOICES: readonly Choice[] = ["rock", "paper", "scissors"] as const;

const CHOICE_DETAILS: Record<Choice, { label: string; emoji: string; beats: Choice }> = {
  rock: { label: "Kamień", emoji: "✊", beats: "scissors" },
  paper: { label: "Papier", emoji: "✋", beats: "rock" },
  scissors: { label: "Nożyce", emoji: "✌️", beats: "paper" },
};

const INITIAL_SCORE: Score = {
  player: 0,
  computer: 0,
  draws: 0,
};

function getRandomChoice(): Choice {
  return CHOICES[Math.floor(Math.random() * CHOICES.length)] ?? "rock";
}

function resolveRound(playerChoice: Choice, computerChoice: Choice): RoundResult {
  if (playerChoice === computerChoice) return "draw";

  return CHOICE_DETAILS[playerChoice].beats === computerChoice ? "player" : "computer";
}

function getResultText(result: RoundResult, playerChoice: Choice, computerChoice: Choice): string {
  if (result === "draw") {
    return `Remis. Obaj wybraliście ${CHOICE_DETAILS[playerChoice].label.toLowerCase()}.`;
  }

  if (result === "player") {
    return `Wygrana! ${CHOICE_DETAILS[playerChoice].label} bije ${CHOICE_DETAILS[
      computerChoice
    ].label.toLowerCase()}.`;
  }

  return `Przegrana. ${CHOICE_DETAILS[computerChoice].label} bije ${CHOICE_DETAILS[
    playerChoice
  ].label.toLowerCase()}.`;
}

function getResultLabel(result: RoundResult): string {
  if (result === "player") return "Wygrana";
  if (result === "computer") return "Przegrana";
  return "Remis";
}

export default function RpsGame(): React.ReactElement {
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [history, setHistory] = useState<RoundHistoryItem[]>([]);
  const nextRoundId = useRef(1);

  const playRound = (choice: Choice) => {
    const nextComputerChoice = getRandomChoice();
    const nextResult = resolveRound(choice, nextComputerChoice);
    const historyItem: RoundHistoryItem = {
      id: nextRoundId.current,
      playerChoice: choice,
      computerChoice: nextComputerChoice,
      result: nextResult,
    };

    nextRoundId.current += 1;
    setPlayerChoice(choice);
    setComputerChoice(nextComputerChoice);
    setRoundResult(nextResult);
    setHistory((currentHistory) => [historyItem, ...currentHistory].slice(0, 5));
    setScore((currentScore) => ({
      player: currentScore.player + (nextResult === "player" ? 1 : 0),
      computer: currentScore.computer + (nextResult === "computer" ? 1 : 0),
      draws: currentScore.draws + (nextResult === "draw" ? 1 : 0),
    }));
  };

  const resetGame = () => {
    nextRoundId.current = 1;
    setScore(INITIAL_SCORE);
    setPlayerChoice(null);
    setComputerChoice(null);
    setRoundResult(null);
    setHistory([]);
  };

  const resultText =
    playerChoice && computerChoice && roundResult
      ? getResultText(roundResult, playerChoice, computerChoice)
      : "Wybierz swój ruch, a komputer odpowie losowym wyborem.";

  return (
    <div className="rps-root">
      <header className="rps-header">
        <div>
          <p className="rps-eyebrow">Singleplayer vs komputer</p>
          <h1>Kamień Papier Nożyce</h1>
          <p className="rps-intro">
            Wybierz symbol, sprawdź ruch komputera i zbieraj punkty za wygrane rundy.
          </p>
        </div>
        <button className="rps-reset" type="button" onClick={resetGame}>
          Reset
        </button>
      </header>

      <section className="rps-scoreboard" aria-label="Wynik punktowy">
        <div className="rps-score-card">
          <span>Gracz</span>
          <strong>{score.player}</strong>
        </div>
        <div className="rps-score-card">
          <span>Komputer</span>
          <strong>{score.computer}</strong>
        </div>
        <div className="rps-score-card">
          <span>Remisy</span>
          <strong>{score.draws}</strong>
        </div>
      </section>

      <main className="rps-arena">
        <section className="rps-pick-card" aria-label="Wybór gracza">
          <span>Twój wybór</span>
          <strong>{playerChoice ? CHOICE_DETAILS[playerChoice].emoji : "?"}</strong>
          <em>{playerChoice ? CHOICE_DETAILS[playerChoice].label : "Czekam na ruch"}</em>
        </section>

        <section
          className={`rps-result${roundResult ? ` rps-result--${roundResult}` : ""}`}
          aria-live="polite"
        >
          <span>{roundResult ? getResultLabel(roundResult) : "Gotowy?"}</span>
          <strong>{resultText}</strong>
        </section>

        <section className="rps-pick-card" aria-label="Wybór komputera">
          <span>Komputer</span>
          <strong>{computerChoice ? CHOICE_DETAILS[computerChoice].emoji : "?"}</strong>
          <em>{computerChoice ? CHOICE_DETAILS[computerChoice].label : "Losuje po Tobie"}</em>
        </section>
      </main>

      <section className="rps-actions" aria-label="Wybierz ruch">
        {CHOICES.map((choice) => (
          <button
            key={choice}
            className="rps-choice"
            type="button"
            onClick={() => playRound(choice)}
            aria-label={`Zagraj: ${CHOICE_DETAILS[choice].label}`}
          >
            <span>{CHOICE_DETAILS[choice].emoji}</span>
            <strong>{CHOICE_DETAILS[choice].label}</strong>
          </button>
        ))}
      </section>

      <section className="rps-history" aria-label="Historia ostatnich rund">
        <h2>Ostatnie rundy</h2>
        {history.length > 0 ? (
          <ol>
            {history.map((round) => (
              <li key={round.id} data-result={round.result}>
                <span>{getResultLabel(round.result)}</span>
                <strong>
                  {CHOICE_DETAILS[round.playerChoice].emoji} vs{" "}
                  {CHOICE_DETAILS[round.computerChoice].emoji}
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <p>Historia pojawi się po pierwszej rundzie.</p>
        )}
      </section>
    </div>
  );
}
