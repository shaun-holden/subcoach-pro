import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  // Use real authentication via API with custom handling for 401 errors
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  
  // If there's a 401 error, the user is not authenticated
  const isAuthenticated = !!user && !error;
  
  return {
    user: user || null,
    isLoading,
    isAuthenticated,
  };
}
