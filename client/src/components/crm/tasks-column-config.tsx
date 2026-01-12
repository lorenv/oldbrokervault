import { useState } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, GripVertical } from "lucide-react";
import type { TaskColumnConfig } from "@/hooks/use-task-filters";

interface TasksColumnConfigProps {
  columns: TaskColumnConfig[];
  onToggleVisibility: (columnId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function SortableColumnItem({
  column,
  onToggleVisibility,
}: {
  column: TaskColumnConfig;
  onToggleVisibility: (columnId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Title column should always be visible
  const isRequired = column.id === 'title';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 ${
        isDragging ? 'bg-gray-100' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        id={`col-${column.id}`}
        checked={column.visible}
        disabled={isRequired}
        onCheckedChange={() => !isRequired && onToggleVisibility(column.id)}
      />
      <label
        htmlFor={`col-${column.id}`}
        className={`flex-1 text-sm cursor-pointer select-none ${isRequired ? 'text-gray-500' : ''}`}
      >
        {column.label}
        {isRequired && <span className="text-xs text-gray-400 ml-1">(required)</span>}
      </label>
    </div>
  );
}

export function TasksColumnConfig({
  columns,
  onToggleVisibility,
  onReorder,
}: TasksColumnConfigProps) {
  const [isOpen, setIsOpen] = useState(false);

  const visibleCount = columns.filter(c => c.visible).length;
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedColumns.findIndex(c => c.id === active.id);
    const newIndex = sortedColumns.findIndex(c => c.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Columns</span>
          <span className="text-gray-400 text-xs">({visibleCount})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="text-xs font-medium text-gray-500 uppercase px-2 py-1.5 mb-1">
          Toggle Columns
        </div>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedColumns.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {sortedColumns.map((column) => (
                <SortableColumnItem
                  key={column.id}
                  column={column}
                  onToggleVisibility={onToggleVisibility}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="border-t mt-2 pt-2 px-2">
          <p className="text-xs text-gray-400">
            Drag to reorder columns. Changes are saved automatically.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
