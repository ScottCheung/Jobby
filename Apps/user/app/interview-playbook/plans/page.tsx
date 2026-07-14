'use client';
import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import type { PracticePlan } from '@/lib/types';
import { EmptyState } from './_components/EmptyState';
import { PlanCard } from './_components/PlanCard';

export default function PracticePlansPage() {
  const [plans, setPlans] = useState<PracticePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const data = await api.practicePlans();
      setPlans(data);
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchPlans();
  }, []);

  const handleCreatePlan = async () => {
    setIsCreating(true);
    try {
      const plan = await api.createPracticePlan({
        name: `30-Day Interview Prep (${new Date().toLocaleDateString()})`,
        target_days: 30,
        daily_questions_count: 5,
      });

      // Try to fetch questions and create a few mock tasks
      const questions = await api.interviewQuestions();
      if (questions.length > 0) {
        // Pick a few questions to schedule
        for (let i = 0; i < Math.min(3, questions.length); i++) {
          const q = questions[i];
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + i); // schedule over next few days
          await api.createPlanTask(plan.id, {
            plan_id: plan.id,
            question_id: q.id,
            scheduled_date: scheduledDate.toISOString(),
            status: "pending"
          });
        }
      }

      await fetchPlans();
    } catch (err) {
      console.error('Failed to create plan:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink-primary">Your Practice Plans</h2>
        <button 
          onClick={handleCreatePlan}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {isCreating ? 'Creating...' : 'New Plan'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-ink-secondary">Loading plans...</div>
        ) : plans.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
