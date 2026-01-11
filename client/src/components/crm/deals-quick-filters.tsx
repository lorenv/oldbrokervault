import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, User, Users } from "lucide-react";
import type { DealFilters } from "@/hooks/use-deal-filters";

interface Stage {
  id: number;
  name: string;
  color: string;
}

interface QuickFiltersProps {
  filters: DealFilters;
  onFilterChange: <K extends keyof DealFilters>(key: K, value: DealFilters[K]) => void;
  onClearFilters: () => void;
  stages: Stage[];
  currentUserId: number | null;
  activeFilterCount: number;
}

export function DealsQuickFilters({
  filters,
  onFilterChange,
  onClearFilters,
  stages,
  currentUserId,
  activeFilterCount,
}: QuickFiltersProps) {
  const isMyDeals = currentUserId !== null && filters.ownerId === currentUserId;

  return (
    <div className="flex flex-wrap items-center gap-2 py-3 px-1">
      {/* My Deals / All Deals Toggle */}
      <div className="flex border rounded-lg overflow-hidden">
        <Button
          variant={!isMyDeals ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onFilterChange('ownerId', null)}
          className="rounded-none border-0 h-8"
        >
          <Users className="h-3.5 w-3.5 mr-1.5" />
          All Deals
        </Button>
        <Button
          variant={isMyDeals ? "secondary" : "ghost"}
          size="sm"
          onClick={() => currentUserId && onFilterChange('ownerId', currentUserId)}
          disabled={currentUserId === null}
          className="rounded-none border-0 border-l h-8"
        >
          <User className="h-3.5 w-3.5 mr-1.5" />
          My Deals
        </Button>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Stage Filter */}
      <Select
        value={filters.stages.length === 1 ? filters.stages[0].toString() : filters.stages.length > 1 ? 'multiple' : 'all'}
        onValueChange={(value) => {
          if (value === 'all') {
            onFilterChange('stages', []);
          } else if (value !== 'multiple') {
            onFilterChange('stages', [parseInt(value)]);
          }
        }}
      >
        <SelectTrigger className="w-[130px] h-8 text-sm">
          <SelectValue placeholder="All Stages" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Stages</SelectItem>
          {stages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id.toString()}>
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                {stage.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={filters.status}
        onValueChange={(value: 'all' | 'open' | 'won' | 'lost') => onFilterChange('status', value)}
      >
        <SelectTrigger className="w-[110px] h-8 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="won">Won</SelectItem>
          <SelectItem value="lost">Lost</SelectItem>
        </SelectContent>
      </Select>

      {/* Closing Period Filter */}
      <Select
        value={filters.closingPeriod}
        onValueChange={(value: 'all' | 'this_week' | 'this_month' | 'this_quarter' | 'overdue') =>
          onFilterChange('closingPeriod', value)
        }
      >
        <SelectTrigger className="w-[140px] h-8 text-sm">
          <SelectValue placeholder="Closing" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any Time</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="this_quarter">This Quarter</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
        </SelectContent>
      </Select>

      {/* Active filter count and clear button */}
      {activeFilterCount > 0 && (
        <>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <Badge variant="secondary" className="h-6 px-2 gap-1">
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 text-gray-500 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        </>
      )}
    </div>
  );
}
