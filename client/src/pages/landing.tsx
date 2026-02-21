import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Dumbbell, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const [isSelectingUserType, setIsSelectingUserType] = useState(false);
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const handleUserTypeSelection = async (userType: 'coach' | 'owner') => {
    try {
      setIsSelectingUserType(true);
      await apiRequest("/api/auth/select-user-type", "POST", { userType });
      
      // Redirect to appropriate dashboard
      if (userType === 'coach') {
        window.location.href = "/coach-dashboard";
      } else {
        window.location.href = "/owner-dashboard";
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set user type. Please try again.",
        variant: "destructive",
      });
      setIsSelectingUserType(false);
    }
  };

  // If user is logged in but hasn't selected a user type, show selection
  if (user && (!user.userType || user.userType === "")) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-brand-500 rounded-full flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to SubCoach Pro</h1>
            <p className="text-gray-600">Please select your account type to continue</p>
          </div>
          
          <div className="space-y-4">
            <Button
              data-testid="button-coach-selection"
              onClick={() => handleUserTypeSelection('coach')}
              disabled={isSelectingUserType}
              className="w-full h-16 text-lg bg-brand-500 hover:bg-brand-600 text-white"
            >
              <Dumbbell className="mr-3 h-5 w-5" />
              I'm a Coach
            </Button>
            
            <Button
              data-testid="button-owner-selection"
              onClick={() => handleUserTypeSelection('owner')}
              disabled={isSelectingUserType}
              variant="outline"
              className="w-full h-16 text-lg border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Building2 className="mr-3 h-5 w-5" />
              I'm a Gym Owner
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="mx-auto h-20 w-20 bg-brand-500 rounded-full flex items-center justify-center mb-8">
              <Users className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              SubCoach Pro
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Connect coaches with substitution opportunities. The professional platform for gym owners and fitness coaches.
            </p>
            <Button
              data-testid="button-get-started"
              onClick={handleLogin}
              size="lg"
              className="bg-brand-500 hover:bg-brand-600 text-white px-8 py-4 text-lg"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything you need to manage substitutions
            </h2>
            <p className="text-lg text-gray-600">
              Streamline your coaching business with our comprehensive platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* For Coaches */}
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <Dumbbell className="h-12 w-12 text-brand-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">For Coaches</h3>
                <ul className="text-gray-600 space-y-2 text-left">
                  <li>• Find substitute opportunities near you</li>
                  <li>• Set your hourly rates and preferences</li>
                  <li>• Choose payment methods (Cash, PayPal, Venmo, etc.)</li>
                  <li>• Control your travel distance</li>
                  <li>• Track your bookings and earnings</li>
                </ul>
              </CardContent>
            </Card>

            {/* For Gym Owners */}
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <Building2 className="h-12 w-12 text-brand-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">For Gym Owners</h3>
                <ul className="text-gray-600 space-y-2 text-left">
                  <li>• Post substitute requests quickly</li>
                  <li>• Set multiple days and times</li>
                  <li>• Specify event types and requirements</li>
                  <li>• Control travel distance requirements</li>
                  <li>• Review and accept applications</li>
                </ul>
              </CardContent>
            </Card>

            {/* Platform Benefits */}
            <Card className="text-center p-6">
              <CardContent className="pt-6">
                <Users className="h-12 w-12 text-brand-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Platform Benefits</h3>
                <ul className="text-gray-600 space-y-2 text-left">
                  <li>• Secure authentication</li>
                  <li>• Real-time notifications</li>
                  <li>• Mobile-responsive design</li>
                  <li>• Professional matching system</li>
                  <li>• Easy communication tools</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-brand-500 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-xl text-brand-100 mb-8">
            Join thousands of coaches and gym owners already using SubCoach Pro
          </p>
          <Button
            data-testid="button-join-now"
            onClick={handleLogin}
            size="lg"
            variant="secondary"
            className="bg-white text-brand-600 hover:bg-gray-100 px-8 py-4 text-lg"
          >
            Join Now
          </Button>
        </div>
      </div>
    </div>
  );
}
