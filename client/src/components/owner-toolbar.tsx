import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Edit, 
  BarChart3, 
  Users, 
  Eye, 
  Settings, 
  ExternalLink, 
  Share2,
  Crown,
  X 
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface OwnerToolbarProps {
  documentId: number;
  shareSlug: string;
  onClose?: () => void;
}

export function OwnerToolbar({ documentId, shareSlug, onClose }: OwnerToolbarProps) {
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

  const handleViewAnalytics = () => {
    window.open(`/cims/${documentId}?tab=analytics`, '_blank');
  };

  const handleShareSettings = () => {
    window.open(`/cims/${documentId}?tab=share`, '_blank');
  };

  const handleViewDashboard = () => {
    window.open('/dashboard', '_blank');
  };

  if (isCollapsed) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={() => setIsCollapsed(false)}
          variant="outline"
          size="sm"
          className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-lg"
        >
          <Crown className="h-4 w-4 mr-1" />
          Owner
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <Card className="bg-blue-600 text-white border-blue-700 shadow-xl max-w-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              <span className="font-semibold text-sm">Document Owner</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={() => setIsCollapsed(true)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white/80 hover:text-white hover:bg-blue-700"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          {analyticsData && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="text-center">
                <div className="text-lg font-bold">{analyticsData.totalViews || 0}</div>
                <div className="text-xs text-blue-100">Total Views</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{analyticsData.totalSignatures || 0}</div>
                <div className="text-xs text-blue-100">NDA Signs</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleEditDocument}
              variant="secondary"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              onClick={handleViewAnalytics}
              variant="secondary"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              Analytics
            </Button>
            <Button
              onClick={handleShareSettings}
              variant="secondary"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <Settings className="h-3 w-3 mr-1" />
              Settings
            </Button>
            <Button
              onClick={handleViewDashboard}
              variant="secondary"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Dashboard
            </Button>
          </div>

          <div className="mt-3 pt-3 border-t border-blue-500">
            <p className="text-xs text-blue-100 text-center">
              You're viewing your own document as visitors see it
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}