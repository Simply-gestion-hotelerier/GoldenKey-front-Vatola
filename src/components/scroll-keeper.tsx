import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

function getMainScrollContainer(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("main"));
  const withOverflow = candidates.find((el) => el.classList.contains("overflow-auto") || el.classList.contains("overflow-y-auto"));
  if (withOverflow) return withOverflow;
  return candidates[0] ?? null;
}

function getSidebarScrollContainer(): HTMLElement | null {
  const sidebarRoot = document.querySelector<HTMLElement>('[data-sidebar="sidebar"]');
  if (!sidebarRoot) return null;
  // Try to find the inner scrollable container
  const inner = sidebarRoot.querySelector<HTMLElement>(".overflow-y-auto, .overflow-auto");
  return inner ?? sidebarRoot;
}

export function ScrollKeeper() {
  const location = useLocation();
  const lastMainScroll = useRef<number>(0);
  const perPathMain = useRef<Map<string, number>>(new Map());
  const lastSidebarScroll = useRef<number>(0);
  const perPathSidebar = useRef<Map<string, number>>(new Map());

  // Capture scroll positions before route changes
  useLayoutEffect(() => {
    return () => {
      const main = getMainScrollContainer();
      const sidebar = getSidebarScrollContainer();
      const topMain = main ? main.scrollTop : 0;
      const topSidebar = sidebar ? sidebar.scrollTop : 0;
      lastMainScroll.current = topMain;
      lastSidebarScroll.current = topSidebar;
      perPathMain.current.set(location.pathname, topMain);
      perPathSidebar.current.set(location.pathname, topSidebar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Restore scroll positions after route change
  useEffect(() => {
    let raf = 0;
    let tries = 0;

    const apply = () => {
      const main = getMainScrollContainer();
      const sidebar = getSidebarScrollContainer();
      let applied = false;

      if (main) {
        const savedMain = perPathMain.current.get(location.pathname);
        const toMain = typeof savedMain === "number" ? savedMain : lastMainScroll.current;
        if (typeof toMain === "number" && toMain > 0) {
          main.scrollTo({ top: toMain, behavior: "auto" });
        }
        applied = true;
      }

      if (sidebar) {
        const savedSide = perPathSidebar.current.get(location.pathname);
        const toSide = typeof savedSide === "number" ? savedSide : lastSidebarScroll.current;
        if (typeof toSide === "number" && toSide > 0) {
          sidebar.scrollTo({ top: toSide, behavior: "auto" });
        }
        applied = true;
      }

      if (applied) return;
      if (tries < 20) {
        tries += 1;
        raf = requestAnimationFrame(apply);
      }
    };

    raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  return null;
}

export default ScrollKeeper;
