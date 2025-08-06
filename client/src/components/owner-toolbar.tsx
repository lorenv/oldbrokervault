import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Edit, 
  ExternalLink, 
  Crown,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface OwnerToolbarProps {
  documentId: number;
  shareSlug: string;
}

export function OwnerToolbar({ documentId, shareSlug }: OwnerToolbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch basic analytics data
  const { data: analyticsData } = useQuery({
    queryKey: ['/api/cim', documentId, 'analytics'],
    queryFn: async () => {
      const response = await fetch(`/api/cim/${documentId}/analytics`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // 10 seconds
  });

  const handleEditDocument = () => {
    window.open(`/cims/${documentId}`, '_blank');
  };



  const handleViewDashboard = () => {
    window.open('/dashboard', '_blank');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white shadow-lg border-b border-blue-700">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left side - Owner indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            <span className="text-sm font-medium">Document Owner</span>
          </div>
          
          {/* Quick stats */}
          {analyticsData && !isCollapsed && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="font-semibold">{analyticsData.totalViews || 0}</span>
                <span className="text-blue-200">views</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold">{analyticsData.totalSignatures || 0}</span>
                <span className="text-blue-200">signatures</span>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <>
              <Button
                onClick={handleEditDocument}
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-white hover:bg-blue-700 border border-blue-500 hover:border-blue-400"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                onClick={handleViewDashboard}
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-white hover:bg-blue-700 border border-blue-500 hover:border-blue-400"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Dashboard
              </Button>
            </>
          )}
          
          {/* Collapse/expand button */}
          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-white hover:bg-blue-700"
            title={isCollapsed ? "Expand toolbar" : "Collapse toolbar"}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {/* Info text when collapsed */}
      {isCollapsed && (
        <div className="px-4 pb-2">
          <p className="text-xs text-blue-200">
            You're viewing your document as visitors see it
          </p>
        </div>
      )}
    </div>
  );
}