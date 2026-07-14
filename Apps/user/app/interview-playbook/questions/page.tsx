'use client';
import React, { useEffect, useState } from 'react';
import { Plus, Search, FileText, Edit3, Trash2, Star, Folder, X, AlertCircle, Tag } from 'lucide-react';
import { api } from '@/lib/api';
import type { InterviewQuestion, InterviewCategory, InterviewTag } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/lib/store/layout-store';

interface QuestionFormProps {
  question?: InterviewQuestion;
  categories: InterviewCategory[];
  tags: InterviewTag[];
  onTagCreated: (tag: InterviewTag) => void;
  onSave: (payload: Partial<InterviewQuestion>) => Promise<void>;
  onCancel: () => void;
}

function QuestionForm({
  question,
  categories,
  tags,
  onTagCreated,
  onSave,
  onCancel,
}: QuestionFormProps) {
  const [title, setTitle] = useState(question?.title || '');
  const [categoryId, setCategoryId] = useState(question?.category_id || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    question?.tags?.map((t) => t.id) || []
  );
  const [frequency, setFrequency] = useState(question?.frequency || 'Medium');
  const [importanceScore, setImportanceScore] = useState(
    question?.importance_score || 3
  );
  const [answerObjective, setAnswerObjective] = useState(
    question?.answer_objective || ''
  );
  const [myAnswer, setMyAnswer] = useState(question?.my_answer || '');
  const [improvementNotes, setImprovementNotes] = useState(
    question?.improvement_notes || ''
  );

  const [frameworkType, setFrameworkType] = useState(() => {
    if (!question?.answer_framework) return 'STAR';
    const isDefault = ['STAR', 'PAR', 'CAR', '5W2H'].includes(question.answer_framework);
    return isDefault ? question.answer_framework : 'custom';
  });
  const [customFramework, setCustomFramework] = useState(() => {
    if (!question?.answer_framework) return '';
    const isDefault = ['STAR', 'PAR', 'CAR', '5W2H'].includes(question.answer_framework);
    return isDefault ? '' : question.answer_framework;
  });

  const [newTagName, setNewTagName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const created = await api.createInterviewTag({ name: newTagName.trim() });
      onTagCreated(created);
      setSelectedTags((prev) => [...prev, created.id]);
      setNewTagName('');
    } catch (err: any) {
      console.error('Failed to create tag:', err);
      setErrorMsg(err.message || 'Failed to create tag');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Title is required');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const frameworkValue = frameworkType === 'custom' ? customFramework.trim() : frameworkType;
      const payload: Partial<InterviewQuestion> = {
        title: title.trim(),
        frequency,
        importance_score: importanceScore,
        category_id: categoryId || null,
        tags: selectedTags as any,
        answer_objective: answerObjective.trim() || null,
        answer_framework: frameworkValue.trim() || null,
        my_answer: myAnswer.trim() || null,
        improvement_notes: improvementNotes.trim() || null,
      };
      await onSave(payload);
    } catch (err: any) {
      console.error('Failed to save question:', err);
      setErrorMsg(err.message || 'Failed to save question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-panel text-ink-primary">
      {/* Header */}
      <div className="p-5 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between shrink-0 bg-zinc-50/20 dark:bg-zinc-900/10">
        <h3 className="text-base font-bold">
          {question ? 'Edit Question' : 'Add New Question'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-ink-secondary hover:text-ink-primary p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 custom-scrollbar-primary">
        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Question title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400"
          >
            <option value="">No Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">Assign Tags</label>
          {/* Inline Tag Creator */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-xs focus:outline-none focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={handleCreateTag}
              className="px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-ink-primary rounded-lg border border-zinc-200 dark:border-zinc-800 font-semibold"
            >
              Create Tag
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 border border-zinc-100 dark:border-zinc-800/80 rounded-lg">
            {tags.length === 0 ? (
              <span className="text-xs text-ink-secondary italic p-1">No tags created yet.</span>
            ) : (
              tags.map((tag) => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-lg transition-colors border",
                      active
                        ? "bg-primary border-primary text-primary-foreground font-semibold"
                        : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-ink-secondary dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    )}
                  >
                    {tag.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Frequency & Importance */}
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">Frequency (频率)</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400"
            >
              <option value="Low">低频 (Low)</option>
              <option value="Medium">中频 (Medium)</option>
              <option value="High">高频 (High)</option>
            </select>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">Importance</label>
            <select
              value={importanceScore}
              onChange={(e) => setImportanceScore(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400"
            >
              <option value={1}>1 Star</option>
              <option value={2}>2 Stars</option>
              <option value={3}>3 Stars</option>
              <option value={4}>4 Stars</option>
              <option value={5}>5 Stars</option>
            </select>
          </div>
        </div>

        {/* Answering Framework */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">Answering Framework (框架)</label>
          <select
            value={frameworkType}
            onChange={(e) => setFrameworkType(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400"
          >
            <option value="STAR">STAR 框架 (Situation, Task, Action, Result)</option>
            <option value="PAR">PAR 框架 (Problem, Action, Result)</option>
            <option value="CAR">CAR 框架 (Context, Action, Result)</option>
            <option value="5W2H">5W2H 框架</option>
            <option value="custom">Custom (自定义框架)</option>
          </select>
          {frameworkType === 'custom' && (
            <textarea
              placeholder="Define your custom answering framework details here..."
              value={customFramework}
              onChange={(e) => setCustomFramework(e.target.value)}
              className="w-full px-4 py-2.5 h-20 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 resize-none text-ink-primary text-sm focus:outline-none focus:border-zinc-400"
            />
          )}
        </div>

        {/* Standard Answer */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">标准答案示例 (Supports Multiple Paragraphs)</label>
          <textarea
            placeholder="Write standard sample answer here..."
            value={answerObjective}
            onChange={(e) => setAnswerObjective(e.target.value)}
            className="w-full px-4 py-2.5 h-32 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 resize-none text-ink-primary text-sm focus:outline-none focus:border-zinc-400 leading-relaxed"
          />
        </div>

        {/* My Answer */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">用户答案 (My Answer)</label>
          <textarea
            placeholder="Write your personal answer here..."
            value={myAnswer}
            onChange={(e) => setMyAnswer(e.target.value)}
            className="w-full px-4 py-2.5 h-32 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 resize-none text-ink-primary text-sm focus:outline-none focus:border-zinc-400 leading-relaxed"
          />
        </div>

        {/* Improvement Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-ink-secondary uppercase tracking-wider">改进建议 / 笔记 (Improvement Notes)</label>
          <textarea
            placeholder="Write feedback or notes for improvement..."
            value={improvementNotes}
            onChange={(e) => setImprovementNotes(e.target.value)}
            className="w-full px-4 py-2.5 h-24 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 resize-none text-ink-primary text-sm focus:outline-none focus:border-zinc-400 leading-relaxed"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-end gap-2 shrink-0 bg-zinc-50/20 dark:bg-zinc-900/10">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold transition-colors text-ink-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !title.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Question'}
        </button>
      </div>
    </form>
  );
}

export default function QuestionsLibraryPage() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [tags, setTags] = useState<InterviewTag[]>([]);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null); // null means All
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null); // null means All

  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);
  const addNotification = useLayoutStore((state) => state.actions.addNotification);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const data = await api.interviewQuestions();
      setQuestions(data);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await api.interviewCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchTags = async () => {
    try {
      const data = await api.interviewTags();
      setTags(data);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  };

  const initData = async () => {
    await Promise.all([fetchQuestions(), fetchCategories(), fetchTags()]);
  };

  useEffect(() => {
    void initData();
  }, []);

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await api.deleteInterviewQuestion(id);
      addNotification({ type: 'success', message: 'Question deleted successfully' });
      await fetchQuestions();
    } catch (err) {
      console.error('Failed to delete question:', err);
      addNotification({ type: 'error', message: 'Failed to delete question' });
    }
  };

  const handleInlineUpdate = async (id: string, updates: Partial<InterviewQuestion>) => {
    // Optimistic update
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
    try {
      await api.updateInterviewQuestion(id, updates);
    } catch (err) {
      console.error('Failed to update question inline:', err);
      addNotification({ type: 'error', message: 'Failed to save changes' });
      await fetchQuestions(); // Sync back
    }
  };

  const handleOpenAddQuestion = () => {
    openDrawer({
      width: 550,
      content: (
        <QuestionForm
          categories={categories}
          tags={tags}
          onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
          onCancel={closeDrawer}
          onSave={async (payload) => {
            await api.createInterviewQuestion(payload);
            addNotification({ type: 'success', message: 'Question created successfully' });
            await fetchQuestions();
            closeDrawer();
          }}
        />
      ),
    });
  };

  const handleOpenEditQuestion = (q: InterviewQuestion) => {
    openDrawer({
      width: 550,
      id: q.id,
      content: (
        <QuestionForm
          question={q}
          categories={categories}
          tags={tags}
          onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
          onCancel={closeDrawer}
          onSave={async (payload) => {
            await api.updateInterviewQuestion(q.id, payload);
            addNotification({ type: 'success', message: 'Question updated successfully' });
            await fetchQuestions();
            closeDrawer();
          }}
        />
      ),
    });
  };

  // Filter logic
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategoryId === null || q.category_id === selectedCategoryId;
    const matchesTag = selectedTagId === null || q.tags?.some(t => t.id === selectedTagId);
    return matchesSearch && matchesCategory && matchesTag;
  });

  return (
    <div className="flex gap-4 h-full relative overflow-hidden">
      {/* 1. Sidebar Panel */}
      <div className="w-64 shrink-0 bg-panel border border-zinc-100 dark:border-zinc-800/60 rounded-xl p-4 flex flex-col gap-5 overflow-y-auto">
        {/* Categories Section */}
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-bold text-ink-secondary px-2 mb-2 uppercase tracking-wider">
            Categories
          </h3>
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all text-left",
              selectedCategoryId === null
                ? "bg-zinc-100 dark:bg-zinc-800 text-ink-primary font-semibold"
                : "text-ink-secondary hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-ink-primary"
            )}
          >
            <span className="flex items-center gap-2">
              <Folder className="w-4 h-4 opacity-70" />
              All Categories
            </span>
            <span className="text-xs bg-zinc-200 dark:bg-zinc-700/80 px-2 py-0.5 rounded-full text-ink-secondary">
              {questions.length}
            </span>
          </button>
          {categories.map((cat) => {
            const count = questions.filter(q => q.category_id === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all text-left",
                  selectedCategoryId === cat.id
                    ? "bg-zinc-100 dark:bg-zinc-800 text-ink-primary font-semibold"
                    : "text-ink-secondary hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-ink-primary"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <Folder className="w-4 h-4 opacity-50 shrink-0" />
                  <span className="truncate">{cat.name}</span>
                </span>
                <span className="text-xs bg-zinc-200 dark:bg-zinc-700/80 px-2 py-0.5 rounded-full text-ink-secondary shrink-0">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tags Section */}
        <div className="flex flex-col gap-1 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
          <h3 className="text-xs font-bold text-ink-secondary px-2 mb-2 uppercase tracking-wider">
            Tags
          </h3>
          <button
            onClick={() => setSelectedTagId(null)}
            className={cn(
              "flex items-center justify-between px-3 py-1.5 rounded-xl text-sm font-medium transition-all text-left",
              selectedTagId === null
                ? "bg-zinc-100 dark:bg-zinc-800 text-ink-primary font-semibold"
                : "text-ink-secondary hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-ink-primary"
            )}
          >
            <span className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 opacity-70" />
              All Tags
            </span>
          </button>
          {tags.map((tag) => {
            const count = questions.filter(q => q.tags?.some(t => t.id === tag.id)).length;
            return (
              <button
                key={tag.id}
                onClick={() => setSelectedTagId(tag.id)}
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 rounded-xl text-sm font-medium transition-all text-left",
                  selectedTagId === tag.id
                    ? "bg-zinc-100 dark:bg-zinc-800 text-ink-primary font-semibold"
                    : "text-ink-secondary hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-ink-primary"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <Tag className="w-3.5 h-3.5 opacity-50 shrink-0" />
                  <span className="truncate">{tag.name}</span>
                </span>
                <span className="text-xs bg-zinc-200 dark:bg-zinc-700/80 px-2 py-0.5 rounded-full text-ink-secondary shrink-0">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Questions List (Full Width) */}
      <div className="flex-1 bg-panel border border-zinc-100 dark:border-zinc-800/60 rounded-xl flex flex-col overflow-hidden">
        {/* Header Tools */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800/60 gap-4 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 bg-panel dark:bg-zinc-955 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-750 text-ink-primary"
            />
          </div>
          <button 
            onClick={handleOpenAddQuestion}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>

        {/* List Header */}
        <div className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,3.5fr)_minmax(0,0.8fr)] text-[11px] font-bold text-ink-secondary uppercase tracking-wider px-4 py-3 shrink-0 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/20 dark:bg-zinc-900/10">
          <div className="px-2">Question</div>
          <div className="px-2">Category</div>
          <div className="px-2">Frequency</div>
          <div className="px-2">Importance</div>
          <div className="px-2">User Answer</div>
          <div className="px-2 text-right">Actions</div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-ink-secondary">Loading questions...</div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-ink-secondary mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-ink-primary mb-1">No questions found</h3>
              <p className="text-sm text-ink-secondary max-w-sm">
                {search ? 'Try adjusting your search criteria.' : 'Add your first interview question to get started.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredQuestions.map((q) => (
                <div 
                  key={q.id} 
                  className="grid grid-cols-[minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,3.5fr)_minmax(0,0.8fr)] items-center px-4 py-3 hover:bg-zinc-50/30 dark:hover:bg-zinc-900/20 transition-colors group"
                >
                  {/* Title & Tags Column */}
                  <div className="pr-4 flex flex-col gap-1">
                    <input
                      type="text"
                      value={q.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, title: val } : item));
                      }}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== q.title) {
                          void handleInlineUpdate(q.id, { title: e.target.value.trim() });
                        }
                      }}
                      className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-800 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-zinc-950 text-sm text-ink-primary font-medium focus:outline-none"
                    />
                    {q.tags && q.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5 px-2">
                        {q.tags.map(t => (
                          <span key={t.id} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-ink-secondary px-1.5 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-700/50">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category Column */}
                  <div className="pr-4">
                    <select
                      value={q.category_id || ''}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        void handleInlineUpdate(q.id, { category_id: val });
                      }}
                      className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-800 dark:focus:border-zinc-700 text-sm text-ink-secondary focus:outline-none cursor-pointer"
                    >
                      <option value="" className="bg-panel text-ink-primary">Unclassified</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id} className="bg-panel text-ink-primary">
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Frequency Column */}
                  <div className="pr-4">
                    <select
                      value={q.frequency || 'Medium'}
                      onChange={(e) => {
                        const val = e.target.value;
                        void handleInlineUpdate(q.id, { frequency: val });
                      }}
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-semibold border border-transparent hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-800 dark:focus:border-zinc-700 focus:outline-none cursor-pointer bg-transparent",
                        (q.frequency === 'Low' || q.frequency === 'Easy') && "text-green-600 dark:text-green-400",
                        (q.frequency === 'Medium' || !q.frequency) && "text-amber-600 dark:text-amber-400",
                        (q.frequency === 'High' || q.frequency === 'Hard') && "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      <option value="Low" className="bg-panel text-ink-primary">低频</option>
                      <option value="Medium" className="bg-panel text-ink-primary">中频</option>
                      <option value="High" className="bg-panel text-ink-primary">高频</option>
                    </select>
                  </div>

                  {/* Importance Column */}
                  <div className="pr-4 flex gap-0.5 items-center">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const score = q.importance_score || 3;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const newScore = i + 1;
                            void handleInlineUpdate(q.id, { importance_score: newScore });
                          }}
                          className="focus:outline-none"
                        >
                          <Star
                            className={cn(
                              "w-3.5 h-3.5 transition-colors",
                              i < score ? "fill-amber-500 text-amber-500" : "text-zinc-300 dark:text-zinc-700 hover:text-amber-400"
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* User Answer Column */}
                  <div className="pr-4">
                    <textarea
                      value={q.my_answer || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, my_answer: val } : item));
                      }}
                      onBlur={(e) => {
                        const orig = questions.find(item => item.id === q.id);
                        if (orig && e.target.value !== (orig.my_answer || '')) {
                          void handleInlineUpdate(q.id, { my_answer: e.target.value });
                        }
                      }}
                      placeholder="Write your answer..."
                      rows={1}
                      className="w-full bg-transparent px-2 py-1 rounded border border-transparent hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-800 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-zinc-955 text-xs text-ink-secondary focus:outline-none resize-none leading-relaxed transition-all focus:h-20 custom-scrollbar-primary"
                    />
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center justify-end gap-1 px-2">
                    <button
                      onClick={() => handleOpenEditQuestion(q)}
                      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg text-ink-secondary hover:text-ink-primary transition-colors"
                      title="Edit Details"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-red-600 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
