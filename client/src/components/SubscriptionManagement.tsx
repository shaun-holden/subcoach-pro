import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, CreditCard, TrendingUp, Zap, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  icon: any;
}

const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$10",
    period: "per booking",
    description: "Perfect for gyms with occasional substitute needs",
    icon: Zap,
    features: [
      "Pay only for successful bookings",
      "Access to all qualified coaches", 
      "Basic profile & request management",
      "Email notifications",
      "Standard support"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    period: "per month",
    description: "Best for gyms with regular substitute coaching needs",
    icon: Crown,
    popular: true,
    features: [
      "Unlimited substitute requests",
      "Priority coach matching",
      "Advanced analytics & insights",
      "Heat map demand analysis",
      "Automated reminders",
      "Priority support",
      "Custom rate negotiations"
    ]
  }
];

interface SubscriptionStatus {
  planType: 'starter' | 'pro';
  status: string;
  nextBillingDate?: Date;
  amount: number;
  cancelAtPeriodEnd: boolean;
  hasPaymentMethod: boolean;
  usage: {
    requestsPosted: number;
    successfulBookings: number;
    totalCharges: number;
  };
}

export function SubscriptionManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real subscription data
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription-status"],
    enabled: !!user,
  });

  // Add payment method mutation
  const addPaymentMethodMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/create-setup-intent", "POST");
      const { client_secret } = await response.json();
      
      const stripe = await stripePromise;
      if (!stripe) throw new Error("Stripe failed to load");

      // Create a test payment method
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: {
          number: '4242424242424242', // Test card number
          exp_month: 12,
          exp_year: 2030,
          cvc: '123',
        },
      });

      if (pmError) throw new Error(pmError.message);

      const { error } = await stripe.confirmCardSetup(client_secret, {
        payment_method: paymentMethod.id,
      });
      if (error) throw new Error(error.message);
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
      toast({
        title: "Payment Method Added",
        description: "Your payment method has been successfully added.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add payment method",
        variant: "destructive",
      });
    },
  });

  // Switch plan mutation (handles both upgrade and downgrade)
  const switchPlanMutation = useMutation({
    mutationFn: async (planType: 'starter' | 'pro') => {
      const response = await apiRequest("/api/subscription/switch", "POST", { planType });
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        toast({
          title: "Success",
          description: data.message || "Plan updated successfully",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to switch plan",
        variant: "destructive",
      });
    },
  });

  const handlePlanSelect = async (planId: string) => {
    if (planId === 'starter' || planId === 'pro') {
      switchPlanMutation.mutate(planId);
    }
  };

  const handleAddPaymentMethod = async () => {
    setIsLoading(true);
    try {
      await addPaymentMethodMutation.mutateAsync();
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Billing & Subscription</h1>
        <p className="text-gray-600">Manage your subscription plan and billing information.</p>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plans">Pricing Plans</TabsTrigger>
          <TabsTrigger value="billing">Billing History</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-6">
          {/* Current Plan Status */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Active Plan</p>
                  <p className="font-semibold capitalize">{subscription?.planType || 'starter'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <Badge variant="secondary" className="capitalize">
                    {subscription?.status || 'inactive'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    {subscription?.planType === 'starter' ? 'Total Bookings' : 'Next Billing'}
                  </p>
                  <p className="font-semibold">
                    {subscription?.planType === 'starter' 
                      ? subscription?.usage?.successfulBookings || 0
                      : subscription?.nextBillingDate 
                        ? new Date(subscription.nextBillingDate).toLocaleDateString()
                        : 'N/A'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pricingPlans.map((plan) => {
              const Icon = plan.icon;
              const isCurrentPlan = (subscription?.planType || 'starter') === plan.id;
              
              return (
                <Card 
                  key={plan.id} 
                  className={`relative ${plan.popular ? 'border-blue-500 shadow-lg' : ''} ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-500">Most Popular</Badge>
                    </div>
                  )}
                  
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <Badge className="bg-green-500">Current Plan</Badge>
                    </div>
                  )}

                  <CardHeader className="text-center">
                    <div className="mx-auto mb-2 p-2 rounded-full bg-gray-100 w-fit">
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="text-3xl font-bold">
                      {plan.price}
                      <span className="text-lg font-normal text-gray-600"> {plan.period}</span>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={isCurrentPlan ? "outline" : (plan.popular ? "default" : "outline")}
                      onClick={() => handlePlanSelect(plan.id)}
                      disabled={isCurrentPlan || switchPlanMutation.isPending}
                      data-testid={`button-select-${plan.id}`}
                    >
                      {isCurrentPlan 
                        ? "Current Plan" 
                        : switchPlanMutation.isPending 
                          ? "Processing..." 
                          : `Switch to ${plan.name}`
                      }
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Billing Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{subscription?.usage?.successfulBookings || 0}</p>
                  <p className="text-sm text-gray-600">Total Bookings</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">${subscription?.usage?.totalCharges || 0}</p>
                  <p className="text-sm text-gray-600">This Month</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">$90.00</p>
                  <p className="text-sm text-gray-600">Total Spent</p>
                </div>
              </div>

              <div className="border rounded-lg">
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="font-semibold">Recent Transactions</h3>
                </div>
                <div className="divide-y">
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">Substitute Booking - Yoga Class</p>
                      <p className="text-sm text-gray-600">August 15, 2025</p>
                    </div>
                    <p className="font-semibold">$10.00</p>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">Substitute Booking - Team Training</p>
                      <p className="text-sm text-gray-600">August 12, 2025</p>
                    </div>
                    <p className="font-semibold">$10.00</p>
                  </div>
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">Substitute Booking - Recreation Class</p>
                      <p className="text-sm text-gray-600">August 8, 2025</p>
                    </div>
                    <p className="font-semibold">$10.00</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}