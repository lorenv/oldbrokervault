import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage;
    const contentType = res.headers.get('content-type') || '';
    
    try {
      // Clone the response so we can read it multiple times if needed
      const clonedRes = res.clone();
      
      if (contentType.includes('application/json')) {
        // Try to parse as JSON first (our API returns JSON errors)
        const errorData = await clonedRes.json();
        errorMessage = errorData.message || errorData.error || res.statusText;
      } else {
        // If not JSON, get text
        const text = await clonedRes.text();
        errorMessage = text || res.statusText;
      }
    } catch (parseError) {
      errorMessage = res.statusText;
    }
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<Response> {
  const body = options?.body;
  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = { ...options?.headers };
  if (body && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (!isFormData) {
    headers["Accept"] = "application/json";
  }
  
  const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    credentials: "include",
  });


  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    
    const res = await fetch(fullUrl, {
      credentials: "include",
      headers: {
        "Accept": "application/json"
      }
    });


    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Prevent refetch on component mount
      refetchOnReconnect: false,
      staleTime: 1000 * 60 * 10, // 10 minutes - much longer to prevent refetches
      gcTime: 1000 * 60 * 30, // 30 minutes cache retention (v5 syntax)
      retry: (failureCount, error: any) => {
        if (error?.message?.includes('401') || error?.message?.includes('404')) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: 1,
    },
  },
});

// Optimistic update helpers
export function createOptimisticUpdate<T>(
  queryKey: string[],
  updateFn: (oldData: T) => T
) {
  return {
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<T>(queryKey);
      
      if (previousData) {
        queryClient.setQueryData(queryKey, updateFn(previousData));
      }
      
      return { previousData };
    },
    onError: (_error: any, _variables: any, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

// Prefetch utilities for better performance
export function prefetchCimDocument(docId: number) {
  return queryClient.prefetchQuery({
    queryKey: [`/api/cim/${docId}`],
    staleTime: 1000 * 60 * 10,
  });
}

export function prefetchUserDocuments() {
  return queryClient.prefetchQuery({
    queryKey: ["/api/cim"],
    staleTime: 1000 * 60 * 5,
  });
}
