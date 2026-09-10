import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export const LOUVORES = [
  { 
    title: "Deus de Obras Completas", 
    artist: "Kemilly Santos", 
    audioUrl: "/audio/deus-de-obras-completas.mp3",
    verse: "Colossenses 3:23 - E tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor."
  },
  { 
    title: "Bom Samaritano (Ao Vivo)", 
    artist: "Anderson Freire", 
    audioUrl: "/audio/bom-samaritano.mp3",
    verse: "Lucas 10:33 - Mas um samaritano, que ia de viagem, chegou ao pé dele e, vendo-o, moveu-se de íntima compaixão."
  },
  { 
    title: "Deus Está Te Ensinando", 
    artist: "Nathália Braga", 
    audioUrl: "/audio/deus-esta-te-ensinando.mp3",
    verse: "Provérbios 3:5 - Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento."
  },
];

export function useWorshipPlayer() {
  const { toast } = useToast();
  const [currentLouvor, setCurrentLouvor] = useState(LOUVORES[Math.floor(Math.random() * LOUVORES.length)]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playLouvor = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = 0.3;
    audio.src = currentLouvor.audioUrl;
    audioRef.current = audio;
    
    audio.play().then(() => {
      setIsPlaying(true);
      toast({ 
        title: "🎵 Tocando Louvor", 
        description: `${currentLouvor.title} - ${currentLouvor.artist}` 
      });
    }).catch((err) => {
      console.error("Erro ao tocar:", err);
      toast({ 
        title: "⚠️ Clique para tocar", 
        description: "Clique no botão ▶ para iniciar o louvor",
        variant: "destructive"
      });
    });

    audio.onended = () => {
      setIsPlaying(false);
      const nextIndex = (LOUVORES.findIndex(l => l.title === currentLouvor.title) + 1) % LOUVORES.length;
      setCurrentLouvor(LOUVORES[nextIndex]);
    };
  };

  const stopLouvor = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const nextLouvor = () => {
    stopLouvor();
    const nextIndex = (LOUVORES.findIndex(l => l.title === currentLouvor.title) + 1) % LOUVORES.length;
    setCurrentLouvor(LOUVORES[nextIndex]);
  };

  return {
    currentLouvor,
    isPlaying,
    playLouvor,
    stopLouvor,
    nextLouvor
  };
}
