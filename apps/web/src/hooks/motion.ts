import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function useReducedMotion() {
  const [reduce, setReduce] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** True once the element has entered the viewport (or immediately without IntersectionObserver). */
export function useInView<T extends Element>(rootMargin = "0px 0px -15% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, seen] as const;
}

const HEX = "0123456789abcdef";

/** Text that resolves from hex noise into the real string when `run` turns true. */
export function useDecrypt(text: string, run: boolean, duration = 900) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!run || reduce) {
      setOut(text);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const reveal = Math.floor(p * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        s += i < reveal || /[\s.,]/.test(c) ? c : HEX[(Math.random() * 16) | 0];
      }
      setOut(s);
      if (p < 1) raf = requestAnimationFrame(step);
      else setOut(text);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, run, duration, reduce]);
  return out;
}

/** Counts from 0 to `to` once `run` is true. */
export function useCountUp(to: number, run: boolean, duration = 1100, decimals = 0) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!run) return;
    if (reduce) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 4);
      setV(+(to * e).toFixed(decimals));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, run, duration, decimals, reduce]);
  return v;
}

/**
 * Scales `content` down so it always fits inside `box` (used by the hero so it fills exactly
 * one viewport at any browser zoom, where the CSS viewport can become very short).
 */
export function useFitInside(box: React.RefObject<HTMLElement>, content: React.RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const b = box.current;
    const c = content.current;
    if (!b || !c) return;
    const fit = () => {
      c.style.transform = "none";
      const cs = getComputedStyle(b);
      const availH = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const availW = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = c.scrollHeight;
      const w = c.scrollWidth;
      const s = Math.max(0.72, Math.min(1, availH / h, availW / w));
      c.style.transform = s < 1 ? `scale(${s})` : "none";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    ro.observe(c);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [box, content]);
}
