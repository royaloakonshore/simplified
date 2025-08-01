'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';
import { api } from '@/lib/trpc/react';

interface WelcomeModalProps {
  isVisible: boolean;
  userName?: string;
  companyName?: string;
  onPreloadComplete?: () => void;
}

interface PreloadStep {
  id: string;
  label: string;
  completed: boolean;
}

export function WelcomeModal({ isVisible, userName, companyName, onPreloadComplete }: WelcomeModalProps) {
  const [preloadSteps, setPreloadSteps] = useState<PreloadStep[]>([
    { id: 'dashboard', label: 'Loading dashboard metrics...', completed: false },
    { id: 'customers', label: 'Preparing customer data...', completed: false },
    { id: 'orders', label: 'Syncing recent orders...', completed: false },
    { id: 'inventory', label: 'Checking inventory levels...', completed: false },
  ]);
  
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = preloadSteps.length;

  // Auto-progress through steps with timing
  useEffect(() => {
    if (!isVisible) return;

    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= totalSteps) {
          setTimeout(() => {
            onPreloadComplete?.();
          }, 500);
          clearInterval(stepTimer);
          return prev;
        }
        return next;
      });
    }, 800); // Each step takes 800ms

    return () => clearInterval(stepTimer);
  }, [isVisible, totalSteps, onPreloadComplete]);

  // Update completion status based on current step
  useEffect(() => {
    setPreloadSteps(prev => prev.map((step, index) => ({
      ...step,
      completed: index < currentStep
    })));
  }, [currentStep]);

  const completedCount = currentStep;
  const progressPercentage = (completedCount / preloadSteps.length) * 100;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <Card className="w-[420px] shadow-2xl border-0 bg-gradient-to-br from-background to-muted/20">
              <CardHeader className="pb-6">
                <div className="flex flex-col items-center space-y-4">
                  <motion.div
                    animate={{ 
                      scale: currentStep === totalSteps ? [1, 1.1, 1] : [1, 1.05, 1],
                      rotate: currentStep === totalSteps ? [0, 5, -5, 0] : [0, 2, -2, 0]
                    }}
                    transition={{ 
                      duration: currentStep === totalSteps ? 1 : 2,
                      repeat: currentStep === totalSteps ? 1 : Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    <Avatar className="h-16 w-16 rounded-xl ring-4 ring-primary/20">
                      <AvatarImage src="/logo.png" alt="Gerby Logo" className="object-contain" />
                      <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-lg">
                        ERP
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  
                  <div className="text-center space-y-2">
                    <motion.h2 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent"
                    >
                      Welcome{userName ? `, ${userName}` : ''}!
                    </motion.h2>
                    
                    {companyName && (
                      <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-muted-foreground font-medium"
                      >
                        {companyName}
                      </motion.p>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pb-8">
                <div className="flex flex-col items-center space-y-6">
                  {currentStep === totalSteps ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 15, stiffness: 300 }}
                      className="flex items-center gap-2 text-green-600"
                    >
                      <CheckCircle className="h-8 w-8" />
                      <span className="font-medium">Ready!</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="h-8 w-8 text-primary" />
                    </motion.div>
                  )}
                  
                  <div className="w-full space-y-3">
                    <motion.div 
                      initial={{ width: "0%" }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="h-2 bg-gradient-to-r from-primary/40 via-primary to-primary/60 rounded-full"
                      style={{ width: `${progressPercentage}%` }}
                    />
                    
                    <div className="space-y-2">
                      {preloadSteps.map((step, index) => (
                        <motion.div
                          key={step.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ 
                            opacity: index <= currentStep ? 1 : 0.4,
                            x: 0 
                          }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-3 text-sm"
                        >
                          {step.completed ? (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : index === currentStep ? (
                            <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted flex-shrink-0" />
                          )}
                          <span className={step.completed ? "text-green-600 font-medium" : "text-muted-foreground"}>
                            {step.label}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 