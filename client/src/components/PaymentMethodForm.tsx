import { useState, useEffect } from 'react';
import { useStripe, useElements, CardElement, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
      iconColor: '#666EE8',
    },
    invalid: {
      color: '#9e2146',
      iconColor: '#fa755a',
    },
  },
};

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await apiRequest('/api/create-setup-intent', 'POST');
      const { client_secret } = await response.json();

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(client_secret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (stripeError) {
        setError(stripeError.message || 'An error occurred');
        setIsProcessing(false);
        return;
      }

      if (setupIntent.status === 'succeeded') {
        await apiRequest('/api/attach-payment-method', 'POST', { setupIntentId: setupIntent.id });

        toast({
          title: 'Success',
          description: 'Payment method added successfully',
        });

        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add payment method');
      toast({
        title: 'Error',
        description: err.message || 'Failed to add payment method',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg bg-white dark:bg-gray-950">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        data-testid="button-save-payment-method"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Save Payment Method
          </>
        )}
      </Button>
    </form>
  );
}

export function PaymentMethodManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: paymentMethodData, isLoading } = useQuery<{
    hasPaymentMethod: boolean;
    paymentMethod?: {
      id: string;
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    };
  }>({
    queryKey: ['/api/payment-method'],
  });

  const hasPaymentMethod = paymentMethodData?.hasPaymentMethod || false;
  const paymentMethod = paymentMethodData?.paymentMethod;

  const handleSuccess = () => {
    setShowAddForm(false);
    queryClient.invalidateQueries({ queryKey: ['/api/payment-method'] });
    queryClient.invalidateQueries({ queryKey: ['/api/subscription-status'] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Method
        </CardTitle>
        <CardDescription>
          {hasPaymentMethod
            ? 'Manage your payment method for pay-as-you-go charges'
            : 'Add a payment method to accept applications on the Starter plan'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPaymentMethod && paymentMethod ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    {paymentMethod.brand.toUpperCase()} •••• {paymentMethod.last4}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
                  </p>
                </div>
              </div>
            </div>

            {!showAddForm && (
              <Button
                variant="outline"
                onClick={() => setShowAddForm(true)}
                className="w-full"
                data-testid="button-update-payment-method"
              >
                Update Payment Method
              </Button>
            )}

            {showAddForm && (
              <div className="space-y-4">
                <Elements stripe={stripePromise}>
                  <PaymentForm onSuccess={handleSuccess} />
                </Elements>
                <Button
                  variant="ghost"
                  onClick={() => setShowAddForm(false)}
                  className="w-full"
                  data-testid="button-cancel-update"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Elements stripe={stripePromise}>
            <PaymentForm onSuccess={handleSuccess} />
          </Elements>
        )}

        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
            💡 <strong>Starter Plan:</strong> Your card is charged $10 per accepted application. 
            Upgrade to Pro for unlimited bookings at $49/month.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
