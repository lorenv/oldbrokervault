import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ChevronUp, ChevronDown, CheckCircle2, Circle, User, FileText, Eye, Share2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href: string;
  icon: React.ComponentType<any>;
}

export function GetStartedChecklist() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [_, setLocation] = useLocation();
  const { user } = useAuth();

  // Fetch user's documents to find the example CIM (using /api/cim endpoint)
  const { data: documentsData } = useQuery({
    queryKey: ["/api/cim"],
    enabled: !!user && isVisible, // Only fetch when user is logged in and checklist is visible
  });
  
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([
    {
      id: 'profile',
      title: 'Complete your profile',
      description: 'Add your personal and business information',
      completed: false,
      href: '/account?tab=profile',
      icon: User,
    },
    {
      id: 'templates',
      title: 'Choose NDA and PDF settings',
      description: 'Configure your document templates',
      completed: false,
      href: '/account?tab=templates',
      icon: FileText,
    },
    {
      id: 'view-cim',
      title: 'View a CIM',
      description: 'Explore how CIM documents work',
      completed: false,
      href: '/documents',
      icon: Eye,
    },
    {
      id: 'share-cim',
      title: 'Share a CIM',
      description: 'Try sharing the example document',
      completed: false,
      href: '/documents', // Will be updated dynamically to /documents/{id}?tab=share
      icon: Share2,
    },
  ]);

  // Check if this is a new user by looking for the checklist completion flag
  useEffect(() => {
    if (!user) return; // Wait for user data
    
    const userId = user.id;
    const hasCompletedChecklist = localStorage.getItem(`get-started-checklist-dismissed-${userId}`);
    
    // Show checklist for new users (who haven't dismissed it) - only once on initial load
    if (!hasCompletedChecklist) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000); // Show after 2 seconds
      
      return () => clearTimeout(timer);
    } else {
      // Ensure it stays hidden if dismissed
      setIsVisible(false);
    }
  }, [user?.id]); // Only depend on user ID to prevent unnecessary re-runs

  // Load saved progress from localStorage and update share CIM link
  useEffect(() => {
    if (!user) return; // Wait for user data
    
    const userId = user.id;
    const savedProgress = localStorage.getItem(`get-started-progress-${userId}`);
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        setChecklistItems(items => 
          items.map(item => ({
            ...item,
            completed: progress[item.id] || false
          }))
        );
      } catch (error) {
        console.error('Failed to load checklist progress:', error);
      }
    }

    // Update the share CIM link if we have documents data
    if (documentsData && (documentsData as any).documents) {
      const documents = (documentsData as any).documents;
      console.log('📋 All documents:', documents.map((d: any) => ({ 
        id: d.id, 
        title: d.title, 
        isExample: d.isExample,
        hasAnalysis: !!d.analysis || !!d.businessName 
      })));
      const exampleDoc = documents.find((doc: any) => 
        (doc.title && doc.title.toLowerCase().includes("tony") && doc.title.toLowerCase().includes("transmission")) ||
        (doc.businessName && doc.businessName.toLowerCase().includes("tony") && doc.businessName.toLowerCase().includes("transmission")) ||
        doc.isExample === true
      );
      
      if (exampleDoc) {
        console.log('📋 Found example doc:', exampleDoc.id, exampleDoc.businessName);
        const shareUrl = `/documents/${exampleDoc.id}?tab=share`;
        console.log('📋 Setting share URL to:', shareUrl);
        setChecklistItems(items => 
          items.map(item => 
            item.id === 'share-cim' 
              ? { ...item, href: shareUrl }
              : item
          )
        );
      } else {
        console.log('📋 No Tony transmission doc found, using first document');
        if (documents.length > 0) {
          const firstDoc = documents[0];
          const shareUrl = `/documents/${firstDoc.id}?tab=share`;
          console.log('📋 Setting share URL to first doc:', shareUrl);
          setChecklistItems(items => 
            items.map(item => 
              item.id === 'share-cim' 
                ? { ...item, href: shareUrl }
                : item
            )
          );
        }
      }
    } else {
      console.log('📋 No documents data available:', documentsData);
      console.log('📋 User available:', !!user);
      console.log('📋 Checklist visible:', isVisible);
    }
  }, [documentsData, user]);

  const completedCount = checklistItems.filter(item => item.completed).length;
  const totalCount = checklistItems.length;

  const handleItemClick = (item: ChecklistItem) => {
    // Mark as completed
    const updatedItems = checklistItems.map(checkItem =>
      checkItem.id === item.id ? { ...checkItem, completed: true } : checkItem
    );
    setChecklistItems(updatedItems);

    // Save progress to user-specific localStorage
    if (!user) return; // Don't save if no user
    
    const userId = user.id;
    const progress = updatedItems.reduce((acc, item) => {
      acc[item.id] = item.completed;
      return acc;
    }, {} as Record<string, boolean>);
    localStorage.setItem(`get-started-progress-${userId}`, JSON.stringify(progress));

    // Navigate to the target page
    console.log('📋 Navigating to:', item.href);
    
    // For account page tabs, use window.location to force proper URL handling
    if (item.href.startsWith('/account?tab=')) {
      window.location.href = item.href;
    } else {
      setLocation(item.href);
    }
  };

  const handleDismiss = () => {
    if (!user) return;
    
    console.log('📋 Dismissing checklist for user:', user.id);
    setIsVisible(false);
    
    // Set the dismissal flag in localStorage
    const dismissalKey = `get-started-checklist-dismissed-${user.id}`;
    localStorage.setItem(dismissalKey, 'true');
    
    // Verify it was set
    const verified = localStorage.getItem(dismissalKey);
    console.log('📋 Dismissal flag set and verified:', verified);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="shadow-lg border border-gray-200 bg-white">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-sm">Get started</h3>
              <span className="text-xs text-gray-500 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {completedCount} of {totalCount} complete!
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleExpanded}
                className="h-6 w-6 p-0 hover:bg-gray-100"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-6 w-6 p-0 hover:bg-gray-100"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
          
          <p className="text-xs text-gray-600 mb-3">
            Build your CIM platform faster with these essentials:
          </p>
        </div>

        {isExpanded && (
          <CardContent className="pt-0 pb-4 px-4">
            <div className="space-y-2">
              {checklistItems.map((item) => {
                const IconComponent = item.icon;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                      item.completed
                        ? 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {item.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <IconComponent className="h-3 w-3 text-gray-500" />
                          <h4 className={`text-sm font-medium ${
                            item.completed ? 'text-green-800' : 'text-gray-900'
                          }`}>
                            {item.title}
                          </h4>
                        </div>
                        <p className={`text-xs mt-1 ${
                          item.completed ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          {item.description}
                        </p>
                      </div>
                      
                      {!item.completed && (
                        <div className="flex-shrink-0">
                          <ChevronUp className="h-3 w-3 text-gray-400 rotate-90" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}