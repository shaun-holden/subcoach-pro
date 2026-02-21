import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, DollarSign, Calendar, Filter, Users, User, LogOut, CreditCard, Navigation, Phone, MessageSquare, TrendingUp, Edit, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NotificationCenter } from "@/components/NotificationCenter";
import { InsightsDashboard } from "@/components/InsightsDashboard";
import { RateNegotiationInterface } from "@/components/RateNegotiationInterface";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import CoachProfileForm from "@/components/coach-profile-form";

export default function CoachDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Get saved travel preferences from localStorage or use defaults
  const getSavedTravelPrefs = () => {
    try {
      const saved = localStorage.getItem('coach-travel-preferences');
      return saved ? JSON.parse(saved) : { distanceFilter: "all" };
    } catch {
      return { distanceFilter: "all" };
    }
  };

  const [distanceFilter, setDistanceFilter] = useState<string>(getSavedTravelPrefs().distanceFilter);
  
  // Gymnastics specializations state
  const gymnasticsSpecializations = [
    "Floor Exercise", "Vault", "Uneven Bars", "Balance Beam", 
    "Rings", "Parallel Bars", "Pommel Horse", "High Bar"
  ];
  
  // Get saved specializations from localStorage or use defaults
  const getSavedSpecializations = () => {
    const saved = localStorage.getItem('coach-highlighted-specializations');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return ["Floor Exercise", "Vault", "Balance Beam"]; // Default fallback
      }
    }
    return ["Floor Exercise", "Vault", "Balance Beam"]; // Default highlighted specializations
  };
  
  const [highlightedSpecializations, setHighlightedSpecializations] = useState<string[]>(getSavedSpecializations());
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [certificationData, setCertificationData] = useState({
    usagMemberNumber: "",
    usagExpiration: "",
    aauMemberNumber: "", 
    aauExpiration: "",
    ngaMemberNumber: "",
    ngaExpiration: "",
    additionalCertifications: [] as Array<{name: string, memberNumber: string, expirationDate: string}>
  });

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

  // Get coach profile data from localStorage (persistent form data) or use defaults
  const getCoachProfile = () => {
    try {
      const saved = localStorage.getItem('coach-profile-form-data');
      const savedData = saved ? JSON.parse(saved) : null;
      
      return {
        firstName: savedData?.firstName || user?.firstName || "Alex",
        lastName: savedData?.lastName || user?.lastName || "Johnson", 
        email: savedData?.emailToGymOwners || user?.email || "alex.johnson@email.com",
        phone: savedData?.phone || "+1 (555) 123-4567",
        address: savedData?.address || "123 Fitness Street, Gym City, GC 12345",
        hourlyRate: savedData?.hourlyRate || "45",
        maxTravelDistance: parseInt(savedData?.maxTravelDistance) || 15,
        paymentMethods: savedData?.paymentMethods || ["cash", "paypal", "venmo"]
      };
    } catch {
      // Fallback to defaults if localStorage fails
      return {
        firstName: user?.firstName || "Alex",
        lastName: user?.lastName || "Johnson",
        email: user?.email || "alex.johnson@email.com", 
        phone: "+1 (555) 123-4567",
        address: "123 Fitness Street, Gym City, GC 12345",
        hourlyRate: "45",
        maxTravelDistance: 15,
        paymentMethods: ["cash", "paypal", "venmo"]
      };
    }
  };

  const coachProfileLocal = getCoachProfile();

  // Fetch coach profile from database
  const { data: coachProfileData, refetch: refetchProfile } = useQuery({
    queryKey: ["/api/coach/profile"],
    retry: false,
  });

  // Use backend data if available, otherwise fall back to localStorage
  const coachProfile = coachProfileData || coachProfileLocal;

  // Update certification data when profile loads from backend
  useEffect(() => {
    if (coachProfileData && (coachProfileData as any).certificationDetails) {
      const details = (coachProfileData as any).certificationDetails;
      setCertificationData({
        usagMemberNumber: details.usag?.membershipNumber || "",
        usagExpiration: details.usag?.expirationDate || "",
        aauMemberNumber: details.aau?.membershipNumber || "",
        aauExpiration: details.aau?.expirationDate || "",
        ngaMemberNumber: details.nga?.membershipNumber || "",
        ngaExpiration: details.nga?.expirationDate || "",
        additionalCertifications: details.additionalCertifications || []
      });
    }
  }, [coachProfileData]);

  // Fetch available opportunities from database with auto-refresh
  const { data: opportunities, isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useQuery({
    queryKey: ["/api/opportunities"],
    retry: false,
    refetchInterval: 30000, // Auto-refresh every 30 seconds to sync with owner changes
  });

  // Fetch my applications from database with auto-refresh
  const { data: myApplications, refetch: refetchApplications } = useQuery({
    queryKey: ["/api/applications"],
    retry: false,
    refetchInterval: 30000, // Auto-refresh every 30 seconds to sync with owner changes
  });

  // Filter accepted applications for recent activity
  const recentAcceptedJobs = Array.isArray(myApplications) ? myApplications.filter((app: any) => app.status === 'accepted') : [];

  // Apply to opportunity mutation
  const applyMutation = useMutation({
    mutationFn: async (data: { requestId: string; requestedRate?: string; message?: string }) => {
      await apiRequest("/api/coaches/apply", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Application submitted successfully!",
      });
      // Invalidate and refetch related data
      refetchOpportunities();
      refetchApplications();
    },
    onError: (error) => {
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
        description: error.message || "Failed to submit application",
        variant: "destructive",
      });
    },
  });

  const handleApply = (requestId: string) => {
    // Send the coach's preferred hourly rate as the requested rate
    applyMutation.mutate({ 
      requestId, 
      requestedRate: coachProfile.hourlyRate,
      message: "I'm interested in this opportunity"
    });
  };

  // Certification update mutation
  const updateCertificationMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("/api/coaches/certifications", "PUT", data);
    },
    onSuccess: () => {
      refetchProfile();
      toast({
        title: "Success",
        description: "Certifications updated successfully!",
      });
      setShowCertificationModal(false);
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to update certifications",
        variant: "destructive",
      });
    },
  });

  const handleUpdateCertifications = () => {
    const validAdditionalCerts = certificationData.additionalCertifications.filter(cert => cert.name.trim() !== '');
    
    updateCertificationMutation.mutate({
      ...certificationData,
      additionalCertifications: validAdditionalCerts
    });
  };

  // Save travel preferences to localStorage when changed
  const saveTravelPreferences = (newDistanceFilter: string) => {
    try {
      localStorage.setItem('coach-travel-preferences', JSON.stringify({
        distanceFilter: newDistanceFilter,
        lastUpdated: new Date().toISOString()
      }));
      console.log('Travel preferences saved successfully');
    } catch (error) {
      console.error('Failed to save travel preferences:', error);
      toast({
        title: "Preferences Not Saved", 
        description: "Your travel filter preference could not be saved.",
        variant: "destructive",
      });
    }
  };

  const handleDistanceFilterChange = (value: string) => {
    setDistanceFilter(value);
    saveTravelPreferences(value);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const filteredOpportunities = Array.isArray(opportunities) ? opportunities.filter((opp: any) => {
    if (distanceFilter === "all") return true;
    const maxDistance = parseInt(distanceFilter);
    
    // If distance is not available (no coach address or geocoding failed), show the opportunity
    if (opp.distanceInMiles === null || opp.distanceInMiles === undefined) {
      return true;
    }
    
    // Filter by actual distance
    return opp.distanceInMiles <= maxDistance;
  }) : [];

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
              <NotificationCenter userType="coach" userId={user?.id || ''} />
              <span data-testid="text-coach-name" className="text-sm text-gray-700">
                {user?.firstName} {user?.lastName}
              </span>
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
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
        <Tabs defaultValue="opportunities" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger data-testid="tab-opportunities" value="opportunities">Available Opportunities</TabsTrigger>
            <TabsTrigger data-testid="tab-applications" value="applications">My Applications</TabsTrigger>
            <TabsTrigger data-testid="tab-bookings" value="bookings">My Experience</TabsTrigger>
            <TabsTrigger data-testid="tab-insights" value="insights">
              <TrendingUp className="h-4 w-4 mr-1" />
              Insights
            </TabsTrigger>
            <TabsTrigger data-testid="tab-profile" value="profile">Profile & Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities" className="mt-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Available Opportunities</h1>
              <div className="flex items-center space-x-4">
                <Select value={distanceFilter} onValueChange={handleDistanceFilterChange}>
                  <SelectTrigger data-testid="select-distance-filter" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All distances</SelectItem>
                    <SelectItem value="5">Within 5 miles</SelectItem>
                    <SelectItem value="10">Within 10 miles</SelectItem>
                    <SelectItem value="25">Within 25 miles</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </div>
            </div>

            {opportunitiesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !filteredOpportunities || filteredOpportunities.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No opportunities available</h3>
                  <p className="text-gray-600">Check back later for new substitute opportunities.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredOpportunities.map((opportunity: any) => (
                  <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h3 data-testid={`text-gym-name-${opportunity.id}`} className="text-lg font-semibold text-gray-900">
                              {opportunity.owner.gymName}
                            </h3>
                            {opportunity.distanceInMiles !== null && opportunity.distanceInMiles !== undefined && (
                              <Badge variant="secondary" className="ml-3">
                                {opportunity.distanceInMiles.toFixed(1)} miles away
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-500">Event Type</p>
                              <p data-testid={`text-event-type-${opportunity.id}`} className="font-medium text-gray-900">
                                {opportunity.eventType}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Date & Time</p>
                              <p data-testid={`text-date-time-${opportunity.id}`} className="font-medium text-gray-900">
                                {new Date(opportunity.startDate).toLocaleDateString()} - {opportunity.startTime}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Duration</p>
                              <p data-testid={`text-duration-${opportunity.id}`} className="font-medium text-gray-900">
                                {opportunity.startTime} - {opportunity.endTime}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-4">
                            <MapPin className="mr-2 h-4 w-4" />
                            <span data-testid={`text-address-${opportunity.id}`}>{opportunity.owner.address}</span>
                          </div>
                          
                          {opportunity.description && (
                            <p data-testid={`text-description-${opportunity.id}`} className="text-sm text-gray-700">
                              {opportunity.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="ml-6 text-right">
                          <div data-testid={`text-pay-rate-${opportunity.id}`} className="text-2xl font-bold text-brand-600">
                            ${opportunity.rateOffer ? parseFloat(opportunity.rateOffer).toFixed(2) : opportunity.hourlyRate || 'N/A'}/hr
                          </div>
                          <p className="text-sm text-gray-500 mb-4">Offered rate</p>
                          <Button
                            data-testid={`button-apply-${opportunity.id}`}
                            onClick={() => handleApply(opportunity.id)}
                            disabled={applyMutation.isPending}
                            className="bg-brand-500 hover:bg-brand-600"
                          >
                            {applyMutation.isPending ? "Applying..." : "Apply Now"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="applications" className="mt-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
              <Badge variant="outline" className="text-sm">
                {Array.isArray(myApplications) ? myApplications.length : 0} Total Applications
              </Badge>
            </div>

            {!Array.isArray(myApplications) || myApplications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No applications yet</h3>
                  <p className="text-gray-600">Once you apply to opportunities, they'll appear here with their current status.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {myApplications.map((application: any) => (
                  <Card key={application.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h3 data-testid={`text-application-gym-${application.id}`} className="text-lg font-semibold text-gray-900">
                              {application.request?.owner?.gymName || "Gym Name"}
                            </h3>
                            <Badge 
                              variant={
                                application.status === 'accepted' ? 'default' : 
                                application.status === 'declined' ? 'destructive' : 
                                'secondary'
                              }
                              className={
                                application.status === 'accepted' ? 'bg-green-600 text-white ml-3' :
                                application.status === 'declined' ? 'bg-red-600 text-white ml-3' :
                                'ml-3'
                              }
                              data-testid={`badge-status-${application.id}`}
                            >
                              {application.status === 'accepted' ? '✓ Accepted' : 
                               application.status === 'declined' ? '✗ Declined' : 
                               'Pending Review'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-500">Event Type</p>
                              <p data-testid={`text-application-type-${application.id}`} className="font-medium text-gray-900">
                                {application.request?.eventType || "Event Type"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Date & Time</p>
                              <p data-testid={`text-application-date-${application.id}`} className="font-medium text-gray-900">
                                {application.request?.startDate ? new Date(application.request.startDate).toLocaleDateString() : "Date"} - {application.request?.startTime || "Time"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Job Rate</p>
                              <p data-testid={`text-application-rate-${application.id}`} className="font-medium text-gray-900">
                                ${application.request?.rateOffer ? parseFloat(application.request.rateOffer).toFixed(2) : application.request?.hourlyRate || application.requestedRate}/hr
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-2">
                            <Clock className="mr-2 h-4 w-4" />
                            <span>Applied {new Date(application.appliedAt).toLocaleDateString()} at {new Date(application.appliedAt).toLocaleTimeString()}</span>
                          </div>
                          
                          {application.status === 'accepted' && application.acceptedAt && (
                            <div className="flex items-center text-sm text-green-600 mb-2">
                              <span>✓ Accepted on {new Date(application.acceptedAt).toLocaleDateString()} at {new Date(application.acceptedAt).toLocaleTimeString()}</span>
                            </div>
                          )}
                          
                          {application.status === 'declined' && application.declinedAt && (
                            <div className="flex items-center text-sm text-red-600 mb-2">
                              <span>✗ Declined on {new Date(application.declinedAt).toLocaleDateString()} at {new Date(application.declinedAt).toLocaleTimeString()}</span>
                            </div>
                          )}
                          
                          {application.message && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-500 mb-1">Your message:</p>
                              <p className="text-sm text-gray-700">"{application.message}"</p>
                            </div>
                          )}

                          {/* Rate Negotiation Interface */}
                          {application.status === 'pending' && (
                            <div className="mt-4 border-t pt-4">
                              <RateNegotiationInterface
                                applicationId={application.id}
                                currentRate={application.request?.rateOffer ? parseFloat(application.request.rateOffer) : application.request?.hourlyRate || 25}
                                coachRequestedRate={application.requestedRate}
                                ownerOfferedRate={application.request?.rateOffer ? parseFloat(application.request.rateOffer) : undefined}
                                userType="coach"
                              />
                            </div>
                          )}

                          {/* Contact and Navigation Actions */}
                          <div className="mt-4 flex flex-wrap gap-2">
                            {/* GPS Directions Link */}
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                application.request?.owner?.address || "Gym Address"
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                              data-testid={`link-directions-${application.id}`}
                            >
                              <Navigation className="w-4 h-4 mr-1.5" />
                              Get Directions
                            </a>

                            {/* Phone Call Link */}
                            <a
                              href={`tel:${application.request?.owner?.phone || "+1-555-0000"}`}
                              className="inline-flex items-center px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                              data-testid={`link-call-${application.id}`}
                            >
                              <Phone className="w-4 h-4 mr-1.5" />
                              Call Gym
                            </a>

                            {/* Text Message Link */}
                            <a
                              href={`sms:${application.request?.owner?.phone || "+1-555-0000"}?body=Hi, this is ${user?.firstName} ${user?.lastName}. I'm the coach who applied for the ${application.request?.eventType || "coaching position"} on ${application.request?.startDate ? new Date(application.request.startDate).toLocaleDateString() : "the scheduled date"}. I wanted to follow up on my application.`}
                              className="inline-flex items-center px-3 py-1.5 text-sm bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                              data-testid={`link-text-${application.id}`}
                            >
                              <MessageSquare className="w-4 h-4 mr-1.5" />
                              Send Text
                            </a>
                          </div>
                        </div>
                        
                        {application.status === 'accepted' && (
                          <div className="ml-6 text-right">
                            <div className="text-green-600 font-medium">
                              🎉 Congratulations!
                            </div>
                            <p className="text-sm text-gray-500 mt-1">Check your email for next steps</p>
                          </div>
                        )}
                        
                        {application.status === 'declined' && (
                          <div className="ml-6 text-right">
                            <div className="text-gray-600 font-medium">
                              Keep trying!
                            </div>
                            <p className="text-sm text-gray-500 mt-1">More opportunities await</p>
                          </div>
                        )}
                        
                        {application.status === 'pending' && (
                          <div className="ml-6 text-right">
                            <div className="text-blue-600 font-medium">
                              Under Review
                            </div>
                            <p className="text-sm text-gray-500 mt-1">Gym owner is reviewing</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bookings" className="mt-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">My Experience & Certifications</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Professional Experience */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="mr-2 h-5 w-5" />
                    Professional Experience
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Years of Experience</p>
                      <p data-testid="text-experience-years" className="font-medium text-gray-900">5+ years</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Gymnastics Specializations</p>
                      <p className="text-xs text-gray-400 mb-3">Click to highlight your primary specializations</p>
                      <div className="flex flex-wrap gap-2">
                        {gymnasticsSpecializations.map((specialization) => {
                          const isHighlighted = highlightedSpecializations.includes(specialization);
                          return (
                            <Badge
                              key={specialization}
                              variant={isHighlighted ? "default" : "secondary"}
                              className={`cursor-pointer transition-all duration-200 ${
                                isHighlighted 
                                  ? "bg-brand-500 hover:bg-brand-600 text-white shadow-md" 
                                  : "hover:bg-gray-200 border border-gray-300"
                              }`}
                              onClick={() => {
                                const updatedSpecializations = highlightedSpecializations.includes(specialization)
                                  ? highlightedSpecializations.filter(s => s !== specialization)
                                  : [...highlightedSpecializations, specialization];
                                
                                setHighlightedSpecializations(updatedSpecializations);
                                
                                // Save to localStorage
                                localStorage.setItem('coach-highlighted-specializations', JSON.stringify(updatedSpecializations));
                                
                                toast({
                                  title: isHighlighted ? "Specialization removed" : "Specialization highlighted",
                                  description: `${specialization} ${isHighlighted ? "removed from" : "added to"} your highlights`,
                                });
                              }}
                              data-testid={`badge-specialization-${specialization.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {specialization}
                            </Badge>
                          );
                        })}
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        <span className="font-medium">{highlightedSpecializations.length}</span> of {gymnasticsSpecializations.length} specializations highlighted
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* Certifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CreditCard className="mr-2 h-5 w-5" />
                      Certifications
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowCertificationModal(true)}
                      data-testid="button-edit-certifications"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Update
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-3">Fitness Certifications</p>
                      <div className="space-y-3">
                        {certificationData.usagMemberNumber && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span data-testid="cert-usag" className="font-medium text-gray-900">USAG Certified</span>
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <div>
                                <span className="font-medium">Member #:</span> {certificationData.usagMemberNumber}
                              </div>
                              <div>
                                <span className="font-medium">Expires:</span> {certificationData.usagExpiration ? new Date(certificationData.usagExpiration).toLocaleDateString() : 'Not set'}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {certificationData.aauMemberNumber && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span data-testid="cert-aau" className="font-medium text-gray-900">AAU Certified</span>
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <div>
                                <span className="font-medium">Member #:</span> {certificationData.aauMemberNumber}
                              </div>
                              <div>
                                <span className="font-medium">Expires:</span> {certificationData.aauExpiration ? new Date(certificationData.aauExpiration).toLocaleDateString() : 'Not set'}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {certificationData.ngaMemberNumber && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span data-testid="cert-nga" className="font-medium text-gray-900">NGA Certified</span>
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <div>
                                <span className="font-medium">Member #:</span> {certificationData.ngaMemberNumber}
                              </div>
                              <div>
                                <span className="font-medium">Expires:</span> {certificationData.ngaExpiration ? new Date(certificationData.ngaExpiration).toLocaleDateString() : 'Not set'}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {!certificationData.usagMemberNumber && !certificationData.aauMemberNumber && !certificationData.ngaMemberNumber && (
                          <div className="p-3 bg-gray-50 rounded-lg text-center text-gray-500">
                            No certifications added yet. Click "Update" to add your certifications.
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {certificationData.additionalCertifications.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-3">Additional Certifications</p>
                        <div className="space-y-3">
                          {certificationData.additionalCertifications.map((cert, index) => (
                            <div key={index} className="p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span data-testid={`cert-additional-${index}`} className="font-medium text-gray-900">{cert.name}</span>
                                <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                <div>
                                  <span className="font-medium">Certificate #:</span> {cert.memberNumber || 'N/A'}
                                </div>
                                <div>
                                  <span className="font-medium">Expires:</span> {cert.expirationDate ? new Date(cert.expirationDate).toLocaleDateString() : 'N/A'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="mr-2 h-5 w-5" />
                    Recent Coaching Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentAcceptedJobs.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No completed sessions yet</h3>
                      <p className="text-gray-600">Your completed coaching sessions will appear here once you accept and complete opportunities from gym owners.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentAcceptedJobs.map((job: any) => (
                        <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              {job.request.eventType} - {job.request.owner.gymName}
                            </p>
                            <p className="text-sm text-gray-500">
                              Completed {new Date(job.request.startDate).toLocaleDateString()} • 
                              {job.request.startTime} - {job.request.endTime}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-brand-600">
                              ${job.request.rateOffer || job.requestedRate || job.request.hourlyRate}/hr
                            </p>
                            <p className="text-sm text-gray-500">
                              {(() => {
                                const start = new Date(`2000-01-01 ${job.request.startTime}`);
                                const end = new Date(`2000-01-01 ${job.request.endTime}`);
                                const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                return `${diff} ${diff === 1 ? 'hour' : 'hours'}`;
                              })()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Performance Insights</h1>
                <p className="text-gray-600">Personalized insights to help you succeed as a substitute coach.</p>
              </div>
              <InsightsDashboard userType="coach" userId={user?.id || ''} />
            </div>
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <CoachProfileForm 
              coachProfile={coachProfile} 
              onSave={refetchProfile}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Certification Update Modal */}
      <Dialog open={showCertificationModal} onOpenChange={setShowCertificationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Certifications</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="usag-member">USAG Member Number</Label>
                <Input
                  id="usag-member"
                  value={certificationData.usagMemberNumber}
                  onChange={(e) => setCertificationData({...certificationData, usagMemberNumber: e.target.value})}
                  placeholder="USG-12345"
                />
              </div>
              <div>
                <Label htmlFor="usag-exp">USAG Expiration Date</Label>
                <Input
                  id="usag-exp"
                  type="date"
                  value={certificationData.usagExpiration}
                  onChange={(e) => setCertificationData({...certificationData, usagExpiration: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="aau-member">AAU Member Number</Label>
                <Input
                  id="aau-member"
                  value={certificationData.aauMemberNumber}
                  onChange={(e) => setCertificationData({...certificationData, aauMemberNumber: e.target.value})}
                  placeholder="AAU-67890"
                />
              </div>
              <div>
                <Label htmlFor="aau-exp">AAU Expiration Date</Label>
                <Input
                  id="aau-exp"
                  type="date"
                  value={certificationData.aauExpiration}
                  onChange={(e) => setCertificationData({...certificationData, aauExpiration: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="nga-member">NGA Member Number</Label>
                <Input
                  id="nga-member"
                  value={certificationData.ngaMemberNumber}
                  onChange={(e) => setCertificationData({...certificationData, ngaMemberNumber: e.target.value})}
                  placeholder="NGA-54321"
                />
              </div>
              <div>
                <Label htmlFor="nga-exp">NGA Expiration Date</Label>
                <Input
                  id="nga-exp"
                  type="date"
                  value={certificationData.ngaExpiration}
                  onChange={(e) => setCertificationData({...certificationData, ngaExpiration: e.target.value})}
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Additional Certifications</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newCert = {name: "", memberNumber: "", expirationDate: ""};
                    setCertificationData({
                      ...certificationData,
                      additionalCertifications: [...certificationData.additionalCertifications, newCert]
                    });
                  }}
                  data-testid="button-add-certification"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Certification
                </Button>
              </div>

              {certificationData.additionalCertifications.length > 0 && (
                <div className="space-y-4">
                  {certificationData.additionalCertifications.map((cert, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <Label className="text-sm font-medium">Certification {index + 1}</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const updated = certificationData.additionalCertifications.filter((_, i) => i !== index);
                            setCertificationData({...certificationData, additionalCertifications: updated});
                          }}
                          data-testid={`button-remove-certification-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <Label htmlFor={`cert-name-${index}`} className="text-xs">Certification Name</Label>
                        <Input
                          id={`cert-name-${index}`}
                          value={cert.name}
                          onChange={(e) => {
                            const updated = [...certificationData.additionalCertifications];
                            updated[index] = {...updated[index], name: e.target.value};
                            setCertificationData({...certificationData, additionalCertifications: updated});
                          }}
                          placeholder="e.g., CPR/AED, First Aid, SafeSport"
                          data-testid={`input-cert-name-${index}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`cert-number-${index}`} className="text-xs">Member/Certificate Number</Label>
                        <Input
                          id={`cert-number-${index}`}
                          value={cert.memberNumber}
                          onChange={(e) => {
                            const updated = [...certificationData.additionalCertifications];
                            updated[index] = {...updated[index], memberNumber: e.target.value};
                            setCertificationData({...certificationData, additionalCertifications: updated});
                          }}
                          placeholder="Certificate number"
                          data-testid={`input-cert-number-${index}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`cert-exp-${index}`} className="text-xs">Expiration Date</Label>
                        <Input
                          id={`cert-exp-${index}`}
                          type="date"
                          value={cert.expirationDate}
                          onChange={(e) => {
                            const updated = [...certificationData.additionalCertifications];
                            updated[index] = {...updated[index], expirationDate: e.target.value};
                            setCertificationData({...certificationData, additionalCertifications: updated});
                          }}
                          data-testid={`input-cert-exp-${index}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={() => setShowCertificationModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateCertifications}
                disabled={updateCertificationMutation.isPending}
                data-testid="button-save-certifications"
              >
                {updateCertificationMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
