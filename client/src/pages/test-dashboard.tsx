import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, TestTube2, RotateCcw, Eye } from "lucide-react";
import CoachDashboard from "./coach-dashboard";
import OwnerDashboard from "./owner-dashboard";
import { RoleSwitcher } from "@/components/role-switcher";

export default function TestDashboard() {
  const [currentRole, setCurrentRole] = useState<"coach" | "owner">("owner");
  const [viewMode, setViewMode] = useState<"dashboard" | "overview">("dashboard");

  const handleRoleChange = (role: "coach" | "owner") => {
    setCurrentRole(role);
    // Auto switch to dashboard view when switching roles
    setViewMode("dashboard");
  };

  const OverviewPanel = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube2 className="h-5 w-5" />
            Test Mode Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Building2 className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-blue-900">Gym Owner Mode</h3>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>• Create substitute requests with rate offers</li>
                      <li>• Filter and manage active requests</li>
                      <li>• Review coach applications</li>
                      <li>• Edit gym profile and settings</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Users className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-900">Coach Mode</h3>
                    <ul className="text-sm text-green-700 mt-1 space-y-1">
                      <li>• Browse substitute opportunities</li>
                      <li>• Apply for positions with custom rates</li>
                      <li>• Manage profile and certifications</li>
                      <li>• Track application status</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-purple-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <RotateCcw className="h-6 w-6 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-purple-900">How to Test</h3>
                  <ol className="text-sm text-purple-700 mt-1 space-y-1">
                    <li>1. Use the role switcher to change between Coach and Gym Owner</li>
                    <li>2. As Owner: Create substitute requests and see them in Active Requests</li>
                    <li>3. As Coach: Browse opportunities and apply for positions</li>
                    <li>4. Switch roles to see both sides of the application process</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button
              onClick={() => setViewMode("dashboard")}
              size="lg"
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View {currentRole === "coach" ? "Coach" : "Gym Owner"} Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        <div className="mb-6">
          <RoleSwitcher
            currentRole={currentRole}
            onRoleChange={handleRoleChange}
          />
        </div>

        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "dashboard" | "overview")}>
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4" />
              Test Overview
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Live Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewPanel />
          </TabsContent>

          <TabsContent value="dashboard">
            {currentRole === "coach" ? <CoachDashboard /> : <OwnerDashboard />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}