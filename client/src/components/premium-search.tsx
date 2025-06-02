import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, FileText, Clock } from "lucide-react";
import { useDebouncedValidation } from "@/lib/form-validation";
import { z } from "zod";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

const searchSchema = z.string().min(3, "Search query must be at least 3 characters");

interface SearchResult {
  id: number;
  title: string;
  createdAt: string;
  relevance: number;
  analysis: any;
}

export function PremiumSearch() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [shouldSearch, setShouldSearch] = useState(false);

  const validation = useDebouncedValidation(searchQuery, searchSchema, 300);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["/api/search", searchQuery, dateRange],
    enabled: shouldSearch && validation.isValid && !!searchQuery,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const handleSearch = () => {
    if (validation.isValid && searchQuery.length >= 3) {
      setShouldSearch(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && validation.isValid) {
      handleSearch();
    }
  };

  // Check if user has premium access
  const isPremium = user && (user.subscriptionStatus !== 'free' || user.isAdmin);

  if (!isPremium) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Advanced Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Premium Feature</h3>
            <p className="text-muted-foreground mb-4">
              Advanced search across all your documents is available with a premium subscription.
            </p>
            <Button variant="outline">
              Upgrade to Premium
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Advanced Document Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search your documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className={validation.error ? "border-destructive" : ""}
              />
              {validation.error && (
                <p className="text-sm text-destructive mt-1">{validation.error}</p>
              )}
            </div>
            <Button 
              onClick={handleSearch}
              disabled={!validation.isValid || validation.isValidating}
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
              />
            </div>
            {dateRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateRange(undefined)}
              >
                Clear Date Filter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {shouldSearch && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : searchResults?.results?.length ? (
              <div className="space-y-4">
                {searchResults.results.map((result: SearchResult) => (
                  <div key={result.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg mb-2">{result.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(result.createdAt).toLocaleDateString()}
                          </div>
                          <Badge variant="secondary">
                            Relevance: {result.relevance}/10
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {result.analysis?.story?.businessSummary || 'No summary available'}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery && !isLoading ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms or date range.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}