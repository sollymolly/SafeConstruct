"use client";

import { useEffect, useRef, useState } from "react";

export default function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        display: "inline-block",
        marginLeft: "1rem",
        verticalAlign: "middle",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="who"
        style={{
          border: "none",
          cursor: "pointer",
          font: "inherit",
          letterSpacing: "inherit",
        }}
      >
        {name}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 0.5rem)",
            right: 0,
            minWidth: "160px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            boxShadow: "var(--shadow)",
            backdropFilter: "blur(10px)",
            padding: "0.4rem",
            zIndex: 60,
          }}
        >
          <form action="/auth/signout" method="post" style={{ margin: 0 }}>
            <button
              type="submit"
              role="menuitem"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                padding: "0.6rem 0.8rem",
                borderRadius: "6px",
                fontWeight: 500,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--panel-2)";
                e.currentTarget.style.color = "var(--brand)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--muted)";
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
