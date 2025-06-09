import { useQuery } from '@tanstack/react-query';

// Centralized hook for CIM document data to prevent duplicate API calls
export function useCimDocument(docId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: [`/api/cim/${docId}`],
    queryFn: async () => {
      if (!docId) throw new Error('No document ID provided');
      const response = await fetch(`/api/cim/${docId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch CIM document');
      return response.json();
    },
    enabled: !!docId && enabled,
    staleTime: 60000, // Cache for 60 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: false // Use cached data when available
  });
}

// Centralized hook for financial files to prevent duplicate API calls
export function useFinancialFiles(docId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: [`/api/cim/${docId}/financial-files`],
    queryFn: async () => {
      if (!docId) throw new Error('No document ID provided');
      const response = await fetch(`/api/cim/${docId}/financial-files`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch financial files');
      return response.json();
    },
    enabled: !!docId && enabled,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: false // Use cached data when available
  });
}

// Centralized hook for custom sections to prevent duplicate API calls
export function useCustomSections(docId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: [`/api/cim/${docId}/custom-sections`],
    queryFn: async () => {
      if (!docId) throw new Error('No document ID provided');
      const response = await fetch(`/api/cim/${docId}/custom-sections`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch custom sections');
      return response.json();
    },
    enabled: !!docId && enabled,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: false // Use cached data when available
  });
}

// Centralized hook for NDA signatures to prevent duplicate API calls
export function useNdaSignatures(docId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: [`/api/cim/${docId}/nda-signatures`],
    queryFn: async () => {
      if (!docId) throw new Error('No document ID provided');
      const response = await fetch(`/api/cim/${docId}/nda-signatures`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch NDA signatures');
      return response.json();
    },
    enabled: !!docId && enabled,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: false // Use cached data when available
  });
}