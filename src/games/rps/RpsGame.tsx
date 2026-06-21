import React, { useRef, useState } from "react";
import { useTranslation, type TranslationFunction } from "@/i18n/useTranslation";
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

const CHOICE_DETAILS: Record<Choice, { labelKey: string; emoji: string; beats: Choice }> = {
  rock: { labelKey: "rps.choice.rock", emoji: "✊", beats: "scissors" },
  paper: { labelKey: "rps.choice.paper", emoji: "✋", beats: "rock" },
  scissors: { labelKey: "rps.choice.scissors", emoji: "✌️", beats: "paper" },
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

function getChoiceLabel(choice: Choice, t: TranslationFunction): string {
  return t(CHOICE_DETAILS[choice].labelKey);
}

function getResultText(
  result: RoundResult,
  playerChoice: Choice,
  computerChoice: Choice,
  t: TranslationFunction,
): string {
  const playerLabel = getChoiceLabel(playerChoice, t);
  const computerLabel = getChoiceLabel(computerChoice, t);

  if (result === "draw") {
    return t("rps.result.drawText", { choice: playerLabel.toLocaleLowerCase() });
  }

  if (result === "player") {
    return t("rps.result.playerText", {
      playerChoice: playerLabel,
      computerChoice: computerLabel.toLocaleLowerCase(),
    });
  }

  return t("rps.result.computerText", {
    computerChoice: computerLabel,
    playerChoice: playerLabel.toLocaleLowerCase(),
  });
}

function getResultLabel(result: RoundResult, t: TranslationFunction): string {
  if (result === "player") return t("rps.result.player");
  if (result === "computer") return t("rps.result.computer");
  return t("rps.result.draw");
}

export default function RpsGame(): React.ReactElement {
  const { t } = useTranslation();
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
      ? getResultText(roundResult, playerChoice, computerChoice, t)
      : t("rps.defaultResult");

  return (
    <div className="rps-root">
      <header className="rps-header">
        <div>
          <p className="rps-eyebrow">{t("rps.eyebrow")}</p>
          <h1>{t("rps.title")}</h1>
          <p className="rps-intro">
            {t("rps.intro")}
          </p>
        </div>
        <button className="rps-reset" type="button" onClick={resetGame}>
          {t("rps.reset")}
        </button>
      </header>

      <section className="rps-scoreboard" aria-label={t("rps.scoreboardAria")}>
        <div className="rps-score-card">
          <span>{t("rps.score.player")}</span>
          <strong>{score.player}</strong>
        </div>
        <div className="rps-score-card">
          <span>{t("rps.computer")}</span>
          <strong>{score.computer}</strong>
        </div>
        <div className="rps-score-card">
          <span>{t("rps.score.draws")}</span>
          <strong>{score.draws}</strong>
        </div>
      </section>

      <main className="rps-arena">
        <section className="rps-pick-card" aria-label={t("rps.playerChoiceAria")}>
          <span>{t("rps.yourChoice")}</span>
          <strong>{playerChoice ? CHOICE_DETAILS[playerChoice].emoji : "?"}</strong>
          <em>{playerChoice ? getChoiceLabel(playerChoice, t) : t("rps.waitingForMove")}</em>
        </section>

        <section
          className={`rps-result${roundResult ? ` rps-result--${roundResult}` : ""}`}
          aria-live="polite"
        >
          <span>{roundResult ? getResultLabel(roundResult, t) : t("rps.ready")}</span>
          <strong>{resultText}</strong>
        </section>

        <section className="rps-pick-card" aria-label={t("rps.computerChoiceAria")}>
          <span>{t("rps.computer")}</span>
          <strong>{computerChoice ? CHOICE_DETAILS[computerChoice].emoji : "?"}</strong>
          <em>{computerChoice ? getChoiceLabel(computerChoice, t) : t("rps.computerWaiting")}</em>
        </section>
      </main>

      <section className="rps-actions" aria-label={t("rps.actionsAria")}>
        {CHOICES.map((choice) => (
          <button
            key={choice}
            className="rps-choice"
            type="button"
            onClick={() => playRound(choice)}
            aria-label={t("rps.playChoice", { choice: getChoiceLabel(choice, t) })}
          >
            <span>{CHOICE_DETAILS[choice].emoji}</span>
            <strong>{getChoiceLabel(choice, t)}</strong>
          </button>
        ))}
      </section>

      <section className="rps-history" aria-label={t("rps.historyAria")}>
        <h2>{t("rps.historyTitle")}</h2>
        {history.length > 0 ? (
          <ol>
            {history.map((round) => (
              <li key={round.id} data-result={round.result}>
                <span>{getResultLabel(round.result, t)}</span>
                <strong>
                  {CHOICE_DETAILS[round.playerChoice].emoji} vs{" "}
                  {CHOICE_DETAILS[round.computerChoice].emoji}
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <p>{t("rps.historyEmpty")}</p>
        )}
      </section>
    </div>
  );
}
