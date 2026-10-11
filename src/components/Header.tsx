"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand, Icon } from "./studio/StudioIcons";

const links = [
  ["The process", "/#how-it-works"],
  ["Selected work", "/#showcase"],
  ["Pricing", "/#pricing"],
];
export default function Header() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="studio-header">
      <div className="studio-container studio-nav">
        <Link
          className="studio-home-link"
          href="/"
          aria-label="Image2Ad home"
          onClick={() => setOpen(false)}
        >
          <Brand />
        </Link>
        <nav className="studio-desktop-nav" aria-label="Main navigation">
          {links.map(([label, href]) => (
            <Link href={href} key={label}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="studio-nav-actions">
          <Link href="/signin" className="studio-signin">
            Log in
          </Link>
          <Link href="/signup" className="studio-button studio-button-small">
            Let’s create <Icon name="diagonal" width="15" height="15" />
          </Link>
          <button
            ref={toggle}
            className="studio-menu-toggle"
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="studio-mobile-menu"
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="studio-mobile-menu"
          className="studio-mobile-nav"
          aria-label="Mobile navigation"
        >
          {links.map(([label, href]) => (
            <Link href={href} key={label} onClick={() => setOpen(false)}>
              {label}
              <Icon name="diagonal" />
            </Link>
          ))}
          <Link
            href="/signin"
            onClick={() => setOpen(false)}
            aria-current={pathname === "/signin" ? "page" : undefined}
          >
            Log in
            <Icon name="arrow" />
          </Link>
        </nav>
      )}
    </header>
  );
}
