import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X, Building2, Tag, Calendar } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ContactFilters } from "@/hooks/use-contact-filters";

interface AdvancedFiltersProps {
  filters: ContactFilters;
  updateFilter: <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) => void;
  clearFilters: () => void;
  activeFilterCount: number;
}

export function ContactsAdvancedFilters({
  filters,
  updateFilter,
  clearFilters,
  activeFilterCount,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch companies for the filter
  const { data: companiesData } = useQuery({
    queryKey: ["/api/crm/companies"],
    queryFn: () => apiRequest("GET", "/api/crm/companies").then(res => res.json()),
  });
  const companies = (companiesData as any)?.companies || [];

  const leadStatusOptions = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'unqualified', label: 'Unqualified' },
  ];

  const sourceOptions = [
    { value: 'website', label: 'Website' },
    { value: 'referral', label: 'Referral' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'cold_outreach', label: 'Cold Outreach' },
    { value: 'event', label: 'Event' },
    { value: 'other', label: 'Other' },
  ];

  const toggleArrayFilter = (key: 'leadStatus' | 'source', value: string) => {
    const current = filters[key];
    if (current.includes(value)) {
      updateFilter(key, current.filter(v => v !== value));
    } else {
      updateFilter(key, [...current, value]);
    }
  };

  const toggleCompany = (companyId: number) => {
    const current = filters.companies;
    if (current.includes(companyId)) {
      updateFilter('companies', current.filter(id => id !== companyId));
    } else {
      updateFilter('companies', [...current, companyId]);
    }
  };

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
          <h4 className="font-medium">Filter Contacts</h4>
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
          {/* Lead Status */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Lead Status</Label>
            <div className="flex flex-wrap gap-2">
              {leadStatusOptions.map(option => (
                <Badge
                  key={option.value}
                  variant={filters.leadStatus.includes(option.value) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleArrayFilter('leadStatus', option.value)}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Source</Label>
            <div className="flex flex-wrap gap-2">
              {sourceOptions.map(option => (
                <Badge
                  key={option.value}
                  variant={filters.source.includes(option.value) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleArrayFilter('source', option.value)}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Company Filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Company
            </Label>
            <Select
              value={filters.companies.length === 1 ? filters.companies[0].toString() : ""}
              onValueChange={(val) => {
                if (val) {
                  updateFilter('companies', [parseInt(val)]);
                } else {
                  updateFilter('companies', []);
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent position="popper" className="overflow-visible">
                <SelectItem value="">All companies</SelectItem>
                {companies.map((company: any) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Has Email/Phone */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Contact Info</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasEmail"
                  checked={filters.hasEmail === true}
                  onCheckedChange={(checked) => {
                    updateFilter('hasEmail', checked ? true : null);
                  }}
                />
                <label htmlFor="hasEmail" className="text-sm cursor-pointer">
                  Has email address
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasPhone"
                  checked={filters.hasPhone === true}
                  onCheckedChange={(checked) => {
                    updateFilter('hasPhone', checked ? true : null);
                  }}
                />
                <label htmlFor="hasPhone" className="text-sm cursor-pointer">
                  Has phone number
                </label>
              </div>
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
