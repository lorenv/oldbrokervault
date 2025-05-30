// Additional types for API responses
export interface ShareData {
  cim: {
    id: number;
    title: string;
    analysis: any;
    logoUrl: string | null;
    websiteUrl: string | null;
    selectedImages: string[] | null;
    userId: number;
  };
  requiresNda: boolean;
  ndaUrl?: string;
}