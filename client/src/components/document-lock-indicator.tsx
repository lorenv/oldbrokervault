import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, AlertCircle, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DocumentLockIndicatorProps {
  documentId: number;
  onLockAcquired?: () => void;
  onLockReleased?: () => void;
}

interface LockStatus {
  locked: boolean;
  user?: {
    name: string;
    email: string;
    lockedAt: string;
    duration: number;
  };
}

export function DocumentLockIndicator({
  documentId,
  onLockAcquired,
  onLockReleased,
}: DocumentLockIndicatorProps) {
  const { toast } = useToast();
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [showTakeOverDialog, setShowTakeOverDialog] = useState(false);
  const [isTakingOver, setIsTakingOver] = useState(false);

  // Poll lock status every 10 seconds
  useEffect(() => {
    const checkLockStatus = async () => {
      try {
        const response = await apiRequest("GET", `/api/cim/${documentId}/lock/status`);
        const data = await response.json();
        setLockStatus(data);
      } catch (error) {
        console.error("Failed to check lock status:", error);
      }
    };

    checkLockStatus();
    const interval = setInterval(checkLockStatus, 10000);

    return () => clearInterval(interval);
  }, [documentId]);

  const handleTakeOver = async () => {
    setIsTakingOver(true);
    try {
      const response = await apiRequest("POST", `/api/cim/${documentId}/lock/takeover`);
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Edit access acquired",
          description: `You have taken over editing from ${data.previousUser || "the previous editor"}.`,
        });
        setShowTakeOverDialog(false);
        setLockStatus({ locked: false }); // Clear the lock status
        onLockAcquired?.();
      }
    } catch (error: any) {
      toast({
        title: "Failed to take over",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTakingOver(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "just now";
    if (minutes === 1) return "1 minute ago";
    return `${minutes} minutes ago`;
  };

  if (!lockStatus?.locked) {
    return null;
  }

  return (
    <>
      <Alert className="border-amber-200 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-900">Document Currently Being Edited</AlertTitle>
        <AlertDescription className="text-amber-700 flex items-center justify-between">
          <div>
            <p className="mb-1">
              <strong>{lockStatus.user?.name || lockStatus.user?.email}</strong> is currently editing this document.
            </p>
            <p className="text-sm">
              Started editing {formatDuration(lockStatus.user?.duration || 0)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTakeOverDialog(true)}
            className="ml-4"
          >
            Take Over & Edit
          </Button>
        </AlertDescription>
      </Alert>

      <AlertDialog open={showTakeOverDialog} onOpenChange={setShowTakeOverDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Take Over Editing?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>{lockStatus.user?.name || lockStatus.user?.email}</strong> is currently editing this
                document.
              </p>
              <p className="text-amber-700 font-medium">
                If you take over, their unsaved changes may be lost and they will be notified via
                email.
              </p>
              <p>
                Are you sure you want to take over editing?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTakingOver}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTakeOver}
              disabled={isTakingOver}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isTakingOver ? "Taking Over..." : "Take Over & Edit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Hook for managing document lock with heartbeat
export function useDocumentLock(documentId: number) {
  const { toast } = useToast();
  const [hasLock, setHasLock] = useState(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  const [isReleasingLock, setIsReleasingLock] = useState(false);
  const [hasShownExpiredToast, setHasShownExpiredToast] = useState(false);

  const acquireLock = async () => {
    try {
      setIsReleasingLock(false);
      setHasShownExpiredToast(false);
      const response = await apiRequest("POST", `/api/cim/${documentId}/lock`);
      const data = await response.json();

      if (data.success) {
        setHasLock(true);
        startHeartbeat();
        return true;
      }
    } catch (error: any) {
      console.error("Failed to acquire lock:", error);
      return false;
    }
    return false;
  };

  const releaseLock = async () => {
    setIsReleasingLock(true);
    stopHeartbeat();
    try {
      await apiRequest("DELETE", `/api/cim/${documentId}/lock`);
      setHasLock(false);
    } catch (error) {
      console.error("Failed to release lock:", error);
    }
  };

  const startHeartbeat = () => {
    // Send heartbeat every 30 seconds
    const interval = setInterval(async () => {
      // Don't send heartbeat if we're releasing the lock
      if (isReleasingLock) {
        return;
      }

      try {
        await apiRequest("POST", `/api/cim/${documentId}/lock/heartbeat`);
      } catch (error) {
        console.error("Heartbeat failed:", error);
        stopHeartbeat();
        setHasLock(false);

        // Only show toast once and only if we didn't intentionally release the lock
        if (!hasShownExpiredToast && !isReleasingLock) {
          setHasShownExpiredToast(true);
          toast({
            title: "Edit session expired",
            description: "Your edit session has expired. Please refresh to continue editing.",
            variant: "destructive",
          });
        }
      }
    }, 30000);

    setHeartbeatInterval(interval);
  };

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      setHeartbeatInterval(null);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasLock) {
        releaseLock();
      }
    };
  }, [hasLock]);

  // Release lock when page is about to unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasLock) {
        // Use navigator.sendBeacon for more reliable cleanup
        const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
        navigator.sendBeacon(`/api/cim/${documentId}/lock`, blob);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasLock, documentId]);

  return {
    hasLock,
    acquireLock,
    releaseLock,
  };
}
