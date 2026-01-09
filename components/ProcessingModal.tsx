"use client"

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileUp, FileSearch, FileSpreadsheet } from 'lucide-react';

interface ProcessingModalProps {
  stage: 'uploading' | 'analyzing' | 'parsing';
  progress: number;
}

export function ProcessingModal({ stage, progress }: ProcessingModalProps) {
  const [progressValue, setProgressValue] = useState(progress);

  useEffect(() => {
    // Smooth progress animation
    const interval = setInterval(() => {
      if (progressValue < progress) {
        setProgressValue(prev => Math.min(prev + 1, progress));
      }
    }, 20);

    return () => clearInterval(interval);
  }, [progress, progressValue]);

  const stageInfo = {
    uploading: {
      title: 'Uploading Document',
      description: 'Please wait while we upload your document...',
      icon: FileUp,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100'
    },
    analyzing: {
      title: 'Analyzing Document',
      description: 'Using AI to analyze the content...',
      icon: FileSearch,
      color: 'text-purple-500',
      bgColor: 'bg-purple-100'
    },
    parsing: {
      title: 'Extracting Events',
      description: 'Creating calendar events from your document...',
      icon: FileSpreadsheet,
      color: 'text-green-500',
      bgColor: 'bg-green-100'
    }
  };

  const currentStage = stageInfo[stage];
  const Icon = currentStage.icon;

  // Calculate which stages are complete
  const isAnalyzingComplete = stage === 'parsing' || (stage === 'analyzing' && progress >= 66);
  const isUploadingComplete = stage !== 'uploading' || progress >= 33;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
      >
        <div className="flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`p-4 rounded-full ${currentStage.bgColor} mb-4`}
          >
            <Icon className={`h-8 w-8 ${currentStage.color}`} />
          </motion.div>

          <h2 className="text-xl font-semibold text-gray-800 mb-1">{currentStage.title}</h2>
          <p className="text-gray-600 mb-6 text-center">{currentStage.description}</p>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-4 mb-6 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressValue}%` }}
              transition={{ type: 'spring', stiffness: 60 }}
              className="h-full bg-gradient-to-r from-blue-400 via-purple-400 to-green-400"
            />
          </div>

          {/* Stage indicators */}
          <div className="w-full flex justify-between mb-2 relative">
            {/* Progress line */}
            <div className="absolute top-3 left-0 w-full h-1 bg-gray-200 -z-10">
              <div className="h-full bg-gray-400" style={{ width: `${progressValue}%` }} />
            </div>
            
            {/* Stages */}
            <StageIndicator 
              title="Uploading"
              isComplete={isUploadingComplete}
              isActive={stage === 'uploading'}
            />
            <StageIndicator 
              title="Analyzing"
              isComplete={isAnalyzingComplete}
              isActive={stage === 'analyzing'}
            />
            <StageIndicator 
              title="Extracting Events"
              isComplete={false}
              isActive={stage === 'parsing'}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface StageIndicatorProps {
  title: string;
  isComplete: boolean;
  isActive: boolean;
}

function StageIndicator({ title, isComplete, isActive }: StageIndicatorProps) {
  return (
    <div className="flex flex-col items-center">
      <motion.div 
        className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
          isComplete 
            ? 'bg-green-500' 
            : isActive 
              ? 'bg-blue-500'
              : 'bg-gray-300'
        }`}
        animate={isActive ? { scale: [1, 1.2, 1], transition: { repeat: Infinity, duration: 2 } } : {}}
      >
        {isComplete && (
          <motion.svg 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-3 h-3 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </motion.svg>
        )}
      </motion.div>
      <p className={`text-xs mt-1 ${isActive ? 'font-medium' : 'text-gray-500'}`}>{title}</p>
    </div>
  );
}