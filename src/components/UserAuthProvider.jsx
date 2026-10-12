import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getUserSupabase } from "../lib/supabase";
import UserAuthModal from "./UserAuthModal";

const AI_AUTH_REQUEST_MARKER = "careerfit-ai-access-request-after-auth";
const AI_AUTH_REQUEST_MARKER_TTL_MS = 15 * 60 * 1000;

const getAuthenticationMethod = (session) => {
  try {
    const payload = session?.access_token?.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    const methods = Array.isArray(claims?.amr) ? claims.amr.map((entry) => entry?.method) : [];
    if (methods.includes("password")) return "password";
    if (methods.length > 0) return "magic-link";
  } catch {
    // This is a UI-only hint. Authorization remains server-side.
  }
  return null;
};

const UserAuthContext = createContext({
  user: null,
  authenticationMethod: null,
  authVersion: 0,
  isAuthReady: false,
  isAuthenticationOpen: false,
  requestAuthentication: () => {},
  consumeAiAuthRequestOrigin: () => false,
  signOut: async () => false,
});

export function UserAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authenticationMethod, setAuthenticationMethod] = useState(null);
  const [authVersion, setAuthVersion] = useState(0);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authLanguage, setAuthLanguage] = useState("ar");
  const [authOrigin, setAuthOrigin] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authFlow, setAuthFlow] = useState("default");
  const authOriginRef = useRef(null);
  const authenticationCompletedRef = useRef(false);

  useEffect(() => {
    const userSupabase = getUserSupabase();
    if (!userSupabase) {
      setIsAuthReady(true);
      return undefined;
    }

    let isActive = true;
    const setAuthenticatedUser = (nextUser, session, explicitMethod = null) => {
      setUser(nextUser);
      setAuthenticationMethod(nextUser ? (explicitMethod || getAuthenticationMethod(session)) : null);
      setAuthVersion((version) => version + 1);
    };

    userSupabase.auth.getSession()
      .then(({ data }) => {
        if (isActive) setAuthenticatedUser(data.session?.user ?? null, data.session);
      })
      .catch(() => {
        if (isActive) setAuthenticatedUser(null, null);
      })
      .finally(() => {
        if (isActive) setIsAuthReady(true);
      });

    const { data: authListener } = userSupabase.auth.onAuthStateChange((event, session) => {
      setAuthenticatedUser(session?.user ?? null, session);
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        authOriginRef.current = "career-profile";
        authenticationCompletedRef.current = false;
        setAuthOrigin("career-profile");
        setAuthFlow("recovery");
        setIsAuthModalOpen(true);
      }
    });

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const requestAuthentication = (language = "ar", origin = null, email = "") => {
    authOriginRef.current = origin;
    authenticationCompletedRef.current = false;
    if (origin === "assistant") {
      try {
        window.localStorage.setItem(AI_AUTH_REQUEST_MARKER, String(Date.now()));
      } catch {
        // Authentication remains available if private browsing blocks storage.
      }
    } else {
      try {
        window.localStorage.removeItem(AI_AUTH_REQUEST_MARKER);
      } catch {
        // A form-origin authentication flow can still continue without storage.
      }
    }
    setAuthLanguage(language);
    setAuthOrigin(origin);
    setAuthEmail(origin === "application" ? String(email || "").trim().toLowerCase() : "");
    setAuthFlow("default");
    setIsAuthModalOpen(true);
  };

  const consumeAiAuthRequestOrigin = () => {
    if (authOriginRef.current === "assistant") {
      authOriginRef.current = null;
      try {
        window.localStorage.removeItem(AI_AUTH_REQUEST_MARKER);
      } catch {
        // The in-memory marker is enough when storage is unavailable.
      }
      return true;
    }

    try {
      const requestedAt = Number(window.localStorage.getItem(AI_AUTH_REQUEST_MARKER));
      if (!Number.isFinite(requestedAt) || Date.now() - requestedAt > AI_AUTH_REQUEST_MARKER_TTL_MS) {
        window.localStorage.removeItem(AI_AUTH_REQUEST_MARKER);
        return false;
      }

      window.localStorage.removeItem(AI_AUTH_REQUEST_MARKER);
      return true;
    } catch {
      return false;
    }
  };

  const closeAuthentication = () => {
    if (!authenticationCompletedRef.current && authOriginRef.current === "assistant") {
      try {
        window.localStorage.removeItem(AI_AUTH_REQUEST_MARKER);
      } catch {
        // The modal can still close when storage is unavailable.
      }
    }

    if (!authenticationCompletedRef.current) authOriginRef.current = null;
    authenticationCompletedRef.current = false;
    setAuthOrigin(null);
    setAuthEmail("");
    setAuthFlow("default");
    setIsAuthModalOpen(false);
  };

  const signOut = async () => {
    const userSupabase = getUserSupabase();
    if (!userSupabase) {
      setUser(null);
      setAuthenticationMethod(null);
      setAuthVersion((version) => version + 1);
      closeAuthentication();
      return true;
    }

    const { error } = await userSupabase.auth.signOut();
    if (error) return false;

    // Clear the UI immediately; the auth listener provides the same state update.
    setUser(null);
    setAuthenticationMethod(null);
    setAuthVersion((version) => version + 1);
    closeAuthentication();
    return true;
  };

  return (
    <UserAuthContext.Provider value={{ user, authenticationMethod, authVersion, isAuthReady, isAuthenticationOpen: isAuthModalOpen, requestAuthentication, consumeAiAuthRequestOrigin, signOut }}>
      {children}
      <UserAuthModal
        isOpen={isAuthModalOpen}
        language={authLanguage}
        authOrigin={authOrigin}
        applicationEmail={authEmail}
        authFlow={authFlow}
        onClose={closeAuthentication}
        onAuthenticated={(nextUser, explicitMethod = null) => {
          authenticationCompletedRef.current = true;
          setUser(nextUser);
          setAuthenticationMethod(explicitMethod);
          setAuthVersion((version) => version + 1);
        }}
      />
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  return useContext(UserAuthContext);
}
