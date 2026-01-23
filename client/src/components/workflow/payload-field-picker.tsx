/**
 * PayloadFieldPicker
 *
 * Expandable tree view of captured payload for field selection.
 * Shows nested objects with clickable paths.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  ChevronDown,
  Hash,
  Type,
  ToggleLeft,
  List,
  Braces,
  Search,
  Check,
} from "lucide-react";

interface PayloadFieldPickerProps {
  payload: Record<string, any>;
  selectedPath?: string;
  onSelect: (path: string, value: any) => void;
  className?: string;
}

// Get type icon for a value
function getTypeIcon(value: any): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 text-xs">null</span>;
  }
  if (typeof value === 'string') {
    return <Type className="h-3.5 w-3.5 text-green-500" />;
  }
  if (typeof value === 'number') {
    return <Hash className="h-3.5 w-3.5 text-blue-500" />;
  }
  if (typeof value === 'boolean') {
    return <ToggleLeft className="h-3.5 w-3.5 text-purple-500" />;
  }
  if (Array.isArray(value)) {
    return <List className="h-3.5 w-3.5 text-orange-500" />;
  }
  if (typeof value === 'object') {
    return <Braces className="h-3.5 w-3.5 text-gray-500" />;
  }
  return null;
}

// Format value for display
function formatValue(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    return value.length > 30 ? `"${value.slice(0, 30)}..."` : `"${value}"`;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return `{${Object.keys(value).length} keys}`;
  return String(value);
}

interface TreeNodeProps {
  keyName: string;
  value: any;
  path: string;
  depth: number;
  selectedPath?: string;
  onSelect: (path: string, value: any) => void;
  searchTerm?: string;
}

function TreeNode({
  keyName,
  value,
  path,
  depth,
  selectedPath,
  onSelect,
  searchTerm,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const hasChildren = isObject || isArray;
  const isSelected = path === selectedPath;
  const isPrimitive = !hasChildren;

  // Check if this node or any children match search
  const matchesSearch = !searchTerm ||
    keyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (isPrimitive && String(value).toLowerCase().includes(searchTerm.toLowerCase()));

  if (searchTerm && !matchesSearch && !hasChildren) {
    return null;
  }

  return (
    <div className="select-none">
      <div
        onClick={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          } else {
            onSelect(path, value);
          }
        }}
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-gray-100",
          isSelected && "bg-blue-50 hover:bg-blue-100",
          isPrimitive && "cursor-pointer"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse icon */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Type icon */}
        <span className="flex-shrink-0">{getTypeIcon(value)}</span>

        {/* Key name */}
        <span className={cn(
          "font-mono text-sm",
          isSelected ? "text-blue-700 font-medium" : "text-gray-700"
        )}>
          {keyName}
        </span>

        {/* Value preview for primitives */}
        {isPrimitive && (
          <span className="text-xs text-gray-400 truncate ml-1 flex-1">
            : {formatValue(value)}
          </span>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <Check className="h-4 w-4 text-blue-600 ml-auto" />
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {isArray
            ? value.map((item: any, index: number) => (
                <TreeNode
                  key={`${path}[${index}]`}
                  keyName={`[${index}]`}
                  value={item}
                  path={`${path}[${index}]`}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  searchTerm={searchTerm}
                />
              ))
            : Object.entries(value).map(([key, val]) => (
                <TreeNode
                  key={`${path}.${key}`}
                  keyName={key}
                  value={val}
                  path={path ? `${path}.${key}` : key}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  searchTerm={searchTerm}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export function PayloadFieldPicker({
  payload,
  selectedPath,
  onSelect,
  className,
}: PayloadFieldPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className={cn("rounded-lg border bg-gray-50", className)}>
      {/* Search */}
      <div className="p-2 border-b bg-white rounded-t-lg">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="max-h-64 overflow-y-auto p-1">
        {Object.entries(payload).map(([key, value]) => (
          <TreeNode
            key={key}
            keyName={key}
            value={value}
            path={key}
            depth={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
            searchTerm={searchTerm}
          />
        ))}
      </div>

      {/* Selected path display */}
      {selectedPath && (
        <div className="px-3 py-2 border-t bg-blue-50 rounded-b-lg">
          <div className="text-xs text-gray-500">Selected:</div>
          <code className="text-sm font-mono text-blue-700">{selectedPath}</code>
        </div>
      )}
    </div>
  );
}
