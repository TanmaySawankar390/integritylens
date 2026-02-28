"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getAuth } from "@/lib/auth";
import { useEffect, useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const auth = getAuth();

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!auth?.token && pathname !== "/login") router.replace("/login");
  }, [auth?.token, pathname, ready, router]);

  const onLogout = () => {
    clearAuth();
    router.replace("/login");
  };

  if (!ready) return null;

  const isAuthed = Boolean(auth?.token);
  const showNav = pathname !== "/login";

  return (
    <div className="min-h-screen">
      {showNav && (
        <div className="bg-[var(--brand)] text-[var(--brand-foreground)] shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/tests" className="text-lg font-semibold tracking-tight">
              ShikshaMitra
            </Link>
            <div className="flex items-center gap-3 text-sm">
              {auth?.teacher?.displayName ? (
                <span className="rounded-full bg-white/10 px-3 py-1">{auth.teacher.displayName}</span>
              ) : null}
              {isAuthed ? (
                <button
                  onClick={onLogout}
                  className="rounded-md bg-white/10 px-3 py-1 hover:bg-white/20"
                >
                  Logout
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
