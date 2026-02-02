import { useEffect, useCallback, useState } from 'react';
import { useLocation } from 'wouter';

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  category: 'navigation' | 'actions' | 'general';
}

const STORAGE_KEY = 'keyboard-shortcuts-enabled';

export function useKeyboardShortcuts() {
  const [, navigate] = useLocation();
  const [enabled, setEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== 'false'; // Default to enabled
    }
    return true;
  });
  const [showHelp, setShowHelp] = useState(false);

  // Persist enabled state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  const toggleEnabled = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  const openCreateMenu = useCallback(() => {
    // Dispatch a custom event that the global header can listen to
    window.dispatchEvent(new CustomEvent('open-create-menu'));
  }, []);

  const focusSearch = useCallback(() => {
    // Focus the search input in the header
    const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  }, []);

  const shortcuts: KeyboardShortcut[] = [
    // Navigation
    { key: 'h', description: 'Go to Home', action: () => navigate('/'), category: 'navigation' },
    { key: 'd', description: 'Go to Deals', action: () => navigate('/deals'), category: 'navigation' },
    { key: 'c', description: 'Go to Contacts', action: () => navigate('/contacts'), category: 'navigation' },
    { key: 'o', description: 'Go to Companies', action: () => navigate('/companies'), category: 'navigation' },
    { key: 't', description: 'Go to Tasks', action: () => navigate('/tasks'), category: 'navigation' },
    // Actions
    { key: 'n', description: 'Create new...', action: openCreateMenu, category: 'actions' },
    { key: '/', description: 'Focus search', action: focusSearch, category: 'actions' },
    // General
    { key: '?', description: 'Show keyboard shortcuts', action: () => setShowHelp(true), category: 'general' },
  ];

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isEditable = target.isContentEditable;
      const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';

      if (isInput || isEditable) {
        // Allow Escape to blur the input
        if (event.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // Don't trigger on modifier keys (except for ?)
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      // Handle ? (which requires shift)
      if (event.key === '?' || (event.shiftKey && key === '/')) {
        event.preventDefault();
        setShowHelp(true);
        return;
      }

      // Handle / for search (without shift)
      if (key === '/' && !event.shiftKey) {
        event.preventDefault();
        focusSearch();
        return;
      }

      // Handle Escape to close modals
      if (key === 'escape') {
        setShowHelp(false);
        return;
      }

      // Find and execute matching shortcut
      const shortcut = shortcuts.find(s => s.key.toLowerCase() === key && s.key !== '?' && s.key !== '/');
      if (shortcut) {
        event.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, shortcuts, focusSearch]);

  return {
    enabled,
    setEnabled,
    toggleEnabled,
    shortcuts,
    showHelp,
    setShowHelp,
  };
}
