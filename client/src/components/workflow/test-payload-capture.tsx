/**
 * TestPayloadCapture
 *
 * Component to capture a test payload before mapping.
 * Shows webhook URL to copy and waits for incoming data.
 */

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { CaptureStatus } from "./types";
import {
  Copy,
  Check,
  Loader2,
  Webhook,
  RefreshCw,
  FileJson,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface TestPayloadCaptureProps {
  webhookUrl: string;
  onPayloadCaptured: (payload: Record<string, any>) => void;
  status: CaptureStatus;
  onStatusChange?: (status: CaptureStatus) => void;
  className?: string;
}

export function TestPayloadCapture({
  webhookUrl,
  onPayloadCaptured,
  status,
  onStatusChange,
  className,
}: TestPayloadCaptureProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Copy URL to clipboard
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast({ title: "URL copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  // Parse and use manual JSON input
  const useManualJson = () => {
    try {
      const parsed = JSON.parse(manualJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setJsonError("Please enter a valid JSON object (not an array)");
        return;
      }
      setJsonError(null);
      onPayloadCaptured(parsed);
      onStatusChange?.('received');
    } catch (e) {
      setJsonError("Invalid JSON format");
    }
  };

  // Sample payload for demo/testing
  const useSamplePayload = () => {
    const samplePayload = {
      form_response: {
        form_id: "abc123",
        submitted_at: new Date().toISOString(),
        answers: [
          { field: { type: "email" }, email: "john@example.com" },
          { field: { type: "short_text" }, text: "John" },
          { field: { type: "short_text" }, text: "Doe" },
          { field: { type: "phone_number" }, phone_number: "+1234567890" },
        ],
      },
      email: "john@example.com",
      first_name: "John",
      last_name: "Doe",
      phone: "+1234567890",
      company: "Acme Inc",
      source: "typeform",
    };
    onPayloadCaptured(samplePayload);
    onStatusChange?.('received');
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Idle/Waiting state */}
      {(status === 'idle' || status === 'waiting') && (
        <>
          {/* Webhook URL section */}
          <div className="space-y-2">
            <Label className="text-gray-700">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="font-mono text-sm bg-gray-50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyUrl}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Copy this URL and paste it into your external service (Typeform, Zapier, etc.)
            </p>
          </div>

          {/* Waiting indicator */}
          <div className={cn(
            "rounded-lg border-2 border-dashed p-8 text-center transition-all",
            status === 'waiting' ? "border-blue-300 bg-blue-50" : "border-gray-200"
          )}>
            {status === 'waiting' ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative">
                    <Webhook className="h-12 w-12 text-blue-400" />
                    <div className="absolute -top-1 -right-1">
                      <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Waiting for webhook data...
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Send a test request from your external service to capture the data structure
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Listening for incoming data
                </div>
              </>
            ) : (
              <>
                <Webhook className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Send a test webhook
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Copy the URL above and send a test request to capture your data structure
                </p>
                <Button
                  onClick={() => onStatusChange?.('waiting')}
                >
                  <Webhook className="h-4 w-4 mr-2" />
                  Start listening
                </Button>
              </>
            )}
          </div>

          {/* Alternative options */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 uppercase">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowManualInput(!showManualInput)}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Paste JSON manually
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={useSamplePayload}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Use sample data
            </Button>
          </div>

          {/* Manual JSON input */}
          {showManualInput && (
            <div className="space-y-2">
              <Label className="text-gray-700">Paste JSON payload</Label>
              <Textarea
                value={manualJson}
                onChange={(e) => {
                  setManualJson(e.target.value);
                  setJsonError(null);
                }}
                placeholder='{"email": "john@example.com", "name": "John Doe"}'
                className="font-mono text-sm min-h-[120px]"
              />
              {jsonError && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  {jsonError}
                </div>
              )}
              <Button onClick={useManualJson} disabled={!manualJson.trim()}>
                Use this JSON
              </Button>
            </div>
          )}
        </>
      )}

      {/* Timeout state */}
      {status === 'timeout' && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-orange-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No data received
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            We didn't receive any webhook data. Make sure you're sending to the correct URL.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => onStatusChange?.('waiting')}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowManualInput(true)}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Paste JSON
            </Button>
          </div>
        </div>
      )}

      {/* Received state */}
      {status === 'received' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Data captured successfully!
          </h3>
          <p className="text-sm text-gray-500">
            You can now map the incoming fields to your CRM
          </p>
        </div>
      )}
    </div>
  );
}
