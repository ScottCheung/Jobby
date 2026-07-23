'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  GamificationTransaction,
  PracticeRecord,
  InterviewQuestion,
} from '@/lib/types';
import { Loader2, Coins, Trophy, Clock, PlayCircle, History, Gem, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'practice' | 'rewards';

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateStr));
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('practice');
  const [transactions, setTransactions] = useState<GamificationTransaction[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [questions, setQuestions] = useState<Record<string, InterviewQuestion>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [txData, prData, qData] = await Promise.all([
          api.gamificationTransactions(),
          api.practiceRecords(),
          api.interviewQuestions(),
        ]);
        setTransactions(txData);
        setPracticeRecords(prData);
        
        const qMap: Record<string, InterviewQuestion> = {};
        qData.forEach(q => {
          qMap[q.id] = q;
        });
        setQuestions(qMap);
      } catch (err) {
        console.error('Failed to fetch history data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="title-page text-ink-primary mb-2">History & Rewards</h1>
          <p className="text-ink-secondary">View your past practice sessions and track your XP earnings.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('practice')}
          className={cn(
            'pb-3 px-1 font-medium transition-colors border-b-2',
            activeTab === 'practice'
              ? 'border-primary text-primary'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          )}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            <span>Practice History</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={cn(
            'pb-3 px-1 font-medium transition-colors border-b-2',
            activeTab === 'rewards'
              ? 'border-primary text-primary'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          )}
        >
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4" />
            <span>Reward Ledger</span>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-ink-secondary" />
        </div>
      ) : activeTab === 'practice' ? (
        <div className="space-y-4">
          {practiceRecords.length === 0 ? (
            <div className="text-center py-12 text-ink-secondary border border-dashed rounded-xl border-border">
              No practice records found. Start practicing to see your history!
            </div>
          ) : (
            practiceRecords.map((record) => (
              <div key={record.id} className="bg-panel border border-border rounded-xl p-5 hover:border-primary/20 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="label-sm flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5" />
                      {record.created_at ? formatDate(record.created_at) : 'Unknown Date'}
                    </div>
                    <h3 className="title-card mb-1">
                      {questions[record.question_id]?.title || 'Unknown Question'}
                    </h3>
                    {record.confidence_score !== null && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="label-overline">Confidence Score:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <div
                              key={s}
                              className={cn(
                                'w-6 h-1.5 rounded-full',
                                s <= (record.confidence_score || 0)
                                  ? 'bg-primary'
                                  : 'bg-zinc-200 dark:bg-zinc-800'
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {record.audio_records && record.audio_records.length > 0 && (
                    <div className="shrink-0 flex items-center">
                      <audio controls className="h-10 max-w-[200px] md:max-w-[250px]">
                        <source src={record.audio_records[0].url_path} type="audio/webm" />
                      </audio>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="flex-1 w-full space-y-4">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-ink-secondary border border-dashed rounded-xl border-border">
                No transactions yet. Complete tasks to earn XP and Coins!
              </div>
            ) : (
              <div className="bg-panel border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="label-overline bg-background-secondary/50 border-b border-border text-ink-secondary">
                      <th className="px-5 py-3 font-semibold">Date & Time</th>
                      <th className="px-5 py-3 font-semibold">Event</th>
                      <th className="px-5 py-3 font-semibold text-right">Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-background-secondary/20 transition-colors">
                        <td className="body-md px-5 py-4 text-ink-secondary">
                          {tx.created_at ? formatDate(tx.created_at) : 'Unknown Date'}
                        </td>
                        <td className="label px-5 py-4">
                          {tx.reason}
                        </td>
                        <td className="label px-5 py-4 text-right">
                          {tx.currency === 'xp' ? (
                            <span className="text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                              <Trophy className="w-3.5 h-3.5" />
                              +{tx.amount} XP
                            </span>
                          ) : (
                            <span className="text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                              <Coins className="w-3.5 h-3.5" />
                              +{tx.amount} Coins
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            <div className="bg-panel border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-ink-primary">Earning Rules</h3>
              </div>
              <ul className="body-md space-y-4 text-ink-secondary">
                <li className="flex items-start gap-2">
                  <Trophy className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <span><strong className="text-ink-primary">+10 XP & +2 Coins</strong> when you practice a question for the first time each day.</span>
                </li>
                <li className="flex items-start gap-2">
                  <PlayCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>Practicing the same question multiple times in one day will <strong className="text-ink-primary">not</strong> yield duplicate rewards.</span>
                </li>
                <li className="flex items-start gap-2">
                  <History className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <span><strong className="text-ink-primary">+500 XP Bonus</strong> for every 7 consecutive days you practice (7-Day Streak).</span>
                </li>
                <li className="flex items-start gap-2">
                  <Gem className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <span><strong className="text-ink-primary">Leveling Up:</strong> Higher levels require progressively more XP. Keep practicing to reach the next rank!</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
