import { ReactNode, useEffect, useRef, useState } from "react";

interface ViewTransitionProps {
  children: ReactNode;
  viewKey: string;
}

export function ViewTransition({ children, viewKey }: ViewTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const prevKey = useRef(viewKey);

  useEffect(() => {
    if (viewKey !== prevKey.current) {
      setIsVisible(false);
      const t = setTimeout(() => {
        setIsVisible(true);
        prevKey.current = viewKey;
      }, 50);
      return () => clearTimeout(t);
    } else {
      setIsVisible(true);
    }
  }, [viewKey]);

  return (
    <div
      className="w-full h-full transition-all duration-500"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? "perspective(1200px) rotateY(0deg) translateZ(0px) scale(1)"
          : "perspective(1200px) rotateY(-4deg) translateZ(-40px) scale(0.97)",
        transformOrigin: "left center",
      }}
    >
      {children}
    </div>
  );
}
