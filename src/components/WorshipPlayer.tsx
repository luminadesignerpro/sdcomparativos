import React, { useState } from 'react';
import { Play, Pause, SkipForward, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface Louvor {
  title: string;
  artist: string;
  audioUrl: string;
  verse: string;
}

interface WorshipPlayerProps {
  currentLouvor: Louvor;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onNext: () => void;
}

export const WorshipPlayer: React.FC<WorshipPlayerProps> = ({
  currentLouvor,
  isPlaying,
  onPlay,
  onStop,
  onNext,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isMobileBreakpoint = useIsMobile();

  // Detect actual mobile/touch devices (not just screen width)
  // This prevents landscape mode on phones from triggering desktop layout
  const isTouchDevice = typeof navigator !== 'undefined' && (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
  const isMobile = isMobileBreakpoint || isTouchDevice;

  // No mobile: renderiza inline (não fixed), sem z-index alto
  // No desktop: fixed bottom-right com hover expand
  return (
    <div
      className={cn(
        isMobile
          ? 'w-full px-4 py-2 pointer-events-auto'
          : 'fixed bottom-6 right-6 z-10 pointer-events-none'
      )}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
    >
      <div
        className={cn(
          'flex items-center gap-3 backdrop-blur-xl rounded-2xl shadow-2xl border transition-all duration-300',
          isMobile
            ? 'bg-black/80 border-amber-500/20 px-3 py-2 pointer-events-auto'
            : cn(
              'pointer-events-auto w-fit ml-auto',
              isHovered
                ? 'bg-black/90 border-amber-500/20 opacity-100 scale-100 px-4 py-3'
                : 'bg-black/10 border-transparent opacity-30 scale-95 px-2 py-2'
            )
        )}
      >
        <button
          onClick={isPlaying ? onStop : onPlay}
          className="touch-manipulation select-none w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-black transition-all hover:scale-105 shadow-lg shadow-amber-500/30 shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div
          className={cn(
            'text-left overflow-hidden transition-all duration-300',
            isMobile
              ? 'flex-1 min-w-0 opacity-100'
              : isHovered
                ? 'max-w-56 opacity-100 ml-1'
                : 'max-w-0 opacity-0 ml-0'
          )}
        >
          <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Music className="w-3 h-3 shrink-0" />
            Tocando
            {isPlaying && (
              <span className="inline-flex gap-0.5 ml-1">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-amber-400 rounded-full animate-pulse"
                    style={{ height: `${6 + i * 2}px`, animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            )}
          </p>
          <p className="text-white text-sm font-medium truncate">{currentLouvor.title}</p>
          <p className="text-gray-500 text-xs truncate">{currentLouvor.artist}</p>
        </div>

        <button
          onClick={onNext}
          className={cn(
            'touch-manipulation select-none text-gray-500 hover:text-amber-400 transition-all rounded-lg shrink-0',
            isMobile
              ? 'p-2 opacity-100'
              : isHovered
                ? 'opacity-100 p-2 hover:bg-white/5'
                : 'opacity-0 max-w-0 overflow-hidden p-0'
          )}
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default WorshipPlayer;
