import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";

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
  streamMode: "direct" | "unavailable";
  playTrack: (track: PlayerTrack, newQueue?: PlayerTrack[]) => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  changeVolume: (vol: number) => void;
  toggleMute: () => void;
  playNext: () => void;
  playPrev: () => void;
  addToQueue: (track: PlayerTrack) => void;
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
  const [streamMode, setStreamMode] = useState<"direct" | "unavailable">("unavailable");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const queueIndexRef = useRef(-1);
  const volumeRef = useRef(80);

  useEffect(() => {
    const audio = new Audio();
    audio.volume = volumeRef.current / 100;
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => { if (isFinite(audio.duration)) setDuration(audio.duration); };
    const onPlay = () => { setIsPlaying(true); setIsBuffering(false); };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => { setIsBuffering(false); setIsReady(true); };
    const onEnded = () => {
      const nextIdx = queueIndexRef.current + 1;
      if (nextIdx < queueRef.current.length) {
        const next = queueRef.current[nextIdx];
        queueIndexRef.current = nextIdx;
        setQueueIndex(nextIdx);
        setCurrentTrack(next);
        setCurrentTime(0);
        setDuration(0);
        setIsReady(false);
        setIsBuffering(true);
        audio.src = `/api/stream/${next.id}`;
        audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };
    const onError = () => {
      setIsBuffering(false);
      setIsReady(false);
      setIsPlaying(false);
      setStreamMode("unavailable");
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const playTrack = useCallback((track: PlayerTrack, newQueue?: PlayerTrack[]) => {
    const q = newQueue ?? [track];
    const idx = Math.max(0, q.findIndex((t) => t.id === track.id));
    queueRef.current = q;
    queueIndexRef.current = idx;
    setQueue(q);
    setQueueIndex(idx);
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(0);
    setIsReady(false);
    setIsBuffering(true);
    setIsPlaying(false);
    setStreamMode("direct");

    const audio = audioRef.current;
    if (!audio) return;
    audio.src = `/api/stream/${track.id}`;
    audio.play().catch(() => {
      setStreamMode("unavailable");
      setIsBuffering(false);
    });
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio && isFinite(seconds)) {
      audio.currentTime = seconds;
      setCurrentTime(seconds);
    }
  }, []);

  const changeVolume = useCallback((vol: number) => {
    volumeRef.current = vol;
    setVolume(vol);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = vol / 100;
      audio.muted = false;
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  }, []);

  const playNext = useCallback(() => {
    const nextIdx = queueIndexRef.current + 1;
    if (nextIdx < queueRef.current.length) {
      const next = queueRef.current[nextIdx];
      queueIndexRef.current = nextIdx;
      setQueueIndex(nextIdx);
      setCurrentTrack(next);
      setCurrentTime(0);
      setDuration(0);
      setIsReady(false);
      setIsBuffering(true);
      setStreamMode("direct");
      const audio = audioRef.current;
      if (audio) {
        audio.src = `/api/stream/${next.id}`;
        audio.play().catch(() => setStreamMode("unavailable"));
      }
    }
  }, []);

  const playPrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const prevIdx = queueIndexRef.current - 1;
    if (prevIdx >= 0) {
      const prev = queueRef.current[prevIdx];
      queueIndexRef.current = prevIdx;
      setQueueIndex(prevIdx);
      setCurrentTrack(prev);
      setCurrentTime(0);
      setDuration(0);
      setIsReady(false);
      setIsBuffering(true);
      setStreamMode("direct");
      const audio2 = audioRef.current;
      if (audio2) {
        audio2.src = `/api/stream/${prev.id}`;
        audio2.play().catch(() => setStreamMode("unavailable"));
      }
    }
  }, []);

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
        streamMode,
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
    </PlayerContext.Provider>
  );
}
