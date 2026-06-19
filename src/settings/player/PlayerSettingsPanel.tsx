import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePlayerSettings } from "./PlayerSettingsContext";
import "./player-settings.css";

/**
 * Accessible, responsive Player Settings panel
 * - Modal on small viewports; inline/drawer capable via props
 * - Full keyboard navigation and focus management
 * - ARIA attributes and labels
 */

export type PlayerSettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  variant?: "modal" | "inline" | "drawer";
  /** Optional: initial focus selector inside the panel */
  initialFocusSelector?: string;
};

type EmojiPickerTarget = "player" | "ai";

const EMOJI_OPTIONS = [
  "😀", "😎", "🤖", "👾", "🐱", "🐶", "🦊", "🐼",
  "🐸", "🐵", "🦄", "🐲", "🦖", "🚀", "⭐", "🔥",
  "⚡", "💎", "🎮", "🎲", "🏆", "👑", "❤️", "💙",
  "💚", "💛", "🟣", "❌", "⭕", "🍕", "🍩", "🍀",
];

function useFocusTrap(enabled: boolean, containerRef: React.RefObject<HTMLElement>, initialSelector?: string) {
  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const focusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      );

    // Initial focus
    const tryInitial = () => {
      if (initialSelector) {
        const pref = container.querySelector<HTMLElement>(initialSelector);
        if (pref) {
          pref.focus();
          return true;
        }
      }
      const first = focusable()[0];
      if (first) first.focus();
      return !!first;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = focusable();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const prevActive = document.activeElement as HTMLElement | null;
    const cleanupFocus = () => {
      if (prevActive && typeof prevActive.focus === "function") {
        prevActive.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // Delay to ensure open animation does not steal focus
    const id = window.setTimeout(() => tryInitial(), 20);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKeyDown);
      cleanupFocus();
    };
  }, [enabled, containerRef, initialSelector]);
}

export default function PlayerSettingsPanel(props: PlayerSettingsPanelProps): React.ReactElement | null {
  const { open, onClose, variant = "modal", initialFocusSelector } = props;
  const { settings, setName, setColor, setEmoji, setAiColor, setAiEmoji, reset } = usePlayerSettings();

  const titleId = useId();
  const descId = useId();
  const emojiPickerTitleId = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  const isModal = variant === "modal" || variant === "drawer";

  // Cast is safe because HTMLDivElement extends HTMLElement and our ref will be non-null during trap usage
  useFocusTrap(open && isModal, containerRef as unknown as React.RefObject<HTMLElement>, initialFocusSelector);

  // Local form state with validation
  const [name, setNameState] = useState(settings.name);
  const [color, setColorState] = useState(settings.color);
  const [emoji, setEmojiState] = useState(settings.emoji);
  const [aiColor, setAiColorState] = useState(settings.aiColor);
  const [aiEmoji, setAiEmojiState] = useState(settings.aiEmoji);
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<EmojiPickerTarget | null>(null);

  // Close on Escape and outside click for modal/drawer
  useEffect(() => {
    if (!open || !isModal) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (emojiPickerTarget) {
        e.preventDefault();
        setEmojiPickerTarget(null);
        return;
      }
      onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (!containerRef.current) return;
      if (e.target instanceof Node && containerRef.current === e.target) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    containerRef.current?.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      containerRef.current?.removeEventListener("pointerdown", onPointer as any);
    };
  }, [open, isModal, onClose, emojiPickerTarget]);

  useEffect(() => {
    if (!open) return;
    setNameState(settings.name);
    setColorState(settings.color);
    setEmojiState(settings.emoji);
    setAiColorState(settings.aiColor);
    setAiEmojiState(settings.aiEmoji);
    setEmojiPickerTarget(null);
  }, [open, settings]);

  const invalids = useMemo(() => {
    const errs: Record<string, string | null> = {
      name: null,
      color: null,
      emoji: null,
      aiColor: null,
      aiEmoji: null,
    };
    if (!name.trim()) errs.name = "Name cannot be empty.";
    const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    if (!hex.test(color.trim())) errs.color = "Color must be a hex value like #dc3545 or #fff.";
    if (!hex.test(aiColor.trim())) errs.aiColor = "AI color must be a hex value like #ffc107 or #ff0.";
    // Basic emoji check (allow any single grapheme approximation)
    const emoj = (s: string) => s.trim().length > 0 && s.trim().length <= 4 && !/[<>{}]/.test(s);
    if (!emoj(emoji)) errs.emoji = "Provide a valid emoji.";
    if (!emoj(aiEmoji)) errs.aiEmoji = "Provide a valid emoji.";
    return errs;
  }, [name, color, emoji, aiColor, aiEmoji]);

  const hasErrors = Object.values(invalids).some(Boolean);
  const currentPickerEmoji = emojiPickerTarget === "player" ? emoji : aiEmoji;
  const currentPickerLabel = emojiPickerTarget === "player" ? "your emoji" : "AI emoji";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) return;
    setName(name.trim());
    setColor(color.trim());
    setEmoji(emoji.trim());
    setAiColor(aiColor.trim());
    setAiEmoji(aiEmoji.trim());
    // lightweight toast
    showToast("Player settings saved");
    if (isModal) onClose();
  };

  const onReset = () => {
    reset();
    showToast("Player settings reset");
    if (isModal) onClose();
  };

  const onEmojiSelect = (selectedEmoji: string) => {
    if (emojiPickerTarget === "player") {
      setEmojiState(selectedEmoji);
    }
    if (emojiPickerTarget === "ai") {
      setAiEmojiState(selectedEmoji);
    }
    setEmojiPickerTarget(null);
  };

  if (!open && isModal) return null;

  const panel = (
    <div
      className={["ps-panel", `ps-${variant}`].join(" ")}
      role={isModal ? "dialog" : "region"}
      aria-modal={isModal ? true : undefined}
      aria-labelledby={titleId}
      aria-describedby={descId}
      ref={containerRef}
      // For modal/drawer, the containerRef is overlay; inner panel stops propagation
    >
      <div className="ps-surface" role="document" onPointerDown={(e) => e.stopPropagation()}>
        <header className="ps-header">
          <h2 id={titleId} className="ps-title">Player Settings</h2>
          <button
            className="ps-close"
            type="button"
            aria-label="Close settings"
            title="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div id={descId} className="ps-desc">Customize your name, colors, and emoji for you and AI.</div>

        <form className="ps-form" onSubmit={onSubmit}>
          <section className="ps-section" aria-labelledby="ps-user">
            <h3 id="ps-user" className="ps-section-title">You</h3>
            <div className="ps-field">
              <label htmlFor="ps-name">Name</label>
              <input
                id="ps-name"
                type="text"
                value={name}
                onChange={(e) => setNameState(e.target.value)}
                maxLength={40}
                aria-invalid={!!invalids.name}
                aria-describedby={invalids.name ? "ps-name-err" : undefined}
              />
              {invalids.name && <div id="ps-name-err" className="ps-error" role="alert">{invalids.name}</div>}
            </div>

            <div className="ps-field">
              <label htmlFor="ps-color">Color</label>
              <div className="ps-color-row">
                <input
                  id="ps-color"
                  type="text"
                  inputMode="text"
                  placeholder="#dc3545"
                  value={color}
                  onChange={(e) => setColorState(e.target.value)}
                  aria-invalid={!!invalids.color}
                  aria-describedby={invalids.color ? "ps-color-err" : undefined}
                />
                <input
                  aria-label="Pick color"
                  title="Pick color"
                  className="ps-color"
                  type="color"
                  value={safeColorInput(color)}
                  onChange={(e) => setColorState(e.target.value)}
                />
                <div className="ps-swatch" style={{ background: safeColorInput(color) }} aria-hidden />
              </div>
              {invalids.color && <div id="ps-color-err" className="ps-error" role="alert">{invalids.color}</div>}
            </div>

            <div className="ps-field">
              <label htmlFor="ps-emoji">Emoji</label>
              <button
                id="ps-emoji"
                type="button"
                className="ps-emoji-trigger"
                aria-haspopup="dialog"
                aria-expanded={emojiPickerTarget === "player"}
                aria-invalid={!!invalids.emoji}
                aria-describedby={invalids.emoji ? "ps-emoji-err" : undefined}
                onClick={() => setEmojiPickerTarget("player")}
              >
                <span className="ps-emoji-preview" aria-hidden>{emoji}</span>
                <span>Choose emoji</span>
              </button>
              {invalids.emoji && <div id="ps-emoji-err" className="ps-error" role="alert">{invalids.emoji}</div>}
            </div>
          </section>

          <section className="ps-section" aria-labelledby="ps-ai">
            <h3 id="ps-ai" className="ps-section-title">AI Opponent</h3>

            <div className="ps-field">
              <label htmlFor="ps-ai-color">AI Color</label>
              <div className="ps-color-row">
                <input
                  id="ps-ai-color"
                  type="text"
                  placeholder="#ffc107"
                  value={aiColor}
                  onChange={(e) => setAiColorState(e.target.value)}
                  aria-invalid={!!invalids.aiColor}
                  aria-describedby={invalids.aiColor ? "ps-ai-color-err" : undefined}
                />
                <input
                  aria-label="Pick AI color"
                  title="Pick AI color"
                  className="ps-color"
                  type="color"
                  value={safeColorInput(aiColor)}
                  onChange={(e) => setAiColorState(e.target.value)}
                />
                <div className="ps-swatch" style={{ background: safeColorInput(aiColor) }} aria-hidden />
              </div>
              {invalids.aiColor && <div id="ps-ai-color-err" className="ps-error" role="alert">{invalids.aiColor}</div>}
            </div>

            <div className="ps-field">
              <label htmlFor="ps-ai-emoji">AI Emoji</label>
              <button
                id="ps-ai-emoji"
                type="button"
                className="ps-emoji-trigger"
                aria-haspopup="dialog"
                aria-expanded={emojiPickerTarget === "ai"}
                aria-invalid={!!invalids.aiEmoji}
                aria-describedby={invalids.aiEmoji ? "ps-ai-emoji-err" : undefined}
                onClick={() => setEmojiPickerTarget("ai")}
              >
                <span className="ps-emoji-preview" aria-hidden>{aiEmoji}</span>
                <span>Choose emoji</span>
              </button>
              {invalids.aiEmoji && <div id="ps-ai-emoji-err" className="ps-error" role="alert">{invalids.aiEmoji}</div>}
            </div>
          </section>

          <div className="ps-actions">
            <button type="submit" className="ps-primary">Save</button>
            <button type="button" className="ps-secondary" onClick={onReset}>Reset</button>
          </div>
        </form>

        {emojiPickerTarget && (
          <div className="ps-emoji-picker-backdrop" onPointerDown={() => setEmojiPickerTarget(null)}>
            <div
              className="ps-emoji-picker"
              role="dialog"
              aria-modal="true"
              aria-labelledby={emojiPickerTitleId}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="ps-emoji-picker-header">
                <h3 id={emojiPickerTitleId} className="ps-emoji-picker-title">Choose {currentPickerLabel}</h3>
                <button
                  type="button"
                  className="ps-close"
                  aria-label="Close emoji picker"
                  onClick={() => setEmojiPickerTarget(null)}
                >
                  ×
                </button>
              </div>
              <div className="ps-emoji-grid" role="listbox" aria-label={`Emoji options for ${currentPickerLabel}`}>
                {EMOJI_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="ps-emoji-option"
                    role="option"
                    aria-label={`Choose ${option}`}
                    aria-selected={option === currentPickerEmoji}
                    onClick={() => onEmojiSelect(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return panel;
  }

  // Inline variant just returns the surface without overlay
  return (
    <div className="ps-inline-wrapper" role="region" aria-labelledby={titleId}>
      {panel}
    </div>
  );
}

/** Helpers */
function safeColorInput(v: string): string {
  const t = v.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    return "#" + t.slice(1).split("").map((c) => c + c).join("").toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  // fallback to a valid color to avoid input[type=color] crash
  return "#000000";
}

/** Minimal, non-blocking toast */
let toastTimer: number | undefined;
function showToast(message: string): void {
  let el = document.getElementById("ps-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "ps-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = "ps-toast ps-toast-show";
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el?.classList.remove("ps-toast-show");
  }, 1800);
}
