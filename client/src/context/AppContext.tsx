import { createContext, useContext, useState, useEffect } from "react";
import type { AxiosInstance } from "axios";
import axios from "axios";

interface User {
  id: string;
  name: string;
  email: string;
  plan: "free" | "pro" | "enterprise";
  analysisCount?: number;
}

interface AppContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  api: AxiosInstance;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; message: string }>;
  register: (
    email: string,
    name: string,
    password: string,
    confirmPassword: string
  ) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
    const [loading, setLoading] = useState<boolean>(true);

    // Axios instance with base URL and auth header
    const api = axios.create({
        baseURL: BACKEND_URL,
    });

    // update axios headers when token changes
    api.interceptors.request.use((config) => {
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    const loadUser = async() => {
        if(!token) {
            setLoading(false);
            return;
        }

        try {
            const {data} = await api.get("/api/v1/auth/user");
            if(data.success) {
                setUser(data.data);
            } 
        } catch (error) {
            console.error("Failed to load user:", error);
            localStorage.removeItem("token");
            setUser(null);
            setToken(null);
        } 
        setLoading(false);
    }

    useEffect(() => {
        loadUser();
    }, []);

    const register = async (email: string, name: string, password: string, confirmPassword: string) => {
        if (password !== confirmPassword) {
            return { success: false, message: "Passwords do not match" };
        }

        try {
            const { data } = await api.post("/api/v1/auth/register", { email, name, password, confirmPassword });
            if (data.success) {
                setToken(data.data.token);
                setUser(data.data);
                localStorage.setItem("token", data.data.token);
            }
            return data;
        } catch (error: any) {
            console.error("Registration failed:", error);
            return { success: false, message: "Registration failed" };
        }
    };

    const login = async (email: string, password: string) => {
        try {
            const { data } = await api.post("/api/v1/auth/login", { email, password });
            if (data.success) {
                setToken(data.data.token);
                setUser(data.data);
                localStorage.setItem("token", data.data.token);
            }
            return data;
        } catch (error: any) {
            console.error("Login failed:", error);
            return { success: false, message: "Invalid credentials" };
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("token");
    };


    const value = {user, token, loading, api, login, register, logout};

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useApp must be used within an AppProvider");
    }
    return context;
}
