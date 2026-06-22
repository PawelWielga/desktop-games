import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GameStartMenu, type GameStartMenuAction } from "@/components/GameStartMenu";
import { useTranslation } from "@/i18n/useTranslation";
import { InGameMultiplayerOverlay, MultiplayerPanel, useMultiplayerLobby } from "@/multiplayer";
import type { GameResetMessage, GameSpecificMessage, PlayerProfile } from "@/multiplayer";
import { COUNTRIES_CITIES_LETTERS, drawRoundLetter, groupSimilarAnswers, normalizeAnswer } from "./countriesCities.logic";
import "./countriesCities.css";

type Phase = "menu" | "lobby" | "setup" | "input" | "review" | "reveal" | "results";
type EndMode = "timer" | "manual";
type ReviewVote = "ok" | "duplicate" | "wrong";
type Submission = { playerId: string; playerName: string; answers: Record<string, string> };
type VoteMap = Record<string, Record<string, ReviewVote>>;
type DuplicateOverrides = Record<string, string>;
type AnswerResult = { winner: ReviewVote; points: number };
type FinalResults = Record<string, AnswerResult>;
type FinalScores = Record<string, number>;
type ReviewReady = Record<number, string[]>;

type SettingsMessage = GameSpecificMessage<"countries-cities:settings", { categories: string[]; endMode: EndMode; hostControlsReview: boolean }>;
type StartRoundMessage = GameSpecificMessage<"countries-cities:start-round", { letter: string; usedLetters: string[] }>;
type SubmitMessage = GameSpecificMessage<"countries-cities:submit", { player: PlayerProfile; answers: Record<string, string> }>;
type DeadlineMessage = GameSpecificMessage<"countries-cities:deadline", { deadlineAt: number }>;
type ReviewMessage = GameSpecificMessage<"countries-cities:review", { submissions: Submission[]; categoryIndex: number }>;
type VoteMessage = GameSpecificMessage<"countries-cities:vote", { answerId: string; vote: ReviewVote }>;
type DuplicateMessage = GameSpecificMessage<"countries-cities:duplicate", { answerId: string; groupKey: string | null }>;
type ReviewReadyMessage = GameSpecificMessage<"countries-cities:review-ready", { categoryIndex: number; playerId: string }>;
type RevealMessage = GameSpecificMessage<"countries-cities:reveal", { categoryIndex: number; finalResults: FinalResults }>;
type ResultsMessage = GameSpecificMessage<"countries-cities:results", { finalResults: FinalResults; finalScores: FinalScores }>;
type CountriesCitiesMessage =
  | SettingsMessage
  | StartRoundMessage
  | SubmitMessage
  | DeadlineMessage
  | ReviewMessage
  | VoteMessage
  | DuplicateMessage
  | ReviewReadyMessage
  | RevealMessage
  | ResultsMessage
  | GameResetMessage;

type VoteSummary = {
  ok: number;
  duplicate: number;
  wrong: number;
  winner: ReviewVote;
};

const DEFAULT_CATEGORIES = ["Państwo", "Miasto", "Roślina", "Zwierzę", "Rzecz"];
const TIMER_MS = 10_000;
const HOST_AUTO_SUBMIT_GRACE_MS = 2_000;
const VOTE_ORDER: ReviewVote[] = ["ok", "duplicate", "wrong"];

const answerId = (playerId: string, category: string): string => `${playerId}::${category}`;
const toProfile = (player: { id: string; name: string; color: string; emoji: string }): PlayerProfile => ({
  id: player.id,
  name: player.name,
  color: player.color,
  emoji: player.emoji,
});

function getVoteSummary(votes: Record<string, ReviewVote> | undefined): VoteSummary {
  const summary: VoteSummary = { ok: 0, duplicate: 0, wrong: 0, winner: "ok" };

  Object.values(votes ?? {}).forEach((vote) => {
    summary[vote] += 1;
  });

  summary.winner = pickVoteWinner(summary);
  return summary;
}

function getHostAuthoritativeVoteSummary(
  votes: Record<string, ReviewVote> | undefined,
  hostPlayerId: string,
  seed: string
): VoteSummary {
  const summary: VoteSummary = { ok: 0, duplicate: 0, wrong: 0, winner: "ok" };

  Object.values(votes ?? {}).forEach((vote) => {
    summary[vote] += 1;
  });

  const regularWinners = getTopVotes(summary);
  if (regularWinners.length === 1) {
    summary.winner = regularWinners[0];
    return summary;
  }

  const hostWeightedSummary = { ...summary };
  const hostVote = votes?.[hostPlayerId];
  if (hostVote) hostWeightedSummary[hostVote] += 1;

  const hostWeightedWinners = getTopVotes(hostWeightedSummary);
  summary.winner = hostWeightedWinners.length === 1 ? hostWeightedWinners[0] : pickDeterministicWinner(hostWeightedWinners, seed);

  return summary;
}

function getHostControlledVoteSummary(votes: Record<string, ReviewVote> | undefined, hostPlayerId: string): VoteSummary {
  const summary: VoteSummary = { ok: 0, duplicate: 0, wrong: 0, winner: "ok" };

  Object.values(votes ?? {}).forEach((vote) => {
    summary[vote] += 1;
  });

  summary.winner = votes?.[hostPlayerId] ?? "ok";
  return summary;
}

function pickVoteWinner(summary: Pick<VoteSummary, "ok" | "duplicate" | "wrong">): ReviewVote {
  return VOTE_ORDER.reduce((winner, vote) => (summary[vote] > summary[winner] ? vote : winner), "ok" as ReviewVote);
}

function getTopVotes(summary: Pick<VoteSummary, "ok" | "duplicate" | "wrong">): ReviewVote[] {
  const highest = Math.max(summary.ok, summary.duplicate, summary.wrong);
  return VOTE_ORDER.filter((vote) => summary[vote] === highest);
}

function pickDeterministicWinner(options: ReviewVote[], seed: string): ReviewVote {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2147483647;
  }

  return options[hash % options.length] ?? "ok";
}

function getAnswerPoints(answer: string, summary: VoteSummary): number {
  if (!answer.trim() || summary.winner === "wrong") return 0;
  return summary.winner === "duplicate" ? 10 : 15;
}

export default function CountriesCitiesGame(): React.ReactElement {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("menu");
  const [categoriesText, setCategoriesText] = useState(DEFAULT_CATEGORIES.join("\n"));
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [endMode, setEndMode] = useState<EndMode>("timer");
  const [hostControlsReview, setHostControlsReview] = useState(true);
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [usedLetters, setUsedLetters] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [donePlayers, setDonePlayers] = useState<string[]>([]);
  const [votes, setVotes] = useState<VoteMap>({});
  const [duplicateOverrides, setDuplicateOverrides] = useState<DuplicateOverrides>({});
  const [reviewReady, setReviewReady] = useState<ReviewReady>({});
  const [finalResults, setFinalResults] = useState<FinalResults>({});
  const [finalScores, setFinalScores] = useState<FinalScores>({});
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const addDonePlayer = useCallback((playerId: string) => {
    setDonePlayers((items) => (items.includes(playerId) ? items : [...items, playerId]));
  }, []);

  const upsertSubmission = useCallback((submission: Submission) => {
    setSubmissions((items) => [...items.filter((item) => item.playerId !== submission.playerId), submission]);
  }, []);

  const addVote = useCallback((id: string, voterId: string, vote: ReviewVote) => {
    setVotes((items) => ({ ...items, [id]: { ...(items[id] ?? {}), [voterId]: vote } }));
  }, []);

  const addReviewReady = useCallback((index: number, playerId: string) => {
    setReviewReady((items) => {
      const ready = items[index] ?? [];
      return ready.includes(playerId) ? items : { ...items, [index]: [...ready, playerId] };
    });
  }, []);

  const resetRound = useCallback((nextPhase: Phase = "setup") => {
    setAnswers({});
    setSubmissions([]);
    setDonePlayers([]);
    setVotes({});
    setDuplicateOverrides({});
    setReviewReady({});
    setFinalResults({});
    setFinalScores({});
    setCategoryIndex(0);
    setDeadlineAt(null);
    setPhase(nextPhase);
  }, []);

  const resetGame = useCallback(() => {
    setCurrentLetter(null);
    setUsedLetters([]);
    resetRound();
  }, [resetRound]);

  const onMessage = useCallback(
    (message: CountriesCitiesMessage) => {
      if (message.type === "countries-cities:settings") {
        setCategories(message.categories);
        setCategoriesText(message.categories.join("\n"));
        setEndMode(message.endMode);
        setHostControlsReview(message.hostControlsReview);
        setCurrentLetter(null);
        setUsedLetters([]);
        resetRound();
      } else if (message.type === "countries-cities:start-round") {
        setCurrentLetter(message.letter);
        setUsedLetters(message.usedLetters);
        resetRound("input");
      } else if (message.type === "countries-cities:submit") {
        upsertSubmission({ playerId: message.player.id, playerName: message.player.name, answers: message.answers });
        addDonePlayer(message.player.id);
      } else if (message.type === "countries-cities:deadline") {
        setDeadlineAt(message.deadlineAt);
      } else if (message.type === "countries-cities:review") {
        setSubmissions(message.submissions);
        setCategoryIndex(message.categoryIndex);
        setPhase("review");
      } else if (message.type === "countries-cities:vote" && message.senderId) {
        addVote(message.answerId, message.senderId, message.vote);
      } else if (message.type === "countries-cities:duplicate") {
        setDuplicateOverrides((items) => {
          const next = { ...items };
          if (message.groupKey) next[message.answerId] = message.groupKey;
          else delete next[message.answerId];
          return next;
        });
      } else if (message.type === "countries-cities:review-ready") {
        addReviewReady(message.categoryIndex, message.playerId);
      } else if (message.type === "countries-cities:reveal") {
        setCategoryIndex(message.categoryIndex);
        setFinalResults((items) => ({ ...items, ...message.finalResults }));
        setPhase("reveal");
      } else if (message.type === "countries-cities:results") {
        setFinalResults(message.finalResults);
        setFinalScores(message.finalScores);
        setPhase("results");
      } else if (message.type === "game:reset") {
        resetGame();
      }
    },
    [addDonePlayer, addReviewReady, addVote, resetGame, resetRound, upsertSubmission]
  );

  const lobby = useMultiplayerLobby<CountriesCitiesMessage>({ onGameMessage: onMessage });
  const players = useMemo(() => [lobby.localPlayer, ...lobby.remotePlayers], [lobby.localPlayer, lobby.remotePlayers]);
  const isHost = lobby.role === "host";
  const hostPlayerId = isHost ? lobby.localPlayer.id : lobby.remotePlayers[0]?.id;
  const parsedCategories = useMemo(
    () => [...new Set(categoriesText.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))],
    [categoriesText]
  );
  const secondsLeft = deadlineAt ? Math.max(0, Math.ceil((deadlineAt - now) / 1000)) : null;
  const currentCategory = categories[categoryIndex] ?? categories[0];
  const currentReady = reviewReady[categoryIndex] ?? [];
  const hasAvailableRoundLetters = usedLetters.length < COUNTRIES_CITIES_LETTERS.length;
  const hasAcceptedCurrentReview = currentReady.includes(lobby.localPlayer.id);
  const hasSubmittedAnswers = donePlayers.includes(lobby.localPlayer.id);
  const requiredReviewApprovals = hostControlsReview ? 1 : players.length;
  const hasRequiredReviewApprovals = hostControlsReview
    ? Boolean(hostPlayerId && currentReady.includes(hostPlayerId))
    : currentReady.length >= players.length;
  const acceptReviewButtonClassName = hasAcceptedCurrentReview
    ? "countries-cities-primary countries-cities-accept-review countries-cities-review-accepted"
    : "countries-cities-primary countries-cities-accept-review";

  useEffect(() => {
    if (!deadlineAt || phase !== "input") return undefined;
    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [deadlineAt, phase]);

  const beginReview = useCallback(
    (items = submissions) => {
      const fullSubmissions = players.map(
        (player) =>
          items.find((item) => item.playerId === player.id) ?? {
            playerId: player.id,
            playerName: player.name,
            answers: Object.fromEntries(categories.map((category) => [category, ""])),
          }
      );

      setSubmissions(fullSubmissions);
      setCategoryIndex(0);
      setPhase("review");
      lobby.sendMessage({ type: "countries-cities:review", submissions: fullSubmissions, categoryIndex: 0 });
    },
    [categories, lobby, players, submissions]
  );

  useEffect(() => {
    if (!isHost || phase !== "input") return;

    if (endMode === "timer" && submissions.length > 0 && deadlineAt === null) {
      const nextDeadline = Date.now() + TIMER_MS;
      setDeadlineAt(nextDeadline);
      lobby.sendMessage({ type: "countries-cities:deadline", deadlineAt: nextDeadline });
      return;
    }

    const hasAllExpectedSubmissions = donePlayers.length >= players.length;
    const shouldEnd =
      endMode === "manual"
        ? hasAllExpectedSubmissions
        : hasAllExpectedSubmissions || (deadlineAt !== null && Date.now() >= deadlineAt + HOST_AUTO_SUBMIT_GRACE_MS);

    if (shouldEnd) beginReview();
  }, [beginReview, deadlineAt, donePlayers.length, endMode, isHost, lobby, phase, players.length, submissions.length, now]);

  const groupsByCategory = useMemo(
    () =>
      Object.fromEntries(
        categories.map((category) => [category, groupSimilarAnswers(submissions.map((item) => item.answers[category] ?? ""))])
      ),
    [categories, submissions]
  );

  const calculatedFinalResults = useMemo<FinalResults>(() => {
    if (!hostPlayerId) return {};

    return Object.fromEntries(
      submissions.flatMap((submission) =>
        categories.map((category) => {
          const id = answerId(submission.playerId, category);
          const answer = submission.answers[category] ?? "";
          const summary = hostControlsReview
            ? getHostControlledVoteSummary(votes[id], hostPlayerId)
            : getHostAuthoritativeVoteSummary(votes[id], hostPlayerId, id);
          return [id, { winner: summary.winner, points: getAnswerPoints(answer, summary) }];
        })
      )
    );
  }, [categories, hostControlsReview, hostPlayerId, submissions, votes]);

  const calculatedFinalScores = useMemo<FinalScores>(
    () =>
      Object.fromEntries(
        submissions.map((submission) => [
          submission.playerId,
          categories.reduce((sum, category) => sum + (calculatedFinalResults[answerId(submission.playerId, category)]?.points ?? 0), 0),
        ])
      ),
    [calculatedFinalResults, categories, submissions]
  );

  const displayedFinalResults = isHost ? calculatedFinalResults : finalResults;
  const displayedFinalScores = isHost ? calculatedFinalScores : finalScores;

  const publishSettings = (): void => {
    if (parsedCategories.length === 0) return;

    setCategories(parsedCategories);
    setCurrentLetter(null);
    setUsedLetters([]);
    resetRound();
    lobby.sendMessage({ type: "countries-cities:settings", categories: parsedCategories, endMode, hostControlsReview });
  };

  const startInput = (): void => {
    if (!isHost) return;

    const nextRound = drawRoundLetter(usedLetters);
    if (!nextRound) return;
    setCurrentLetter(nextRound.letter);
    setUsedLetters(nextRound.usedLetters);
    resetRound("input");
    lobby.sendMessage({ type: "countries-cities:start-round", letter: nextRound.letter, usedLetters: nextRound.usedLetters });
  };

  const submitAnswers = useCallback((): void => {
    if (hasSubmittedAnswers) return;

    const player = toProfile(lobby.localPlayer);
    const submission = {
      playerId: player.id,
      playerName: player.name,
      answers: Object.fromEntries(categories.map((category) => [category, answers[category]?.trim() ?? ""])),
    };

    upsertSubmission(submission);
    addDonePlayer(player.id);
    lobby.sendMessage({ type: "countries-cities:submit", player, answers: submission.answers });
  }, [addDonePlayer, answers, categories, hasSubmittedAnswers, lobby, upsertSubmission]);

  useEffect(() => {
    if (phase !== "input" || !deadlineAt || hasSubmittedAnswers || Date.now() < deadlineAt) return;

    submitAnswers();
  }, [deadlineAt, hasSubmittedAnswers, now, phase, submitAnswers]);

  const vote = (id: string, selectedVote: ReviewVote): void => {
    if (hasAcceptedCurrentReview) return;

    addVote(id, lobby.localPlayer.id, selectedVote);
    lobby.sendMessage({ type: "countries-cities:vote", answerId: id, vote: selectedVote });
  };

  const setDuplicate = (id: string, groupKey: string | null): void => {
    if (hasAcceptedCurrentReview) return;

    setDuplicateOverrides((items) => {
      const next = { ...items };
      if (groupKey) next[id] = groupKey;
      else delete next[id];
      return next;
    });
    lobby.sendMessage({ type: "countries-cities:duplicate", answerId: id, groupKey });
  };

  const acceptReview = (): void => {
    if (hasAcceptedCurrentReview) return;

    addReviewReady(categoryIndex, lobby.localPlayer.id);
    lobby.sendMessage({ type: "countries-cities:review-ready", categoryIndex, playerId: lobby.localPlayer.id });
  };

  const revealCategory = useCallback((): void => {
    if (!isHost) return;

    setFinalResults((items) => ({ ...items, ...calculatedFinalResults }));
    setPhase("reveal");
    lobby.sendMessage({ type: "countries-cities:reveal", categoryIndex, finalResults: calculatedFinalResults });
  }, [calculatedFinalResults, categoryIndex, isHost, lobby]);

  useEffect(() => {
    if (!isHost || phase !== "review" || !hasRequiredReviewApprovals) return;

    revealCategory();
  }, [hasRequiredReviewApprovals, isHost, phase, revealCategory]);

  const nextCategory = (): void => {
    const nextIndex = categoryIndex + 1;
    if (nextIndex >= categories.length) {
      setFinalResults(calculatedFinalResults);
      setFinalScores(calculatedFinalScores);
      setPhase("results");
      lobby.sendMessage({ type: "countries-cities:results", finalResults: calculatedFinalResults, finalScores: calculatedFinalScores });
      return;
    }

    setCategoryIndex(nextIndex);
    setPhase("review");
    lobby.sendMessage({ type: "countries-cities:review", submissions, categoryIndex: nextIndex });
  };

  const menuActions: GameStartMenuAction[] = [
    {
      id: "online",
      title: t("countriesCities.online.title"),
      description: t("countriesCities.online.description"),
      icon: "🌍",
      featured: true,
      variant: "blue",
      actionLabel: t("countriesCities.online.join"),
      onSelect: () => setPhase("lobby"),
    },
  ];

  if (phase === "menu") {
    return (
      <div className="countries-cities-root">
        <GameStartMenu title={t("apps.countriesCities")} subtitle={t("countriesCities.subtitle")} actions={menuActions} />
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="countries-cities-root">
        <MultiplayerPanel lobby={lobby} title={t("countriesCities.online.title")} minPlayers={2} maxPlayers={8} />
        <button type="button" onClick={() => setPhase("menu")}>
          {t("countriesCities.backToMenu")}
        </button>
        {lobby.status === "connected" && (
          <section className="countries-cities-card">
            {isHost ? (
              <>
                <label className="countries-cities-field">
                  <span>{t("countriesCities.categoriesLabel")}</span>
                  <textarea value={categoriesText} onChange={(event) => setCategoriesText(event.target.value)} rows={7} />
                </label>
                <label className="countries-cities-checkbox">
                  <input
                    type="checkbox"
                    checked={endMode === "timer"}
                    onChange={(event) => setEndMode(event.target.checked ? "timer" : "manual")}
                  />
                  <span>{t("countriesCities.timerModeLabel")}</span>
                </label>
                <label className="countries-cities-checkbox">
                  <input
                    type="checkbox"
                    checked={hostControlsReview}
                    onChange={(event) => setHostControlsReview(event.target.checked)}
                  />
                  <span>{t("countriesCities.hostControlsReviewLabel")}</span>
                </label>
                <p>{t("countriesCities.parsedCategories", { count: parsedCategories.length })}</p>
                <button className="countries-cities-primary" type="button" disabled={parsedCategories.length === 0} onClick={publishSettings}>
                  {t("countriesCities.saveSettings")}
                </button>
              </>
            ) : (
              <p>{t("countriesCities.waitingForHostSettings")}</p>
            )}
          </section>
        )}
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="countries-cities-root">
        <InGameMultiplayerOverlay lobby={lobby} maxPlayers={8} />
        <section className="countries-cities-card countries-cities-center">
          <h2>{t("countriesCities.setupTitle")}</h2>
          <ul className="countries-cities-chip-list">
            {categories.map((category) => (
              <li key={category}>{category}</li>
            ))}
          </ul>
          <p>{t(`countriesCities.endMode.${endMode}`)}</p>
          <p>{t(`countriesCities.reviewMode.${hostControlsReview ? "host" : "players"}`)}</p>
          {isHost ? (
            <>
              <button className="countries-cities-primary" type="button" disabled={!hasAvailableRoundLetters} onClick={startInput}>
                {t("countriesCities.startRound")}
              </button>
              {!hasAvailableRoundLetters && <p>{t("countriesCities.allLettersUsed")}</p>}
            </>
          ) : (
            <p>{t("countriesCities.waitingForHostStart")}</p>
          )}
        </section>
      </div>
    );
  }

  if (phase === "input") {
    return (
      <div className="countries-cities-root">
        <InGameMultiplayerOverlay lobby={lobby} maxPlayers={8} />
        <section className="countries-cities-card">
          <div className="countries-cities-header">
            <h2>{t("countriesCities.inputTitle")}</h2>
            {secondsLeft !== null && <strong>{t("countriesCities.timer", { seconds: secondsLeft })}</strong>}
          </div>
          {currentLetter && (
            <div className="countries-cities-letter-card" aria-live="polite">
              <span>{t("countriesCities.roundLetter")}</span>
              <strong>{currentLetter}</strong>
              {usedLetters.length > 1 && <em>{t("countriesCities.usedLetters", { letters: usedLetters.join(", ") })}</em>}
            </div>
          )}
          <div className="countries-cities-grid">
            {categories.map((category) => (
              <label className="countries-cities-field" key={category}>
                <span>{category}</span>
                <input
                  value={answers[category] ?? ""}
                  disabled={hasSubmittedAnswers}
                  onChange={(event) => setAnswers((current) => ({ ...current, [category]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="countries-cities-actions">
            <button
              className={`countries-cities-primary countries-cities-submit-answers${hasSubmittedAnswers ? " countries-cities-submit-accepted" : ""}`}
              type="button"
              disabled={hasSubmittedAnswers}
              onClick={submitAnswers}
              aria-pressed={hasSubmittedAnswers}
            >
              {t(hasSubmittedAnswers ? "countriesCities.answersConfirmed" : "countriesCities.confirmAnswers")}
            </button>
          </div>
          <p>{t("countriesCities.donePlayers", { done: donePlayers.length, total: players.length })}</p>
        </section>
      </div>
    );
  }

  if (phase === "review" || phase === "reveal") {
    const answerGroups = groupsByCategory[currentCategory] ?? [];
    const revealAuthors = phase === "reveal";
    const showAuthorNames = revealAuthors || (isHost && hostControlsReview);

    return (
      <div className="countries-cities-root">
        <InGameMultiplayerOverlay lobby={lobby} maxPlayers={8} />
        <section className="countries-cities-card">
          <div className="countries-cities-header">
            <div>
              <h2>{t(revealAuthors ? "countriesCities.revealTitle" : "countriesCities.reviewTitle", { category: currentCategory })}</h2>
              <p>{t("countriesCities.categoryProgress", { current: categoryIndex + 1, total: categories.length })}</p>
            </div>
            {!revealAuthors && <strong>{t("countriesCities.reviewReady", { done: currentReady.length, total: requiredReviewApprovals })}</strong>}
          </div>
          {!revealAuthors && <p>{t(hostControlsReview ? "countriesCities.reviewHintHost" : "countriesCities.reviewHint")}</p>}
          <div className="countries-cities-scoring">
            {submissions.map((submission, index) => {
              const id = answerId(submission.playerId, currentCategory);
              const answer = submission.answers[currentCategory] || t("countriesCities.emptyAnswer");
              const selectedVote = votes[id]?.[lobby.localPlayer.id];
              const summary = getVoteSummary(votes[id]);
              const result = displayedFinalResults[id];
              const displayWinner = revealAuthors ? result?.winner ?? summary.winner : summary.winner;
              const displayPoints = revealAuthors ? result?.points ?? 0 : getAnswerPoints(submission.answers[currentCategory] ?? "", summary);
              const duplicateGroup = duplicateOverrides[id] ?? "";

              return (
                <article className="countries-cities-vote" key={id}>
                  <div>
                    <strong>{showAuthorNames ? submission.playerName : t("countriesCities.anonymousAnswer", { number: index + 1 })}</strong>
                    <span>{answer}</span>
                    {revealAuthors && <em>{t(`countriesCities.voteResult.${displayWinner}`)}</em>}
                  </div>
                  {!revealAuthors ? (
                    <div>
                      <span>{t("countriesCities.voteCounts", { ok: summary.ok, duplicate: summary.duplicate, wrong: summary.wrong })}</span>
                      <button
                        className={selectedVote === "ok" ? "countries-cities-selected" : undefined}
                        type="button"
                        disabled={hasAcceptedCurrentReview || (hostControlsReview && !isHost)}
                        onClick={() => vote(id, "ok")}
                      >
                        {t("countriesCities.vote.ok")}
                      </button>
                      <button
                        className={selectedVote === "duplicate" ? "countries-cities-selected" : undefined}
                        type="button"
                        disabled={hasAcceptedCurrentReview || (hostControlsReview && !isHost)}
                        onClick={() => vote(id, "duplicate")}
                      >
                        {t("countriesCities.vote.duplicate")}
                      </button>
                      <button
                        className={selectedVote === "wrong" ? "countries-cities-selected" : undefined}
                        type="button"
                        disabled={hasAcceptedCurrentReview || (hostControlsReview && !isHost)}
                        onClick={() => vote(id, "wrong")}
                      >
                        {t("countriesCities.vote.wrong")}
                      </button>
                      {isHost && selectedVote === "duplicate" && (
                        <select
                          value={duplicateGroup}
                          disabled={hasAcceptedCurrentReview}
                          onChange={(event) => setDuplicate(id, event.target.value || null)}
                          aria-label={t("countriesCities.duplicateSelect")}
                        >
                          <option value="">{t("countriesCities.notDuplicate")}</option>
                          {answerGroups
                            .filter((group) => group.key !== normalizeAnswer(submission.answers[currentCategory] ?? ""))
                            .map((group) => (
                              <option key={group.key} value={group.key}>
                                {t("countriesCities.duplicateOf", { answer: group.answers[0] })}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <strong>{t("countriesCities.points", { points: displayPoints })}</strong>
                  )}
                </article>
              );
            })}
          </div>
          {!revealAuthors ? (
            <div className="countries-cities-actions">
              <button
                className={acceptReviewButtonClassName}
                type="button"
                disabled={hasAcceptedCurrentReview || (hostControlsReview && !isHost)}
                onClick={acceptReview}
                aria-pressed={hasAcceptedCurrentReview}
              >
                {t(hasAcceptedCurrentReview ? "countriesCities.acceptedReview" : "countriesCities.acceptReview")}
              </button>
              {isHost && (
                <button type="button" disabled={!hasRequiredReviewApprovals} onClick={revealCategory}>
                  {t("countriesCities.revealAnswers")}
                </button>
              )}
            </div>
          ) : (
            isHost && (
              <button className="countries-cities-primary" type="button" onClick={nextCategory}>
                {categoryIndex + 1 >= categories.length ? t("countriesCities.showResults") : t("countriesCities.nextCategory")}
              </button>
            )
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="countries-cities-root">
      <section className="countries-cities-card countries-cities-center">
        <h2>{t("countriesCities.resultsTitle")}</h2>
        <ol className="countries-cities-score-list">
          {submissions
            .slice()
            .sort((a, b) => (displayedFinalScores[b.playerId] ?? 0) - (displayedFinalScores[a.playerId] ?? 0))
            .map((submission) => (
              <li key={submission.playerId}>
                <span>{submission.playerName}</span>
                <strong>{t("countriesCities.points", { points: displayedFinalScores[submission.playerId] ?? 0 })}</strong>
              </li>
            ))}
        </ol>
        {isHost && (
          <>
            <button className="countries-cities-primary" type="button" disabled={!hasAvailableRoundLetters} onClick={startInput}>
              {t("countriesCities.nextRound")}
            </button>
            {!hasAvailableRoundLetters && <p>{t("countriesCities.allLettersUsed")}</p>}
          </>
        )}
        <button
          type="button"
          onClick={() => {
            lobby.sendMessage({ type: "game:reset" });
            resetGame();
          }}
        >
          {t("countriesCities.reset")}
        </button>
      </section>
    </div>
  );
}
