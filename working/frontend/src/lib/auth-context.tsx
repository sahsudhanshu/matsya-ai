"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { toast } from "sonner";
import { getUserProfile, updateUserProfile } from "./api-client";

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "";
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";

const poolData = {
  UserPoolId: userPoolId,
  ClientId: clientId,
};
const userPool = new CognitoUserPool(poolData);

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  port?: string;
  phone?: string;
  region?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    phone: string,
  ) => Promise<void>;
  logout: () => void;
  /** Returns current JWT token for API calls */
  getToken: () => string;
  /** Update user state in memory (after profile save) */
  updateUser: (partial: Partial<User>) => void;
  /** Change password via Cognito */
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

export async function getFreshToken(): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !isCognitoConfigured) return resolve("");
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      return resolve(localStorage.getItem("matsya_ai_token") || "");
    }
    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(localStorage.getItem("matsya_ai_token") || "");
      } else {
        const token = session.getAccessToken().getJwtToken();
        localStorage.setItem("matsya_ai_token", token);
        resolve(token);
      }
    });
  });
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isCognitoConfigured = Boolean(userPoolId && clientId);

function toUserFromSession(
  session: CognitoUserSession,
  fallbackEmail: string,
): User {
  const payload = session.getIdToken().payload;
  return {
    id: (payload.sub as string) || fallbackEmail,
    name: (payload.name as string) || "User",
    email: (payload.email as string) || fallbackEmail,
    role: "fisherman",
    avatar: "",
    port: "",
    phone: "",
    region: "",
  };
}

function persistUserSession(nextUser: User, token: string): void {
  localStorage.setItem("matsya_ai_user", JSON.stringify(nextUser));
  localStorage.setItem("matsya_ai_token", token);
}

/** Hydrate user with profile data from DynamoDB (best-effort) */
async function hydrateProfile(baseUser: User): Promise<User> {
  try {
    const profile = await getUserProfile();
    
    // If backend auto-created the profile with the "Fisherman" placeholder,
    // but we have the user's real name from Cognito, sync it to the DB instantly!
    if (profile.name === "Fisherman" && baseUser.name && baseUser.name !== "User") {
        try {
            await updateUserProfile({ name: baseUser.name, email: baseUser.email });
            profile.name = baseUser.name;
        } catch (e) {
            console.error("Failed to auto-sync profile to backend", e);
        }
    }

    return {
      ...baseUser,
      name: profile.name || baseUser.name,
      avatar: profile.avatar || baseUser.avatar || "",
      port: profile.port || baseUser.port || "",
      phone: profile.phone || baseUser.phone || "",
      region: profile.region || baseUser.region || "",
      role: profile.role || baseUser.role,
    };
  } catch {
    // Profile not found yet, that's fine - use token data
    return baseUser;
  }
}

function mapCognitoError(err: unknown): Error {
  const maybeError = err as { code?: string; message?: string };
  const code = maybeError?.code;

  if (code === "NotAuthorizedException") {
    return new Error("Incorrect email or password.");
  }
  if (code === "UserNotFoundException") {
    return new Error("No account found for this email.");
  }
  if (code === "UsernameExistsException") {
    return new Error(
      "An account with this email already exists. Please sign in.",
    );
  }
  if (code === "InvalidPasswordException") {
    return new Error("Password does not meet Cognito policy requirements.");
  }
  if (code === "UserNotConfirmedException") {
    return new Error("Account is not confirmed yet.");
  }
  if (code === "PasswordResetRequiredException") {
    return new Error(
      "Password reset required. Please reset your password and try again.",
    );
  }
  if (
    code === "InvalidParameterException" &&
    maybeError?.message?.includes("SECRET_HASH")
  ) {
    return new Error(
      "Cognito app client is misconfigured: use a public client with no client secret.",
    );
  }

  return new Error(
    maybeError?.message || "Authentication failed. Please try again.",
  );
}

function assertCognitoConfigured(): void {
  if (!isCognitoConfigured) {
    throw new Error(
      "Cognito env is missing. Set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID in frontend/.env.local.",
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  // Keep a stable ref to logout so the event listener always calls the latest version
  const logoutRef = useRef<() => void>(() => { });

  useEffect(() => {
    if (!isCognitoConfigured) {
      setIsLoading(false);
      return;
    }

    // Check if there is an active session
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.getSession(
        async (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session || !session.isValid()) {
            logout();
            setIsLoading(false);
            return;
          }

          const baseUser = toUserFromSession(
            session,
            cognitoUser.getUsername(),
          );
          const token = session.getAccessToken().getJwtToken();
          persistUserSession(baseUser, token);

          // Hydrate with DynamoDB profile data
          const fullUser = await hydrateProfile(baseUser);
          setUser(fullUser);
          persistUserSession(fullUser, token);
          setIsLoading(false);
        },
      );
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);

    return new Promise<void>((resolve, reject) => {
      try {
        assertCognitoConfigured();
      } catch (err) {
        setIsLoading(false);
        reject(err);
        return;
      }

      if (!password) {
        setIsLoading(false);
        reject(new Error("Password is required for login."));
        return;
      }

      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async (result) => {
          const apiToken = result.getAccessToken().getJwtToken();
          const baseUser = toUserFromSession(result, email);
          persistUserSession(baseUser, apiToken);

          // Hydrate with DynamoDB profile
          const fullUser = await hydrateProfile(baseUser);
          setUser(fullUser);
          persistUserSession(fullUser, apiToken);
          setIsLoading(false);
          resolve();
        },
        onFailure: (err) => {
          setIsLoading(false);
          reject(mapCognitoError(err));
        },
      });
    });
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    phone: string,
  ) => {
    return new Promise<void>((resolve, reject) => {
      try {
        assertCognitoConfigured();
      } catch (err) {
        reject(err);
        return;
      }

      const attributeList = [
        new CognitoUserAttribute({ Name: "name", Value: name }),
        ...(phone && phone.trim() !== ""
          ? [new CognitoUserAttribute({ Name: "phone_number", Value: phone })]
          : []),
      ];

      userPool.signUp(email, password, attributeList, [], (err) => {
        if (err) {
          reject(mapCognitoError(err));
          return;
        }
        resolve();
      });
    });
  };

  const logout = () => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    setUser(null);

    // Clear auth tokens from localStorage
    localStorage.removeItem("matsya_ai_user");
    localStorage.removeItem("matsya_ai_token");

    // Clear ALL Cognito tokens written by amazon-cognito-identity-js
    // (prefixed with "CognitoIdentityServiceProvider.<clientId>")
    try {
      const cognitoPrefix = "CognitoIdentityServiceProvider";
      Object.keys(localStorage)
        .filter((k) => k.startsWith(cognitoPrefix))
        .forEach((k) => localStorage.removeItem(k));
    } catch { }

    // Clear persisted pane widths so next login starts fresh layout
    try { localStorage.removeItem("matsyaai_pane_widths"); } catch { }

    // Clear session storage fully (activeComponent, chat history, etc.)
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error("[Auth] Failed to clear session:", error);
    }

    // Reset Zustand store in-memory state so activeComponent, history etc.
    // are wiped immediately - prevents stale state leaking into next login
    try {
      // Dynamic import avoids circular dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useAgentFirstStore } = require("@/lib/stores/agent-first-store");
      useAgentFirstStore.getState().logout();
    } catch { }
  };

  // Keep ref up-to-date so the event listener always calls the latest logout
  logoutRef.current = logout;

  // Handle token expiry from API calls (401 responses dispatch this event)
  useEffect(() => {
    const handleUnauthorized = () => {
      logoutRef.current();
      toast.error("Your session has expired. Please sign in again.");
      router.replace("/login");
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getToken = (): string => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("matsya_ai_token") || "";
  };

  const updateUser = (partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      // Keep localStorage in sync
      const token = localStorage.getItem("matsya_ai_token") || "";
      persistUserSession(updated, token);
      return updated;
    });
  };

  const changePassword = async (
    oldPassword: string,
    newPassword: string,
  ): Promise<void> => {
    assertCognitoConfigured();

    return new Promise<void>((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        reject(new Error("No active session. Please log in again."));
        return;
      }

      cognitoUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session || !session.isValid()) {
            reject(new Error("Session expired. Please log in again."));
            return;
          }

          cognitoUser.changePassword(oldPassword, newPassword, (changeErr) => {
            if (changeErr) {
              reject(mapCognitoError(changeErr));
              return;
            }
            resolve();
          });
        },
      );
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        getToken,
        updateUser,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
