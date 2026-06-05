"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  address: string | null;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  // True while a login/signout redirect is in flight. Auth state changes during
  // that window would otherwise flash the wrong navbar on the *current* page
  // before the destination loads, so consumers treat this like "loading".
  transitioning: boolean;
  setTransitioning: (v: boolean) => void;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  transitioning: false,
  setTransitioning: () => {},
});

// Single source of truth for the signed-in user. Both the navbar and the pages
// read from this one fetch so they resolve together — no more navbar lagging
// behind the page (or vice-versa) on load.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    const refresh = () =>
      fetch(`/api/auth?t=${Date.now()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!active) return;
          setUser(d.user ?? null);
          setLoading(false);
        })
        .catch(() => active && setLoading(false));

    refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => refresh());

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, transitioning, setTransitioning }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
