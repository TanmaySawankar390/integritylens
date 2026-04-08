"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getAuth } from "@/lib/auth";
import { useEffect, useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [auth, setAuthState] = useState<ReturnType<typeof getAuth>>(null);

  useEffect(() => {
    const currentAuth = getAuth();
    setAuthState(currentAuth);
    setReady(true);

    if (!currentAuth?.token && pathname !== "/login") {
      router.replace("/login");
    }
  }, [pathname, router]);

  const onLogout = () => {
    clearAuth();
    setAuthState(null);
    router.replace("/login");
  };

  if (!ready) return null;

  const isAuthed = Boolean(auth?.token);
  const showNav = pathname !== "/login";

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {showNav && (
        <header className="sticky top-0 z-10 bg-[var(--surface)]/80 backdrop-blur-md border-b border-[var(--border)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/tests" className="flex items-center gap-2">
              <span className="text-xl font-medium tracking-tight text-[var(--brand)] font-serif">
                ShikshaMitra
              </span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              {auth?.teacher?.displayName ? (
                <span className="text-[var(--muted)] pl-4 border-l border-[var(--border)]">
                  {auth.teacher.displayName}
                </span>
              ) : null}
              {isAuthed ? (
                <button
                  onClick={onLogout}
                  className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Logout
                </button>
              ) : null}
            </div>
          </div>
        </header>
      )}
      <main className="flex-1 w-full mx-auto max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
