"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

interface UserLite {
  id: number;
  username: string;
  displayName: string;
  color: string;
  isAdmin?: boolean;
}

interface NavBarProps {
  currentUser: UserLite;
  allUsers: UserLite[];
}

const NAV_LINKS = [
  { label: "月历", href: "/" },
  { label: "周历", href: "/week" },
  { label: "时间轴", href: "/timeline" },
  { label: "任务", href: "/tasks" },
  { label: "设置", href: "/settings" },
] as const;

const ADMIN_LINK = { label: "管理员", href: "/admin" } as const;

function isLinkActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavBar({ currentUser, allUsers }: NavBarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownBtnRef = useRef<HTMLButtonElement>(null);

  // Determine current view label for the switcher button
  const otherUsers = allUsers.filter((u) => u.id !== currentUser.id);
  let viewLabel = "我自己";
  if (pathname === "/timeline") {
    viewLabel = "合并视图";
  } else if (pathname.startsWith("/u/")) {
    const slug = pathname.slice(3).split("/")[0];
    const found = otherUsers.find((u) => u.username === slug);
    if (found) viewLabel = found.displayName;
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !dropdownBtnRef.current?.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  return (
    <>
      <style>{`
        /* ── NavBar Base ─────────────────────────────────────────── */
        .nb-bar {
          background: oklch(99% 0.008 62);
          border-bottom: 1px solid oklch(88% 0.014 58);
          height: 52px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          padding: 0 20px;
          gap: 0;
          position: sticky;
          top: 0;
          z-index: 40;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
        }

        /* ── Logo ─────────────────────────────────────────────────── */
        .nb-logo {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.0625rem;
          font-weight: 400;
          color: oklch(34% 0.025 58);
          letter-spacing: 0.08em;
          text-decoration: none;
          flex-shrink: 0;
          white-space: nowrap;
          padding-right: 20px;
        }

        .nb-logo:hover {
          color: oklch(28% 0.028 58);
        }

        /* ── Center section ───────────────────────────────────────── */
        .nb-center {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          /* No overflow:hidden — would clip the view-switcher dropdown popup */
        }

        /* ── Nav links ───────────────────────────────────────────── */
        .nb-link {
          display: inline-flex;
          align-items: center;
          padding: 0 12px;
          height: 52px;
          font-size: 0.875rem;
          color: oklch(50% 0.020 58);
          text-decoration: none;
          letter-spacing: 0.04em;
          white-space: nowrap;
          position: relative;
          transition: color 0.12s ease;
        }

        .nb-link:hover {
          color: oklch(30% 0.025 58);
        }

        /* Active underline via pseudo-element */
        .nb-link[data-active="true"] {
          color: oklch(34% 0.025 58);
          font-weight: 500;
        }

        .nb-link[data-active="true"]::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 12px;
          right: 12px;
          height: 2px;
          background: oklch(52% 0.12 38);
          border-radius: 2px 2px 0 0;
        }

        /* ── Admin link special style ────────────────────────────── */
        .nb-link-admin {
          display: inline-flex;
          align-items: center;
          padding: 0 12px;
          height: 52px;
          font-size: 0.875rem;
          color: oklch(46% 0.040 38);
          text-decoration: none;
          letter-spacing: 0.04em;
          white-space: nowrap;
          position: relative;
          transition: color 0.12s ease;
        }

        .nb-link-admin:hover {
          color: oklch(30% 0.06 38);
        }

        .nb-link-admin[data-active="true"] {
          color: oklch(34% 0.08 38);
          font-weight: 500;
        }

        .nb-link-admin[data-active="true"]::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 12px;
          right: 12px;
          height: 2px;
          background: oklch(52% 0.12 38);
          border-radius: 2px 2px 0 0;
        }

        /* ── Right section ───────────────────────────────────────── */
        .nb-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          padding-left: 16px;
        }

        /* View switcher button */
        .nb-switcher-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          background: oklch(95% 0.012 62);
          border: 1px solid oklch(84% 0.014 58);
          border-radius: 14px;
          font-size: 0.8125rem;
          color: oklch(40% 0.022 58);
          font-family: inherit;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition: background-color 0.12s, border-color 0.12s, color 0.12s;
          outline: none;
          white-space: nowrap;
        }

        .nb-switcher-btn:hover {
          background: oklch(91% 0.014 62);
          border-color: oklch(74% 0.018 58);
          color: oklch(28% 0.025 58);
        }

        .nb-switcher-btn:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.3);
        }

        .nb-switcher-label {
          font-weight: 500;
        }

        /* Caret icon */
        .nb-caret {
          opacity: 0.55;
          transition: transform 0.18s ease;
          flex-shrink: 0;
        }

        .nb-caret[data-open="true"] {
          transform: rotate(180deg);
        }

        /* ── Dropdown ────────────────────────────────────────────── */
        .nb-dropdown-wrap {
          position: relative;
        }

        .nb-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 176px;
          background: oklch(99.5% 0.006 62);
          border: 1px solid oklch(86% 0.014 58);
          border-radius: 6px;
          box-shadow: 0 4px 16px oklch(22% 0.02 58 / 0.10), 0 1px 3px oklch(22% 0.02 58 / 0.06);
          padding: 6px 0;
          z-index: 50;
          animation: nb-drop-in 0.14s ease;
        }

        @keyframes nb-drop-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .nb-dropdown-section {
          padding: 2px 0;
        }

        .nb-dropdown-divider {
          height: 1px;
          background: oklch(90% 0.012 58);
          margin: 4px 0;
        }

        .nb-dropdown-caption {
          padding: 4px 14px 2px;
          font-size: 0.6875rem;
          font-weight: 600;
          color: oklch(60% 0.018 58);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .nb-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 14px;
          font-size: 0.875rem;
          color: oklch(36% 0.022 58);
          text-decoration: none;
          letter-spacing: 0.02em;
          transition: background-color 0.1s;
          background: transparent;
          border: none;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
        }

        .nb-dropdown-item:hover {
          background: oklch(95% 0.014 62);
        }

        .nb-dropdown-item[data-active="true"] {
          color: oklch(34% 0.025 58);
          font-weight: 500;
          background: oklch(93% 0.016 62);
        }

        .nb-dropdown-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Active checkmark indicator */
        .nb-dropdown-check {
          margin-left: auto;
          width: 14px;
          height: 14px;
          color: oklch(52% 0.12 38);
          flex-shrink: 0;
        }

        /* ── Welcome greeting ────────────────────────────────────── */
        .nb-welcome {
          font-size: 0.8125rem;
          color: oklch(46% 0.022 58);
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        /* ── Logout button ───────────────────────────────────────── */
        .nb-logout-btn {
          padding: 4px 12px;
          background: transparent;
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          font-size: 0.8125rem;
          color: oklch(46% 0.022 58);
          font-family: inherit;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: border-color 0.12s, color 0.12s;
          outline: none;
          white-space: nowrap;
        }

        .nb-logout-btn:hover {
          border-color: oklch(62% 0.022 58);
          color: oklch(32% 0.025 58);
        }

        .nb-logout-btn:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.3);
        }

        /* ── Mobile hamburger ────────────────────────────────────── */
        .nb-hamburger {
          display: none;
          padding: 6px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: oklch(44% 0.022 58);
          border-radius: 4px;
          transition: background-color 0.1s;
          outline: none;
          margin-left: 4px;
        }

        .nb-hamburger:hover {
          background: oklch(93% 0.014 62);
        }

        .nb-hamburger:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.3);
        }

        /* ── Mobile nav drawer ───────────────────────────────────── */
        .nb-mobile-drawer {
          display: none;
          flex-direction: column;
          background: oklch(99% 0.008 62);
          border-bottom: 1px solid oklch(88% 0.014 58);
          padding: 8px 0 12px;
          position: sticky;
          top: 52px;
          z-index: 39;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          animation: nb-slide-down 0.16s ease;
        }

        @keyframes nb-slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .nb-mobile-drawer[data-open="true"] {
          display: flex;
        }

        .nb-mobile-link {
          display: block;
          padding: 10px 20px;
          font-size: 0.9375rem;
          color: oklch(44% 0.022 58);
          text-decoration: none;
          letter-spacing: 0.04em;
          transition: background-color 0.1s, color 0.1s;
        }

        .nb-mobile-link:hover {
          background: oklch(95% 0.014 62);
        }

        .nb-mobile-link[data-active="true"] {
          color: oklch(52% 0.12 38);
          font-weight: 500;
        }

        /* ── Responsive: collapse nav links + switcher to drawer ─── */
        @media (max-width: 768px) {
          .nb-center {
            display: none;
          }

          .nb-hamburger {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .nb-welcome {
            display: none;
          }

          .nb-switcher-btn .nb-switcher-prefix {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .nb-bar {
            padding: 0 14px;
          }

          .nb-logo {
            font-size: 0.9375rem;
            padding-right: 12px;
          }
        }
      `}</style>

      {/* ── Desktop nav bar ── */}
      <header className="nb-bar">
        {/* Left: Logo */}
        <Link href="/" className="nb-logo" aria-label="日历记账 首页">
          日历记账
        </Link>

        {/* Center: nav links + view switcher */}
        <nav className="nb-center" aria-label="主导航">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nb-link"
              data-active={isLinkActive(l.href, pathname) ? "true" : "false"}
              aria-current={isLinkActive(l.href, pathname) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}

          {/* Admin link — only for admins */}
          {currentUser.isAdmin && (
            <Link
              href={ADMIN_LINK.href}
              className="nb-link-admin"
              data-active={isLinkActive(ADMIN_LINK.href, pathname) ? "true" : "false"}
              aria-current={isLinkActive(ADMIN_LINK.href, pathname) ? "page" : undefined}
            >
              {ADMIN_LINK.label}
            </Link>
          )}

          {/* View switcher — inline with nav on desktop */}
          <div className="nb-dropdown-wrap" style={{ marginLeft: "8px" }}>
            <button
              ref={dropdownBtnRef}
              type="button"
              className="nb-switcher-btn"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((v) => !v)}
            >
              <span className="nb-switcher-prefix" style={{ color: "oklch(60% 0.018 58)", fontSize: "0.75rem" }}>看：</span>
              <span className="nb-switcher-label">{viewLabel}</span>
              <svg
                className="nb-caret"
                data-open={dropdownOpen ? "true" : "false"}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {dropdownOpen && (
              <div ref={dropdownRef} className="nb-dropdown" role="menu">
                {/* My view */}
                <div className="nb-dropdown-section">
                  <Link
                    href="/"
                    className="nb-dropdown-item"
                    role="menuitem"
                    data-active={pathname === "/" ? "true" : "false"}
                    onClick={() => setDropdownOpen(false)}
                  >
                    <span
                      className="nb-dropdown-dot"
                      style={{ background: currentUser.color }}
                    />
                    我自己
                    {pathname === "/" && (
                      <svg className="nb-dropdown-check" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </Link>
                  <Link
                    href="/timeline"
                    className="nb-dropdown-item"
                    role="menuitem"
                    data-active={pathname === "/timeline" ? "true" : "false"}
                    onClick={() => setDropdownOpen(false)}
                  >
                    <span
                      className="nb-dropdown-dot"
                      style={{ background: "oklch(72% 0.08 280)" }}
                    />
                    合并视图
                    {pathname === "/timeline" && (
                      <svg className="nb-dropdown-check" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </Link>
                </div>

                {/* Other users */}
                {otherUsers.length > 0 && (
                  <>
                    <div className="nb-dropdown-divider" />
                    <div className="nb-dropdown-section">
                      <p className="nb-dropdown-caption">圈友</p>
                      {otherUsers.map((u) => {
                        const userPath = `/u/${u.username}`;
                        const active = pathname === userPath || pathname.startsWith(userPath + "/");
                        return (
                          <Link
                            key={u.id}
                            href={userPath}
                            className="nb-dropdown-item"
                            role="menuitem"
                            data-active={active ? "true" : "false"}
                            onClick={() => setDropdownOpen(false)}
                          >
                            <span
                              className="nb-dropdown-dot"
                              style={{ background: u.color }}
                            />
                            <span style={{ color: u.color, fontWeight: 500 }}>
                              {u.displayName}
                            </span>
                            {active && (
                              <svg className="nb-dropdown-check" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Right: welcome + logout */}
        <div className="nb-right">
          <span className="nb-welcome">
            你好，
            <span style={{ color: currentUser.color, fontWeight: 500 }}>
              {currentUser.displayName}
            </span>
          </span>
          <form action="/api/logout" method="POST">
            <button type="submit" className="nb-logout-btn">登出</button>
          </form>
          {/* Mobile hamburger */}
          <button
            type="button"
            className="nb-hamburger"
            aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {mobileMenuOpen ? (
                <>
                  <path d="M4.5 4.5L15.5 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M15.5 4.5L4.5 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <path d="M3 5.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M3 14.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      <nav
        className="nb-mobile-drawer"
        data-open={mobileMenuOpen ? "true" : "false"}
        aria-label="移动端导航"
      >
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="nb-mobile-link"
            data-active={isLinkActive(l.href, pathname) ? "true" : "false"}
            aria-current={isLinkActive(l.href, pathname) ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}

        {/* Admin link in mobile drawer — only for admins */}
        {currentUser.isAdmin && (
          <Link
            href={ADMIN_LINK.href}
            className="nb-mobile-link"
            data-active={isLinkActive(ADMIN_LINK.href, pathname) ? "true" : "false"}
            aria-current={isLinkActive(ADMIN_LINK.href, pathname) ? "page" : undefined}
            style={{ color: "oklch(46% 0.040 38)" }}
          >
            {ADMIN_LINK.label}
          </Link>
        )}

        {/* View switcher section in mobile */}
        <div style={{ padding: "8px 20px 2px", borderTop: "1px solid oklch(90% 0.012 58)", marginTop: "4px" }}>
          <p style={{ margin: "0 0 6px", fontSize: "0.75rem", fontWeight: 600, color: "oklch(60% 0.018 58)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            切换视角
          </p>
          <Link
            href="/"
            className="nb-mobile-link"
            style={{ padding: "8px 0" }}
            data-active={pathname === "/" ? "true" : "false"}
          >
            我自己
          </Link>
          <Link
            href="/timeline"
            className="nb-mobile-link"
            style={{ padding: "8px 0" }}
            data-active={pathname === "/timeline" ? "true" : "false"}
          >
            合并视图
          </Link>
          {otherUsers.map((u) => (
            <Link
              key={u.id}
              href={`/u/${u.username}`}
              className="nb-mobile-link"
              style={{ padding: "8px 0", color: u.color }}
              data-active={pathname === `/u/${u.username}` ? "true" : "false"}
            >
              {u.displayName}
            </Link>
          ))}
        </div>

        {/* Mobile welcome + logout */}
        <div style={{ padding: "8px 20px 4px", borderTop: "1px solid oklch(90% 0.012 58)", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.875rem", color: "oklch(46% 0.022 58)" }}>
            你好，<span style={{ color: currentUser.color, fontWeight: 500 }}>{currentUser.displayName}</span>
          </span>
          <form action="/api/logout" method="POST">
            <button
              type="submit"
              style={{
                padding: "5px 14px",
                background: "transparent",
                border: "1px solid oklch(82% 0.016 58)",
                borderRadius: "4px",
                fontSize: "0.8125rem",
                color: "oklch(46% 0.022 58)",
                fontFamily: "inherit",
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              登出
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
