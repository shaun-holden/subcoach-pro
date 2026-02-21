import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Calendar, Users, User, LogOut, Building2, Settings, Edit3, Eye, Trash2, TrendingUp, CreditCard, DollarSign } from "lucide-react";
import { NotificationCenter } from "@/components/NotificationCenter";
import { InsightsDashboard } from "@/components/InsightsDashboard";
import { RateNegotiationInterface } from "@/components/RateNegotiationInterface";

import { SubscriptionManagement } from "@/components/SubscriptionManagement";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import SubstituteRequestForm from "@/components/substitute-request-form";
import GymProfileDisplay from "@/components/gym-profile-display";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [pendingAcceptId, setPendingAcceptId] = useState<string | null>(null);
  const [showChargeConfirm, setShowChargeConfirm] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [user, toast]);

  // Fetch owner profile from database
  const { data: ownerProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["/api/owners/profile"],
    retry: false,
  });

  // Fetch my requests from database with real-time updates for applications
  const { data: myRequests, refetch: refetchRequests } = useQuery({
    queryKey: ["/api/owner-requests"],
    retry: false,
    refetchInterval: 5000, // Check for new applications every 5 seconds
  });

  // Fetch applications data for heat map analysis
  const { data: allApplications } = useQuery({
    queryKey: ["/api/applications"],
    retry: false,
  });

  // Fetch subscription status to check plan type
  const { data: subscription } = useQuery({
    queryKey: ["/api/subscription-status"],
    enabled: !!user,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleAcceptApplication = async (applicationId: string) => {
    // Default to showing dialog if subscription hasn't loaded (assume Starter for safety)
    // Or if explicitly on Starter plan
    const isProPlan = subscription && subscription.planType === 'pro';
    
    if (!isProPlan) {
      // Show confirmation dialog for Starter plan or unknown plan (safe default)
      setPendingAcceptId(applicationId);
      setShowChargeConfirm(true);
      return;
    }
    
    // Only accept directly if confirmed Pro plan
    await confirmAcceptApplication(applicationId);
  };

  const confirmAcceptApplication = async (applicationId: string) => {
    try {
      // Call the acceptance endpoint
      await apiRequest(`/api/applications/${applicationId}/accept`, "POST");
      
      toast({
        title: "Success",
        description: subscription?.planType === 'starter' 
          ? "Application accepted! Your card has been charged $10. Coach has been notified by email."
          : "Application accepted! Coach has been notified by email.",
      });
      
      // Refresh data to show updated status
      refetchRequests();
      // Invalidate coach opportunities and applications to sync data
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
      
      // Poll billing history with retry to wait for Stripe charge processing
      const pollBillingHistory = async (attempts = 0, maxAttempts = 5) => {
        if (attempts >= maxAttempts) return;
        
        const delay = Math.min(2000 * Math.pow(1.5, attempts), 10000); // Exponential backoff, max 10s
        
        setTimeout(async () => {
          await queryClient.invalidateQueries({ queryKey: ["/api/billing-history"] });
          pollBillingHistory(attempts + 1, maxAttempts);
        }, delay);
      };
      
      pollBillingHistory();
      
      // Clear pending state
      setPendingAcceptId(null);
      setShowChargeConfirm(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept application",
        variant: "destructive",
      });
      setPendingAcceptId(null);
      setShowChargeConfirm(false);
    }
  };

  const handleDeclineApplication = async (applicationId: string) => {
    if (!window.confirm("Are you sure you want to decline this application? The coach will be notified by email.")) {
      return;
    }
    
    try {
      // Call the decline endpoint
      await apiRequest(`/api/applications/${applicationId}/decline`, "POST");
      
      toast({
        title: "Application Declined",
        description: "Application declined. Coach has been notified by email.",
      });
      
      // Refresh data to show updated status
      refetchRequests();
      // Invalidate coach opportunities and applications to sync data
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to decline application",
        variant: "destructive",
      });
    }
  };

  // Edit request mutation
  const editRequestMutation = useMutation({
    mutationFn: async (requestData: any) => {
      if (!editingRequest?.id) {
        throw new Error("No request ID for editing");
      }
      const response = await apiRequest(`/api/owner-requests/${editingRequest.id}`, "PUT", requestData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Request updated successfully!",
      });
      setShowEditDialog(false);
      setEditingRequest(null);
      refetchRequests();
      // Invalidate coach opportunities to sync updated data
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update request",
        variant: "destructive",
      });
    },
  });

  // Delete request mutation
  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest(`/api/owner-requests/${requestId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Request deleted successfully!",
      });
      // Invalidate the cache to force a refetch
      queryClient.invalidateQueries({ queryKey: ["/api/owner-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demo/opportunities"] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete request",
        variant: "destructive",
      });
    },
  });

  const handleEditRequest = (request: any) => {
    setEditingRequest(request);
    setShowEditDialog(true);
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (window.confirm("Are you sure you want to delete this request? This action cannot be undone.")) {
      deleteRequestMutation.mutate(requestId);
    }
  };

  const requestsArray = Array.isArray(myRequests) ? myRequests : [];
  
  // Debug logging
  console.log('All requests from API:', requestsArray);
  console.log('Active requests:', requestsArray.filter(r => r.status === 'active'));
  console.log('Request array length:', requestsArray.length);
  console.log('First request sample:', requestsArray[0]);
  
  const filteredRequests = requestsArray.filter((request: any) => {
    if (statusFilter === "all") return true;
    return request.status === statusFilter;
  });
  
  // Filter active requests with additional filtering options
  const filteredActiveRequests = requestsArray.filter((request: any) => {
    // First filter by active status (include both 'active' and 'pending review' as they're still open, exclude 'filled')
    if (request.status !== 'active' && request.status !== 'pending review') return false;
    
    // Then apply additional filters
    if (activeFilter === "all") return true;
    if (activeFilter === "with-rate") return request.rateOffer && parseFloat(request.rateOffer) > 0;
    if (activeFilter === "no-rate") return !request.rateOffer || parseFloat(request.rateOffer) <= 0;
    if (activeFilter === "recent") {
      const createdDate = new Date(request.createdAt);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      return createdDate >= threeDaysAgo;
    }
    
    return true;
  });

  // Filter approved requests (status='filled' meaning an application was accepted)
  const filteredApprovedRequests = requestsArray.filter((request: any) => {
    return request.status === 'filled';
  });

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-brand-500 rounded flex items-center justify-center">
                <Users className="h-4 w-4 text-white" />
              </div>
              <span className="ml-2 text-xl font-semibold text-gray-900">SubCoach Pro</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationCenter userType="owner" userId={user?.id || ''} />
              <span data-testid="text-owner-name" className="text-sm text-gray-700">
                {user?.firstName} {user?.lastName}
              </span>
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <Building2 className="h-4 w-4 text-gray-600" />
              </div>
              <Button
                data-testid="button-logout"
                onClick={handleLogout}
                variant="ghost"
                size="sm"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger data-testid="tab-create-request" value="create">Create Request</TabsTrigger>
            <TabsTrigger data-testid="tab-active-requests" value="requests">Active Requests</TabsTrigger>
            <TabsTrigger data-testid="tab-approved-requests" value="approved">Approved Requests</TabsTrigger>
            <TabsTrigger data-testid="tab-insights" value="insights">
              <TrendingUp className="h-4 w-4 mr-1" />
              Insights
            </TabsTrigger>
            <TabsTrigger data-testid="tab-billing" value="billing">
              <CreditCard className="h-4 w-4 mr-1" />
              Billing
            </TabsTrigger>
            <TabsTrigger data-testid="tab-gym-profile" value="profile">Gym Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-6">
            <div className="flex items-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Create Substitute Request</h1>
            </div>
            
            <SubstituteRequestForm onSuccess={async () => {
              console.log('Request created successfully, refreshing data...');
              await refetchRequests();
              // Also invalidate the cache to ensure fresh data
              queryClient.invalidateQueries({ queryKey: ['/api/owner-requests'] });
              // Switch to Active Requests tab to show the new request
              setTimeout(() => {
                const activeTab = document.querySelector('[data-testid="tab-active-requests"]') as HTMLElement;
                if (activeTab) {
                  activeTab.click();
                }
              }, 1000);
            }} />
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Active Requests</h1>
              <div className="flex items-center space-x-4">
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger data-testid="select-active-filter" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All active requests</SelectItem>
                    <SelectItem value="with-rate">With rate offer</SelectItem>
                    <SelectItem value="no-rate">No rate offer</SelectItem>
                    <SelectItem value="recent">Recently created</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!requestsArray || requestsArray.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No requests yet</h3>
                  <p className="text-gray-600">Create your first substitute request to get started.</p>
                </CardContent>
              </Card>
            ) : filteredActiveRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No active requests match your filter</h3>
                  <p className="text-gray-600">Try adjusting your filter criteria or create new requests.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredActiveRequests.map((request: any) => (
                  <Card key={request.id}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h3 data-testid={`text-request-event-type-${request.id}`} className="text-lg font-semibold text-gray-900">
                              {request.eventType}
                            </h3>
                            <Badge 
                              variant={
                                request.status === 'active' ? 'default' :
                                request.status === 'pending review' ? 'default' :
                                request.status === 'filled' ? 'secondary' : 'destructive'
                              }
                              className={`ml-3 ${request.status === 'pending review' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}`}
                            >
                              {request.status}
                            </Badge>
                            {request.applications?.length > 0 && (
                              <>
                                <Badge variant="outline" className="ml-2">
                                  {request.applications.length} Application{request.applications.length !== 1 ? 's' : ''}
                                </Badge>
                                {request.applications.some((app: any) => app.status === 'pending') && (
                                  <Badge className="ml-2 bg-orange-500 hover:bg-orange-600 text-white">
                                    {request.applications.filter((app: any) => app.status === 'pending').length} NEW
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-500">Date & Time</p>
                              <p data-testid={`text-request-date-${request.id}`} className="font-medium text-gray-900">
                                {new Date(request.startDate).toLocaleDateString()} - {request.startTime}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Duration</p>
                              <p data-testid={`text-request-duration-${request.id}`} className="font-medium text-gray-900">
                                {request.startTime} - {request.endTime}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Rate Offered</p>
                              <p data-testid={`text-request-rate-${request.id}`} className="font-medium text-gray-900">
                                {request.rateOffer ? `$${request.rateOffer}/hr` : 'Not specified'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Max Distance</p>
                              <p data-testid={`text-request-distance-${request.id}`} className="font-medium text-gray-900">
                                {request.maxTravelDistance} miles
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 ml-6">
                          <Button
                            data-testid={`button-edit-${request.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRequest(request)}
                            disabled={request.status === 'filled'}
                            className="flex items-center gap-2"
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            data-testid={`button-delete-${request.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteRequest(request.id)}
                            disabled={request.applications?.some((app: any) => app.status === 'accepted')}
                            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>

                      {/* Applications */}
                      {request.applications && request.applications.length > 0 && (
                        <div className="border-t border-gray-200 pt-4">
                          <h4 className="font-medium text-gray-900 mb-3">Applications Received</h4>
                          <div className="space-y-3">
                            {request.applications.map((application: any) => (
                              <div key={application.id} className="bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between p-3">
                                  <div className="flex items-center">
                                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                                      <User className="h-5 w-5 text-gray-600" />
                                    </div>
                                    <div>
                                      <p data-testid={`text-applicant-name-${application.id}`} className="font-medium text-gray-900">
                                        {application.coach.user.firstName} {application.coach.user.lastName}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        Applied {new Date(application.appliedAt).toLocaleDateString()} • 
                                        Wants ${application.requestedRate || request.hourlyRate}/hr
                                        {application.status === 'accepted' && application.acceptedAt && (
                                          <span className="text-green-600 ml-2">• Accepted {new Date(application.acceptedAt).toLocaleDateString()}</span>
                                        )}
                                        {application.status === 'declined' && application.declinedAt && (
                                          <span className="text-red-600 ml-2">• Declined {new Date(application.declinedAt).toLocaleDateString()}</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    {application.status === 'pending' ? (
                                      <div className="flex items-center space-x-2">
                                        <Button
                                          data-testid={`button-accept-${application.id}`}
                                          onClick={() => handleAcceptApplication(application.id)}
                                          className="bg-brand-500 hover:bg-brand-600 text-sm"
                                          size="sm"
                                        >
                                          Accept
                                        </Button>
                                        <Button
                                          data-testid={`button-decline-${application.id}`}
                                          onClick={() => handleDeclineApplication(application.id)}
                                          variant="outline"
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 text-sm"
                                          size="sm"
                                        >
                                          Decline
                                        </Button>
                                      </div>
                                    ) : (
                                      <Badge variant={application.status === 'accepted' ? 'default' : 'destructive'}
                                             className={application.status === 'accepted' ? 'bg-green-600 text-white' : application.status === 'declined' ? 'bg-red-600 text-white' : ''}>
                                        {application.status === 'accepted' ? '✓ Accepted' : application.status === 'declined' ? '✗ Declined' : application.status}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Rate Negotiation Interface for Owner */}
                                {application.status === 'pending' && (
                                  <div className="px-3 pb-3">
                                    <RateNegotiationInterface
                                      applicationId={application.id}
                                      currentRate={request.rateOffer ? parseFloat(request.rateOffer) : request.hourlyRate || 25}
                                      coachRequestedRate={application.requestedRate}
                                      ownerOfferedRate={request.rateOffer ? parseFloat(request.rateOffer) : undefined}
                                      userType="owner"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Approved Requests</h1>
              <p className="text-gray-600">Requests where you've accepted a coach</p>
            </div>

            {filteredApprovedRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No approved requests yet</h3>
                  <p className="text-gray-600">When you accept a coach's application, it will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredApprovedRequests.map((request: any) => {
                  // Find the accepted application
                  const acceptedApplication = request.applications?.find((app: any) => app.status === 'accepted');
                  
                  return (
                    <Card key={request.id} data-testid={`card-approved-request-${request.id}`}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <h3 data-testid={`text-request-event-type-${request.id}`} className="text-lg font-semibold text-gray-900">
                                {request.eventType}
                              </h3>
                              <Badge 
                                variant="default"
                                className="ml-3 bg-green-600 hover:bg-green-700 text-white"
                              >
                                ✓ Filled
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-sm text-gray-500">Date & Time</p>
                                <p data-testid={`text-request-date-${request.id}`} className="font-medium text-gray-900">
                                  {new Date(request.startDate).toLocaleDateString()} - {request.startTime}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Duration</p>
                                <p data-testid={`text-request-duration-${request.id}`} className="font-medium text-gray-900">
                                  {request.startTime} - {request.endTime}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Rate</p>
                                <p data-testid={`text-request-rate-${request.id}`} className="font-medium text-gray-900">
                                  ${request.rateOffer || request.hourlyRate}/hr
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Accepted Coach Info */}
                        {acceptedApplication && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Accepted Coach</h4>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                                    <User className="h-5 w-5 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      {acceptedApplication.coach?.user?.firstName} {acceptedApplication.coach?.user?.lastName}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {acceptedApplication.coach?.user?.email}
                                    </p>
                                    {acceptedApplication.coach?.phone && (
                                      <p className="text-sm text-gray-600">
                                        📞 {acceptedApplication.coach?.phone}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-500">Accepted Rate</p>
                                  <p className="text-lg font-bold text-green-600">
                                    ${request.rateOffer || acceptedApplication.requestedRate || request.hourlyRate}/hr
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Business Insights</h1>
                <p className="text-gray-600">Performance analytics and recommendations to optimize your substitute coaching operations.</p>
              </div>
              

              
              <InsightsDashboard userType="owner" userId={user?.id || ''} />
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-6">
            <SubscriptionManagement />
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <div className="flex items-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Gym Profile Settings</h1>
            </div>
            
            <GymProfileDisplay 
              ownerProfile={ownerProfile}
              onSave={refetchProfile}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Request Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Substitute Request</DialogTitle>
          </DialogHeader>
          {editingRequest && (
            <SubstituteRequestForm 
              initialData={editingRequest}
              onSuccess={(data) => {
                editRequestMutation.mutate(data);
              }}
              isEditing={true}
              submitButtonText={editRequestMutation.isPending ? "Updating..." : "Update Request"}
              disabled={editRequestMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Charge Confirmation Dialog for Starter Plan */}
      <AlertDialog open={showChargeConfirm} onOpenChange={setShowChargeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Confirm Booking Payment
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="text-base">
                You're on the <strong>Starter Plan</strong> (pay-as-you-go).
              </p>
              <p className="text-base">
                Accepting this application will charge your payment method <strong className="text-green-600">$10.00</strong> for this booking.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  💡 <strong>Tip:</strong> Switch to the Pro Plan ($49/month) for unlimited bookings with no per-session charges.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingAcceptId(null);
              setShowChargeConfirm(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingAcceptId) {
                  confirmAcceptApplication(pendingAcceptId);
                }
              }}
              className="bg-green-600 hover:bg-green-700"
              data-testid="confirm-charge-accept"
            >
              Accept & Pay $10
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
