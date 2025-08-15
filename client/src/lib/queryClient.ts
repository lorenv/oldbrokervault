import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage;
    const contentType = res.headers.get('content-type') || '';
    console.log(`Error response content-type: ${contentType}`);
    
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
        console.log(`Non-JSON error response (first 500 chars):`, text.substring(0, 500));
        errorMessage = text || res.statusText;
      }
    } catch (parseError) {
      console.log(`Error parsing response:`, parseError);
      errorMessage = res.statusText;
    }
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const isFormData = data instanceof FormData;
  
  const headers: Record<string, string> = isFormData ? {} : {};
  if (data && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  headers["Accept"] = "application/json";
  
  const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
  console.log(`Making ${method} request to ${fullUrl}`, { 
    data: data instanceof FormData ? 'FormData' : data,
    credentials: 'include',
    headers: headers
  });

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  console.log(`Response from ${fullUrl}:`, {
    status: res.status,
    statusText: res.statusText,
    contentType: res.headers.get('content-type'),
    actualUrl: res.url,
    requestUrl: fullUrl
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
    console.log(`Query request to ${fullUrl}`, { credentials: 'include' });
    
    const res = await fetch(fullUrl, {
      credentials: "include",
      headers: {
        "Accept": "application/json"
      }
    });

    console.log(`Query response from ${fullUrl}:`, {
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type'),
      actualUrl: res.url,
      requestUrl: fullUrl
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
