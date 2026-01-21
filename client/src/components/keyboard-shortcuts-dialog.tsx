import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Keyboard } from "lucide-react";
import type { KeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: KeyboardShortcut[];
  enabled: boolean;
  onToggleEnabled: () => void;
}

function ShortcutKey({ shortcutKey }: { shortcutKey: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded shadow-sm">
      {shortcutKey === '/' ? '/' : shortcutKey === '?' ? '?' : shortcutKey.toUpperCase()}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
  enabled,
  onToggleEnabled,
}: KeyboardShortcutsDialogProps) {
  const navigationShortcuts = shortcuts.filter(s => s.category === 'navigation');
  const actionShortcuts = shortcuts.filter(s => s.category === 'actions');
  const generalShortcuts = shortcuts.filter(s => s.category === 'general');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-gray-600" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
            <Label htmlFor="shortcuts-enabled" className="text-sm font-medium text-gray-700">
              Enable keyboard shortcuts
            </Label>
            <Switch
              id="shortcuts-enabled"
              checked={enabled}
              onCheckedChange={onToggleEnabled}
            />
          </div>

          {/* Navigation Shortcuts */}
          <div className={!enabled ? 'opacity-50' : ''}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Navigation
            </h3>
            <div className="space-y-2">
              {navigationShortcuts.map(shortcut => (
                <div key={shortcut.key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700">{shortcut.description}</span>
                  <ShortcutKey shortcutKey={shortcut.key} />
                </div>
              ))}
            </div>
          </div>

          {/* Action Shortcuts */}
          <div className={!enabled ? 'opacity-50' : ''}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Actions
            </h3>
            <div className="space-y-2">
              {actionShortcuts.map(shortcut => (
                <div key={shortcut.key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700">{shortcut.description}</span>
                  <ShortcutKey shortcutKey={shortcut.key} />
                </div>
              ))}
            </div>
          </div>

          {/* General Shortcuts */}
          <div className={!enabled ? 'opacity-50' : ''}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              General
            </h3>
            <div className="space-y-2">
              {generalShortcuts.map(shortcut => (
                <div key={shortcut.key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700">{shortcut.description}</span>
                  <ShortcutKey shortcutKey={shortcut.key} />
                </div>
              ))}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700">Close dialogs / Blur input</span>
                <kbd className="inline-flex items-center justify-center h-6 px-2 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded shadow-sm">
                  Esc
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
