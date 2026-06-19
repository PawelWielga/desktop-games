import React, { FormEvent, useMemo, useState } from "react";
import youtubeIcon from "@/assets/brand-icons/youtube.svg";
import "./youtube.css";

const DEFAULT_VIDEO_ID = "dQw4w9WgXcQ";

type ViewMode = "player" | "search";

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

const buildEmbedSrc = (source: PlayerSource): string => {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
  });

  if (source.type === "video") {
    return `https://www.youtube.com/embed/${source.value}?${params.toString()}`;
  }

  params.set("listType", "search");
  params.set("list", source.value);
  return `https://www.youtube.com/embed?${params.toString()}`;
};

export default function YouTubeApp(): React.ReactElement {
  const [mode, setMode] = useState<ViewMode>("player");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<PlayerSource>({
    type: "video",
    value: DEFAULT_VIDEO_ID,
    title: "YouTube",
  });

  const embedSrc = useMemo(() => buildEmbedSrc(source), [source]);

  const playDefaultVideo = (): void => {
    setSource({
      type: "video",
      value: DEFAULT_VIDEO_ID,
      title: "YouTube",
    });
    setMode("player");
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
            title: `Wyniki: ${phrase}`,
          }
    );
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
              <button type="submit">Odtwórz</button>
            </form>
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
        <main className="youtube-app__player" aria-label="Odtwarzacz YouTube">
          <iframe
            key={embedSrc}
            src={embedSrc}
            title={source.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </main>
      )}
    </div>
  );
}
