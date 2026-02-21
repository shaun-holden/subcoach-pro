import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Zap, Users, Clock, HeartHandshake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PricingPlansProps {
  currentPlan?: 'starter' | 'pro' | null;
  onPlanSelect?: (plan: 'starter' | 'pro') => void;
  showCurrentPlan?: boolean;
}

export function PricingPlans({ currentPlan, onPlanSelect, showCurrentPlan = true }: PricingPlansProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSelectPlan = async (planType: 'starter' | 'pro') => {
    if (currentPlan === planType) return;
    
    setIsLoading(planType);
    
    try {
      if (planType === 'pro') {
        // Create subscription for Pro plan
        const response = await apiRequest("/api/create-subscription", "POST", {
          priceId: process.env.VITE_STRIPE_PRICE_ID || 'price_pro_monthly',
          planType: 'pro'
        });
        
        const { sessionUrl } = await response.json();
        window.location.href = sessionUrl;
      } else {
        // Switch to pay-as-you-go (Starter plan)
        await apiRequest("/api/switch-to-payasyougo", "POST");
        
        toast({
          title: "Plan Updated",
          description: "You're now on the Starter plan. You'll be charged $10 per successful booking.",
        });
        
        onPlanSelect?.(planType);
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast({
        title: "Error",
        description: "Failed to update your plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const plans = [
    {
      id: 'starter',
      name: 'Starter Plan',
      subtitle: 'Pay-As-You-Go',
      price: '$10',
      period: 'per successful booking',
      description: 'Perfect for gyms with occasional coverage needs',
      icon: <Zap className="h-6 w-6" />,
      color: 'border-blue-200 bg-blue-50',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      features: [
        'No monthly commitment',
        'Pay only for successful bookings',
        'Access to all qualified coaches',
        'Basic support',
        'Standard job visibility'
      ],
      limitations: [
        'Per-booking fee applies',
        'Standard priority'
      ]
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      subtitle: 'Best Value',
      price: '$49',
      period: 'per month',
      description: 'Unlimited substitute requests with premium features',
      icon: <Star className="h-6 w-6" />,
      color: 'border-orange-300 bg-orange-50 ring-2 ring-orange-200',
      buttonColor: 'bg-orange-600 hover:bg-orange-700',
      badge: 'Most Popular',
      features: [
        'Unlimited substitute requests',
        'Priority job visibility to coaches',
        'Dedicated account support',
        'Advanced analytics & insights',
        'Early access to new features',
        'No per-booking fees'
      ],
      savings: 'Save up to $120/month vs Starter plan'
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto" data-testid="pricing-plans">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Choose Your Plan
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Easily find qualified gymnastics coaches to cover classes when you need it most.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative ${plan.color} ${currentPlan === plan.id ? 'ring-2 ring-green-500' : ''}`}
            data-testid={`plan-card-${plan.id}`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-orange-600 text-white px-3 py-1">
                  {plan.badge}
                </Badge>
              </div>
            )}
            
            {currentPlan === plan.id && showCurrentPlan && (
              <div className="absolute -top-3 right-4">
                <Badge className="bg-green-600 text-white px-3 py-1">
                  Current Plan
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-3 rounded-full ${plan.id === 'pro' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                  {plan.icon}
                </div>
              </div>
              
              <CardTitle className="text-xl font-bold">
                {plan.name}
              </CardTitle>
              
              <div className="text-sm text-gray-600 mb-2">
                {plan.subtitle}
              </div>
              
              <div className="mb-4">
                <span className="text-4xl font-bold text-gray-900">
                  {plan.price}
                </span>
                <span className="text-gray-600 ml-1">
                  {plan.period}
                </span>
              </div>
              
              <p className="text-sm text-gray-600">
                {plan.description}
              </p>
              
              {plan.savings && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    {plan.savings}
                  </Badge>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-3">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              {plan.limitations && plan.limitations.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Limitations:</p>
                  <div className="space-y-1">
                    {plan.limitations.map((limitation, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="h-1 w-1 bg-gray-400 rounded-full flex-shrink-0"></div>
                        <span className="text-xs text-gray-500">{limitation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <Button
                  onClick={() => handleSelectPlan(plan.id as 'starter' | 'pro')}
                  disabled={isLoading === plan.id || currentPlan === plan.id}
                  className={`w-full ${plan.buttonColor} text-white`}
                  data-testid={`button-select-${plan.id}`}
                >
                  {isLoading === plan.id ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Processing...
                    </div>
                  ) : currentPlan === plan.id ? (
                    'Current Plan'
                  ) : plan.id === 'pro' ? (
                    'Start Pro Plan'
                  ) : (
                    'Select Starter Plan'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Features Section */}
      <div className="mt-12 text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          What You Get With Every Plan
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="text-center" data-testid="feature-coaches">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-gray-100 rounded-full">
                <Users className="h-6 w-6 text-gray-700" />
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Qualified Coaches</h4>
            <p className="text-sm text-gray-600">
              Access to vetted, certified gymnastics coaches with USAG, AAU, and NGA credentials
            </p>
          </div>
          
          <div className="text-center" data-testid="feature-coverage">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-gray-100 rounded-full">
                <Clock className="h-6 w-6 text-gray-700" />
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Fast Coverage</h4>
            <p className="text-sm text-gray-600">
              Get substitute coaches quickly for last-minute coverage or planned absences
            </p>
          </div>
          
          <div className="text-center" data-testid="feature-support">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-gray-100 rounded-full">
                <HeartHandshake className="h-6 w-6 text-gray-700" />
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Dedicated Support</h4>
            <p className="text-sm text-gray-600">
              Customer support to help with any questions or issues you encounter
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}