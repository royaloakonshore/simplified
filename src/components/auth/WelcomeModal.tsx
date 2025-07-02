'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface WelcomeModalProps {
  isVisible: boolean;
  userName?: string;
  companyName?: string;
}

export function WelcomeModal({ isVisible, userName, companyName }: WelcomeModalProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <Card className="w-96 shadow-2xl border-0 bg-gradient-to-br from-background to-muted/20">
              <CardHeader className="pb-6">
                <div className="flex flex-col items-center space-y-4">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    <Avatar className="h-16 w-16 rounded-xl ring-4 ring-primary/20">
                      <AvatarImage src="/logo.png" alt="Simplified ERP Logo" className="object-contain" />
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
                <div className="flex flex-col items-center space-y-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-8 w-8 text-primary" />
                  </motion.div>
                  
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-sm text-muted-foreground text-center"
                  >
                    Loading your workspace...
                  </motion.p>
                  
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3, ease: "easeInOut" }}
                    className="h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 rounded-full w-full"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 