import { useEffect, useState } from 'react';

// The web app is desktop-first by design (the phone experience is the
// native app). "Mobile" here means a phone-class device: narrow viewport
// AND a mobile UA, so a resized desktop browser window doesn't trip it.
const MOBILE_UA = /Android|iPhone|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini/i;
const NARROW_WIDTH = 860;

function computeIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const narrow = window.innerWidth < NARROW_WIDTH;
  const mobileUa = MOBILE_UA.test(window.navigator.userAgent);
  // iPadOS reports as "Macintosh" but is touch-only; treat touch + narrow as
  // mobile too so tablets in portrait also get the app-install experience.
  const touchNarrow = narrow && 'ontouchstart' in window;
  return (narrow && mobileUa) || touchNarrow;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(computeIsMobile);

  useEffect(() => {
    const onResize = () => setIsMobile(computeIsMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile;
}
