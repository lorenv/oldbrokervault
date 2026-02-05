/**
 * CIM Generation Context Provider
 * Tracks active CIM generation globally, persists across refreshes, handles polling and notifications
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface ActiveGeneration {
  docId: number;
  title: string;
  startedAt: number;
}

interface CimGenerationState {
  activeGeneration: ActiveGeneration | null;
  isGenerating: boolean;
  startGeneration: (docId: number, title: string) => void;
  cancelGeneration: () => Promise<void>;
  clearGeneration: () => void;
}

const STORAGE_KEY = 'cim_active_generation';
const POLL_INTERVAL = 3000; // 3 seconds

const CimGenerationContext = createContext<CimGenerationState | null>(null);

export function useCimGeneration() {
  const context = useContext(CimGenerationContext);
  if (!context) {
    throw new Error('useCimGeneration must be used within CimGenerationProvider');
  }
  return context;
}

// Optional hook that doesn't throw if used outside provider
export function useCimGenerationOptional() {
  return useContext(CimGenerationContext);
}

interface CimGenerationProviderProps {
  children: ReactNode;
}

export function CimGenerationProvider({ children }: CimGenerationProviderProps) {
  const [activeGeneration, setActiveGeneration] = useState<ActiveGeneration | null>(null);
  const { toast } = useToast();

  // Load active generation from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ActiveGeneration;
        // Verify with server that generation is still active
        verifyGeneration(parsed);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Verify generation status with server
  const verifyGeneration = async (generation: ActiveGeneration) => {
    try {
      const response = await fetch(`/api/cim/${generation.docId}/status`, {
        credentials: 'include'
      });

      if (!response.ok) {
        // Document doesn't exist or user doesn't have access
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      const data = await response.json();

      if (data.generationStatus === 'generating') {
        // Still generating - restore state
        setActiveGeneration(generation);
      } else if (data.generationStatus === 'ready') {
        // Already complete - clear storage and refresh data
        localStorage.removeItem(STORAGE_KEY);

        // Invalidate queries to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
        queryClient.invalidateQueries({ queryKey: [`/api/cim/${generation.docId}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/notifications"] });
      } else if (data.generationStatus === 'failed') {
        // Generation failed - clear storage
        localStorage.removeItem(STORAGE_KEY);
        queryClient.invalidateQueries({ queryKey: ["/api/crm/notifications"] });
      }
    } catch (error) {
      // Network error - keep trying
      console.error('Failed to verify generation status:', error);
    }
  };

  // Poll for completion while generating
  useEffect(() => {
    if (!activeGeneration) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/cim/${activeGeneration.docId}/status`, {
          credentials: 'include'
        });

        if (!response.ok) {
          // Document deleted or access revoked
          clearGeneration();
          return;
        }

        const data = await response.json();

        if (data.generationStatus === 'ready') {
          // Generation complete!
          clearGeneration();

          // Invalidate queries to refresh document lists AND the specific document
          queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
          queryClient.invalidateQueries({ queryKey: [`/api/cim/${activeGeneration.docId}`] });
          // Trigger notification bell update (server created the notification)
          queryClient.invalidateQueries({ queryKey: ["/api/crm/notifications"] });
        } else if (data.generationStatus === 'failed') {
          // Generation failed
          clearGeneration();

          // Trigger notification bell update
          queryClient.invalidateQueries({ queryKey: ["/api/crm/notifications"] });
        }
        // If still 'generating', keep polling
      } catch (error) {
        console.error('Error polling generation status:', error);
      }
    };

    const intervalId = setInterval(pollStatus, POLL_INTERVAL);

    // Poll immediately on start
    pollStatus();

    return () => clearInterval(intervalId);
  }, [activeGeneration, toast]);

  const startGeneration = useCallback((docId: number, title: string) => {
    const generation: ActiveGeneration = {
      docId,
      title,
      startedAt: Date.now()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(generation));
    setActiveGeneration(generation);
  }, []);

  const cancelGeneration = useCallback(async () => {
    if (!activeGeneration) return;

    try {
      const response = await fetch(`/api/cim/${activeGeneration.docId}/generation`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: "Generation Cancelled",
          description: "CIM generation has been cancelled."
        });

        // Invalidate queries to refresh document lists
        queryClient.invalidateQueries({ queryKey: ["/api/cim"] });
      } else {
        const data = await response.json();
        toast({
          title: "Cancel Failed",
          description: data.error || "Failed to cancel generation.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Cancel Failed",
        description: "Failed to cancel generation. Please try again.",
        variant: "destructive"
      });
    } finally {
      clearGeneration();
    }
  }, [activeGeneration, toast]);

  const clearGeneration = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setActiveGeneration(null);
  }, []);

  const value: CimGenerationState = {
    activeGeneration,
    isGenerating: !!activeGeneration,
    startGeneration,
    cancelGeneration,
    clearGeneration
  };

  return (
    <CimGenerationContext.Provider value={value}>
      {children}
    </CimGenerationContext.Provider>
  );
}
