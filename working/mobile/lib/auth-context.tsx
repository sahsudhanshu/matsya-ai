import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from "amazon-cognito-identity-js";
import { toastService } from "./toast-service";

const TOKEN_KEY = "ocean_ai_token";
const USER_KEY = "ocean_ai_user";

const poolData = {
  UserPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || "",
  ClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || "",
};
const userPool = new CognitoUserPool(poolData);
const isCognitoConfigured = Boolean(poolData.UserPoolId && poolData.ClientId);

export interface User {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  role: "fisherman" | "admin";
  port?: string;
  customPort?: string;
  region?: string;
  boatType?:
    | "Trawler"
    | "Gill Netter"
    | "Purse Seiner"
    | "Catamaran"
    | "Country Craft"
    | "Motorized"
    | "Non-Motorized";
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    phone: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function assertCognitoConfigured() {
  if (!isCognitoConfigured) {
    throw new Error(
      "Cognito env is missing. Set EXPO_PUBLIC_COGNITO_USER_POOL_ID and EXPO_PUBLIC_COGNITO_CLIENT_ID in mobile/.env.",
    );
  }
}

function mapCognitoError(err: unknown): Error {
  const maybeError = err as { code?: string; message?: string };
  const code = maybeError?.code;

  if (code === "NotAuthorizedException")
    return new Error("Incorrect email or password.");
  if (code === "UserNotFoundException")
    return new Error("No account found for this email.");
  if (code === "UsernameExistsException")
    return new Error(
      "An account with this email already exists. Please sign in.",
    );
  if (code === "InvalidPasswordException")
    return new Error("Password does not meet Cognito policy requirements.");
  if (
    code === "InvalidParameterException" &&
    maybeError?.message?.includes("SECRET_HASH")
  ) {
    return new Error(
      "Cognito app client is misconfigured: use a public app client with no secret.",
    );
  }

  return new Error(
    maybeError?.message || "Authentication failed. Please try again.",
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session on mount
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (_) {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        assertCognitoConfigured();
      } catch (err) {
        reject(err);
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
          const jwtToken = result.getAccessToken().getJwtToken();
          const loggedInUser: User = {
            userId: result.getIdToken().payload.sub as string,
            name: result.getIdToken().payload.name || "User",
            email: email,
            role: "fisherman",
          };
          await AsyncStorage.setItem(TOKEN_KEY, jwtToken);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
          setToken(jwtToken);
          setUser(loggedInUser);
          resolve();
        },
        onFailure: (err) => {
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
        new CognitoUserAttribute({ Name: "email", Value: email }),
      ];

      // Only add phone number if provided and valid
      if (phone && phone.trim() !== "") {
        const trimmedPhone = phone.trim();
        // Validate E.164 format (starts with +)
        if (!trimmedPhone.startsWith("+")) {
          reject(
            new Error(
              "Phone number must include country code (e.g., +91 for India)",
            ),
          );
          return;
        }
        attributeList.push(
          new CognitoUserAttribute({
            Name: "phone_number",
            Value: trimmedPhone,
          }),
        );
      }

      userPool.signUp(
        email,
        password,
        attributeList,
        [],
        async (err, result) => {
          if (err) {
            console.error("Cognito signup error:", err);
            reject(mapCognitoError(err));
            return;
          }
          console.log("Signup successful:", result);
          resolve();
        },
      );
    });
  };

  const logout = async () => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
