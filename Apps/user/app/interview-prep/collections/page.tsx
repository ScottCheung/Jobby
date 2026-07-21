/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Loader2,
  ShoppingBag,
  Sparkles,
  BadgeCheck,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { InterviewCollection, User } from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { CollectionCard } from './_components/CollectionCard';
import { CollectionFormModal } from './_components/CollectionFormModal';
import { ScrollableContainer } from '@/components/layout/ScrollableContainer';
import { Button } from '@/components/UI/Button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function DiscoverPage() {
  const [collections, setCollections] = useState<InterviewCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'all' | 'purchased' | 'published' | 'private' | 'archive'
  >('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [createdCollections, setCreatedCollections] = useState<
    InterviewCollection[]
  >([]);

  // Form Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedCollectionToEdit, setSelectedCollectionToEdit] =
    useState<InterviewCollection | null>(null);

  const confirm = useConfirmStore((state) => state.confirm);
  const pathname = usePathname();

  const load = async (showInitialLoader = false) => {
    if (showInitialLoader) setIsLoading(true);
    try {
      const [data, user, createdData] = await Promise.all([
        api.interviewCollections(),
        api.me().catch(() => null),
        api.myCreatedCollections().catch(() => []),
      ]);
      setCollections(data);
      setCreatedCollections(createdData);
      if (user) {
        setCurrentUser(user);
      }
    } catch (loadError) {
      showGlobalToast(
        loadError instanceof Error ?
          loadError.message
        : 'Could not load collections.',
      );
    } finally {
      if (showInitialLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, [pathname]);

  useEffect(() => {
    const syncCollections = () => void load(false);
    window.addEventListener('playbookLibraryUpdated', syncCollections);
    return () =>
      window.removeEventListener('playbookLibraryUpdated', syncCollections);
  }, []);

  const handleAdd = async (collection: InterviewCollection) => {
    const isLocked = !collection.is_purchased && collection.price_coins > 0;
    const isRestoring =
      collection.library_status === 'partial' ||
      (collection.library_status === 'not_added' && collection.is_in_library);

    if (isRestoring) {
      const ok = await confirm({
        title: 'Restore missing questions?',
        message: `Restore ${collection.missing_question_count} missing question${collection.missing_question_count === 1 ? '' : 's'} from "${collection.title}"? Your answers and practice history will remain unchanged.`,
        confirmLabel: 'Restore Questions',
        cancelLabel: 'Cancel',
      });
      if (!ok) return;
    } else if (isLocked) {
      const ok = await confirm({
        title: 'Unlock Collection?',
        message: `Unlock "${collection.title}" for ${collection.price_coins} coins? This will add all its questions to your library.`,
        confirmLabel: 'Unlock & Add',
        cancelLabel: 'Cancel',
      });
      if (!ok) return;
    } else {
      const ok = await confirm({
        title: 'Add to Library?',
        message: `Add "${collection.title}" to your library? This will import all its questions so you can start practicing them.`,
        confirmLabel: 'Add to Library',
        cancelLabel: 'Cancel',
      });
      if (!ok) return;
    }

    setActiveId(collection.id);
    try {
      const result = await api.addCollectionToLibrary(collection.id);
      await load(false);
      showGlobalToast(
        result.questions_added > 0 ?
          `${result.questions_added} question${result.questions_added === 1 ? '' : 's'} ${isRestoring ? 'restored to' : 'added to'} your library`
        : 'This collection is already in your library',
      );
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (actionError) {
      showGlobalToast(
        actionError instanceof Error ?
          actionError.message
        : 'Could not add collection.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleRemove = async (collection: InterviewCollection) => {
    const ok = await confirm({
      title: 'Remove Collection from Library?',
      message: `Are you sure you want to remove "${collection.title}" from your library? The questions will be removed from your active practice library, but your custom answers, practice history, and records are preserved in the system and will be restored if you add this collection back later.`,
      confirmLabel: 'Remove from Library',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setActiveId(collection.id);
    try {
      await api.removeCollectionFromLibrary(collection.id);
      await load(false);
      showGlobalToast('Collection removed from your library');
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (actionError) {
      showGlobalToast(
        actionError instanceof Error ?
          actionError.message
        : 'Could not remove collection.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleEdit = (collection: InterviewCollection) => {
    setSelectedCollectionToEdit(collection);
    setIsFormModalOpen(true);
  };

  const handleDelete = async (collection: InterviewCollection) => {
    const hasSubscribers = (collection.library_adds || 0) > 0;

    if (!hasSubscribers) {
      const ok = await confirm({
        title: 'Delete Collection?',
        message: `Are you sure you want to delete "${collection.title}" permanently? This action cannot be undone.`,
        confirmLabel: 'Delete Permanently',
        cancelLabel: 'Cancel',
      });
      if (!ok) return;

      setActiveId(collection.id);
      try {
        await api.deleteInterviewCollection(collection.id);
        showGlobalToast('Collection permanently deleted');
        await load(false);
      } catch (err) {
        showGlobalToast(
          err instanceof Error ? err.message : 'Could not delete collection.',
        );
      } finally {
        setActiveId(null);
      }
    } else {
      if (collection.status === 'archived') {
        alert(
          `This collection has ${collection.library_adds} active subscribers and cannot be permanently deleted. It remains archived to support existing users.`,
        );
        return;
      }

      const ok = await confirm({
        title: 'Collection Has Active Subscribers',
        message: `This collection "${collection.title}" has ${collection.library_adds} subscribers. Deleting it would affect existing users. You can archive it instead.`,
        confirmLabel: 'Archive Collection',
        cancelLabel: 'Cancel',
      });
      if (!ok) return;

      setActiveId(collection.id);
      try {
        await api.updateInterviewCollection(collection.id, {
          status: 'archived',
        });
        showGlobalToast('Collection archived successfully');
        await load(false);
      } catch (err) {
        showGlobalToast(
          err instanceof Error ? err.message : 'Could not archive collection.',
        );
      } finally {
        setActiveId(null);
      }
    }
  };

  const handleRestore = async (collection: InterviewCollection) => {
    setActiveId(collection.id);
    try {
      await api.updateInterviewCollection(collection.id, {
        status: 'published',
      });
      showGlobalToast('Collection restored successfully');
      await load(false);
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not restore collection.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleSaveCollection = async (payload: {
    title: string;
    description?: string;
    price_coins?: number;
    status: string;
    question_ids: string[];
    cover_file?: File;
  }) => {
    try {
      if (selectedCollectionToEdit) {
        const updated = await api.updateInterviewCollection(
          selectedCollectionToEdit.id,
          payload,
        );
        if (payload.cover_file)
          await api.uploadCollectionCover(updated.id, payload.cover_file);
        showGlobalToast('Collection updated successfully');
      } else {
        const created = await api.createInterviewCollection(payload);
        if (payload.cover_file)
          await api.uploadCollectionCover(created.id, payload.cover_file);
        showGlobalToast('Collection published successfully');
      }
      setIsFormModalOpen(false);
      setSelectedCollectionToEdit(null);
      await load(false);
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to save collection',
      );
      throw err;
    }
  };

  // Only show published collections in the Discover lists
  const official = collections.filter(
    (collection) =>
      collection.collection_type === 'official' &&
      collection.status === 'published',
  );
  const community = collections.filter(
    (collection) =>
      collection.collection_type === 'community' &&
      collection.status === 'published',
  );
  const purchased = collections.filter((collection) => collection.is_purchased);

  // Separate created collections
  const myPublished = createdCollections.filter(
    (collection) => collection.status === 'published',
  );
  const myPrivate = createdCollections.filter(
    (collection) => collection.status === 'draft',
  );
  const myArchived = createdCollections.filter(
    (collection) => collection.status === 'archived',
  );

  return (
    <div className='grid gap-6'>
      {/* Premium Animated Segmented Control Tabs */}
      <div className='sticky top-0 flex backdrop-blur-sm border-b border-border/40 shrink-0 gap-6 px-6 pt-4 bg-background-secondary/5 overflow-x-auto no-scrollbar'>
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            'label pb-3 transition-colors relative cursor-pointer whitespace-nowrap',
            activeTab === 'all' ?
              'text-primary font-bold'
            : 'text-ink-secondary hover:text-ink-primary',
          )}
        >
          Discover
          {activeTab === 'all' && (
            <motion.div
              layoutId='discoverActiveTabLine'
              className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary'
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('purchased')}
          className={cn(
            'label pb-3 transition-colors relative flex items-center gap-2 cursor-pointer whitespace-nowrap',
            activeTab === 'purchased' ?
              'text-primary font-bold'
            : 'text-ink-secondary hover:text-ink-primary',
          )}
        >
          My Purchases
          {purchased.length > 0 && (
            <span className='label-sm rounded-full bg-primary/15 px-2 py-0.5 text-primary'>
              {purchased.length}
            </span>
          )}
          {activeTab === 'purchased' && (
            <motion.div
              layoutId='discoverActiveTabLine'
              className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary'
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('published')}
          className={cn(
            'label pb-3 transition-colors relative flex items-center gap-2 cursor-pointer whitespace-nowrap',
            activeTab === 'published' ?
              'text-primary font-bold'
            : 'text-ink-secondary hover:text-ink-primary',
          )}
        >
          My Published
          {myPublished.length > 0 && (
            <span className='label-sm rounded-full bg-primary/15 px-2 py-0.5 text-primary'>
              {myPublished.length}
            </span>
          )}
          {activeTab === 'published' && (
            <motion.div
              layoutId='discoverActiveTabLine'
              className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary'
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('private')}
          className={cn(
            'label pb-3 transition-colors relative flex items-center gap-2 cursor-pointer whitespace-nowrap',
            activeTab === 'private' ?
              'text-primary font-bold'
            : 'text-ink-secondary hover:text-ink-primary',
          )}
        >
          My Private
          {myPrivate.length > 0 && (
            <span className='label-sm rounded-full bg-primary/15 px-2 py-0.5 text-primary'>
              {myPrivate.length}
            </span>
          )}
          {activeTab === 'private' && (
            <motion.div
              layoutId='discoverActiveTabLine'
              className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary'
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={cn(
            'label pb-3 transition-colors relative flex items-center gap-2 cursor-pointer whitespace-nowrap',
            activeTab === 'archive' ?
              'text-primary font-bold'
            : 'text-ink-secondary hover:text-ink-primary',
          )}
        >
          Archive
          {myArchived.length > 0 && (
            <span className='label-sm rounded-full bg-primary/15 px-2 py-0.5 text-primary'>
              {myArchived.length}
            </span>
          )}
          {activeTab === 'archive' && (
            <motion.div
              layoutId='discoverActiveTabLine'
              className='absolute bottom-0 left-0 right-0 h-0.5 bg-primary'
            />
          )}
        </button>
      </div>
      {/* Tab Contents */}
      <div className=' grid gap-8 px-6 py-6'>
        {activeTab === 'all' ?
          <>
            <section>
              <div className='mb-4 flex items-center gap-2'>
                <Sparkles className='h-4 w-4 text-primary' />
                <h2 className='title-card'>Official Collections</h2>
              </div>
              {isLoading ?
                <div className='body-md panel-sm flex items-center gap-3 p-5 text-ink-secondary'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Loading official collections...
                </div>
              : official.length === 0 ?
                <div className='body-md rounded-2xl border border-dashed border-border/60 bg-background/30 p-8 text-center text-ink-secondary'>
                  No official collections available.
                </div>
              : <ScrollableContainer>
                  {official.map((collection) => (
                    <CollectionCard
                      key={collection.id}
                      collection={collection}
                      onAdd={handleAdd}
                      onRemove={handleRemove}
                      isLoading={activeId === collection.id}
                      currentUserId={currentUser?.id}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                    />
                  ))}
                </ScrollableContainer>
              }
            </section>

            <section>
              <div className='mb-4 flex items-center gap-2'>
                <ShoppingBag className='h-4 w-4 text-primary' />
                <h2 className='title-card'>Community Collections</h2>
              </div>
              {isLoading ?
                <div className='body-md panel-sm flex items-center gap-3 p-5 text-ink-secondary'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Loading community collections...
                </div>
              : community.length === 0 ?
                <div className='body-md rounded-2xl border border-dashed border-border/60 bg-background/30 p-8 text-center text-ink-secondary'>
                  No community collections available.
                </div>
              : <ScrollableContainer>
                  {community.map((collection) => (
                    <CollectionCard
                      key={collection.id}
                      collection={collection}
                      onAdd={handleAdd}
                      onRemove={handleRemove}
                      isLoading={activeId === collection.id}
                      currentUserId={currentUser?.id}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onRestore={handleRestore}
                    />
                  ))}
                </ScrollableContainer>
              }
            </section>
          </>
        : activeTab === 'purchased' /* My Purchases Tab */ ?
          <section>
            <div className='mb-4 flex items-center gap-2'>
              <BadgeCheck className='h-4.5 w-4.5 text-primary' />
              <h2 className='title-card'>Your Owned Packs</h2>
            </div>
            <div className='body-md mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-ink-secondary'>
              <div className='font-semibold text-ink-primary'>
                Imported questions stay linked to the collection they came from.
              </div>
              <div className='mt-1'>
                You can edit your own answer in your library, but the original
                prompt stays locked for library copies.
              </div>
            </div>
            {isLoading ?
              <div className='body-md panel-sm flex items-center gap-3 p-5 text-ink-secondary'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading your purchases...
              </div>
            : purchased.length === 0 ?
              <div className='body-md rounded-2xl border border-dashed border-border/60 bg-background/30 p-12 text-center text-ink-secondary'>
                You have not purchased any collections yet.
              </div>
            : <ScrollableContainer>
                {purchased.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    isLoading={activeId === collection.id}
                    currentUserId={currentUser?.id}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                  />
                ))}
              </ScrollableContainer>
            }
          </section>
        : activeTab === 'published' /* My Published Tab */ ?
          <section>
            <div className='mb-4 flex items-center gap-2'>
              <Sparkles className='h-4.5 w-4.5 text-primary' />
              <h2 className='title-card'>
                Your Published Collections ({myPublished.length})
              </h2>
            </div>
            {isLoading ?
              <div className='body-md panel-sm flex items-center gap-3 p-5 text-ink-secondary'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading your published collections...
              </div>
            : myPublished.length === 0 ?
              <div className='body-md rounded-2xl border border-dashed border-border/60 bg-background/30 p-12 text-center text-ink-secondary'>
                You have no published collections.
              </div>
            : <ScrollableContainer>
                {myPublished.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    isLoading={activeId === collection.id}
                    currentUserId={currentUser?.id}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                  />
                ))}
              </ScrollableContainer>
            }
          </section>
        : activeTab === 'private' /* My Private Tab */ ?
          <section>
            <div className='mb-4 flex items-center gap-2'>
              <Sparkles className='h-4.5 w-4.5 text-primary' />
              <h2 className='title-card'>
                Your Private Collections ({myPrivate.length})
              </h2>
            </div>
            {isLoading ?
              <div className='body-md panel-sm flex items-center gap-3 p-5 text-ink-secondary'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading your private collections...
              </div>
            : myPrivate.length === 0 ?
              <div className='body-md rounded-2xl border border-dashed border-border/60 bg-background/30 p-12 text-center text-ink-secondary'>
                You have no private collections.
              </div>
            : <ScrollableContainer>
                {myPrivate.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    isLoading={activeId === collection.id}
                    currentUserId={currentUser?.id}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                  />
                ))}
              </ScrollableContainer>
            }
          </section>
        : /* Archived Tab */
          <section>
            <div className='mb-4 flex items-center gap-2'>
              <Trash2 className='h-4.5 w-4.5 text-rose-500' />
              <h2 className='title-card text-rose-500'>
                Archived Collections ({myArchived.length})
              </h2>
            </div>
            {isLoading ?
              <div className='body-md panel-sm flex items-center gap-3 p-5 text-ink-secondary'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading archived collections...
              </div>
            : myArchived.length === 0 ?
              <div className='body-md rounded-2xl border border-dashed border-border/60 bg-background/30 p-12 text-center text-ink-secondary'>
                No archived collections.
              </div>
            : <ScrollableContainer itemClassName='opacity-75 hover:opacity-100 transition-opacity duration-200'>
                {myArchived.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    isLoading={activeId === collection.id}
                    currentUserId={currentUser?.id}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                  />
                ))}
              </ScrollableContainer>
            }
          </section>
        }
      </div>

      {/* Custom Collection Creation & Edit Modal */}
      {isFormModalOpen && (
        <CollectionFormModal
          collection={selectedCollectionToEdit}
          onSave={handleSaveCollection}
          onClose={() => {
            setIsFormModalOpen(false);
            setSelectedCollectionToEdit(null);
          }}
        />
      )}
    </div>
  );
}
