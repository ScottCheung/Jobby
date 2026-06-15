import { useState } from 'react';

interface Question {
  id: string;
  label: string;
  normalized_label: string;
  field_type: string;
  options: string[] | null;
  answer: string;
  source: string;
  times_used: number;
  last_used: string;
  companies: string[];
}

interface QuestionCacheProps {
  questions: Question[];
  onUpdateAnswer: (id: string, newAnswer: string) => void;
  onDeleteQuestion: (id: string) => void;
}

export default function QuestionCache({ questions, onUpdateAnswer, onDeleteQuestion }: QuestionCacheProps) {
  const [search, setSearch] = useState('');

  const filtered = questions.filter(q => {
    const term = search.toLowerCase();
    const labelMatch = (q.label || '').toLowerCase().includes(term);
    const ansMatch = (q.answer || '').toLowerCase().includes(term);
    const compMatch = (q.companies || []).some(c => c.toLowerCase().includes(term));
    return labelMatch || ansMatch || compMatch;
  });

  return (
    <>
      <div className="bot-search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search questions by text or company name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="bot-list-container">
        <table className="bot-table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>Question Label</th>
              <th style={{ width: '15%' }}>Type</th>
              <th style={{ width: '30%' }}>Saved Answer</th>
              <th style={{ width: '10%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#5f6368', padding: '20px' }}>
                  No questions found matching your search.
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr key={q.id}>
                  <td>
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>{q.label}</div>
                    <div style={{ fontSize: '11px', color: '#5f6368' }}>
                      Companies: {(q.companies || []).join(', ') || 'N/A'}
                    </div>
                  </td>
                  <td>
                    <span className="bot-badge bot-badge-easy">{q.field_type}</span>
                  </td>
                  <td>
                    {q.options && q.options.length > 0 ? (
                      <select
                        className="bot-editable-input"
                        style={{ border: '1px solid #dadce0' }}
                        value={q.answer}
                        onChange={(e) => onUpdateAnswer(q.id, e.target.value)}
                      >
                        {q.options.map((opt) => (
                          <option value={opt} key={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="bot-editable-input"
                        value={q.answer || ''}
                        onChange={(e) => onUpdateAnswer(q.id, e.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    <button
                      className="bot-btn bot-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '11px', borderColor: '#ea4335', color: '#ea4335' }}
                      onClick={() => onDeleteQuestion(q.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
