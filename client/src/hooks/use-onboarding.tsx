import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './use-auth';

interface OnboardingData {
  businessName: string;
  businessType: string;
  primaryGoal: string;
  contentSource: 'transcript' | 'website' | '';
  websiteUrl: string;
  hasCompletedOnboarding: boolean;
  currentStep: number;
}

interface OnboardingContextType {
  onboardingData: OnboardingData;
  updateOnboardingData: (updates: Partial<OnboardingData>) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  shouldShowOnboarding: boolean;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const defaultOnboardingData: OnboardingData = {
  businessName: '',
  businessType: '',
  primaryGoal: '',
  contentSource: '',
  websiteUrl: '',
  hasCompletedOnboarding: false,
  currentStep: 0,
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [onboardingData, setOnboardingData] = useState<OnboardingData>(defaultOnboardingData);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  // Load onboarding state from localStorage on mount
  useEffect(() => {
    if (user) {
      const savedData = localStorage.getItem(`onboarding_${user.id}`);
      const globalCompleted = localStorage.getItem('onboarding_completed');
      
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setOnboardingData(prev => ({ ...prev, ...parsed }));
        } catch (error) {
          console.warn('Failed to parse saved onboarding data');
        }
      }

      // Show onboarding if user hasn't completed it and hasn't explicitly skipped
      const hasCompleted = globalCompleted === 'true' || onboardingData.hasCompletedOnboarding;
      setShouldShowOnboarding(!hasCompleted && user.id !== undefined);
    }
  }, [user, onboardingData.hasCompletedOnboarding]);

  const updateOnboardingData = (updates: Partial<OnboardingData>) => {
    setOnboardingData(prev => {
      const newData = { ...prev, ...updates };
      if (user?.id) {
        localStorage.setItem(`onboarding_${user.id}`, JSON.stringify(newData));
      }
      return newData;
    });
  };

  const completeOnboarding = () => {
    updateOnboardingData({ hasCompletedOnboarding: true });
    localStorage.setItem('onboarding_completed', 'true');
    setShouldShowOnboarding(false);
  };

  const resetOnboarding = () => {
    setOnboardingData(defaultOnboardingData);
    localStorage.removeItem('onboarding_completed');
    if (user?.id) {
      localStorage.removeItem(`onboarding_${user.id}`);
    }
    setShouldShowOnboarding(true);
  };

  const nextStep = () => {
    updateOnboardingData({ currentStep: onboardingData.currentStep + 1 });
  };

  const prevStep = () => {
    if (onboardingData.currentStep > 0) {
      updateOnboardingData({ currentStep: onboardingData.currentStep - 1 });
    }
  };

  const skipOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setShouldShowOnboarding(false);
  };

  const value: OnboardingContextType = {
    onboardingData,
    updateOnboardingData,
    completeOnboarding,
    resetOnboarding,
    shouldShowOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

// Helper function to check if user should see specific onboarding elements
export function useOnboardingStep(stepName: string) {
  const { onboardingData, shouldShowOnboarding } = useOnboarding();
  const stepMap: Record<string, number> = {
    welcome: 0,
    'business-setup': 1,
    'content-source': 2,
    'feature-tour': 3,
    'first-document': 4,
  };

  const currentStepNumber = stepMap[stepName] ?? -1;
  const shouldShow = shouldShowOnboarding && onboardingData.currentStep === currentStepNumber;

  return { shouldShow, isActive: shouldShow };
}