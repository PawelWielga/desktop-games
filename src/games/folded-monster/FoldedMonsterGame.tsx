import React, { useMemo, useRef, useState } from "react";
import { usePeerClientRoom, usePeerHostRoom } from "@/multiplayer";
import type { PlayerProfile } from "@/multiplayer";
import { loadPlayerSettings } from "@/settings/player/playerSettings.storage";
import { GameStartMenu, type GameStartMenuAction } from "@/components/GameStartMenu";
import { useTranslation } from "@/i18n/useTranslation";
import "./foldedMonster.css";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 900;
const SECTION_COUNT = 3;
const SECTION_HEIGHT = CANVAS_HEIGHT / SECTION_COUNT;
const GUIDE_SIZE = 42;

type GameMode = "menu" | "play" | "onlineLobby";
type SectionIndex = 0 | 1 | 2;

type DrawPoint = {
  x: number;
  y: number;
};

type DrawStroke = {
  id: string;
  section: SectionIndex;
  points: DrawPoint[];
};

const SECTION_KEYS = ["head", "body", "legs"] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pointsToPath(points: DrawPoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return rest.reduce((path, point) => `${path} L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`, `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`);
}

function getActiveRange(section: SectionIndex): { min: number; max: number } {
  return {
    min: section === 0 ? 0 : section * SECTION_HEIGHT - GUIDE_SIZE,
    max: section === 2 ? CANVAS_HEIGHT : (section + 1) * SECTION_HEIGHT + GUIDE_SIZE,
  };
}

function getRelativePoint(event: React.PointerEvent<SVGSVGElement>, section: SectionIndex): DrawPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
  const range = getActiveRange(section);

  return {
    x: clamp(x, 0, CANVAS_WIDTH),
    y: clamp(y, range.min, range.max),
  };
}

export default function FoldedMonsterGame(): React.ReactElement {
  const { t } = useTranslation();
  const [mode, setMode] = useState<GameMode>("menu");
  const [activeSection, setActiveSection] = useState<SectionIndex>(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const drawingStrokeId = useRef<string | null>(null);
  const [onlineRole, setOnlineRole] = useState<"host" | "guest">("host");
  const [joinCode, setJoinCode] = useState("");
  const localPlayer = useMemo<PlayerProfile>(() => {
    const settings = loadPlayerSettings();
    const storedId = window.localStorage.getItem("folded-monster-player-id");
    const id = storedId ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `player-${Math.random().toString(36).slice(2, 10)}`);
    if (!storedId) window.localStorage.setItem("folded-monster-player-id", id);
    return { id, name: settings.name, color: settings.color, emoji: settings.emoji };
  }, []);
  const hostRoom = usePeerHostRoom({ localPlayer });
  const clientRoom = usePeerClientRoom({ localPlayer });
  const onlinePlayers = onlineRole === "host" ? [localPlayer, ...hostRoom.players] : clientRoom.players.length > 0 ? clientRoom.players : [localPlayer];
  const onlineStatus = onlineRole === "host" ? hostRoom.status : clientRoom.status;
  const onlineRoomCode = onlineRole === "host" ? hostRoom.roomCode : clientRoom.roomCode;
  const onlineReady = onlineRole === "host" && hostRoom.status === "connected" && onlinePlayers.length >= 3;

  const activeSectionName = t(`foldedMonster.section.${SECTION_KEYS[activeSection]}`);
  const progressText = t("foldedMonster.progress", { current: activeSection + 1, total: SECTION_COUNT });

  const menuActions = useMemo<GameStartMenuAction[]>(
    () => [
      {
        id: "online",
        title: t("foldedMonster.online.title"),
        description: t("foldedMonster.online.description"),
        icon: "🌐",
        actionLabel: t("foldedMonster.online.join"),
        featured: true,
        variant: "blue",
        onSelect: () => {
          setMode("onlineLobby");
          setOnlineRole("host");
          setActiveSection(0);
          setIsRevealed(false);
          setStrokes([]);
        },
      },
      {
        id: "local",
        title: t("foldedMonster.local.title"),
        description: t("foldedMonster.local.description"),
        icon: "👹",
        variant: "green",
        onSelect: () => {
          setMode("play");
          setActiveSection(0);
          setIsRevealed(false);
          setStrokes([]);
        },
      },
    ],
    [t]
  );

  const startStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isRevealed) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getRelativePoint(event, activeSection);
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    drawingStrokeId.current = id;
    setStrokes((current) => [...current, { id, section: activeSection, points: [point] }]);
  };

  const continueStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawingStrokeId.current || isRevealed) return;

    const point = getRelativePoint(event, activeSection);
    const strokeId = drawingStrokeId.current;

    setStrokes((current) =>
      current.map((stroke) => (stroke.id === strokeId ? { ...stroke, points: [...stroke.points, point] } : stroke))
    );
  };

  const finishStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drawingStrokeId.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    drawingStrokeId.current = null;
  };

  const undoLastStroke = () => {
    if (isRevealed) return;
    setStrokes((current) => {
      const lastActiveIndex = current.map((stroke) => stroke.section).lastIndexOf(activeSection);
      if (lastActiveIndex === -1) return current;
      return current.filter((_, index) => index !== lastActiveIndex);
    });
  };

  const clearActiveSection = () => {
    if (isRevealed) return;
    setStrokes((current) => current.filter((stroke) => stroke.section !== activeSection));
  };

  const goNext = () => {
    if (activeSection < 2) {
      setActiveSection((section) => (section + 1) as SectionIndex);
      return;
    }

    setIsRevealed(true);
  };

  const resetGame = () => {
    setActiveSection(0);
    setIsRevealed(false);
    setStrokes([]);
    drawingStrokeId.current = null;
  };

  const backToMenu = () => {
    hostRoom.close();
    clientRoom.close();
    resetGame();
    setMode("menu");
  };

  const createOnlineRoom = () => {
    clientRoom.close();
    setOnlineRole("host");
    void hostRoom.host();
  };

  const joinOnlineRoom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = joinCode.trim().toUpperCase();
    if (!normalizedCode) return;
    hostRoom.close();
    setOnlineRole("guest");
    void clientRoom.join(normalizedCode);
  };

  if (mode === "menu") {
    return (
      <div className="folded-monster-root folded-monster-root--menu">
        <GameStartMenu
          title={t("apps.foldedMonster")}
          subtitle={t("foldedMonster.subtitle")}
          actions={menuActions}
          className="folded-monster-start"
        />
      </div>
    );
  }

  if (mode === "onlineLobby") {
    return (
      <div className="folded-monster-root folded-monster-root--play">
        <header className="folded-monster-topbar">
          <div>
            <span className="folded-monster-eyebrow">{t("foldedMonster.onlineEyebrow")}</span>
            <h1>{t("foldedMonster.online.title")}</h1>
            <p>{t("foldedMonster.online.subtitle")}</p>
          </div>
          <div className="folded-monster-actions">
            <button type="button" onClick={backToMenu}>{t("foldedMonster.backToMenu")}</button>
          </div>
        </header>
        <main className="folded-monster-stage">
          <aside className="folded-monster-panel">
            <strong>{t("foldedMonster.connectionStatus", { status: t(`foldedMonster.status.${onlineStatus}`) })}</strong>
            {onlineRoomCode && <p>{t("foldedMonster.roomCode")}: <strong>{onlineRoomCode}</strong></p>}
            <p>{t("foldedMonster.playersProgress", { current: onlinePlayers.length, min: 3, max: 8 })}</p>
          </aside>
          <section className="folded-monster-paper-card">
            <div className="folded-monster-controls">
              <button type="button" className="folded-monster-primary" onClick={createOnlineRoom}>{t("foldedMonster.createRoom")}</button>
              <form onSubmit={joinOnlineRoom} className="folded-monster-inline-form">
                <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder="ABC12" aria-label={t("foldedMonster.roomCode")} />
                <button type="submit" disabled={!joinCode.trim()}>{t("foldedMonster.joinRoom")}</button>
              </form>
            </div>
            <div className="folded-monster-player-list">
              {onlinePlayers.map((player) => <span key={player.id} className="folded-monster-player-chip"><span>{player.emoji}</span>{player.name}</span>)}
            </div>
            {onlineRole === "host" ? <button type="button" className="folded-monster-primary" disabled={!onlineReady}>{t("foldedMonster.startOnline")}</button> : <p>{t("foldedMonster.waitingForHost")}</p>}
            <p className="folded-monster-muted">{t("foldedMonster.onlineWorkInProgress")}</p>
          </section>
        </main>
      </div>
    );
  }

  const currentStrokes = strokes.filter((stroke) => stroke.section === activeSection);
  const guideStrokes = activeSection > 0 ? strokes.filter((stroke) => stroke.section === activeSection - 1) : [];
  const revealStrokes = isRevealed ? strokes : [];
  const activeTop = activeSection * SECTION_HEIGHT;
  const guideTop = activeSection * SECTION_HEIGHT - GUIDE_SIZE;

  return (
    <div className="folded-monster-root folded-monster-root--play">
      <header className="folded-monster-topbar">
        <div>
          <span className="folded-monster-eyebrow">{progressText}</span>
          <h1>{isRevealed ? t("foldedMonster.revealTitle") : t("foldedMonster.turnTitle", { section: activeSectionName })}</h1>
          <p>{isRevealed ? t("foldedMonster.revealHint") : t(`foldedMonster.instruction.${SECTION_KEYS[activeSection]}`)}</p>
        </div>
        <div className="folded-monster-actions">
          <button type="button" onClick={backToMenu}>
            {t("foldedMonster.backToMenu")}
          </button>
          <button type="button" onClick={resetGame}>
            {t("foldedMonster.reset")}
          </button>
        </div>
      </header>

      <main className="folded-monster-stage">
        <aside className="folded-monster-panel" aria-label={t("foldedMonster.rulesAria")}>
          <strong>{t("foldedMonster.rulesTitle")}</strong>
          <ol>
            <li>{t("foldedMonster.rule.head")}</li>
            <li>{t("foldedMonster.rule.body")}</li>
            <li>{t("foldedMonster.rule.legs")}</li>
          </ol>
        </aside>

        <section className="folded-monster-paper-card">
          <div className="folded-monster-paper-frame">
            <svg
              className="folded-monster-paper"
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              role="img"
              aria-label={t("foldedMonster.canvasAria")}
              onPointerDown={startStroke}
              onPointerMove={continueStroke}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              onPointerLeave={finishStroke}
            >
              <defs>
                <clipPath id="folded-monster-guide-1">
                  <rect x="0" y={SECTION_HEIGHT - GUIDE_SIZE} width={CANVAS_WIDTH} height={GUIDE_SIZE * 2} />
                </clipPath>
                <clipPath id="folded-monster-guide-2">
                  <rect x="0" y={SECTION_HEIGHT * 2 - GUIDE_SIZE} width={CANVAS_WIDTH} height={GUIDE_SIZE * 2} />
                </clipPath>
              </defs>

              {[1, 2].map((divider) => (
                <line
                  key={divider}
                  className="folded-monster-fold-line"
                  x1="0"
                  x2={CANVAS_WIDTH}
                  y1={divider * SECTION_HEIGHT}
                  y2={divider * SECTION_HEIGHT}
                />
              ))}

              {isRevealed && (
                <g>
                  {revealStrokes.map((stroke) => (
                    <path key={stroke.id} className={`folded-monster-stroke folded-monster-stroke--${SECTION_KEYS[stroke.section]}`} d={pointsToPath(stroke.points)} />
                  ))}
                </g>
              )}

              {!isRevealed && activeSection > 0 && (
                <g clipPath={`url(#folded-monster-guide-${activeSection})`}>
                  {guideStrokes.map((stroke) => (
                    <path key={stroke.id} className="folded-monster-stroke folded-monster-stroke--guide" d={pointsToPath(stroke.points)} />
                  ))}
                </g>
              )}

              {!isRevealed && (
                <g>
                  <rect className="folded-monster-active-zone" x="0" y={activeTop} width={CANVAS_WIDTH} height={SECTION_HEIGHT} />
                  {currentStrokes.map((stroke) => (
                    <path key={stroke.id} className={`folded-monster-stroke folded-monster-stroke--${SECTION_KEYS[stroke.section]}`} d={pointsToPath(stroke.points)} />
                  ))}
                  {activeSection > 0 && (
                    <rect className="folded-monster-guide-zone" x="0" y={guideTop} width={CANVAS_WIDTH} height={GUIDE_SIZE * 2} />
                  )}
                </g>
              )}
            </svg>
          </div>

          <div className="folded-monster-controls">
            <button type="button" onClick={undoLastStroke} disabled={isRevealed}>
              {t("foldedMonster.undo")}
            </button>
            <button type="button" onClick={clearActiveSection} disabled={isRevealed}>
              {t("foldedMonster.clearSection")}
            </button>
            <button type="button" className="folded-monster-primary" onClick={goNext}>
              {activeSection < 2 ? t("foldedMonster.nextPlayer") : t("foldedMonster.reveal")}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
