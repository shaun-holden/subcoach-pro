import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, MessageCircle, Clock, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RateNegotiationInterfaceProps {
  applicationId: string;
  currentRate: number;
  coachRequestedRate?: number;
  ownerOfferedRate?: number;
  userType: "coach" | "owner";
}

export function RateNegotiationInterface({
  applicationId,
  currentRate,
  coachRequestedRate,
  ownerOfferedRate,
  userType
}: RateNegotiationInterfaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [proposedRate, setProposedRate] = useState("");
  const [message, setMessage] = useState("");
  const [showNegotiationForm, setShowNegotiationForm] = useState(false);

  // Fetch existing rate negotiation for this application
  const { data: negotiation, isLoading } = useQuery<any>({
    queryKey: ['/api/rate-negotiations/application', applicationId],
    enabled: !!applicationId,
  });

  // Create new rate negotiation mutation
  const createNegotiationMutation = useMutation({
    mutationFn: async (data: { proposedRate: string; message: string }) => {
      return await apiRequest('/api/rate-negotiations', 'POST', {
        applicationId,
        proposedRate: data.proposedRate,
        message: data.message
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rate-negotiations/application', applicationId] });
      setShowNegotiationForm(false);
      setProposedRate("");
      setMessage("");
      toast({
        title: "Negotiation Started",
        description: "Your rate proposal has been submitted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit rate negotiation. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Respond to rate negotiation mutation
  const respondToNegotiationMutation = useMutation({
    mutationFn: async (data: { action: string; proposedRate?: string; message?: string }) => {
      return await apiRequest(`/api/rate-negotiations/${negotiation?.id}/respond`, 'POST', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rate-negotiations/application', applicationId] });
      
      // Also invalidate applications and opportunities to reflect status changes
      if (variables.action === 'accept' || variables.action === 'decline') {
        queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
        queryClient.invalidateQueries({ queryKey: ['/api/owner-requests'] });
      }
      
      setShowNegotiationForm(false);
      setProposedRate("");
      setMessage("");
      
      const actionText = variables.action === 'accept' ? 'accepted' : 
                        variables.action === 'decline' ? 'declined' : 'countered';
      
      toast({
        title: "Response Submitted",
        description: `You have ${actionText} the rate negotiation.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to respond to rate negotiation. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleStartNegotiation = () => {
    if (!proposedRate || parseFloat(proposedRate) <= 0) {
      toast({
        title: "Invalid Rate",
        description: "Please enter a valid hourly rate.",
        variant: "destructive",
      });
      return;
    }

    createNegotiationMutation.mutate({
      proposedRate,
      message
    });
  };

  const handleRespondToNegotiation = (action: 'accept' | 'decline' | 'counter') => {
    if (action === 'counter') {
      if (!proposedRate || parseFloat(proposedRate) <= 0) {
        toast({
          title: "Invalid Rate",
          description: "Please enter a valid counter-offer rate.",
          variant: "destructive",
        });
        return;
      }
    }

    respondToNegotiationMutation.mutate({
      action,
      proposedRate: action === 'counter' ? proposedRate : undefined,
      message: message || undefined
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If there's an existing negotiation
  if (negotiation) {
    const isMyTurn = (userType === 'coach' && negotiation.proposedBy === 'owner') || 
                    (userType === 'owner' && negotiation.proposedBy === 'coach');
    
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <DollarSign className="mr-2 h-5 w-5 text-orange-600" />
            Rate Negotiation in Progress
            <Badge 
              variant={negotiation.status === 'pending' ? 'default' : 'secondary'} 
              className="ml-2"
            >
              {negotiation.status === 'pending' ? 'Active' : negotiation.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Negotiation Status */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-white rounded-lg border">
            <div className="text-center">
              <p className="text-sm text-gray-500">Current Offer</p>
              <p className="text-xl font-bold text-gray-900">${negotiation.currentRate}/hr</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Proposed Rate</p>
              <p className="text-xl font-bold text-orange-600">${negotiation.proposedRate}/hr</p>
            </div>
          </div>

          {/* Negotiation Message */}
          {negotiation.message && (
            <div className="p-3 bg-white rounded-lg border">
              <div className="flex items-start space-x-2">
                <MessageCircle className="h-4 w-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {negotiation.proposedBy === 'coach' ? 'Coach' : 'Gym Owner'} says:
                  </p>
                  <p className="text-sm text-gray-600 mt-1">"{negotiation.message}"</p>
                </div>
              </div>
            </div>
          )}

          {/* Negotiation History */}
          {negotiation.history && negotiation.history.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Negotiation History</p>
              {negotiation.history.map((entry: any, index: number) => (
                <div key={entry.id || index} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                  <span>{entry.proposedBy === 'coach' ? 'Coach' : 'Gym Owner'}: ${entry.rate}/hr</span>
                  <span className="text-gray-500">{new Date(entry.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Response Actions */}
          {isMyTurn && (negotiation.status === 'pending' || negotiation.status === 'countered') && (
            <div className="border-t pt-4">
              <Alert>
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  {userType === 'coach' ? 'The gym owner has made a counter-offer. You can accept, decline, or counter their proposal.' : 
                   'The coach has requested a rate negotiation. You can accept their rate, decline, or make a counter-offer.'}
                </AlertDescription>
              </Alert>

              <div className="mt-4 space-y-3">
                {!showNegotiationForm ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleRespondToNegotiation('accept')}
                      disabled={respondToNegotiationMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                      data-testid="button-accept-rate"
                    >
                      <CheckCircle className="mr-1 h-4 w-4" />
                      Accept ${negotiation.proposedRate}/hr
                    </Button>
                    <Button
                      onClick={() => handleRespondToNegotiation('decline')}
                      disabled={respondToNegotiationMutation.isPending}
                      variant="destructive"
                      size="sm"
                      data-testid="button-decline-rate"
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Decline
                    </Button>
                    <Button
                      onClick={() => setShowNegotiationForm(true)}
                      variant="outline"
                      size="sm"
                      data-testid="button-counter-offer"
                    >
                      <DollarSign className="mr-1 h-4 w-4" />
                      Counter Offer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex space-x-2">
                      <Input
                        type="number"
                        placeholder="Your counter-offer rate"
                        value={proposedRate}
                        onChange={(e) => setProposedRate(e.target.value)}
                        className="flex-1"
                        min="0"
                        step="0.50"
                        data-testid="input-counter-rate"
                      />
                      <span className="flex items-center text-sm text-gray-500">/hr</span>
                    </div>
                    <Textarea
                      placeholder="Optional message explaining your counter-offer..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[60px]"
                      data-testid="textarea-counter-message"
                    />
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleRespondToNegotiation('counter')}
                        disabled={respondToNegotiationMutation.isPending}
                        size="sm"
                        data-testid="button-submit-counter"
                      >
                        Submit Counter Offer
                      </Button>
                      <Button
                        onClick={() => setShowNegotiationForm(false)}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Waiting for response */}
          {!isMyTurn && (negotiation.status === 'pending' || negotiation.status === 'countered') && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Waiting for {negotiation.proposedBy === 'coach' ? 'gym owner' : 'coach'} to respond to your proposal.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  // No existing negotiation - show option to start one
  if (userType === 'coach') {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <DollarSign className="mr-2 h-5 w-5 text-blue-600" />
            Rate Negotiation Available
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">
            <p className="mb-2">Current offered rate: <span className="font-semibold">${currentRate}/hr</span></p>
            <p>Think you deserve more? Start a rate negotiation with the gym owner.</p>
          </div>

          {!showNegotiationForm ? (
            <Button
              onClick={() => setShowNegotiationForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
              data-testid="button-start-negotiation"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Request Rate Negotiation
            </Button>
          ) : (
            <div className="space-y-3">
              <Separator />
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    placeholder="Your requested rate"
                    value={proposedRate}
                    onChange={(e) => setProposedRate(e.target.value)}
                    className="flex-1"
                    min="0"
                    step="0.50"
                    data-testid="input-proposed-rate"
                  />
                  <span className="flex items-center text-sm text-gray-500">/hr</span>
                </div>
                <Textarea
                  placeholder="Explain why you deserve this rate (experience, certifications, etc.)..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="textarea-negotiation-message"
                />
                <div className="flex space-x-2">
                  <Button
                    onClick={handleStartNegotiation}
                    disabled={createNegotiationMutation.isPending}
                    size="sm"
                    data-testid="button-submit-negotiation"
                  >
                    {createNegotiationMutation.isPending ? "Submitting..." : "Start Negotiation"}
                  </Button>
                  <Button
                    onClick={() => setShowNegotiationForm(false)}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Owner view when no negotiation exists
  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <DollarSign className="mr-2 h-5 w-5 text-purple-600" />
          Rate Discussion Available
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p className="mb-2">
            Coach requested: <span className="font-semibold">${coachRequestedRate || 'Not specified'}/hr</span>
            {ownerOfferedRate && <span> • Your offer: <span className="font-semibold">${ownerOfferedRate}/hr</span></span>}
          </p>
          <p>You can negotiate the rate with this coach if there's a difference in expectations.</p>
        </div>

        {!showNegotiationForm ? (
          <Button
            onClick={() => setShowNegotiationForm(true)}
            className="bg-purple-600 hover:bg-purple-700"
            size="sm"
            data-testid="button-start-owner-negotiation"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Start Rate Discussion
          </Button>
        ) : (
          <div className="space-y-3">
            <Separator />
            <div className="space-y-3">
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="Your counter-offer rate"
                  value={proposedRate}
                  onChange={(e) => setProposedRate(e.target.value)}
                  className="flex-1"
                  min="0"
                  step="0.50"
                  data-testid="input-owner-proposed-rate"
                />
                <span className="flex items-center text-sm text-gray-500">/hr</span>
              </div>
              <Textarea
                placeholder="Explain your rate offer (budget constraints, market rates, etc.)..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[80px]"
                data-testid="textarea-owner-negotiation-message"
              />
              <div className="flex space-x-2">
                <Button
                  onClick={handleStartNegotiation}
                  disabled={createNegotiationMutation.isPending}
                  size="sm"
                  data-testid="button-submit-owner-negotiation"
                >
                  {createNegotiationMutation.isPending ? "Starting..." : "Start Discussion"}
                </Button>
                <Button
                  onClick={() => setShowNegotiationForm(false)}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}