import React from "react";
import "./game-start-menu.css";

export type GameStartMenuAction = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  actionLabel?: string;
  featured?: boolean;
  variant?: "mint" | "green" | "blue";
  onSelect: () => void;
};

type GameStartMenuProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  actions: GameStartMenuAction[];
  className?: string;
};

export function GameStartMenu({ title, eyebrow = "Gra", subtitle, actions, className }: GameStartMenuProps): React.ReactElement {
  return (
    <section className={["game-start-menu", className].filter(Boolean).join(" ")} aria-label={`Menu gry ${title}`}>
      <div className="game-start-menu__hero" aria-hidden="true">
        <div className="game-start-menu__badge">
          <span className="game-start-menu__mark game-start-menu__mark--x">×</span>
          <span className="game-start-menu__mark game-start-menu__mark--o">○</span>
        </div>
      </div>

      <div className="game-start-menu__heading">
        <span className="game-start-menu__eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="game-start-menu__actions">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={[
              "game-start-card",
              action.featured ? "game-start-card--featured" : "",
              action.variant ? `game-start-card--${action.variant}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={action.onSelect}
          >
            <span className="game-start-card__icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="game-start-card__content">
              <strong>{action.title}</strong>
              <span>{action.description}</span>
            </span>
            <span className="game-start-card__cta">{action.actionLabel ?? "Rozpocznij"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
