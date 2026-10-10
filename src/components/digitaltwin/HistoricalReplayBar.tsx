import React from "react";
import {
  Play,
  Pause,
  Square,
  FastForward,
  RotateCcw,
  Clock,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { HistoricalReplayConfig } from "../../services/digitaltwin/domain/DigitalTwinTypes";

interface HistoricalReplayBarProps {
  config: HistoricalReplayConfig;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSetSpeed: (speed: 1 | 5 | 10 | 50 | 100) => void;
  onSeek: (isoTime: string) => void;
  theme?: "dark" | "light";
}

export const HistoricalReplayBar: React.FC<HistoricalReplayBarProps> = ({
  config,
  onPlay,
  onPause,
  onStop,
  onSetSpeed,
  onSeek,
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const startEpoch = new Date(config.startTimeIso).getTime();
  const endEpoch = new Date(config.endTimeIso).getTime();
  const currentEpoch = new Date(config.currentPlaybackTimeIso).getTime();
  const totalDurationMs = Math.max(1, endEpoch - startEpoch);
  const progressPercent = Math.min(100, Math.max(0, ((currentEpoch - startEpoch) / totalDurationMs) * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const targetEpoch = startEpoch + (val / 100) * totalDurationMs;
    onSeek(new Date(targetEpoch).toISOString());
  };

  return (
    <div
      className={`p-3.5 rounded-2xl border transition shadow-xl font-mono text-xs ${
        isLight
          ? "bg-white border-slate-300 text-slate-800"
          : "bg-slate-900/95 border-slate-800 text-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide">HISTORICAL REPLAY</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  config.status === "PLAYING"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse"
                    : config.status === "PAUSED"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                ● {config.status}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Reproducción determinista de series temporales de planta (Edge TSDB / SQLite WAL)
            </span>
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 uppercase mr-1">Velocidad:</span>
          {([1, 5, 10, 50, 100] as const).map((spd) => (
            <button
              key={spd}
              onClick={() => onSetSpeed(spd)}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                config.playbackSpeed === spd
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : isLight
                  ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber Slider Track */}
      <div className="space-y-1.5 my-2">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPercent}
            onChange={handleSliderChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Inicio: {new Date(config.startTimeIso).toLocaleTimeString()}</span>
          <span className="font-bold text-indigo-400">
            Estampa Reproducida: {new Date(config.currentPlaybackTimeIso).toLocaleTimeString()} ({new Date(config.currentPlaybackTimeIso).toLocaleDateString()})
          </span>
          <span>Fin: {new Date(config.endTimeIso).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Playback Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          {config.status !== "PLAYING" ? (
            <button
              onClick={onPlay}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Reproducir</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-600/20"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pausar</span>
            </button>
          )}

          <button
            onClick={onStop}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition border ${
              isLight
                ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Detener</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-500 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
          <span>Datos históricos leídos desde buffer local determinista con calidad GOOD/RECONSTRUCTED</span>
        </div>
      </div>
    </div>
  );
};
