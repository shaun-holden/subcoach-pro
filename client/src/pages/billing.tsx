import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Calendar, 
  Check, 
  ArrowLeft,
  Crown,
  Zap,
  Shield,
  Receipt
} from "lucide-react";
import { Link } from "wouter";
import { PaymentMethodManager } from "@/components/PaymentMethodForm";

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

interface PaymentMethodData {
  hasPaymentMethod: boolean;
  paymentMethod?: {
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
}

interface BillingCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created: Date;
  receiptUrl?: string;
  metadata?: Record<string, string>;
}

export default function Billing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);

  // Fetch subscription status
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription-status"],
    enabled: !!user,
  });

  // Fetch billing history
  const { data: billingData, isLoading: billingLoading } = useQuery<{ charges: BillingCharge[] }>({
    queryKey: ["/api/billing-history"],
    enabled: !!user,
  });

  // Verify checkout after Stripe redirect
  useEffect(() => {
    const verifyCheckout = async () => {
      const sessionId = searchParams.get('session_id');
      if (searchParams.get('success') === 'true' && sessionId && user) {
        try {
          const response = await apiRequest("/api/stripe/verify-checkout", "POST", { sessionId });
          const data = await response.json();
          
          if (data.verified) {
            toast({
              title: "Success!",
              description: data.message || "Successfully upgraded to Pro plan",
            });
            // Force immediate refetch of subscription data
            await queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
            await queryClient.refetchQueries({ queryKey: ["/api/subscription-status"] });
            
            // Clean up URL
            window.history.replaceState({}, '', '/billing');
          }
        } catch (error) {
          console.error('Error verifying checkout:', error);
          toast({
            title: "Error",
            description: "Failed to verify payment. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };
    
    verifyCheckout();
  }, [searchParams, user, toast, queryClient]);

  // Switch plan mutation (handles both upgrade and downgrade)
  const switchPlanMutation = useMutation({
    mutationFn: async (planType: 'starter' | 'pro') => {
      const response = await apiRequest("/api/subscription/switch", "POST", { planType });
      const data = await response.json();
      return data;
    },
    onSuccess: async (data: any) => {
      if (data.sessionUrl) {
        // Redirect to Stripe checkout for Pro upgrade
        window.location.href = data.sessionUrl;
      } else {
        // Show success message for downgrade or same plan
        toast({
          title: "Success",
          description: data.message || "Plan updated successfully",
        });
        // Force immediate refetch to update UI
        await queryClient.invalidateQueries({ queryKey: ["/api/subscription-status"] });
        await queryClient.refetchQueries({ queryKey: ["/api/subscription-status"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/payment-method"] });
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

  const handleSwitchPlan = (planType: 'starter' | 'pro') => {
    switchPlanMutation.mutate(planType);
  };

  if (subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  const currentPlan = subscription?.planType || 'starter';
  const hasPaymentMethod = subscription?.hasPaymentMethod || false;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/owner-dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600 mt-2">Manage your payment methods and subscription plan</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Current Plan */}
          <div className="lg:col-span-2 space-y-6">
            {/* Plan Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {currentPlan === 'pro' ? (
                    <>
                      <Crown className="h-5 w-5 text-yellow-500" />
                      Pro Plan
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5 text-blue-500" />
                      Starter Plan (Pay-as-you-go)
                    </>
                  )}
                  <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
                    {subscription?.status || 'inactive'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {currentPlan === 'pro' 
                    ? 'Unlimited substitute requests for $49/month'
                    : 'Pay $10 per successful booking'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subscription?.nextBillingDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    Next billing: {new Date(subscription.nextBillingDate).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <PaymentMethodManager />

            {/* Billing Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Billing Summary
                </CardTitle>
                <CardDescription>
                  View your usage statistics and billing history
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Month Usage */}
                {subscription?.usage && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Current Month Usage</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-brand-600">
                          {subscription.usage.requestsPosted}
                        </div>
                        <div className="text-sm text-gray-600">Requests Posted</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {subscription.usage.successfulBookings}
                        </div>
                        <div className="text-sm text-gray-600">Successful Bookings</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          ${subscription.usage.totalCharges}
                        </div>
                        <div className="text-sm text-gray-600">Total Charges</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Divider */}
                {subscription?.usage && (
                  <div className="border-t border-gray-200"></div>
                )}

                {/* Billing History */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Billing History</h3>
                  {billingLoading ? (
                    <div className="text-center py-8 text-gray-500">
                      Loading billing history...
                    </div>
                  ) : billingData?.charges && billingData.charges.length > 0 ? (
                    <div className="space-y-3">
                      {billingData.charges.map((charge) => (
                        <div 
                          key={charge.id} 
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                          data-testid={`charge-${charge.id}`}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {charge.description}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(charge.created).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">
                                ${charge.amount.toFixed(2)}
                              </div>
                              <Badge 
                                variant={charge.status === 'succeeded' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {charge.status}
                              </Badge>
                            </div>
                            {charge.receiptUrl && (
                              <a
                                href={charge.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-600 hover:text-brand-700"
                                data-testid={`receipt-${charge.id}`}
                              >
                                <Receipt className="h-5 w-5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No billing history yet. Charges will appear here when you accept applications on the Starter plan.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plan Options */}
          <div className="space-y-6">
            <Card className={currentPlan === 'starter' ? 'ring-2 ring-brand-500' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  Starter
                </CardTitle>
                <CardDescription>Perfect for occasional use</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-4">$10</div>
                <div className="text-sm text-gray-600 mb-4">per successful booking</div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Pay only when coaches are booked
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Unlimited coach applications
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Basic analytics
                  </li>
                </ul>
                <Button 
                  className="mt-4 w-full"
                  variant={currentPlan === 'starter' ? 'outline' : 'default'}
                  onClick={() => handleSwitchPlan('starter')}
                  disabled={currentPlan === 'starter' || switchPlanMutation.isPending}
                  data-testid="button-switch-to-starter"
                >
                  {currentPlan === 'starter' 
                    ? 'Current Plan' 
                    : switchPlanMutation.isPending 
                      ? 'Switching...' 
                      : 'Switch to Starter'}
                </Button>
              </CardContent>
            </Card>

            <Card className={currentPlan === 'pro' ? 'ring-2 ring-yellow-500' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Pro
                </CardTitle>
                <CardDescription>Best for regular users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-4">$49</div>
                <div className="text-sm text-gray-600 mb-4">per month</div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Unlimited substitute requests
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Priority coach matching
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Advanced analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-500" />
                    Premium support
                  </li>
                </ul>
                <Button 
                  className="mt-4 w-full"
                  variant={currentPlan === 'pro' ? 'outline' : 'default'}
                  onClick={() => handleSwitchPlan('pro')}
                  disabled={currentPlan === 'pro' || switchPlanMutation.isPending || !hasPaymentMethod}
                  data-testid="button-switch-to-pro"
                >
                  {!hasPaymentMethod && currentPlan !== 'pro'
                    ? 'Add Payment Method First'
                    : currentPlan === 'pro'
                      ? 'Current Plan'
                      : switchPlanMutation.isPending
                        ? 'Switching...'
                        : 'Switch to Pro'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}