import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, RotateCcw } from "lucide-react";

interface RoleSwitcherProps {
  currentRole: "coach" | "owner";
  onRoleChange: (role: "coach" | "owner") => void;
}

export function RoleSwitcher({ currentRole, onRoleChange }: RoleSwitcherProps) {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <RotateCcw className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-medium text-blue-900">Test Mode</h3>
              <p className="text-sm text-blue-700">
                Switch roles to test both sides of the platform
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant={currentRole === "coach" ? "default" : "outline"}>
              Current: {currentRole === "coach" ? "Coach" : "Gym Owner"}
            </Badge>
            
            <div className="flex space-x-1">
              <Button
                data-testid="button-switch-to-coach"
                variant={currentRole === "coach" ? "default" : "outline"}
                size="sm"
                onClick={() => onRoleChange("coach")}
                className="flex items-center gap-1"
              >
                <Users className="h-4 w-4" />
                Coach
              </Button>
              
              <Button
                data-testid="button-switch-to-owner"
                variant={currentRole === "owner" ? "default" : "outline"}
                size="sm"
                onClick={() => onRoleChange("owner")}
                className="flex items-center gap-1"
              >
                <Building2 className="h-4 w-4" />
                Owner
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}