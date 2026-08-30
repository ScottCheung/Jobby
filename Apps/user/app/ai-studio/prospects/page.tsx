/** @format */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Users,
  Building2,
  CheckCircle2,
  RefreshCw,
  Compass,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Prospect, ProspectStatus } from '@/lib/types';
import { ProspectCard } from '@/app/prospects/_components/prospect-card';
import { DiscoveryAgentModal } from '@/app/prospects/_components/discovery-agent-modal';
import { ProspectDetailDrawer } from '@/app/prospects/_components/prospect-detail-drawer';
import { ProspectImportModal } from '@/app/prospects/_components/prospect-import-modal';
import { WaterfallLayout, motion } from '@jobby/ui';
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

  const handleOpenDiscoverAgent = () => {
    openModal({
      layoutId: 'prospects-discover-modal',
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

  const handleOpenImportProspects = () => {
    openModal({
      layoutId: 'prospects-import-modal',
      className: 'w-[94vw] max-w-6xl max-h-[88vh] overflow-hidden',
      content: (
        <ProspectImportModal
          onClose={closeModal}
          onImported={fetchProspects}
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
    <div className='w-full space-y-5 pb-12'>
      {/* Header */}
      <div>
        <h2 className='title-page bg-primary-gradient bg-clip-text text-transparent'>
          AI Networking Assistant
        </h2>
        <p className='mt-1 text-xs text-ink-secondary'>
          Discover and manage key contacts to accelerate your job search through strategic networking.
        </p>
      </div>

      {/* Two Large Action Cards */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <motion.div
          layout
          layoutId='prospects-discover-modal'
          transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
          onClick={handleOpenDiscoverAgent}
          role='button'
          tabIndex={0}
          style={{ transition: 'none' }}
          onKeyDown={(e) => e.key === 'Enter' && handleOpenDiscoverAgent()}
          className='group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-primary/20 bg-panel/75 p-5 hover:border-primary/50'
        >
          <div className='flex items-start gap-3.5'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-xs'>
              <Sparkles className='size-5' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-bold text-ink-primary group-hover:text-primary'>
                  Discover Contacts
                </h3>
                <ArrowRight className='size-4 text-ink-secondary group-hover:text-primary' />
              </div>
              <p className='mt-1 text-xs leading-relaxed text-ink-secondary'>
                Launch the AI discovery agent to find hiring managers, recruiters, and decision makers aligned with your target roles.
              </p>
            </div>
          </div>
          <div className='mt-4 flex items-center justify-end border-t border-border/20 pt-3'>
            <span className='inline-flex items-center gap-1 text-xs font-semibold text-primary'>
              <span>Discover Now</span>
              <ArrowRight className='size-3.5' />
            </span>
          </div>
        </motion.div>

        <motion.div
          layout
          layoutId='prospects-import-modal'
          transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
          onClick={handleOpenImportProspects}
          role='button'
          tabIndex={0}
          style={{ transition: 'none' }}
          onKeyDown={(e) => e.key === 'Enter' && handleOpenImportProspects()}
          className='group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-primary/20 bg-panel/75 p-5 hover:border-primary/50'
        >
          <div className='flex items-start gap-3.5'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs'>
              <FileSpreadsheet className='size-5' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-bold text-ink-primary group-hover:text-primary'>
                  Import Contacts
                </h3>
                <ArrowRight className='size-4 text-ink-secondary group-hover:text-primary' />
              </div>
              <p className='mt-1 text-xs leading-relaxed text-ink-secondary'>
                Paste AI-discovered contacts, review the parsed rows, and import them into your outreach pipeline.
              </p>
            </div>
          </div>
          <div className='mt-4 flex items-center justify-end border-t border-border/20 pt-3'>
            <span className='inline-flex items-center gap-1 text-xs font-semibold text-primary'>
              <span>Import Contacts</span>
              <ArrowRight className='size-3.5' />
            </span>
          </div>
        </motion.div>
      </div>

      {/* Metric Cards Dashboard */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='rounded-2xl bg-panel/70 p-4 shadow-xs backdrop-blur-md flex flex-col justify-between'>
          <div className='flex items-center justify-between text-ink-secondary text-xs font-medium'>
            <span>Total Prospects</span>
            <Users className='size-4 text-primary' />
          </div>
          <p className='text-2xl font-extrabold text-ink-primary mt-2'>
            {stats.total}
          </p>
        </div>

        <div className='rounded-2xl bg-panel/70 p-4 shadow-xs backdrop-blur-md flex flex-col justify-between'>
          <div className='flex items-center justify-between text-ink-secondary text-xs font-medium'>
            <span>Hiring Decision Makers</span>
            <Building2 className='size-4 text-emerald-500' />
          </div>
          <p className='text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2'>
            {stats.hiringManagers}
          </p>
        </div>

        <div className='rounded-2xl bg-panel/70 p-4 shadow-xs backdrop-blur-md flex flex-col justify-between'>
          <div className='flex items-center justify-between text-ink-secondary text-xs font-medium'>
            <span>High Priority Matches</span>
            <Sparkles className='size-4 text-amber-500' />
          </div>
          <p className='text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2'>
            {stats.highPriority}
          </p>
        </div>

        <div className='rounded-2xl bg-panel/70 p-4 shadow-xs backdrop-blur-md flex flex-col justify-between'>
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
              className='w-full rounded-xl bg-background pl-9 pr-3 py-2 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
            />
          </div>

          <button
            onClick={fetchProspects}
            title='Refresh Prospects'
            className='rounded-xl bg-background p-2 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition-colors'
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Prospect Cards Grid */}
      {loading ?
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className='h-64 rounded-2xl bg-panel/40 animate-pulse'
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
        <div className='flex flex-col items-center justify-center rounded-3xl bg-panel/40 py-16 px-6 text-center space-y-4'>
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
              <span className='font-semibold text-primary'>"Import Contacts"</span>{' '}
              to paste, review, and import candidate entries in Jobby.
            </p>
          </div>
          <div className='flex items-center gap-3 pt-2'>
            <button
              onClick={handleOpenImportProspects}
              className='flex items-center gap-2 rounded-xl bg-background px-4 py-2.5 text-xs font-bold text-ink-primary hover:bg-background-secondary transition-colors cursor-pointer'
            >
              <FileSpreadsheet className='size-4' />
              <span>Import Contacts</span>
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
