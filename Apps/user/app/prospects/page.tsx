/** @format */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  UserCheck,
  Sparkles,
  Search,
  Users,
  Building2,
  CheckCircle2,
  RefreshCw,
  Plus,
  Compass,
  UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Prospect, ProspectStatus } from '@/lib/types';
import { ProspectCard } from './_components/prospect-card';
import { DiscoveryAgentModal } from './_components/discovery-agent-modal';
import { ProspectDetailDrawer } from './_components/prospect-detail-drawer';
import { AddProspectModal } from './_components/add-prospect-modal';
import { Button, WaterfallLayout } from '@jobby/ui';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { useLayoutStore } from '@/lib/store/layout-store';

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<
    | 'all'
    | 'hiring_manager'
    | 'recruiter'
    | 'engineering_manager'
    | 'high_priority'
    | 'contacted'
  >('all');

  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const data = await api.prospects();
      setProspects(data || []);
    } catch (err) {
      console.error('Failed to fetch prospects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const handleStatusChange = async (id: string, newStatus: ProspectStatus) => {
    try {
      const updated = await api.updateProspect(id, {
        status: newStatus,
        last_interacted_at:
          newStatus !== 'recommended' ? new Date().toISOString() : null,
      });
      setProspects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleUpdateProspect = (updated: Prospect) => {
    setProspects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
  };

  const handleDeleteProspect = async (id: string) => {
    try {
      await api.deleteProspect(id);
      setProspects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete prospect:', err);
    }
  };

  const handleAddProspectSuccess = (newProspect: Prospect) => {
    setProspects((prev) => [newProspect, ...prev]);
  };

  // Global Drawer Trigger for Prospect Details
  const handleOpenDetail = (prospect: Prospect) => {
    openDrawer({
      width: 520,
      id: `prospect-detail-${prospect.id}`,
      content: (
        <ProspectDetailDrawer
          prospect={prospect}
          onClose={closeDrawer}
          onUpdate={(updated) => {
            handleUpdateProspect(updated);
          }}
          onDelete={(id) => {
            handleDeleteProspect(id);
            closeDrawer();
          }}
        />
      ),
    });
  };

  // Global Modal Trigger for Discover Agent
  const handleOpenDiscoverAgent = () => {
    openModal({
      layoutId: 'Discover Contacts',
      className:
        'w-[92vw] max-w-3xl flex flex-col max-h-[92vh] overflow-hidden p-0! border-none bg-transparent',
      content: (
        <DiscoveryAgentModal
          isOpen={true}
          onClose={closeModal}
          onSuccess={() => {
            fetchProspects();
            closeModal();
          }}
        />
      ),
    });
  };

  // Global Modal Trigger for Add Prospect
  const handleOpenAddProspect = () => {
    openModal({
      className: 'max-w-2xl p-0 overflow-hidden border-none bg-transparent',
      content: (
        <AddProspectModal
          isOpen={true}
          onClose={closeModal}
          onSuccess={(newP) => {
            handleAddProspectSuccess(newP);
            closeModal();
          }}
        />
      ),
    });
  };

  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === 'all') return true;
      if (activeTab === 'high_priority') return p.priority_score >= 90;
      if (activeTab === 'contacted')
        return (
          p.status === 'contacted' ||
          p.status === 'replied' ||
          p.status === 'interviewing'
        );
      return p.role_type === activeTab;
    });
  }, [prospects, searchQuery, activeTab]);

  const stats = useMemo(() => {
    const total = prospects.length;
    const hiringManagers = prospects.filter(
      (p) =>
        p.role_type === 'hiring_manager' ||
        p.role_type === 'engineering_manager',
    ).length;
    const highPriority = prospects.filter((p) => p.priority_score >= 90).length;
    const contacted = prospects.filter(
      (p) =>
        p.status === 'contacted' ||
        p.status === 'replied' ||
        p.status === 'interviewing',
    ).length;
    return { total, hiringManagers, highPriority, contacted };
  }, [prospects]);

  return (
    <div className='flex-1 p-6 md:p-8 overflow-y-auto no-scrollbar space-y-6'>
      {/* Page Title & Main Header */}
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6'>
        <div>
          <div className='flex items-center gap-3'>
            <div className='flex size-11 items-center justify-center rounded-2xl bg-primary-gradient text-white shadow-md'>
              <UserCheck className='size-6' />
            </div>
            <div>
              <h1 className='text-2xl font-bold text-ink-primary tracking-tight'>
                AI Networking Assistant
              </h1>
              <p className='text-xs text-ink-secondary mt-0.5'>
                Discover high-value recruiters, Hiring Managers, & Engineering
                Managers for strategic outreach.
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className='flex items-center gap-3'>
          <Button variant='ghost' onClick={handleOpenAddProspect} Icon={Plus}>
            <span>Add Contact</span>
          </Button>

          <Button
            layoutId='Discover Contacts'
            onClick={handleOpenDiscoverAgent}
            Icon={Sparkles}
          >
            <span>Discover Contacts</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards Dashboard */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='rounded-2xl border border-border/60 bg-panel/70 p-4 shadow-xs backdrop-blur-md flex flex-col justify-between'>
          <div className='flex items-center justify-between text-ink-secondary text-xs font-medium'>
            <span>Total Prospects</span>
            <Users className='size-4 text-primary' />
          </div>
          <p className='text-2xl font-extrabold text-ink-primary mt-2'>
            {stats.total}
          </p>
        </div>

        <div className='rounded-2xl border border-border/60 bg-panel/70 p-4 shadow-xs backdrop-blur-md flex flex-col justify-between'>
          <div className='flex items-center justify-between text-ink-secondary text-xs font-medium'>
            <span>Hiring Decision Makers</span>
            <Building2 className='size-4 text-emerald-500' />
          </div>
          <p className='text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2'>
            {stats.hiringManagers}
          </p>
        </div>

        <div className='rounded-2xl border border-border/60 bg-panel/70 p-4 shadow-xs backdrop-blur-md flex flex-col justify-between'>
          <div className='flex items-center justify-between text-ink-secondary text-xs font-medium'>
            <span>High Priority Matches</span>
            <Sparkles className='size-4 text-amber-500' />
          </div>
          <p className='text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2'>
            {stats.highPriority}
          </p>
        </div>

        <div className='rounded-2xl border border-border/60 bg-panel/70 p-4 shadow-xs backdrop-blur-md flex flex-col justify-between'>
          <div className='flex items-center justify-between text-ink-secondary text-xs font-medium'>
            <span>Outreach Contacted</span>
            <CheckCircle2 className='size-4 text-blue-500' />
          </div>
          <p className='text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-2'>
            {stats.contacted}
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        {/* Filter Tabs */}
        <div className='flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1'>
          {[
            { id: 'all', label: 'All Prospects' },
            { id: 'hiring_manager', label: 'Hiring Managers' },
            { id: 'engineering_manager', label: 'Engineering Managers' },
            { id: 'recruiter', label: 'Recruiters' },
            { id: 'high_priority', label: 'High Priority (90%+)' },
            { id: 'contacted', label: 'Contacted' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                activeTab === tab.id ?
                  'bg-primary text-white font-semibold shadow-xs'
                : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar & Refresh */}
        <div className='flex items-center gap-2 shrink-0'>
          <div className='relative flex-1 md:w-64'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search by name, company, title...'
              className='w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
            />
          </div>

          <button
            onClick={fetchProspects}
            title='Refresh Prospects'
            className='rounded-xl border border-border bg-background p-2 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition-colors'
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Prospect Cards Grid -> Wrapped with WaterfallLayout */}
      {loading ?
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className='h-64 rounded-2xl border border-border/40 bg-panel/40 animate-pulse'
            />
          ))}
        </div>
      : filteredProspects.length > 0 ?
        <WaterfallLayout minColumnWidth={350} gap={20}>
          {filteredProspects.map((prospect) => (
            <ProspectCard
              key={prospect.id}
              prospect={prospect}
              onStatusChange={handleStatusChange}
              onOpenDetail={handleOpenDetail}
              onDelete={handleDeleteProspect}
            />
          ))}
        </WaterfallLayout>
      : /* Empty State */
        <div className='flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-panel/40 py-16 px-6 text-center space-y-4'>
          <div className='flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
            <Compass className='size-7' />
          </div>
          <div className='max-w-md space-y-1'>
            <h3 className='text-base font-bold text-ink-primary'>
              No prospects found
            </h3>
            <p className='text-xs text-ink-secondary'>
              Click{' '}
              <span className='font-semibold text-primary'>
                "Discover Prospects"
              </span>{' '}
              to launch Codex Agent or click{' '}
              <span className='font-semibold text-primary'>"Add Prospect"</span>{' '}
              to manually create candidate entries in Jobby.
            </p>
          </div>
          <div className='flex items-center gap-3 pt-2'>
            <button
              onClick={handleOpenAddProspect}
              className='flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-ink-primary hover:bg-background-secondary transition-colors cursor-pointer'
            >
              <UserPlus className='size-4' />
              <span>Add Prospect Manually</span>
            </button>
            <button
              onClick={handleOpenDiscoverAgent}
              className='flex items-center gap-2 rounded-xl bg-primary-gradient px-5 py-2.5 text-xs font-bold text-white shadow-md hover:scale-105 transition-all cursor-pointer'
            >
              <Sparkles className='size-4' />
              <span>Discover Prospects Now</span>
            </button>
          </div>
        </div>
      }
    </div>
  );
}
