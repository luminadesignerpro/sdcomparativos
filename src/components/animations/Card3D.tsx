import { ReactNode, useRef, useState, useCallback } from "react";

interface Card3DProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
}

export function Card3D({ children, className = "", intensity = 8 }: Card3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(800px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) translateZ(10px)`,
      boxShadow: `${-x * 20}px ${y * 20}px 40px hsl(43 74% 52% / 0.08)`,
    });
  }, [intensity]);

  const handleLeave = useCallback(() => {
    setStyle({ transform: "none", boxShadow: "none" });
  }, []);

  return (
    <div
      ref={cardRef}
      className={`transition-all duration-300 ease-out ${className}`}
      style={{ position: "relative", zIndex: 1, ...style }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </div>
  );
}
