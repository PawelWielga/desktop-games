import React, { FormEvent, useEffect, useMemo, useState } from "react";
import youtubeIcon from "@/assets/brand-icons/youtube.svg";
import { useTranslation } from "@/i18n/useTranslation";
import {
  getYouTubeIframeAllow,
  YOUTUBE_IFRAME_REFERRER_POLICY,
  YOUTUBE_IFRAME_SANDBOX,
} from "./youtubeIframePolicy";
import { buildDefaultYouTubeSrc } from "./youtubePreloader";
import "./youtube.css";

const DEFAULT_VIDEO_ID = "dQw4w9WgXcQ";
const PLAYER_LOAD_TIMEOUT_MS = 8000;
const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";

type ViewMode = "player" | "search";
type PlayerLoadState = "loading" | "ready" | "failed";

type PlayerSource =
  | {
      type: "video";
      value: string;
      title: string;
    }
  | {
      type: "search";
      value: string;
      title: string;
    };

const isBrowser = (): boolean => typeof window !== "undefined";

const getOrigin = (): string =>
  isBrowser() ? window.location.origin : "http://localhost";

const buildPlayerParams = (): URLSearchParams =>
  new URLSearchParams({
    autoplay: "1",
    enablejsapi: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    origin: getOrigin(),
  });

const getYouTubeVideoId = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      url.hostname.includes("youtube.com") ||
      url.hostname.includes("youtube-nocookie.com")
    ) {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;

      const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch?.[1]) return embedMatch[1];

      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch?.[1]) return shortsMatch[1];
    }
  } catch {
    return null;
  }

  return null;
};

const buildEmbedSrc = (source: PlayerSource): string => {
  if (source.type === "video" && source.value === DEFAULT_VIDEO_ID) {
    return buildDefaultYouTubeSrc(false);
  }

  const params = buildPlayerParams();

  if (source.type === "video") {
    return `${YOUTUBE_EMBED_ORIGIN}/embed/${source.value}?${params.toString()}`;
  }

  params.set("listType", "search");
  params.set("list", source.value);
  return `${YOUTUBE_EMBED_ORIGIN}/embed?${params.toString()}`;
};

export default function YouTubeApp(): React.ReactElement {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ViewMode>("player");
  const [query, setQuery] = useState("");
  const [playerLoadState, setPlayerLoadState] =
    useState<PlayerLoadState>("loading");
  const [playerReloadKey, setPlayerReloadKey] = useState(0);
  const [source, setSource] = useState<PlayerSource>({
    type: "video",
    value: DEFAULT_VIDEO_ID,
    title: "YouTube",
  });

  const embedSrc = useMemo(() => buildEmbedSrc(source), [source]);
  const iframeKey = `${embedSrc}:${playerReloadKey}`;
  const iframeAllow = getYouTubeIframeAllow();


  useEffect(() => {
    if (mode !== "player") return;

    setPlayerLoadState("loading");

    const timeout = window.setTimeout(() => {
      setPlayerLoadState((currentState) =>
        currentState === "loading" ? "failed" : currentState
      );
    }, PLAYER_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [embedSrc, mode, playerReloadKey]);

  const playDefaultVideo = (): void => {
    setSource({
      type: "video",
      value: DEFAULT_VIDEO_ID,
      title: "YouTube",
    });
    setPlayerReloadKey(0);
    setMode("player");
  };

  const retryPlayerLoad = (): void => {
    setPlayerLoadState("loading");
    setPlayerReloadKey((currentKey) => currentKey + 1);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const phrase = query.trim();
    if (!phrase) return;

    const videoId = getYouTubeVideoId(phrase);
    setSource(
      videoId
        ? {
            type: "video",
            value: videoId,
            title: "YouTube",
          }
        : {
            type: "search",
            value: phrase,
            title: `YouTube: ${phrase}`,
          }
    );
    setPlayerReloadKey(0);
    setMode("player");
  };

  return (
    <div className="youtube-app">
      <header className="youtube-app__toolbar">
        <button
          className="youtube-app__nav-button"
          type="button"
          onClick={() => setMode(mode === "player" ? "search" : "player")}
        >
          {mode === "player" ? t("youtube.back") : t("youtube.player")}
        </button>
        <div className="youtube-app__brand" aria-label="YouTube">
          <img
            className="youtube-app__brand-icon"
            src={youtubeIcon}
            alt=""
            aria-hidden="true"
          />
          <span>{source.title}</span>
        </div>
      </header>

      {mode === "search" ? (
        <main className="youtube-app__search-panel">
          <div className="youtube-app__search-card">
            <img
              className="youtube-app__logo"
              src={youtubeIcon}
              alt=""
              aria-hidden="true"
            />
            <h2>YouTube</h2>
            <p>{t("youtube.description")}</p>
            <form className="youtube-app__search-form" onSubmit={submitSearch}>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("youtube.placeholder")}
                aria-label={t("youtube.searchAria")}
              />
              <button type="submit">{t("youtube.searchOrPlay")}</button>
            </form>
            <button
              className="youtube-app__default-button"
              type="button"
              onClick={playDefaultVideo}
            >
              {t("youtube.defaultVideo")}
            </button>
          </div>
        </main>
      ) : (
        <main
          className="youtube-app__player"
          aria-label={t("youtube.playerAria")}
        >
          <iframe
            key={iframeKey}
            src={embedSrc}
            title={source.title}
            allow={iframeAllow}
            referrerPolicy={YOUTUBE_IFRAME_REFERRER_POLICY}
            sandbox={YOUTUBE_IFRAME_SANDBOX}
            loading="eager"
            allowFullScreen
            onLoad={() => setPlayerLoadState("ready")}
            onError={() => setPlayerLoadState("failed")}
          />

          {playerLoadState === "loading" && (
            <div className="youtube-app__player-state" aria-live="polite">
              <div className="youtube-app__player-state-card">
                {t("youtube.playerLoading")}
              </div>
            </div>
          )}

          {playerLoadState === "failed" && (
            <div className="youtube-app__player-state" role="alert">
              <div className="youtube-app__player-state-card">
                <h2>{t("youtube.playerFallbackTitle")}</h2>
                <p>{t("youtube.playerFallbackDescription")}</p>
                <button
                  className="youtube-app__player-retry-button"
                  type="button"
                  onClick={retryPlayerLoad}
                >
                  {t("youtube.retryPlayer")}
                </button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
