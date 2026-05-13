"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setActive(true);
    setProgress(0);

    const start = window.setTimeout(() => setProgress(72), 20);
    const finish = window.setTimeout(() => setProgress(100), 260);
    const hide = window.setTimeout(() => setActive(false), 460);

    return () => {
      window.clearTimeout(start);
      window.clearTimeout(finish);
      window.clearTimeout(hide);
    };
  }, [pathname]);

  return (
    <>
      <div
        className={`fixed left-0 top-0 z-[9999] h-0.5 bg-[var(--brand-accent)] shadow-[0_0_18px_rgba(255,107,44,0.55)] transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
        style={{ width: `${progress}%`, transitionProperty: "width, opacity", transitionDuration: "400ms, 200ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1), ease" }}
      />
      <div key={pathname} className="route-fade">
        {children}
      </div>
    </>
  );
}
