import React, {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import youtubeIcon from "@/assets/brand-icons/youtube.svg";
import {
  attachDefaultYouTubePlayer,
  buildDefaultYouTubeSrc,
  canUsePreloadedYouTubePlayer,
  detachDefaultYouTubePlayer,
  startDefaultYouTubePreload,
} from "./youtubePreloader";
import "./youtube.css";

const DEFAULT_VIDEO_ID = "dQw4w9WgXcQ";

type ViewMode = "player" | "search";

type PlayerSource = {
  value: string;
  title: string;
};

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

    if (url.hostname.includes("youtube.com")) {
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

const buildYouTubeSearchUrl = (phrase: string): string => {
  const params = new URLSearchParams({ search_query: phrase });
  return `https://www.youtube.com/results?${params.toString()}`;
};

const buildEmbedSrc = (source: PlayerSource): string => {
  if (source.value === DEFAULT_VIDEO_ID) {
    return buildDefaultYouTubeSrc(false);
  }

  const params = new URLSearchParams({
    autoplay: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });

  return `https://www.youtube.com/embed/${source.value}?${params.toString()}`;
};

export default function YouTubeApp(): React.ReactElement {
  const [mode, setMode] = useState<ViewMode>("player");
  const [query, setQuery] = useState("");
  const [lastSearchUrl, setLastSearchUrl] = useState<string | null>(null);
  const [source, setSource] = useState<PlayerSource>({
    value: DEFAULT_VIDEO_ID,
    title: "YouTube",
  });
  const playerRef = useRef<HTMLElement | null>(null);

  const embedSrc = useMemo(() => buildEmbedSrc(source), [source]);
  const shouldUsePreloadedPlayer =
    mode === "player" &&
    source.value === DEFAULT_VIDEO_ID &&
    canUsePreloadedYouTubePlayer();

  useEffect(() => {
    startDefaultYouTubePreload();
  }, []);

  useLayoutEffect(() => {
    if (!shouldUsePreloadedPlayer) {
      detachDefaultYouTubePlayer();
      return;
    }

    attachDefaultYouTubePlayer(playerRef.current);

    return () => {
      detachDefaultYouTubePlayer();
    };
  }, [shouldUsePreloadedPlayer]);

  const playDefaultVideo = (): void => {
    setSource({
      value: DEFAULT_VIDEO_ID,
      title: "YouTube",
    });
    setLastSearchUrl(null);
    setMode("player");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const phrase = query.trim();
    if (!phrase) return;

    const videoId = getYouTubeVideoId(phrase);
    if (videoId) {
      setSource({
        value: videoId,
        title: "YouTube",
      });
      setLastSearchUrl(null);
      setMode("player");
      return;
    }

    const searchUrl = buildYouTubeSearchUrl(phrase);
    setLastSearchUrl(searchUrl);
    window.open(searchUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="youtube-app">
      <header className="youtube-app__toolbar">
        <button
          className="youtube-app__nav-button"
          type="button"
          onClick={() => setMode(mode === "player" ? "search" : "player")}
        >
          {mode === "player" ? "← Wstecz" : "Odtwarzacz"}
        </button>
        <div className="youtube-app__brand" aria-label="YouTube">
          <img className="youtube-app__brand-icon" src={youtubeIcon} alt="" aria-hidden="true" />
          <span>{source.title}</span>
        </div>
      </header>

      {mode === "search" ? (
        <main className="youtube-app__search-panel">
          <div className="youtube-app__search-card">
            <img className="youtube-app__logo" src={youtubeIcon} alt="" aria-hidden="true" />
            <h2>YouTube</h2>
            <p>Wpisz frazę, link do filmu albo samo ID filmu z YouTube.</p>
            <form className="youtube-app__search-form" onSubmit={submitSearch}>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Szukaj albo wklej link YouTube"
                aria-label="Szukaj w YouTube lub wklej link"
              />
              <button type="submit">Szukaj / odtwórz</button>
            </form>
            {lastSearchUrl && (
              <p className="youtube-app__search-hint">
                Wyniki wyszukiwania otworzyły się w YouTube. Jeśli nic się nie stało,
                <a href={lastSearchUrl} target="_blank" rel="noreferrer">
                  kliknij tutaj
                </a>
                .
              </p>
            )}
            <button
              className="youtube-app__default-button"
              type="button"
              onClick={playDefaultVideo}
            >
              Wróć do domyślnego filmu
            </button>
          </div>
        </main>
      ) : (
        <main
          ref={playerRef}
          className="youtube-app__player"
          aria-label="Odtwarzacz YouTube"
        >
          {!shouldUsePreloadedPlayer && (
            <iframe
              key={embedSrc}
              src={embedSrc}
              title={source.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </main>
      )}
    </div>
  );
}
