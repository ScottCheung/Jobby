/** @format */

'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Tag,
  Layers,
  FolderPlus,
  Lock,
  BadgeCheck,
  User,
  Users,
} from 'lucide-react';
import type {
  InterviewCategory,
  InterviewTag,
  InterviewQuestion,
  InterviewCollection,
} from '@/lib/types';
import { cn, cleanName, matchesCollection } from '@/lib/utils';
import { AutoScroll } from '@/components/UI/AutoScroll/AutoScroll';
import { LibraryCollectionItem } from './LibraryCollectionItem';
import { motion } from 'framer-motion';

interface FilterSidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  categories: InterviewCategory[];
  tags: InterviewTag[];
  selectedCategoryIds: string[];
  setSelectedCategoryIds: (ids: string[]) => void;
  selectedTagIds: string[];
  setSelectedTagIds: (ids: string[]) => void;
  questions: InterviewQuestion[];
  collections: InterviewCollection[];
  selectedCollectionIds: string[];
  setSelectedCollectionIds: (ids: string[]) => void;
  onCreateCollection?: () => void;
  currentUserId?: string;
  collectionActionId?: string | null;
  onCollectionAddOrRestore?: (collection: InterviewCollection) => void;
  onCollectionRemove?: (collection: InterviewCollection) => void;
  onCollectionEdit?: (collection: InterviewCollection) => void;
  onCollectionArchive?: (collection: InterviewCollection) => void;
}

const getCategoryAvatar = (name: string, isSelected: boolean) => {
  const cleaned = cleanName(name).trim();
  if (!cleaned) return <Folder className='w-4 h-4 opacity-50 shrink-0' />;

  let initials = '';
  const isChinese = /[\u4e00-\u9fa5]/.test(cleaned);
  if (isChinese) {
    initials = cleaned.slice(0, 2);
  } else {
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else {
      initials = cleaned.slice(0, 2).toUpperCase();
    }
  }

  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) {
    hash = cleaned.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  const bgColor = `hsl(${h}, 60%, 45%)`;

  return (
    <span
      className={cn(
        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 transition-transform duration-200 hover:scale-105',
      )}
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </span>
  );
};

const getTagAvatar = (name: string, isSelected: boolean) => {
  const cleaned = cleanName(name).trim();
  if (!cleaned) return <Tag className='w-3 h-3 opacity-50 shrink-0' />;

  const initial = cleaned.toUpperCase();

  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) {
    hash = cleaned.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  const color = `hsl(${h}, 65%, 45%)`;

  return (
    <span
      className={cn(
        'text-[10px] font-medium shrink-0 inline-flex w-full h-4  items-center justify-start select-none opacity-80',
        isSelected ?
          'text-primary opacity-100 font-semibold'
        : 'text-ink-secondary',
      )}
      style={{ color }}
    >
      <AutoScroll speed={1} className='w-full px-2'>
        <div className='ml-2'>#{initial}</div>
      </AutoScroll>
    </span>
  );
};

const getCollectionAvatar = (
  col: InterviewCollection,
  currentUserId?: string,
) => {
  const isPrivate = col.status === 'draft';
  const isOfficial = col.collection_type === 'official';
  const isPersonal = col.creator_user_id === currentUserId;

  if (isPrivate) {
    return (
      <span className='w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-zinc-500 dark:bg-zinc-800/80 transition-transform duration-200 hover:scale-105'>
        <Lock className='w-3 h-3' />
      </span>
    );
  }
  if (isOfficial) {
    return (
      <span className='w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-amber-500 dark:bg-amber-955/20 transition-transform duration-200 hover:scale-105'>
        <BadgeCheck className='size-4' />
      </span>
    );
  }
  if (isPersonal) {
    return (
      <span className='w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-emerald-500 dark:bg-emerald-955/20 transition-transform duration-200 hover:scale-105'>
        <User className='size-4' />
      </span>
    );
  }
  // Community
  return (
    <span className='w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-indigo-500 dark:bg-indigo-955/20 transition-transform duration-200 hover:scale-105'>
      <Users className='size-4' />
    </span>
  );
};

export function FilterSidebar({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  categories,
  tags,
  selectedCategoryIds,
  setSelectedCategoryIds,
  selectedTagIds,
  setSelectedTagIds,
  questions,
  collections,
  selectedCollectionIds,
  setSelectedCollectionIds,
  onCreateCollection,
  currentUserId,
  collectionActionId,
  onCollectionAddOrRestore,
  onCollectionRemove,
  onCollectionEdit,
  onCollectionArchive,
}: FilterSidebarProps) {
  const activeTab =
    'bg-gradient-to-r from-primary/20 to-transparent text-primary font-semibold';
  const inactiveTab =
    'text-ink-secondary hover:bg-background-secondary/60 hover:text-ink-primary';

  const CountClassNameInActive =
    'body-sm bg-zinc-200 dark:bg-zinc-700/80 px-2 py-0.5 rounded-full text-ink-secondary shrink-0';
  const CountClassNameActive =
    'body-sm bg-primary px-2 py-0.5 rounded-full !text-primary-foreground shrink-0';

  const getTabButtonClass = (isSelected: boolean, isTag = false) =>
    cn(
      'label flex items-center transition-all text-left',
      'rounded-full',
      isSidebarCollapsed ? 'justify-center p-2.5 w-10 h-10'
      : isTag ? 'justify-between px-2.5 pr-1.5 py-1.5 w-full'
      : 'justify-between px-2 py-1.5 w-full',
      isSelected ? activeTab : inactiveTab,
    );

  const getCountBadgeClass = (isSelected: boolean) =>
    isSelected ? CountClassNameActive : CountClassNameInActive;

  const handleCategoryClick = (id: string | null) => {
    if (id === null) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(
        selectedCategoryIds.includes(id) ?
          selectedCategoryIds.filter((x) => x !== id)
        : [...selectedCategoryIds, id],
      );
    }
  };

  const handleTagClick = (id: string | null) => {
    if (id === null) {
      setSelectedTagIds([]);
    } else {
      setSelectedTagIds(
        selectedTagIds.includes(id) ?
          selectedTagIds.filter((x) => x !== id)
        : [...selectedTagIds, id],
      );
    }
  };

  const handleCollectionClick = (id: string | null) => {
    if (id === null) {
      setSelectedCollectionIds([]);
    } else {
      setSelectedCollectionIds(
        selectedCollectionIds.includes(id) ?
          selectedCollectionIds.filter((x) => x !== id)
        : [...selectedCollectionIds, id],
      );
    }
  };

  return (
    <div
      className={cn(
        'shrink-0 panel-xl  p-lg! flex flex-col gap-5 overflow-y-auto no-scrollbar transition-all duration-300 relative',
        isSidebarCollapsed ? 'w-16 items-center ' : 'w-64',
      )}
    >
      {/* Toggle Collapse Button */}
      <div
        className={cn(
          'flex items-center sticky top-0 z-10',
          isSidebarCollapsed ?
            'justify-center w-full '
          : 'justify-between w-full  ',
        )}
      >
        {!isSidebarCollapsed && (
          <span className='label-overline backdrop-blur-3xl '>Filters</span>
        )}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className='p-1.5 rounded-full text-primary-foreground bg-primary transition-colors'
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ?
            <ChevronRight className='w-4 h-4' />
          : <ChevronLeft className='w-4 h-4' />}
        </button>
      </div>

      {/* Categories Section */}
      <div
        className={cn(
          'flex flex-col gap-1 w-full ',
          isSidebarCollapsed && 'items-center',
        )}
      >
        {!isSidebarCollapsed && (
          <h3 className='label-overline px-2 mb-2'>Categories</h3>
        )}
        <button
          onClick={() => handleCategoryClick(null)}
          className={getTabButtonClass(selectedCategoryIds.length === 0, false)}
          title={isSidebarCollapsed ? 'All ' : undefined}
        >
          <span className='flex items-center gap-2'>
            <Folder className='w-4 h-4 opacity-70 shrink-0' />
            {!isSidebarCollapsed && <span>All</span>}
          </span>
          {!isSidebarCollapsed && (
            <span
              className={getCountBadgeClass(selectedCategoryIds.length === 0)}
            >
              {questions.length}
            </span>
          )}
        </button>
        {categories.map((cat) => {
          const isSelected = selectedCategoryIds.includes(cat.id);
          const count = questions.filter(
            (q) => q.category_id === cat.id,
          ).length;
          const cleanedName = cleanName(cat.name);
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={getTabButtonClass(isSelected, false)}
              title={
                isSidebarCollapsed ? `${cleanedName} (${count})` : undefined
              }
            >
              <span className='flex items-center gap-2 truncate'>
                {getCategoryAvatar(cat.name, isSelected)}
                {!isSidebarCollapsed && (
                  <span className='truncate text-[11px]'>{cleanedName}</span>
                )}
              </span>
              {!isSidebarCollapsed && (
                <span className={getCountBadgeClass(isSelected)}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Collections Section */}
      <div
        className={cn(
          'flex flex-col gap-1 w-full pt-4 border-t border-border/40',
          isSidebarCollapsed && 'items-center',
        )}
      >
        {!isSidebarCollapsed && (
          <div className='flex items-center justify-between px-2 mb-2 w-full'>
            <h3 className='label-overline'>Collections</h3>
            <motion.button
              layoutId='collection-form-modal'
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                onCreateCollection?.();
              }}
              className='p-1 rounded-lg hover:bg-background-secondary text-ink-secondary hover:text-ink-primary transition-colors'
              title='Create Collection'
            >
              <FolderPlus className='w-4 h-4' />
            </motion.button>
          </div>
        )}
        <button
          onClick={() => handleCollectionClick(null)}
          className={getTabButtonClass(
            selectedCollectionIds.length === 0,
            false,
          )}
          title={isSidebarCollapsed ? 'All Collections' : undefined}
        >
          <span className='flex items-center gap-2'>
            <Layers className='w-4 h-4 opacity-70 shrink-0' />
            {!isSidebarCollapsed && <span>All</span>}
          </span>
          {!isSidebarCollapsed && (
            <span
              className={getCountBadgeClass(selectedCollectionIds.length === 0)}
            >
              {questions.length}
            </span>
          )}
        </button>
        {collections.map((col) => {
          const isSelected = selectedCollectionIds.includes(col.id);
          const count = questions.filter((q) =>
            matchesCollection(q, col),
          ).length;
          const cleanedTitle = cleanName(col.title);
          return isSidebarCollapsed ? (
            <button
              key={col.id}
              onClick={() => handleCollectionClick(col.id)}
              className={getTabButtonClass(isSelected, false)}
              title={
                isSidebarCollapsed ? `${cleanedTitle} (${count})` : undefined
              }
            >
              <span className='flex items-center gap-2 truncate'>
                {getCollectionAvatar(col, currentUserId)}
                {!isSidebarCollapsed && (
                  <span className='truncate text-[11px]'>{cleanedTitle}</span>
                )}
              </span>
              {!isSidebarCollapsed && (
                <span className={getCountBadgeClass(isSelected)}>{count}</span>
              )}
            </button>
          ) : (
            <LibraryCollectionItem
              key={col.id}
              collection={col}
              count={count}
              isSelected={isSelected}
              isOwned={col.creator_user_id === currentUserId}
              isBusy={collectionActionId === col.id}
              avatar={getCollectionAvatar(col, currentUserId)}
              onSelect={() => handleCollectionClick(col.id)}
              onAddOrRestore={() => onCollectionAddOrRestore?.(col)}
              onRemove={() => onCollectionRemove?.(col)}
              onEdit={() => onCollectionEdit?.(col)}
              onArchive={() => onCollectionArchive?.(col)}
            />
          );
        })}
      </div>

      {/* Tags Section
      <div
        className={cn(
          'flex flex-col gap-1 pt-4 border-t border-border/40 w-full',
          isSidebarCollapsed && 'items-center',
        )}
      >
        {!isSidebarCollapsed && (
          <h3 className='label-overline px-2 mb-2'>Tags</h3>
        )}
        <button
          onClick={() => handleTagClick(null)}
          className={getTabButtonClass(selectedTagIds.length === 0, true)}
          title={isSidebarCollapsed ? 'All Tags' : undefined}
        >
          <span className='flex items-center gap-2'>
            <Tag className='w-3.5 h-3.5 opacity-70 shrink-0' />
            {!isSidebarCollapsed && <span>All Tags</span>}
          </span>
        </button>
        {tags
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            const count = questions.filter((q) =>
              q.tags?.some((t) => t.id === tag.id),
            ).length;
            const cleanedName = cleanName(tag.name);
            return (
              <button
                key={tag.id}
                onClick={() => handleTagClick(tag.id)}
                className={getTabButtonClass(isSelected, true)}
                title={
                  isSidebarCollapsed ? `${cleanedName} (${count})` : undefined
                }
              >
                <span className='flex items-center gap-2 truncate'>
                  {getTagAvatar(tag.name, isSelected)}
                </span>
                {!isSidebarCollapsed && (
                  <span className={getCountBadgeClass(isSelected)}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
      </div> */}
    </div>
  );
}
