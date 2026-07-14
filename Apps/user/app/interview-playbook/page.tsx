'use client';
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { InterviewQuestion, PracticeRecord } from '@/lib/types';
import { CheckCircle2, TrendingUp, Target } from 'lucide-react';

export default function InterviewPlaybookPage() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  
  useEffect(() => {
    void api.interviewQuestions().then(setQuestions);
    void api.practiceRecords().then(setPracticeRecords);
  }, []);

  const masteredCount = practiceRecords.filter(r => (r.confidence_score ?? 0) >= 4).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-2 text-ink-secondary mb-2">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-ink-primary">Total Questions</h3>
          </div>
          <p className="text-3xl font-bold text-ink-primary">{questions.length}</p>
        </div>
        
        <div className="p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-2 text-ink-secondary mb-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-ink-primary">Practiced</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{practiceRecords.length}</p>
        </div>

        <div className="p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-2 shadow-sm">
          <div className="flex items-center gap-2 text-ink-secondary mb-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-ink-primary">Mastered</h3>
          </div>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{masteredCount}</p>
        </div>
      </div>
      
      <div className="p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 shadow-sm flex flex-col gap-4">
        <h2 className="text-lg font-bold">Today's Tasks</h2>
        <p className="text-sm text-zinc-500">You don't have any tasks scheduled for today. Go to the Practice Plans tab to create one.</p>
      </div>
    </div>
  );
}
