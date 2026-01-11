import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X, Briefcase, MapPin, Calendar } from "lucide-react";

export interface CompanyFilters {
  search: string;
  industry: string;
  city: string;
  state: string;
  hasDeals: boolean | null;
  hasContacts: boolean | null;
  createdFrom: string | null;
  createdTo: string | null;
}

export const DEFAULT_COMPANY_FILTERS: CompanyFilters = {
  search: '',
  industry: '',
  city: '',
  state: '',
  hasDeals: null,
  hasContacts: null,
  createdFrom: null,
  createdTo: null,
};

interface AdvancedFiltersProps {
  filters: CompanyFilters;
  updateFilter: <K extends keyof CompanyFilters>(key: K, value: CompanyFilters[K]) => void;
  clearFilters: () => void;
  activeFilterCount: number;
}

export function CompaniesAdvancedFilters({
  filters,
  updateFilter,
  clearFilters,
  activeFilterCount,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const industryOptions = [
    'Technology',
    'Healthcare',
    'Finance',
    'Manufacturing',
    'Retail',
    'Real Estate',
    'Professional Services',
    'Education',
    'Other',
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">Filter Companies</h4>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {/* Industry Filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Industry
            </Label>
            <Select
              value={filters.industry || "all"}
              onValueChange={(val) => updateFilter('industry', val === "all" ? '' : val)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="All industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All industries</SelectItem>
                {industryOptions.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location Filters */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={filters.city}
                onChange={(e) => updateFilter('city', e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="State"
                value={filters.state}
                onChange={(e) => updateFilter('state', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Has Deals/Contacts */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Company Status</Label>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={filters.hasDeals === true ? "default" : "outline"}
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => updateFilter('hasDeals', filters.hasDeals === true ? null : true)}
              >
                Has Deals
              </Badge>
              <Badge
                variant={filters.hasContacts === true ? "default" : "outline"}
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => updateFilter('hasContacts', filters.hasContacts === true ? null : true)}
              >
                Has Contacts
              </Badge>
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Created Date
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-gray-500">From</Label>
                <Input
                  type="date"
                  value={filters.createdFrom || ''}
                  onChange={(e) => updateFilter('createdFrom', e.target.value || null)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">To</Label>
                <Input
                  type="date"
                  value={filters.createdTo || ''}
                  onChange={(e) => updateFilter('createdTo', e.target.value || null)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <Button
            className="w-full"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Apply Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
