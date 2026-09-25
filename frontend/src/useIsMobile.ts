import { useEffect, useState } from "react";

// Width-only, not orientation-aware: a landscape phone (~800-850px CSS
// width) still gets the desktop side-panel layout under this breakpoint.
// That's an intentional scope cut -- in landscape there's enough spare
// width for a 280px side column to be tolerable, unlike portrait where it
// would eat nearly the whole screen. Revisit with an aspect-ratio query if
// landscape-phone users report the side panel feels cramped.
const MOBILE_QUERY = "(max-width: 760px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
