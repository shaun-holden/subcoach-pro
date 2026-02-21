import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Save, AlertTriangle } from "lucide-react";

interface DraftSavingIndicatorProps {
  isEnabled?: boolean;
  storageKey?: string;
}

export function DraftSavingIndicator({ isEnabled = true, storageKey }: DraftSavingIndicatorProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (!isEnabled || !storageKey) return;

    // Check if there's existing draft data
    try {
      const existingData = localStorage.getItem(storageKey);
      if (existingData) {
        setLastSaved(new Date());
        setSaveStatus('saved');
      }
    } catch (error) {
      console.warn('Cannot access localStorage for draft checking');
      setSaveStatus('error');
    }

    // Listen for storage changes to update indicator
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) {
        if (e.newValue) {
          setLastSaved(new Date());
          setSaveStatus('saved');
          
          // Show "saving" briefly then "saved"
          setSaveStatus('saving');
          setTimeout(() => setSaveStatus('saved'), 300);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isEnabled, storageKey]);

  if (!isEnabled) return null;

  const getStatusDisplay = () => {
    switch (saveStatus) {
      case 'saving':
        return {
          icon: <Save className="h-3 w-3 animate-spin" />,
          text: "Saving...",
          variant: "secondary" as const,
        };
      case 'saved':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          text: lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : "Draft saved",
          variant: "default" as const,
        };
      case 'error':
        return {
          icon: <AlertTriangle className="h-3 w-3" />,
          text: "Save failed",
          variant: "destructive" as const,
        };
      default:
        return null;
    }
  };

  const status = getStatusDisplay();
  
  if (!status) return null;

  return (
    <div className="flex items-center justify-end">
      <Badge variant={status.variant} className="text-xs">
        {status.icon}
        <span className="ml-1">{status.text}</span>
      </Badge>
    </div>
  );
}