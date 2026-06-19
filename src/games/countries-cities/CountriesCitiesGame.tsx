import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GameStartMenu, type GameStartMenuAction } from "@/components/GameStartMenu";
import { useTranslation } from "@/i18n/useTranslation";
import { InGameMultiplayerOverlay, MultiplayerPanel, useMultiplayerLobby } from "@/multiplayer";
import type { GameResetMessage, GameSpecificMessage, GameStartMessage, PlayerProfile } from "@/multiplayer";
import { calculateAnswerScore, getRequiredApprovalCount, groupSimilarAnswers, normalizeAnswer } from "./countriesCities.logic";
import "./countriesCities.css";

type Phase = "menu" | "lobby" | "setup" | "input" | "scoring" | "results";
type EndMode = "timer" | "manual";
type Submission = { playerId: string; playerName: string; answers: Record<string, string> };
type Votes = Record<string, Record<string, boolean>>;
type DuplicateOverrides = Record<string, string>;
type SettingsMessage = GameSpecificMessage<"countries-cities:settings", { categories: string[]; endMode: EndMode }>;
type SubmitMessage = GameSpecificMessage<"countries-cities:submit", { player: PlayerProfile; answers: Record<string, string> }>;
type DoneMessage = GameSpecificMessage<"countries-cities:done", { playerId: string }>;
type DeadlineMessage = GameSpecificMessage<"countries-cities:deadline", { deadlineAt: number }>;
type ScoringMessage = GameSpecificMessage<"countries-cities:scoring", { submissions: Submission[] }>;
type VoteMessage = GameSpecificMessage<"countries-cities:vote", { answerId: string; accepted: boolean }>;
type DuplicateMessage = GameSpecificMessage<"countries-cities:duplicate", { answerId: string; groupKey: string }>;
type ResultsMessage = GameSpecificMessage<"countries-cities:results", { votes: Votes; duplicateOverrides: DuplicateOverrides }>;
type CountriesCitiesMessage = SettingsMessage | SubmitMessage | DoneMessage | DeadlineMessage | ScoringMessage | VoteMessage | DuplicateMessage | ResultsMessage | GameResetMessage | GameStartMessage;

const DEFAULT_CATEGORIES = ["Państwo", "Miasto", "Roślina", "Zwierzę", "Rzecz"];
const TIMER_MS = 10_000;
const answerId = (playerId: string, category: string): string => `${playerId}::${category}`;
const toProfile = (player: { id: string; name: string; color: string; emoji: string }): PlayerProfile => ({ id: player.id, name: player.name, color: player.color, emoji: player.emoji });

export default function CountriesCitiesGame(): React.ReactElement {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("menu");
  const [categoriesText, setCategoriesText] = useState(DEFAULT_CATEGORIES.join("\n"));
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [endMode, setEndMode] = useState<EndMode>("timer");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [donePlayers, setDonePlayers] = useState<string[]>([]);
  const [votes, setVotes] = useState<Votes>({});
  const [duplicateOverrides, setDuplicateOverrides] = useState<DuplicateOverrides>({});
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const upsertSubmission = useCallback((submission: Submission) => {
    setSubmissions((items) => [...items.filter((item) => item.playerId !== submission.playerId), submission]);
  }, []);

  const addDonePlayer = useCallback((playerId: string) => {
    setDonePlayers((items) => (items.includes(playerId) ? items : [...items, playerId]));
  }, []);

  const addVote = useCallback((id: string, voterId: string, accepted: boolean) => {
    setVotes((items) => ({ ...items, [id]: { ...(items[id] ?? {}), [voterId]: accepted } }));
  }, []);

  const resetRound = useCallback(() => {
    setAnswers({});
    setSubmissions([]);
    setDonePlayers([]);
    setVotes({});
    setDuplicateOverrides({});
    setDeadlineAt(null);
    setPhase("setup");
  }, []);

  const onMessage = useCallback((message: CountriesCitiesMessage) => {
    if (message.type === "countries-cities:settings") {
      setCategories(message.categories);
      setCategoriesText(message.categories.join("\n"));
      setEndMode(message.endMode);
      resetRound();
    } else if (message.type === "game:start") {
      setAnswers({});
      setSubmissions([]);
      setDonePlayers([]);
      setVotes({});
      setDuplicateOverrides({});
      setDeadlineAt(null);
      setPhase("input");
    } else if (message.type === "countries-cities:submit") {
      upsertSubmission({ playerId: message.player.id, playerName: message.player.name, answers: message.answers });
      addDonePlayer(message.player.id);
    } else if (message.type === "countries-cities:done") {
      addDonePlayer(message.playerId);
    } else if (message.type === "countries-cities:deadline") {
      setDeadlineAt(message.deadlineAt);
    } else if (message.type === "countries-cities:scoring") {
      setSubmissions(message.submissions);
      setVotes({});
      setDuplicateOverrides({});
      setPhase("scoring");
    } else if (message.type === "countries-cities:vote" && message.senderId) {
      addVote(message.answerId, message.senderId, message.accepted);
    } else if (message.type === "countries-cities:duplicate") {
      setDuplicateOverrides((items) => ({ ...items, [message.answerId]: message.groupKey }));
    } else if (message.type === "countries-cities:results") {
      setVotes(message.votes);
      setDuplicateOverrides(message.duplicateOverrides);
      setPhase("results");
    } else if (message.type === "game:reset") {
      resetRound();
    }
  }, [addDonePlayer, addVote, resetRound, upsertSubmission]);

  const lobby = useMultiplayerLobby<CountriesCitiesMessage>({ onGameMessage: onMessage });
  const players = useMemo(() => [lobby.localPlayer, ...lobby.remotePlayers], [lobby.localPlayer, lobby.remotePlayers]);
  const isHost = lobby.role === "host";
  const requiredApprovals = getRequiredApprovalCount(players.length);
  const parsedCategories = useMemo(() => categoriesText.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean), [categoriesText]);
  const secondsLeft = deadlineAt ? Math.max(0, Math.ceil((deadlineAt - now) / 1000)) : null;

  useEffect(() => {
    if (!deadlineAt || phase !== "input") return undefined;
    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [deadlineAt, phase]);

  const beginScoring = useCallback((items = submissions) => {
    const fullSubmissions = players.map((player) => items.find((item) => item.playerId === player.id) ?? {
      playerId: player.id,
      playerName: player.name,
      answers: Object.fromEntries(categories.map((category) => [category, ""])),
    });
    setSubmissions(fullSubmissions);
    setVotes({});
    setPhase("scoring");
    lobby.sendMessage({ type: "countries-cities:scoring", submissions: fullSubmissions });
  }, [categories, lobby, players, submissions]);

  useEffect(() => {
    if (!isHost || phase !== "input") return;
    if (endMode === "timer" && submissions.length > 0 && deadlineAt === null) {
      const nextDeadline = Date.now() + TIMER_MS;
      setDeadlineAt(nextDeadline);
      lobby.sendMessage({ type: "countries-cities:deadline", deadlineAt: nextDeadline });
      return;
    }
    const shouldEnd = endMode === "manual" ? donePlayers.length >= players.length : deadlineAt !== null && Date.now() >= deadlineAt;
    if (shouldEnd) beginScoring();
  }, [beginScoring, deadlineAt, donePlayers.length, endMode, isHost, lobby, phase, players.length, submissions.length, now]);

  const groupsByCategory = useMemo(() => Object.fromEntries(categories.map((category) => [category, groupSimilarAnswers(submissions.map((item) => item.answers[category] ?? ""))])), [categories, submissions]);
  const scores = useMemo(() => Object.fromEntries(submissions.map((submission) => [submission.playerId, categories.reduce((sum, category) => {
    const currentAnswerId = answerId(submission.playerId, category);
    const answer = submission.answers[category] ?? "";
    const approvals = Object.values(votes[currentAnswerId] ?? {}).filter(Boolean).length;
    const duplicateKey = duplicateOverrides[currentAnswerId];
    const group = duplicateKey
      ? groupsByCategory[category]?.find((item) => item.key === duplicateKey)
      : groupsByCategory[category]?.find((item) => item.answers.some((value) => normalizeAnswer(value) === normalizeAnswer(answer)));
    return sum + calculateAnswerScore({ answer, accepted: approvals >= requiredApprovals, duplicateCount: group?.answers.length ?? 1 });
  }, 0)])), [categories, duplicateOverrides, groupsByCategory, requiredApprovals, submissions, votes]);

  const publishSettings = (): void => {
    const cleanCategories = [...new Set(parsedCategories)];
    setCategories(cleanCategories);
    resetRound();
    lobby.sendMessage({ type: "countries-cities:settings", categories: cleanCategories, endMode });
  };

  const startInput = (): void => {
    resetRound();
    setPhase("input");
    lobby.sendMessage({ type: "game:start" });
  };

  const submitAnswers = (): void => {
    const player = toProfile(lobby.localPlayer);
    const submission = { playerId: player.id, playerName: player.name, answers: Object.fromEntries(categories.map((category) => [category, answers[category]?.trim() ?? ""])) };
    upsertSubmission(submission);
    addDonePlayer(player.id);
    lobby.sendMessage({ type: "countries-cities:submit", player, answers: submission.answers });
  };

  const markDone = (): void => {
    addDonePlayer(lobby.localPlayer.id);
    lobby.sendMessage({ type: "countries-cities:done", playerId: lobby.localPlayer.id });
  };


  const markDuplicate = (id: string, category: string, answer: string): void => {
    const targetGroup = groupsByCategory[category]?.find((group) => group.answers.some((value) => normalizeAnswer(value) === normalizeAnswer(answer))) ?? groupsByCategory[category]?.[0];
    if (!targetGroup) return;
    setDuplicateOverrides((items) => ({ ...items, [id]: targetGroup.key }));
    lobby.sendMessage({ type: "countries-cities:duplicate", answerId: id, groupKey: targetGroup.key });
  };

  const menuActions: GameStartMenuAction[] = [{ id: "online", title: t("countriesCities.online.title"), description: t("countriesCities.online.description"), icon: "🌍", featured: true, variant: "blue", actionLabel: t("countriesCities.online.join"), onSelect: () => setPhase("lobby") }];

  if (phase === "menu") return <div className="countries-cities-root"><GameStartMenu title={t("apps.countriesCities")} subtitle={t("countriesCities.subtitle")} actions={menuActions} /></div>;

  if (phase === "lobby") return <div className="countries-cities-root"><MultiplayerPanel lobby={lobby} title={t("countriesCities.online.title")} minPlayers={2} maxPlayers={8} /><button type="button" onClick={() => setPhase("menu")}>{t("countriesCities.backToMenu")}</button>{lobby.status === "connected" && <section className="countries-cities-card">{isHost ? <><label className="countries-cities-field"><span>{t("countriesCities.categoriesLabel")}</span><textarea value={categoriesText} onChange={(event) => setCategoriesText(event.target.value)} rows={7} /></label><label className="countries-cities-checkbox"><input type="checkbox" checked={endMode === "timer"} onChange={(event) => setEndMode(event.target.checked ? "timer" : "manual")} /><span>{t("countriesCities.timerModeLabel")}</span></label><p>{t("countriesCities.parsedCategories", { count: parsedCategories.length })}</p><button className="countries-cities-primary" type="button" disabled={parsedCategories.length === 0} onClick={publishSettings}>{t("countriesCities.saveSettings")}</button></> : <p>{t("countriesCities.waitingForHostSettings")}</p>}</section>}</div>;

  if (phase === "setup") return <div className="countries-cities-root"><InGameMultiplayerOverlay lobby={lobby} maxPlayers={8} /><section className="countries-cities-card countries-cities-center"><h2>{t("countriesCities.setupTitle")}</h2><ul className="countries-cities-chip-list">{categories.map((category) => <li key={category}>{category}</li>)}</ul><p>{t(`countriesCities.endMode.${endMode}`)}</p>{isHost ? <button className="countries-cities-primary" type="button" onClick={startInput}>{t("countriesCities.startRound")}</button> : <p>{t("countriesCities.waitingForHostStart")}</p>}</section></div>;

  if (phase === "input") return <div className="countries-cities-root"><InGameMultiplayerOverlay lobby={lobby} maxPlayers={8} /><section className="countries-cities-card"><div className="countries-cities-header"><h2>{t("countriesCities.inputTitle")}</h2>{secondsLeft !== null && <strong>{t("countriesCities.timer", { seconds: secondsLeft })}</strong>}</div><div className="countries-cities-grid">{categories.map((category) => <label className="countries-cities-field" key={category}><span>{category}</span><input value={answers[category] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [category]: event.target.value }))} /></label>)}</div><div className="countries-cities-actions"><button className="countries-cities-primary" type="button" onClick={submitAnswers}>{t("countriesCities.submitAnswers")}</button>{endMode === "manual" && <button type="button" onClick={markDone}>{t("countriesCities.markDone")}</button>}</div><p>{t("countriesCities.donePlayers", { done: donePlayers.length, total: players.length })}</p></section></div>;

  if (phase === "scoring") return <div className="countries-cities-root"><InGameMultiplayerOverlay lobby={lobby} maxPlayers={8} /><section className="countries-cities-card"><h2>{t("countriesCities.scoringTitle")}</h2><p>{t("countriesCities.requiredApprovals", { count: requiredApprovals })}</p><div className="countries-cities-scoring">{categories.map((category) => <article className="countries-cities-category" key={category}><h3>{category}</h3>{groupsByCategory[category]?.some((group) => group.answers.length > 1) && <p>{t("countriesCities.similarHint")}</p>}{submissions.map((submission) => { const id = answerId(submission.playerId, category); const approvals = Object.values(votes[id] ?? {}).filter(Boolean).length; return <div className="countries-cities-vote" key={id}><div><strong>{submission.playerName}</strong><span>{submission.answers[category] || t("countriesCities.emptyAnswer")}</span></div><div><span>{t("countriesCities.approvals", { count: approvals })}</span><button type="button" onClick={() => { addVote(id, lobby.localPlayer.id, true); lobby.sendMessage({ type: "countries-cities:vote", answerId: id, accepted: true }); }}>{t("countriesCities.accept")}</button><button type="button" onClick={() => { addVote(id, lobby.localPlayer.id, false); lobby.sendMessage({ type: "countries-cities:vote", answerId: id, accepted: false }); }}>{t("countriesCities.reject")}</button>{isHost && <button type="button" onClick={() => markDuplicate(id, category, submission.answers[category] ?? "")}>{t("countriesCities.markDuplicate")}</button>}</div></div>; })}</article>)}</div>{isHost ? <button className="countries-cities-primary" type="button" onClick={() => { lobby.sendMessage({ type: "countries-cities:results", votes, duplicateOverrides }); setPhase("results"); }}>{t("countriesCities.showResults")}</button> : <p>{t("countriesCities.waitingForHostResults")}</p>}</section></div>;

  return <div className="countries-cities-root"><section className="countries-cities-card countries-cities-center"><h2>{t("countriesCities.resultsTitle")}</h2><ol className="countries-cities-score-list">{submissions.slice().sort((a, b) => (scores[b.playerId] ?? 0) - (scores[a.playerId] ?? 0)).map((submission) => <li key={submission.playerId}><span>{submission.playerName}</span><strong>{t("countriesCities.points", { points: scores[submission.playerId] ?? 0 })}</strong></li>)}</ol>{isHost && <button className="countries-cities-primary" type="button" onClick={startInput}>{t("countriesCities.nextRound")}</button>}<button type="button" onClick={() => { lobby.sendMessage({ type: "game:reset" }); resetRound(); }}>{t("countriesCities.reset")}</button></section></div>;
}
