import { useEffect, useState } from "react";
import { Logo } from "./Icons";
import { Button } from "./ui";
import "./Header.css";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#privacy", label: "Who sees what" },
  { href: "#sides", label: "Ecosystems and builders" },
  { href: "#midnight", label: "Midnight design" },
];

/** Floating header. Switches to the light treatment while a white section sits under it. */
export function Header() {
  const [light, setLight] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      setScrolled(window.scrollY > 24);
      const probe = 36;
      const sheet = document.querySelector<HTMLElement>(".sheet");
      const overSheet = !!sheet && sheet.getBoundingClientRect().top <= probe;
      const dark = [...document.querySelectorAll<HTMLElement>("[data-surface='dark']")].some((el) => {
        if (overSheet && el.classList.contains("hero")) return false;
        const r = el.getBoundingClientRect();
        return r.top <= probe && r.bottom >= probe;
      });
      setLight(!dark);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <header className={`hdr${light ? " is-light" : ""}${scrolled ? " is-scrolled" : ""}${open ? " is-open" : ""}`}>
      <div className="wrap hdr-bar">
        <a className="hdr-brand" href="#top" aria-label="Senyap home">
          <Logo />
          <span>Senyap</span>
        </a>
        <nav className="hdr-nav" aria-label="Main">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hdr-actions">
          <span className="hdr-team">
            <Button href="/app/registry" variant="secondary" tone={light ? "light" : "dark"} size="sm">
              Register a team
            </Button>
          </span>
          <Button href="/app" size="sm" arrow>
            Open app
          </Button>
          <button className="hdr-menu" type="button" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
