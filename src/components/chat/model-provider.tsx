"use client";

import { appConfig } from "@/app.config";
import type { ModelListItem } from "@cursor/sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = `${appConfig.id}.modelId`;

interface ModelContextValue {
  models: ModelListItem[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  loading: boolean;
  error?: string;
}

const ModelContext = createContext<ModelContextValue | null>(null);

export function useModelContext(): ModelContextValue {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error("useModelContext must be used within ModelProvider");
  return ctx;
}

interface ModelProviderProps {
  apiKeyConfigured: boolean;
  initialModels: ModelListItem[];
  initialModelsError?: string;
  defaultModelId: string;
  children: React.ReactNode;
}

export function ModelProvider({
  apiKeyConfigured,
  initialModels,
  initialModelsError,
  defaultModelId,
  children,
}: ModelProviderProps) {
  const [models, setModels] = useState<ModelListItem[]>(initialModels);
  const [error, setError] = useState<string | undefined>(initialModelsError);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedIdState] = useState<string>(defaultModelId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedIdState(stored);
  }, []);

  useEffect(() => {
    if (initialModels.length > 0 || !apiKeyConfigured) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/models");
        const body = (await res.json().catch(() => ({}))) as {
          models?: ModelListItem[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? `Failed to load models (${res.status})`);
        } else if (body.models) {
          setModels(body.models);
          setError(undefined);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialModels.length, apiKeyConfigured]);

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const value = useMemo(
    () => ({ models, selectedId, setSelectedId, loading, error }),
    [models, selectedId, setSelectedId, loading, error],
  );

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}
