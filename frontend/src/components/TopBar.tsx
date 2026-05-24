"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/useUser";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Documents" },
];

export default function TopBar() {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <header className="topbar">
      <Link className="logo" href="/">
        <div className="mark">L</div>
        <div className="word">LinguaSign</div>
      </Link>

      <nav>
        {NAV.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href} className={active ? "active" : ""}>
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="right">
        <ThemeToggle />
        {user ? (
          <div className="avatar-bubble" title={user.email ?? undefined}>
            {(user.email?.[0] ?? "U").toUpperCase()}
          </div>
        ) : (
          <Link className="cta ghost" style={{ padding: "8px 14px", fontSize: 12 }} href="/dashboard">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
