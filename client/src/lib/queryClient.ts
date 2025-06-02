import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
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
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
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
      staleTime: 1000 * 60 * 5, // 5 minutes for better performance
      cacheTime: 1000 * 60 * 30, // 30 minutes cache retention
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
