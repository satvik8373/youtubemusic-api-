import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";

export interface PlayerTrack {
  id: string;
  title: string;
  uploader: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  viewCount?: number | null;
  likeCount?: number | null;
  uploadDate?: string | null;
}

interface PlayerContextValue {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isReady: boolean;
  isBuffering: boolean;
  playTrack: (track: PlayerTrack, newQueue?: PlayerTrack[]) => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  changeVolume: (vol: number) => void;
  toggleMute: () => void;
  playNext: () => void;
  playPrev: () => void;
  addToQueue: (track: PlayerTrack) => void;
}

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
    _ytApiLoading: boolean;
  }
}

declare namespace YT {
  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    loadVideoById(videoId: string): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    setVolume(volume: number): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    getVolume(): number;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    destroy(): void;
  }
  interface PlayerOptions {
    videoId?: string;
    height?: string | number;
    width?: string | number;
    playerVars?: Record<string, unknown>;
    events?: {
      onReady?: () => void;
      onStateChange?: (e: { data: number }) => void;
      onError?: (e: { data: number }) => void;
    };
  }
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be inside PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const playerRef = useRef<YT.Player | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const queueIndexRef = useRef(-1);
  const pendingVideoRef = useRef<string | null>(null);
  const playerReadyRef = useRef(false);
  const volumeRef = useRef(80);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime());
        const d = playerRef.current.getDuration();
        if (d > 0) setDuration(d);
      }
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPlayerReady = useCallback(() => {
    playerReadyRef.current = true;
    setIsReady(true);
    if (playerRef.current) {
      setDuration(playerRef.current.getDuration());
      playerRef.current.setVolume(volumeRef.current);
    }
    if (pendingVideoRef.current) {
      playerRef.current?.loadVideoById(pendingVideoRef.current);
      pendingVideoRef.current = null;
    }
  }, []);

  const onStateChange = useCallback(
    (e: { data: number }) => {
      const s = e.data;
      if (s === 1) {
        setIsPlaying(true);
        setIsBuffering(false);
        startTimer();
      } else if (s === 2) {
        setIsPlaying(false);
        stopTimer();
      } else if (s === 0) {
        setIsPlaying(false);
        stopTimer();
        setCurrentTime(0);
        const nextIdx = queueIndexRef.current + 1;
        if (nextIdx < queueRef.current.length) {
          const nextTrack = queueRef.current[nextIdx];
          queueIndexRef.current = nextIdx;
          setQueueIndex(nextIdx);
          setCurrentTrack(nextTrack);
          setDuration(0);
          playerRef.current?.loadVideoById(nextTrack.id);
        }
      } else if (s === 3) {
        setIsBuffering(true);
      }
    },
    [startTimer, stopTimer],
  );

  const createPlayer = useCallback(
    (videoId: string) => {
      playerRef.current = new window.YT.Player("yt-global-player", {
        videoId,
        height: "1",
        width: "1",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onStateChange,
        },
      });
    },
    [onPlayerReady, onStateChange],
  );

  const ensureApiLoaded = useCallback(
    (videoId: string) => {
      if (window.YT && window.YT.Player) {
        if (playerRef.current && playerReadyRef.current) {
          playerRef.current.loadVideoById(videoId);
        } else if (playerRef.current) {
          pendingVideoRef.current = videoId;
        } else {
          createPlayer(videoId);
        }
      } else {
        pendingVideoRef.current = videoId;
        if (!window._ytApiLoading) {
          window._ytApiLoading = true;
          window.onYouTubeIframeAPIReady = () => {
            createPlayer(pendingVideoRef.current!);
            pendingVideoRef.current = null;
          };
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          document.body.appendChild(tag);
        }
      }
    },
    [createPlayer],
  );

  useEffect(() => {
    if (!window._ytApiLoading && !window.YT) {
      window._ytApiLoading = true;
      window.onYouTubeIframeAPIReady = () => {
        if (pendingVideoRef.current) {
          createPlayer(pendingVideoRef.current);
          pendingVideoRef.current = null;
        }
      };
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, [createPlayer]);

  const playTrack = useCallback(
    (track: PlayerTrack, newQueue?: PlayerTrack[]) => {
      const q = newQueue ?? [track];
      const idx = q.findIndex((t) => t.id === track.id);
      queueRef.current = q;
      queueIndexRef.current = idx >= 0 ? idx : 0;
      setQueue(q);
      setQueueIndex(idx >= 0 ? idx : 0);
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(0);
      setIsReady(false);
      setIsPlaying(false);
      setIsBuffering(true);
      ensureApiLoaded(track.id);
    },
    [ensureApiLoaded],
  );

  const togglePlay = useCallback(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPlaying]);

  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current && playerReadyRef.current) {
      playerRef.current.seekTo(seconds, true);
      setCurrentTime(seconds);
    }
  }, []);

  const changeVolume = useCallback((vol: number) => {
    volumeRef.current = vol;
    setVolume(vol);
    if (playerRef.current && playerReadyRef.current) {
      playerRef.current.setVolume(vol);
      if (vol > 0) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volumeRef.current || 50);
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  }, [isMuted]);

  const playNext = useCallback(() => {
    const nextIdx = queueIndexRef.current + 1;
    if (nextIdx < queueRef.current.length) {
      const nextTrack = queueRef.current[nextIdx];
      queueIndexRef.current = nextIdx;
      setQueueIndex(nextIdx);
      setCurrentTrack(nextTrack);
      setCurrentTime(0);
      setDuration(0);
      setIsReady(false);
      setIsBuffering(true);
      playerRef.current?.loadVideoById(nextTrack.id);
    }
  }, []);

  const playPrev = useCallback(() => {
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    const prevIdx = queueIndexRef.current - 1;
    if (prevIdx >= 0) {
      const prevTrack = queueRef.current[prevIdx];
      queueIndexRef.current = prevIdx;
      setQueueIndex(prevIdx);
      setCurrentTrack(prevTrack);
      setCurrentTime(0);
      setDuration(0);
      setIsReady(false);
      setIsBuffering(true);
      playerRef.current?.loadVideoById(prevTrack.id);
    }
  }, [currentTime, seekTo]);

  const addToQueue = useCallback((track: PlayerTrack) => {
    queueRef.current = [...queueRef.current, track];
    setQueue((prev) => [...prev, track]);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        queueIndex,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isReady,
        isBuffering,
        playTrack,
        togglePlay,
        seekTo,
        changeVolume,
        toggleMute,
        playNext,
        playPrev,
        addToQueue,
      }}
    >
      {children}
      <div
        className="absolute opacity-0 pointer-events-none w-px h-px overflow-hidden"
        style={{ left: -9999, top: -9999 }}
      >
        <div id="yt-global-player" />
      </div>
    </PlayerContext.Provider>
  );
}
