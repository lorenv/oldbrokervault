import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Save,
  ChevronDown,
  Trash2,
  Share2,
  Star,
  Edit2,
  Plus,
  Check,
  Users,
} from "lucide-react";
import type { DealFilters, DealSorting, ColumnConfig } from "@/hooks/use-deal-filters";

interface DealView {
  id: number;
  name: string;
  isDefault: boolean;
  isShared: boolean;
  userId: number | null;
  filters: Record<string, any>;
  columns: ColumnConfig[];
  sorting: Record<string, any>;
  viewMode: string;
}

interface ViewManagerProps {
  currentFilters: DealFilters;
  currentColumns: ColumnConfig[];
  currentSorting: DealSorting;
  currentViewMode: 'list' | 'kanban';
  onApplyView: (view: {
    filters?: Partial<DealFilters>;
    columns?: ColumnConfig[];
    sorting?: DealSorting;
    viewMode?: 'list' | 'kanban';
  }) => void;
  hasUnsavedChanges?: boolean;
}

export function DealsViewManager({
  currentFilters,
  currentColumns,
  currentSorting,
  currentViewMode,
  onApplyView,
  hasUnsavedChanges = false,
}: ViewManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [editViewName, setEditViewName] = useState("");

  // Fetch saved views
  const { data: views = [], isLoading: viewsLoading } = useQuery<DealView[]>({
    queryKey: ["/api/crm/deal-views"],
  });

  const selectedView = views.find(v => v.id === selectedViewId);

  // Restore last selected view from localStorage on mount
  useEffect(() => {
    if (viewsLoading || views.length === 0) return;

    const savedViewId = localStorage.getItem('lastSelectedDealViewId');
    if (savedViewId) {
      const viewId = parseInt(savedViewId);
      const view = views.find(v => v.id === viewId);
      if (view) {
        setSelectedViewId(viewId);
        onApplyView({
          filters: view.filters as Partial<DealFilters>,
          columns: view.columns,
          sorting: view.sorting as DealSorting,
          viewMode: view.viewMode as 'list' | 'kanban',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, viewsLoading]); // Only run when views are loaded

  // Save selected view ID to localStorage whenever it changes
  useEffect(() => {
    if (selectedViewId !== null) {
      localStorage.setItem('lastSelectedDealViewId', selectedViewId.toString());
    } else {
      localStorage.removeItem('lastSelectedDealViewId');
    }
  }, [selectedViewId]);

  // Create view mutation
  const createViewMutation = useMutation({
    mutationFn: (data: { name: string; filters: any; columns: any; sorting: any; viewMode: string }) =>
      apiRequest("POST", "/api/crm/deal-views", { body: data }).then(res => res.json()),
    onSuccess: (newView) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deal-views"] });
      setSelectedViewId(newView.id);
      setIsSaveDialogOpen(false);
      setNewViewName("");
      toast({ title: "View saved", description: `"${newView.name}" has been created.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save view", variant: "destructive" });
    },
  });

  // Update view mutation
  const updateViewMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; [key: string]: any }) =>
      apiRequest("PATCH", `/api/crm/deal-views/${id}`, { body: data }).then(res => res.json()),
    onSuccess: (updatedView) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deal-views"] });
      setIsEditDialogOpen(false);
      toast({ title: "View updated", description: `"${updatedView.name}" has been updated.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update view", variant: "destructive" });
    },
  });

  // Delete view mutation
  const deleteViewMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/crm/deal-views/${id}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deal-views"] });
      setSelectedViewId(null);
      toast({ title: "View deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete view", variant: "destructive" });
    },
  });

  // Toggle share mutation
  const toggleShareMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/crm/deal-views/${id}/share`).then(res => res.json()),
    onSuccess: (updatedView) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deal-views"] });
      toast({
        title: updatedView.isShared ? "View shared" : "View unshared",
        description: updatedView.isShared
          ? "Team members can now see this view."
          : "This view is now private.",
      });
    },
  });

  const handleSelectView = (viewId: string) => {
    if (viewId === 'none') {
      setSelectedViewId(null);
      return;
    }
    const view = views.find(v => v.id === parseInt(viewId));
    if (view) {
      setSelectedViewId(view.id);
      onApplyView({
        filters: view.filters as Partial<DealFilters>,
        columns: view.columns,
        sorting: view.sorting as DealSorting,
        viewMode: view.viewMode as 'list' | 'kanban',
      });
    }
  };

  const handleSaveNew = () => {
    if (!newViewName.trim()) {
      toast({ title: "Error", description: "Please enter a view name", variant: "destructive" });
      return;
    }
    createViewMutation.mutate({
      name: newViewName,
      filters: currentFilters,
      columns: currentColumns,
      sorting: currentSorting,
      viewMode: currentViewMode,
    });
  };

  const handleSaveCurrent = () => {
    if (!selectedViewId) return;
    updateViewMutation.mutate({
      id: selectedViewId,
      filters: currentFilters,
      columns: currentColumns,
      sorting: currentSorting,
      viewMode: currentViewMode,
    });
  };

  const handleRename = () => {
    if (!selectedViewId || !editViewName.trim()) return;
    updateViewMutation.mutate({
      id: selectedViewId,
      name: editViewName,
    });
  };

  const handleSetDefault = () => {
    if (!selectedViewId) return;
    updateViewMutation.mutate({
      id: selectedViewId,
      isDefault: true,
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* View Selector with integrated actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2 min-w-[140px] justify-between">
            <span className="flex items-center gap-2 truncate">
              {selectedView ? (
                <>
                  {selectedView.isDefault && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                  {selectedView.isShared && <Users className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                  <span className="truncate">{selectedView.name}</span>
                </>
              ) : (
                <span className="text-gray-500">Views</span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {/* Saved Views */}
          <DropdownMenuItem onClick={() => {
            setSelectedViewId(null);
          }}>
            <span className="text-gray-500">No saved view</span>
          </DropdownMenuItem>
          {views.filter(view => view.id != null).map((view) => (
            <DropdownMenuItem
              key={view.id}
              onClick={() => handleSelectView(view.id.toString())}
            >
              <div className="flex items-center gap-2 w-full">
                {view.isDefault && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                {view.isShared && <Users className="h-3 w-3 text-blue-500" />}
                <span className="truncate flex-1">{view.name}</span>
                {view.id === selectedViewId && <Check className="h-4 w-4 text-blue-600" />}
              </div>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {/* Save current view (update existing) */}
          {selectedViewId && (
            <DropdownMenuItem
              onClick={handleSaveCurrent}
              disabled={updateViewMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Save current view
            </DropdownMenuItem>
          )}

          {/* Save as new view */}
          <DropdownMenuItem onClick={() => setIsSaveDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Save as new view
          </DropdownMenuItem>

          {/* View-specific actions when a view is selected */}
          {selectedViewId && selectedView && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                setEditViewName(selectedView.name);
                setIsEditDialogOpen(true);
              }}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleShareMutation.mutate(selectedViewId)}>
                <Share2 className="h-4 w-4 mr-2" />
                {selectedView.isShared ? 'Unshare' : 'Share with Team'}
              </DropdownMenuItem>
              {!selectedView.isDefault && (
                <DropdownMenuItem onClick={handleSetDefault}>
                  <Star className="h-4 w-4 mr-2" />
                  Set as Default
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => deleteViewMutation.mutate(selectedViewId)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete View
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save New View Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="viewName">View Name</Label>
              <Input
                id="viewName"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., High Value Deals"
              />
            </div>
            <p className="text-sm text-gray-500">
              This will save your current filters, columns, and sorting preferences.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNew} disabled={createViewMutation.isPending}>
              {createViewMutation.isPending ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename View Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editViewName">View Name</Label>
              <Input
                id="editViewName"
                value={editViewName}
                onChange={(e) => setEditViewName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={updateViewMutation.isPending}>
              {updateViewMutation.isPending ? "Saving..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
