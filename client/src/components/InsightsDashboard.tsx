import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Award, Target, AlertCircle, BarChart3, Users, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface CoachingInsight {
  id: string;
  type: 'performance' | 'opportunity' | 'improvement' | 'achievement';
  title: string;
  message: string;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  data?: any;
}

interface AnalyticsData {
  totalApplications: number;
  acceptanceRate: number;
  averageRate: number;
  weeklyActivity: number;
  monthlyEarnings: number;
  upcomingJobs: number;
  performanceScore: number;
  improvementAreas: string[];
}

const getInsightIcon = (type: string) => {
  switch (type) {
    case 'achievement':
      return <Award className="h-5 w-5 text-yellow-600" />;
    case 'performance':
      return <TrendingUp className="h-5 w-5 text-blue-600" />;
    case 'improvement':
      return <AlertCircle className="h-5 w-5 text-orange-600" />;
    case 'opportunity':
      return <Target className="h-5 w-5 text-green-600" />;
    default:
      return <BarChart3 className="h-5 w-5 text-gray-600" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'border-l-red-500 bg-red-50';
    case 'medium':
      return 'border-l-yellow-500 bg-yellow-50';
    case 'low':
      return 'border-l-green-500 bg-green-50';
    default:
      return 'border-l-gray-500 bg-gray-50';
  }
};

interface InsightsDashboardProps {
  userType: 'coach' | 'owner';
  userId: string;
}

export function InsightsDashboard({ userType, userId }: InsightsDashboardProps) {
  // Fetch personalized insights
  const { data: insights = [], isLoading: insightsLoading } = useQuery<CoachingInsight[]>({
    queryKey: ["/api/insights", userId, userType],
    retry: false,
  });

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", userId, userType],
    retry: false,
  });

  if (insightsLoading || analyticsLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const defaultAnalytics: AnalyticsData = {
    totalApplications: analytics?.totalApplications || 0,
    acceptanceRate: analytics?.acceptanceRate || 0,
    averageRate: analytics?.averageRate || 0,
    weeklyActivity: analytics?.weeklyActivity || 0,
    monthlyEarnings: analytics?.monthlyEarnings || 0,
    upcomingJobs: analytics?.upcomingJobs || 0,
    performanceScore: analytics?.performanceScore || 0,
    improvementAreas: analytics?.improvementAreas || []
  };

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{defaultAnalytics.performanceScore}/100</div>
            <Progress value={defaultAnalytics.performanceScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {defaultAnalytics.performanceScore >= 80 ? 'Excellent' : 
               defaultAnalytics.performanceScore >= 60 ? 'Good' : 'Needs Improvement'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{defaultAnalytics.acceptanceRate}%</div>
            <p className="text-xs text-muted-foreground">
              {defaultAnalytics.totalApplications} total applications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${defaultAnalytics.averageRate}/hr</div>
            <p className="text-xs text-muted-foreground">
              Competitive with market
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userType === 'coach' ? 'Monthly Earnings' : 'Active Requests'}
            </CardTitle>
            {userType === 'coach' ? 
              <Clock className="h-4 w-4 text-purple-600" /> :
              <Users className="h-4 w-4 text-purple-600" />
            }
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {userType === 'coach' ? `$${defaultAnalytics.monthlyEarnings}` : defaultAnalytics.upcomingJobs}
            </div>
            <p className="text-xs text-muted-foreground">
              {userType === 'coach' ? 'This month' : 'Pending applications'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Personalized Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Personalized Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insights.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keep using the platform to unlock personalized insights!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {insights.map((insight: CoachingInsight) => (
                <Card 
                  key={insight.id}
                  className={`border-l-4 ${getPriorityColor(insight.priority)}`}
                  data-testid={`insight-card-${insight.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900">{insight.title}</h4>
                          <Badge 
                            variant={insight.priority === 'high' ? 'destructive' : 
                                   insight.priority === 'medium' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {insight.priority} priority
                          </Badge>
                          {insight.actionable && (
                            <Badge variant="outline" className="text-xs">
                              Actionable
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          {insight.message}
                        </p>

                        {insight.actionable && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              Learn More
                            </Button>
                            <Button size="sm">
                              Take Action
                            </Button>
                          </div>
                        )}

                        {insight.data && (
                          <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(insight.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Improvement Areas */}
      {defaultAnalytics.improvementAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Areas for Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {defaultAnalytics.improvementAreas.map((area, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                  <span className="text-sm font-medium">{area}</span>
                  <Button size="sm" variant="outline">
                    Improve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}