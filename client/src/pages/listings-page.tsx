import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Loader2,
  Star,
  TrendingUp,
  DollarSign,
  Target,
  Mail,
  Phone,
  Building2,
  X,
  LayoutGrid,
  List,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface ListingData {
  id: number;
  shareSlug: string;
  headline: string;
  summary: string;
  industryTags: string[];
  dealTypeTags: string[];
  coverImageUrl: string | null;
  showFinancials: boolean;
  financials: {
    revenue: string;
    earnings: string;
    askingPrice: string;
  } | null;
  isFeatured: boolean;
  cimShareSlug: string;
  ndaProtected: boolean;
  listingStatus: 'active' | 'under_loi' | 'closed';
}

interface ListingsData {
  broker: {
    businessName: string;
    businessLogo: string | null;
    profilePhoto: string | null;
    name: string;
    email: string;
    phone: string;
  };
  settings: {
    title: string | null;
    tagline: string | null;
    bannerUrl: string | null;
    layout: string;
  };
  listings: ListingData[];
  filterOptions: {
    industries: string[];
    dealTypes: string[];
  };
}

export function ListingsPage() {
  const [matched, params] = useRoute("/listings/:slug");
  const slug = params?.slug;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [industry, setIndustry] = useState<string>("");
  const [dealType, setDealType] = useState<string>("");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Check if listings page exists
  const { data: checkData, isLoading: checkLoading, error: checkError } = useQuery({
    queryKey: [`/api/listings/public/${slug}/check`],
    queryFn: async () => {
      const res = await fetch(`/api/listings/public/${slug}/check`);
      if (!res.ok) throw new Error("Listings page not found");
      return res.json();
    },
    enabled: !!slug,
    retry: false,
  });

  // Build query string for filters (use debounced search)
  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (industry && industry !== "all") queryParams.set("industry", industry);
  if (dealType && dealType !== "all") queryParams.set("dealType", dealType);
  if (sort) queryParams.set("sort", sort);
  const queryString = queryParams.toString();

  // Fetch listings data
  const {
    data: listingsData,
    isLoading: listingsLoading,
    error: listingsError,
  } = useQuery<ListingsData>({
    queryKey: [`/api/listings/public/${slug}`, queryString],
    queryFn: async () => {
      const url = queryString
        ? `/api/listings/public/${slug}?${queryString}`
        : `/api/listings/public/${slug}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load listings");
      return res.json();
    },
    enabled: !!slug && !!checkData,
  });

  // Set view mode from settings
  useEffect(() => {
    if (listingsData?.settings.layout) {
      setViewMode(listingsData.settings.layout as "grid" | "list");
    }
  }, [listingsData?.settings.layout]);

  // Update document title
  useEffect(() => {
    if (listingsData?.settings.title || listingsData?.broker.businessName) {
      document.title = listingsData.settings.title || `${listingsData.broker.businessName} - Listings`;
    }
    return () => {
      document.title = "CIM Share";
    };
  }, [listingsData]);

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setIndustry("");
    setDealType("");
    setSort("newest");
  };

  const hasActiveFilters = search || (industry && industry !== "all") || (dealType && dealType !== "all") || sort !== "newest";

  // Loading state
  if (checkLoading || listingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-4 text-gray-500">Loading listings...</p>
        </div>
      </div>
    );
  }

  // Not found
  if (checkError || !checkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Listings Not Found</h1>
            <p className="text-gray-600">
              This listings page doesn't exist or has been disabled.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (listingsError || !listingsData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Something Went Wrong</h1>
            <p className="text-gray-600 mb-4">
              Unable to load listings. Please try again.
            </p>
            <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700 text-white">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner Image */}
      {listingsData.settings.bannerUrl && (
        <div className="h-48 md:h-64 w-full overflow-hidden relative animate-in fade-in duration-700">
          <img
            src={listingsData.settings.bannerUrl}
            alt="Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/80" />
        </div>
      )}

      {/* Header */}
      <header className={`bg-white border-b sticky top-0 z-20 ${listingsData.settings.bannerUrl ? '-mt-16' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {/* Logo / Business Name */}
            <div className="flex items-center gap-4">
              {listingsData.broker.businessLogo ? (
                <img
                  src={listingsData.broker.businessLogo}
                  alt={listingsData.broker.businessName || ""}
                  className="h-10 object-contain"
                />
              ) : (
                <span className="font-bold text-xl text-gray-900">
                  {listingsData.broker.businessName}
                </span>
              )}
            </div>

            {/* Contact Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `mailto:${listingsData.broker.email}`}
            >
              <Mail className="h-4 w-4 mr-2" />
              Contact
            </Button>
          </div>
        </div>
      </header>

      {/* Title & Tagline */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {listingsData.settings.title || `${listingsData.broker.businessName} Listings`}
          </h1>
          {listingsData.settings.tagline && (
            <p className="text-lg text-gray-600">
              {listingsData.settings.tagline}
            </p>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search listings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Toggle (Mobile) */}
            <Button
              variant="outline"
              className="sm:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge className="ml-2 bg-blue-600 text-white">!</Badge>
              )}
            </Button>

            {/* Desktop Filters */}
            <div className="hidden sm:flex gap-2">
              {listingsData.filterOptions.industries.length > 0 && (
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {listingsData.filterOptions.industries.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {listingsData.filterOptions.dealTypes.length > 0 && (
                <Select value={dealType} onValueChange={setDealType}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Deal Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Deal Types</SelectItem>
                    {listingsData.filterOptions.dealTypes.map((dt) => (
                      <SelectItem key={dt} value={dt}>
                        {dt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-r-none ${viewMode === "grid" ? "bg-gradient-to-r from-slate-600 to-blue-600" : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  className={`rounded-l-none ${viewMode === "list" ? "bg-gradient-to-r from-slate-600 to-blue-600" : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Filters Panel */}
          {showFilters && (
            <div className="sm:hidden mt-4 pt-4 border-t space-y-3">
              {listingsData.filterOptions.industries.length > 0 && (
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {listingsData.filterOptions.industries.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {listingsData.filterOptions.dealTypes.length > 0 && (
                <Select value={dealType} onValueChange={setDealType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Deal Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Deal Types</SelectItem>
                    {listingsData.filterOptions.dealTypes.map((dt) => (
                      <SelectItem key={dt} value={dt}>
                        {dt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="outline" className="w-full" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Listings Grid/List */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(() => {
          // Separate active (including under_loi) and closed listings
          const activeListings = listingsData.listings.filter(l => l.listingStatus !== 'closed');
          const closedListings = listingsData.listings.filter(l => l.listingStatus === 'closed');

          return (
            <>
              {/* Tabs */}
              <div className="flex items-center gap-1 mb-6 border-b">
                <button
                  onClick={() => setActiveTab("active")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "active"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Active Listings
                  {activeListings.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700">
                      {activeListings.length}
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("closed")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "closed"
                      ? "border-gray-600 text-gray-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 inline mr-1" />
                  Closed Deals
                  {closedListings.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-600">
                      {closedListings.length}
                    </Badge>
                  )}
                </button>
              </div>

              {/* Active Tab Content */}
              {activeTab === "active" && (
                <>
                  {activeListings.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-gray-500 text-lg">
                        {hasActiveFilters
                          ? "No active listings match your filters."
                          : "No active listings available yet."}
                      </p>
                      {hasActiveFilters && (
                        <Button variant="link" onClick={clearFilters} className="mt-2">
                          Clear filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                          : "flex flex-col gap-4"
                      }
                    >
                      {activeListings.map((listing, index) => (
                        <ListingCard
                          key={listing.id}
                          listing={listing}
                          viewMode={viewMode}
                          animationDelay={index * 100}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Closed Tab Content */}
              {activeTab === "closed" && (
                <>
                  {closedListings.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-gray-500 text-lg">No closed deals yet.</p>
                    </div>
                  ) : (
                    <div
                      className={
                        viewMode === "grid"
                          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                          : "flex flex-col gap-4"
                      }
                    >
                      {closedListings.map((listing, index) => (
                        <ListingCard
                          key={listing.id}
                          listing={listing}
                          viewMode={viewMode}
                          isClosed
                          animationDelay={index * 100}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          );
        })()}
      </main>

      {/* Footer - Broker Contact Info */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Profile/Logo */}
            <div className="flex items-center gap-4">
              {listingsData.broker.profilePhoto ? (
                <img
                  src={listingsData.broker.profilePhoto}
                  alt={listingsData.broker.name || ""}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-gray-400" />
                </div>
              )}
              <div>
                <div className="font-semibold text-gray-900">
                  {listingsData.broker.businessName}
                </div>
                {listingsData.broker.name && (
                  <div className="text-gray-600">{listingsData.broker.name}</div>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 md:ml-auto">
              {listingsData.broker.email && (
                <a
                  href={`mailto:${listingsData.broker.email}`}
                  className="flex items-center gap-1 hover:text-blue-600"
                >
                  <Mail className="h-4 w-4" />
                  {listingsData.broker.email}
                </a>
              )}
              {listingsData.broker.phone && (
                <a
                  href={`tel:${listingsData.broker.phone}`}
                  className="flex items-center gap-1 hover:text-blue-600"
                >
                  <Phone className="h-4 w-4" />
                  {listingsData.broker.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ListingCard component
function ListingCard({
  listing,
  viewMode,
  isClosed = false,
  animationDelay = 0,
}: {
  listing: ListingData;
  viewMode: "grid" | "list";
  isClosed?: boolean;
  animationDelay?: number;
}) {
  const isUnderLOI = listing.listingStatus === 'under_loi';
  const isDisabled = isClosed || isUnderLOI;

  const handleClick = () => {
    if (isDisabled) return; // Don't navigate for closed or under LOI deals
    window.location.href = `/teaser/${listing.shareSlug}`;
  };

  // Cap animation delay to prevent too long waits
  const cappedDelay = Math.min(animationDelay, 500);

  if (viewMode === "list") {
    return (
      <Card
        className={`overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 ${
          isDisabled
            ? "opacity-70 cursor-default"
            : "cursor-pointer hover:shadow-lg"
        }`}
        style={{ animationDelay: `${cappedDelay}ms`, animationFillMode: 'backwards' }}
        onClick={handleClick}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Cover Image */}
          {listing.coverImageUrl && (
            <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0 overflow-hidden">
              <img
                src={listing.coverImageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <CardContent className="flex-1 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {/* Featured Badge */}
                {listing.isFeatured && !isDisabled && (
                  <Badge className="mb-2 bg-amber-100 text-amber-800 border-amber-200">
                    <Star className="h-3 w-3 mr-1 fill-amber-500" />
                    Featured
                  </Badge>
                )}
                {isUnderLOI && (
                  <Badge className="mb-2 bg-amber-500 text-white border-amber-600">
                    <Clock className="h-3 w-3 mr-1" />
                    Under LOI
                  </Badge>
                )}
                {isClosed && (
                  <Badge className="mb-2 bg-gray-700 text-white border-gray-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Closed
                  </Badge>
                )}

                {/* Headline */}
                <h3 className="font-semibold text-lg text-gray-900 mb-1 line-clamp-1">
                  {listing.headline}
                </h3>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {listing.industryTags?.slice(0, 2).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs bg-blue-50 text-blue-700"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {listing.dealTypeTags?.slice(0, 1).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Summary */}
                <p className="text-sm text-gray-600 line-clamp-2">
                  {listing.summary}
                </p>
              </div>

              {/* Financials */}
              {listing.showFinancials && listing.financials && (
                <div className="hidden md:flex flex-col gap-1 text-right text-sm">
                  {listing.financials.askingPrice && (
                    <div>
                      <span className="text-gray-500">Asking: </span>
                      <span className="font-semibold">
                        {listing.financials.askingPrice}
                      </span>
                    </div>
                  )}
                  {listing.financials.revenue && (
                    <div>
                      <span className="text-gray-500">Revenue: </span>
                      <span className="font-semibold">
                        {listing.financials.revenue}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  // Grid View
  return (
    <Card
      className={`overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 ${
        isDisabled
          ? "opacity-70 cursor-default"
          : "cursor-pointer hover:shadow-lg group"
      }`}
      style={{ animationDelay: `${cappedDelay}ms`, animationFillMode: 'backwards' }}
      onClick={handleClick}
    >
      {/* Cover Image */}
      <div className="h-40 overflow-hidden relative">
        {listing.coverImageUrl ? (
          <img
            src={listing.coverImageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-200 to-gray-300 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-400" />
          </div>
        )}
        {listing.isFeatured && !isDisabled && (
          <Badge className="absolute top-2 left-2 bg-amber-100 text-amber-800 border-amber-200">
            <Star className="h-3 w-3 mr-1 fill-amber-500" />
            Featured
          </Badge>
        )}
        {isUnderLOI && (
          <Badge className="absolute top-2 left-2 bg-amber-500 text-white border-amber-600">
            <Clock className="h-3 w-3 mr-1" />
            Under LOI
          </Badge>
        )}
        {isClosed && (
          <Badge className="absolute top-2 left-2 bg-gray-700 text-white border-gray-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Closed
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        {/* Headline */}
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {listing.headline}
        </h3>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {listing.industryTags?.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs bg-blue-50 text-blue-700"
            >
              {tag}
            </Badge>
          ))}
          {listing.dealTypeTags?.slice(0, 1).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Summary */}
        <p className="text-sm text-gray-600 line-clamp-3 mb-4">
          {listing.summary}
        </p>

        {/* Financials */}
        {listing.showFinancials && listing.financials && (
          <div className="grid grid-cols-3 gap-2 pt-3 border-t">
            {listing.financials.revenue && (
              <div className="text-center">
                <TrendingUp className="h-4 w-4 text-green-600 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Revenue</div>
                <div className="text-sm font-semibold">
                  {listing.financials.revenue}
                </div>
              </div>
            )}
            {listing.financials.earnings && (
              <div className="text-center">
                <DollarSign className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Earnings</div>
                <div className="text-sm font-semibold">
                  {listing.financials.earnings}
                </div>
              </div>
            )}
            {listing.financials.askingPrice && (
              <div className="text-center">
                <Target className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Asking</div>
                <div className="text-sm font-semibold">
                  {listing.financials.askingPrice}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ListingsPage;
