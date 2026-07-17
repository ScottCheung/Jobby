/** @format */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Check,
  Copy,
  Palette,
  Layout,
  Type,
  Grid,
  Edit,
  Tag,
  MousePointer,
  Zap,
  Sidebar,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import config from './design-system-config.json';

// ─── Types ──────────────────────────────────────────────────────────────────

type Section = (typeof config.sections)[number];
type Group = Section['groups'][number];
type Item = Group['items'][number];

// ─── Icon Map ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  palette: Palette,
  layout: Layout,
  type: Type,
  grid: Grid,
  edit: Edit,
  tag: Tag,
  'mouse-pointer': MousePointer,
  zap: Zap,
  sidebar: Sidebar,
};

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({
  value,
  size = 'sm',
}: {
  value: string;
  size?: 'xs' | 'sm';
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    },
    [value],
  );

  return (
    <button
      onClick={handleCopy}
      title={`Copy: ${value}`}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border border-border/40 bg-background-secondary/40',
        'text-ink-secondary hover:text-primary hover:border-primary/30 hover:bg-primary/5',
        'transition-all active:scale-95 cursor-pointer shrink-0',
        size === 'xs' ? 'p-1' : 'p-1.5',
      )}
    >
      {copied ?
        <Check
          className={cn(
            'text-ink-success',
            size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5',
          )}
        />
      : <Copy className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
    </button>
  );
}

// ─── Token Chip ───────────────────────────────────────────────────────────────

function TokenChip({ token }: { token: string }) {
  return (
    <div className='flex items-center gap-1.5 min-w-0'>
      <code className='text-xs font-mono font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md truncate'>
        {token}
      </code>
      <CopyButton value={token} size='xs' />
    </div>
  );
}

// ─── Preview Components ───────────────────────────────────────────────────────

function SwatchPreview({ bg }: { bg: string }) {
  return <div className={cn('w-full h-10 rounded-lg', bg)} />;
}

function TextPreview({
  textClass,
  sample,
}: {
  textClass: string;
  sample: string;
}) {
  return <p className={cn(textClass, 'text-xl font-black')}>{sample}</p>;
}

function ContainerPreview({ classes }: { classes: string }) {
  return (
    <div
      className={cn(classes, 'w-full min-h-[48px] items-center justify-center')}
    >
      <span className='text-ink-secondary text-xs'>Content area</span>
    </div>
  );
}

function BorderPreview({ border }: { border: string }) {
  return <div className={cn('w-full h-10 rounded-lg', border)} />;
}

function LayoutRowPreview({ classes }: { classes: string }) {
  return (
    <div className={cn(classes, 'w-full')}>
      {['A', 'B', 'C'].map((l) => (
        <span
          key={l}
          className='px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold'
        >
          {l}
        </span>
      ))}
    </div>
  );
}

function LayoutBetweenPreview({ classes }: { classes: string }) {
  return (
    <div className={cn(classes, 'w-full')}>
      <span className='px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold'>
        Left
      </span>
      <span className='px-3 py-1 rounded-lg bg-background-secondary text-ink-secondary text-xs font-bold'>
        Right
      </span>
    </div>
  );
}

function LayoutColPreview({ classes }: { classes: string }) {
  return (
    <div className={cn(classes, 'w-full')}>
      {['Row 1', 'Row 2'].map((l) => (
        <div
          key={l}
          className='px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold'
        >
          {l}
        </div>
      ))}
    </div>
  );
}

function LayoutWrapPreview({ classes }: { classes: string }) {
  return (
    <div className={cn(classes, 'w-full')}>
      {['Tag A', 'Tag B', 'Tag C', 'Tag D'].map((t) => (
        <span
          key={t}
          className='px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold'
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function InputPreview({ placeholder }: { placeholder: string }) {
  return <input className='input w-full' placeholder={placeholder} readOnly />;
}

function TextareaPreview({ placeholder }: { placeholder: string }) {
  return (
    <textarea
      className='textarea w-full'
      placeholder={placeholder}
      rows={2}
      readOnly
    />
  );
}

function SelectPreview() {
  return (
    <select className='select w-full'>
      <option>Option A</option>
      <option>Option B</option>
    </select>
  );
}

function BadgePreview({
  classes,
  sample,
}: {
  classes: string;
  sample: string;
}) {
  return <span className={classes}>{sample}</span>;
}

function ButtonPreview({
  classes,
  sample,
}: {
  classes: string;
  sample: string;
}) {
  return (
    <button
      className={cn(
        classes,
        'px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer',
      )}
    >
      {sample}
    </button>
  );
}

function SkeletonPreview() {
  return (
    <div className='flex flex-col gap-2 w-full'>
      <div className='skeleton h-4 w-3/4 rounded-lg' />
      <div className='skeleton h-4 w-1/2 rounded-lg' />
    </div>
  );
}

function ShadowPreview() {
  return <div className='w-full h-10 rounded-xl bg-panel shadow-brand' />;
}

function ScrollbarPreview() {
  return (
    <div className='custom-scrollbar w-full h-14 overflow-y-auto rounded-lg bg-background-secondary/30 p-2'>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className='text-xs text-ink-secondary py-0.5'>
          Scrollable item {i + 1}
        </div>
      ))}
    </div>
  );
}

function ItemPreview({ item }: { item: Item }) {
  const p = item.preview as Record<string, string> | null;
  if (!p) return null;

  switch (p.type) {
    case 'swatch':
      return <SwatchPreview bg={p.bg} />;
    case 'text':
      return <TextPreview textClass={p.text} sample='The quick brown fox' />;
    case 'text-sample':
      return <TextPreview textClass={p.classes} sample={p.sample} />;
    case 'container':
      return <ContainerPreview classes={p.classes} />;
    case 'border':
      return <BorderPreview border={p.border ?? p.classes} />;
    case 'layout-row':
      return <LayoutRowPreview classes={p.classes} />;
    case 'layout-between':
      return <LayoutBetweenPreview classes={p.classes} />;
    case 'layout-col':
      return <LayoutColPreview classes={p.classes} />;
    case 'layout-wrap':
      return <LayoutWrapPreview classes={p.classes} />;
    case 'input':
      return <InputPreview placeholder={p.placeholder} />;
    case 'textarea':
      return <TextareaPreview placeholder={p.placeholder} />;
    case 'select':
      return <SelectPreview />;
    case 'badge':
      return <BadgePreview classes={p.classes} sample={p.sample} />;
    case 'button':
      return <ButtonPreview classes={p.classes} sample={p.sample} />;
    case 'skeleton':
      return <SkeletonPreview />;
    case 'shadow':
      return <ShadowPreview />;
    case 'scrollbar':
      return <ScrollbarPreview />;
    default:
      return null;
  }
}

// ─── Token Card ───────────────────────────────────────────────────────────────

function TokenCard({ item }: { item: Item }) {
  const hasClasses = 'classes' in item && item.classes;

  return (
    <div className='panel-lg gap-3 h-full group hover:shadow-md hover:shadow-primary/5 transition-all duration-200'>
      {/* Preview area */}
      {item.preview && (
        <div className='w-full min-h-[56px] flex items-center justify-center rounded-xl bg-background-secondary/30 px-3 py-3'>
          <ItemPreview item={item} />
        </div>
      )}

      {/* Token chip + copy */}
      <TokenChip token={item.token} />

      {/* Description */}
      <p className='text-meta leading-relaxed'>{item.description}</p>

      {/* Full class string */}
      {hasClasses && (
        <div className='flex items-start gap-2 pt-1 border-t border-border/30'>
          <code className='flex-1 text-[10px] font-mono text-ink-muted leading-relaxed break-all'>
            {item.classes}
          </code>
          <CopyButton value={item.classes as string} size='xs' />
        </div>
      )}
    </div>
  );
}

// ─── Group Block ──────────────────────────────────────────────────────────────

function GroupBlock({ group }: { group: Group }) {
  return (
    <div className='col gap-4'>
      <div className='row-between'>
        <h3 className='title-card'>{group.title}</h3>
      </div>
      {'description' in group && group.description && (
        <p className='text-meta bg-background-secondary/40 px-3 py-2 rounded-lg border border-border/30'>
          {group.description as string}
        </p>
      )}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
        {group.items.map((item) => (
          <TokenCard key={item.token} item={item} />
        ))}
      </div>
    </div>
  );
}

// ─── Section Panel ────────────────────────────────────────────────────────────

function SectionPanel({ section }: { section: Section }) {
  const Icon = ICON_MAP[section.icon] ?? Zap;

  return (
    <section id={section.id} className='col gap-6'>
      <div className='row-between'>
        <div className='row-md'>
          <div className='flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0'>
            <Icon className='w-4.5 h-4.5' />
          </div>
          <h2 className='title-section'>{section.title}</h2>
        </div>
      </div>

      {section.groups.map((group) => (
        <GroupBlock key={group.id} group={group} />
      ))}
    </section>
  );
}

// ─── Rules Panel ─────────────────────────────────────────────────────────────

function RulesPanel() {
  return (
    <section id='rules' className='col gap-4'>
      <div className='row-md'>
        <div className='flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0'>
          <BookOpen className='w-4.5 h-4.5' />
        </div>
        <h2 className='title-section'>命名规范</h2>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
        {config.rules.map((rule) => (
          <div key={rule.id} className='panel-xs p-4 col gap-1.5'>
            <span className='label-overline'>{rule.title}</span>
            <p className='text-sm text-ink-secondary leading-relaxed'>
              {rule.rule}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function SideNav({
  activeSection,
  onSelect,
}: {
  activeSection: string;
  onSelect: (id: string) => void;
}) {
  const allSections = [
    ...config.sections.map((s) => ({ id: s.id, title: s.title, icon: s.icon })),
    { id: 'rules', title: '命名规范', icon: 'book' },
  ];

  return (
    <nav className='sticky top-4 col gap-1'>
      <p className='label-overline px-2 mb-1'>导航</p>
      {allSections.map((s) => {
        const Icon = ICON_MAP[s.icon] ?? BookOpen;
        const isActive = activeSection === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              'row px-3 py-2 rounded-xl text-sm font-semibold text-left w-full transition-all cursor-pointer',
              isActive ?
                'bg-primary/10 text-primary'
              : 'text-ink-secondary hover:bg-background-secondary/60 hover:text-ink-primary',
            )}
          >
            <Icon className='w-3.5 h-3.5 shrink-0' />
            {s.title}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [activeSection, setActiveSection] = useState(config.sections[0].id);

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className='min-h-screen flex flex-col'>
      {/* Page Header */}
      <div className='sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/40 px-page py-4'>
        <div className='row-between max-w-screen-2xl mx-auto'>
          <div className='row-md'>
            <div className='w-8 h-8 rounded-xl bg-primary-gradient flex items-center justify-center'>
              <Palette className='w-4 h-4 text-primary-foreground' />
            </div>
            <div className='stack gap-0'>
              <h1 className='text-base font-bold text-ink-primary leading-tight'>
                {config.meta.title}
              </h1>
              <span className='text-meta'>
                v{config.meta.version} · JSON-driven
              </span>
            </div>
          </div>
          <div className='row gap-2'>
            <span className='status-badge'>
              {config.sections.length} sections
            </span>
            <span className='status-badge'>
              {config.sections.reduce(
                (acc, s) =>
                  acc + s.groups.reduce((a, g) => a + g.items.length, 0),
                0,
              )}{' '}
              tokens
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className='flex flex-1 max-w-screen-2xl mx-auto w-full'>
        {/* Side Nav */}
        <aside className='hidden lg:block w-52 shrink-0 p-6 pr-0'>
          <SideNav activeSection={activeSection} onSelect={scrollToSection} />
        </aside>

        {/* Content */}
        <main className='flex-1 min-w-0 p-6 col gap-16'>
          {/* Description */}
          <div className='panel-xs p-4'>
            <p className='text-sm text-ink-secondary leading-relaxed'>
              {config.meta.description}
            </p>
          </div>

          {/* All Sections */}
          {config.sections.map((section) => (
            <SectionPanel key={section.id} section={section} />
          ))}

          {/* Rules */}
          <RulesPanel />
        </main>
      </div>
    </div>
  );
}
