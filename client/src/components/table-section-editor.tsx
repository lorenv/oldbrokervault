import { useState, useRef, useCallback } from "react";
import { Plus, Trash2, Upload, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface TableSettings {
  hasHeaderRow: boolean;
  striped: boolean;
  bordered: boolean;
  alignment: "left" | "center" | "right";
}

export interface TableData {
  headers: string[];
  rows: string[][];
  settings: TableSettings;
}

interface TableSectionEditorProps {
  initialData?: TableData;
  onChange: (data: TableData) => void;
  mode?: "create" | "edit";
}

const defaultSettings: TableSettings = {
  hasHeaderRow: true,
  striped: true,
  bordered: false,
  alignment: "left",
};

const defaultTableData: TableData = {
  headers: ["Column 1", "Column 2", "Column 3"],
  rows: [["", "", ""]],
  settings: defaultSettings,
};

function parseCSV(text: string): TableData {
  const lines = text.trim().split("\n").filter(line => line.trim());
  if (lines.length === 0) {
    return defaultTableData;
  }

  const rows = lines.map((line) => {
    // Handle quoted values with commas
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cells.push(current.trim().replace(/^"|"$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim().replace(/^"|"$/g, ""));
    return cells;
  });

  // Normalize row lengths
  const maxCols = Math.max(...rows.map((r) => r.length));
  const normalizedRows = rows.map((row) => {
    while (row.length < maxCols) {
      row.push("");
    }
    return row;
  });

  return {
    headers: normalizedRows[0] || [],
    rows: normalizedRows.slice(1),
    settings: defaultSettings,
  };
}

function parsePastedData(text: string): TableData | null {
  // Check if it's tab-delimited (from Excel/Sheets)
  if (!text.includes("\t")) {
    return null;
  }

  const lines = text.trim().split("\n").filter(line => line.trim());
  if (lines.length === 0) {
    return null;
  }

  const rows = lines.map((line) => line.split("\t").map((cell) => cell.trim()));

  // Normalize row lengths
  const maxCols = Math.max(...rows.map((r) => r.length));
  const normalizedRows = rows.map((row) => {
    while (row.length < maxCols) {
      row.push("");
    }
    return row;
  });

  return {
    headers: normalizedRows[0] || [],
    rows: normalizedRows.slice(1),
    settings: defaultSettings,
  };
}

export function TableSectionEditor({
  initialData,
  onChange,
  mode = "create",
}: TableSectionEditorProps) {
  const [tableData, setTableData] = useState<TableData>(
    initialData || defaultTableData
  );
  const [pasteText, setPasteText] = useState("");
  const [inputMode, setInputMode] = useState<"paste" | "upload" | "manual" | null>(
    initialData ? "manual" : null
  );
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
    isHeader: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateTableData = useCallback(
    (newData: TableData) => {
      setTableData(newData);
      onChange(newData);
    },
    [onChange]
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      updateTableData(parsed);
      setInputMode("manual");
    };
    reader.readAsText(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text/plain");
    const parsed = parsePastedData(text);
    if (parsed) {
      e.preventDefault();
      updateTableData(parsed);
      setInputMode("manual");
      setPasteText("");
    }
  };

  const handlePasteSubmit = () => {
    // Try tab-delimited first, then CSV
    let parsed = parsePastedData(pasteText);
    if (!parsed) {
      parsed = parseCSV(pasteText);
    }
    updateTableData(parsed);
    setInputMode("manual");
    setPasteText("");
  };

  const handleCellEdit = (
    rowIndex: number,
    colIndex: number,
    value: string,
    isHeader: boolean
  ) => {
    if (isHeader) {
      const newHeaders = [...tableData.headers];
      newHeaders[colIndex] = value;
      updateTableData({ ...tableData, headers: newHeaders });
    } else {
      const newRows = tableData.rows.map((row, i) =>
        i === rowIndex
          ? row.map((cell, j) => (j === colIndex ? value : cell))
          : row
      );
      updateTableData({ ...tableData, rows: newRows });
    }
  };

  // Smart paste handler for multi-cell paste from spreadsheets
  const handleSmartPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRow: number,
    startCol: number,
    isHeader: boolean
  ) => {
    const text = e.clipboardData.getData("text/plain");

    // Check if it's multi-cell data (contains tabs or multiple lines)
    if (!text.includes("\t") && !text.includes("\n")) {
      // Single cell paste - let default behavior handle it
      return;
    }

    e.preventDefault();

    // Parse the pasted data
    const lines = text.trim().split("\n");
    const pastedRows = lines.map((line) => line.split("\t").map((cell) => cell.trim()));

    if (isHeader) {
      // Pasting into header row - only paste the first row of data into headers
      const newHeaders = [...tableData.headers];
      pastedRows[0].forEach((value, i) => {
        const targetCol = startCol + i;
        if (targetCol < newHeaders.length) {
          newHeaders[targetCol] = value;
        } else {
          // Expand headers if needed
          newHeaders.push(value);
        }
      });

      // Also expand rows to match new header count
      const newRows = tableData.rows.map((row) => {
        const newRow = [...row];
        while (newRow.length < newHeaders.length) {
          newRow.push("");
        }
        return newRow;
      });

      updateTableData({ ...tableData, headers: newHeaders, rows: newRows });
    } else {
      // Pasting into data cells
      let newHeaders = [...tableData.headers];
      let newRows = tableData.rows.map((row) => [...row]);

      // Calculate required dimensions
      const requiredCols = startCol + Math.max(...pastedRows.map((r) => r.length));
      const requiredRows = startRow + pastedRows.length;

      // Expand columns if needed
      while (newHeaders.length < requiredCols) {
        newHeaders.push(`Column ${newHeaders.length + 1}`);
        newRows = newRows.map((row) => [...row, ""]);
      }

      // Expand rows if needed
      while (newRows.length < requiredRows) {
        newRows.push(new Array(newHeaders.length).fill(""));
      }

      // Fill in the pasted data
      pastedRows.forEach((pastedRow, rowOffset) => {
        pastedRow.forEach((value, colOffset) => {
          const targetRow = startRow + rowOffset;
          const targetCol = startCol + colOffset;
          if (targetRow < newRows.length && targetCol < newRows[targetRow].length) {
            newRows[targetRow][targetCol] = value;
          }
        });
      });

      updateTableData({ ...tableData, headers: newHeaders, rows: newRows });
    }

    // Move focus to the last pasted cell
    setEditingCell(null);
  };

  const addRow = () => {
    const newRow = new Array(tableData.headers.length).fill("");
    updateTableData({ ...tableData, rows: [...tableData.rows, newRow] });
  };

  const removeRow = (index: number) => {
    if (tableData.rows.length <= 1) return;
    const newRows = tableData.rows.filter((_, i) => i !== index);
    updateTableData({ ...tableData, rows: newRows });
  };

  const addColumn = () => {
    const newHeaders = [...tableData.headers, `Column ${tableData.headers.length + 1}`];
    const newRows = tableData.rows.map((row) => [...row, ""]);
    updateTableData({ ...tableData, headers: newHeaders, rows: newRows });
  };

  const removeColumn = (index: number) => {
    if (tableData.headers.length <= 1) return;
    const newHeaders = tableData.headers.filter((_, i) => i !== index);
    const newRows = tableData.rows.map((row) => row.filter((_, i) => i !== index));
    updateTableData({ ...tableData, headers: newHeaders, rows: newRows });
  };

  const updateSettings = (key: keyof TableSettings, value: any) => {
    updateTableData({
      ...tableData,
      settings: { ...tableData.settings, [key]: value },
    });
  };

  const startManualEntry = () => {
    setInputMode("manual");
    updateTableData(defaultTableData);
  };

  // Input mode selection (for create mode)
  if (!inputMode && mode === "create") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {/* CSV Upload */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="font-medium">Upload CSV File</p>
            <p className="text-sm text-gray-500">Click or drag & drop</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Paste from spreadsheet */}
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="text-sm text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
            <Label>Paste from Excel/Google Sheets</Label>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Paste your spreadsheet data here (Ctrl+V / Cmd+V)..."
              className="mt-1 min-h-[100px] font-mono text-sm"
            />
            {pasteText && (
              <Button
                onClick={handlePasteSubmit}
                size="sm"
                className="mt-2"
              >
                Convert to Table
              </Button>
            )}
          </div>

          {/* Manual entry */}
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="text-sm text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>
            <Button
              variant="outline"
              onClick={startManualEntry}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Build Table Manually
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Table editor
  return (
    <div className="space-y-4">
      {/* Table Preview/Editor */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          {tableData.settings.hasHeaderRow && (
            <TableHeader>
              <TableRow className="bg-gray-100">
                <TableHead className="w-8"></TableHead>
                {tableData.headers.map((header, colIndex) => (
                  <TableHead
                    key={colIndex}
                    className={cn(
                      "relative group",
                      tableData.settings.bordered && "border",
                      tableData.settings.alignment === "center" && "text-center",
                      tableData.settings.alignment === "right" && "text-right"
                    )}
                  >
                    {editingCell?.isHeader && editingCell?.col === colIndex ? (
                      <Input
                        value={header}
                        onChange={(e) =>
                          handleCellEdit(-1, colIndex, e.target.value, true)
                        }
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingCell(null)}
                        onPaste={(e) => handleSmartPaste(e, -1, colIndex, true)}
                        autoFocus
                        className="h-8 font-medium"
                      />
                    ) : (
                      <div
                        className="cursor-pointer min-h-[32px] flex items-center"
                        onClick={() =>
                          setEditingCell({ row: -1, col: colIndex, isHeader: true })
                        }
                      >
                        {header || <span className="text-gray-400">Click to edit</span>}
                      </div>
                    )}
                    {tableData.headers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute -top-1 -right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 bg-red-100 hover:bg-red-200 text-red-600"
                        onClick={() => removeColumn(colIndex)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </TableHead>
                ))}
                <TableHead className="w-10">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addColumn}
                    className="h-6 w-6 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
          )}
          <TableBody>
            {tableData.rows.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={cn(
                  tableData.settings.striped && rowIndex % 2 === 1 && "bg-gray-50"
                )}
              >
                <TableCell className="w-8 p-1">
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-4 w-4 text-gray-300" />
                    {tableData.rows.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-50 hover:opacity-100 text-red-500"
                        onClick={() => removeRow(rowIndex)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                {row.map((cell, colIndex) => (
                  <TableCell
                    key={colIndex}
                    className={cn(
                      "relative",
                      tableData.settings.bordered && "border",
                      tableData.settings.alignment === "center" && "text-center",
                      tableData.settings.alignment === "right" && "text-right"
                    )}
                  >
                    {editingCell?.row === rowIndex &&
                    editingCell?.col === colIndex &&
                    !editingCell?.isHeader ? (
                      <Input
                        value={cell}
                        onChange={(e) =>
                          handleCellEdit(rowIndex, colIndex, e.target.value, false)
                        }
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setEditingCell(null);
                          if (e.key === "Tab") {
                            e.preventDefault();
                            const nextCol = colIndex + 1;
                            if (nextCol < row.length) {
                              setEditingCell({ row: rowIndex, col: nextCol, isHeader: false });
                            } else if (rowIndex + 1 < tableData.rows.length) {
                              setEditingCell({ row: rowIndex + 1, col: 0, isHeader: false });
                            }
                          }
                        }}
                        onPaste={(e) => handleSmartPaste(e, rowIndex, colIndex, false)}
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      <div
                        className="cursor-pointer min-h-[32px] flex items-center"
                        onClick={() =>
                          setEditingCell({ row: rowIndex, col: colIndex, isHeader: false })
                        }
                      >
                        {cell || <span className="text-gray-300">-</span>}
                      </div>
                    )}
                  </TableCell>
                ))}
                <TableCell className="w-10"></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Row Button */}
      <Button variant="outline" size="sm" onClick={addRow} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Row
      </Button>

      {/* Settings */}
      <div className="border rounded-lg p-4 space-y-3">
        <Label className="text-sm font-medium">Table Settings</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasHeaderRow" className="text-sm">
              Header Row
            </Label>
            <Switch
              id="hasHeaderRow"
              checked={tableData.settings.hasHeaderRow}
              onCheckedChange={(checked) => updateSettings("hasHeaderRow", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="striped" className="text-sm">
              Striped Rows
            </Label>
            <Switch
              id="striped"
              checked={tableData.settings.striped}
              onCheckedChange={(checked) => updateSettings("striped", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="bordered" className="text-sm">
              Cell Borders
            </Label>
            <Switch
              id="bordered"
              checked={tableData.settings.bordered}
              onCheckedChange={(checked) => updateSettings("bordered", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Alignment</Label>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((align) => (
                <Button
                  key={align}
                  variant={tableData.settings.alignment === align ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => updateSettings("alignment", align)}
                >
                  {align.charAt(0).toUpperCase() + align.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Re-import option */}
      {mode === "create" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setInputMode(null);
            setPasteText("");
          }}
          className="text-gray-500"
        >
          Start Over (Upload/Paste Different Data)
        </Button>
      )}
    </div>
  );
}

// Display component for viewing tables (non-editable)
interface TableSectionDisplayProps {
  data: TableData;
  className?: string;
}

export function TableSectionDisplay({ data, className }: TableSectionDisplayProps) {
  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <Table>
        {data.settings.hasHeaderRow && (
          <TableHeader>
            <TableRow className="bg-gray-100">
              {data.headers.map((header, colIndex) => (
                <TableHead
                  key={colIndex}
                  className={cn(
                    data.settings.bordered && "border",
                    data.settings.alignment === "center" && "text-center",
                    data.settings.alignment === "right" && "text-right"
                  )}
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {data.rows.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              className={cn(
                data.settings.striped && rowIndex % 2 === 1 && "bg-gray-50"
              )}
            >
              {row.map((cell, colIndex) => (
                <TableCell
                  key={colIndex}
                  className={cn(
                    data.settings.bordered && "border",
                    data.settings.alignment === "center" && "text-center",
                    data.settings.alignment === "right" && "text-right"
                  )}
                >
                  {cell || "-"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
