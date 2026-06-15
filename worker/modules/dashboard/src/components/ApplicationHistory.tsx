import { useState } from 'react';

interface ApplicationHistoryItem {
  job_id: string;
  title: string;
  company: string;
  status: string;
  application_type: string;
  logged_at?: string;
  error?: string;
  external_application_link?: string;
  job_link?: string;
}

interface ApplicationHistoryProps {
  history: ApplicationHistoryItem[];
  onDelete: (index: number) => void;
}

export default function ApplicationHistory({ history, onDelete }: ApplicationHistoryProps) {
  const [search, setSearch] = useState('');

  const filtered = history.filter(app => {
    const term = search.toLowerCase();
    const titleMatch = (app.title || '').toLowerCase().includes(term);
    const compMatch = (app.company || '').toLowerCase().includes(term);
    const errMatch = (app.error || '').toLowerCase().includes(term);
    return titleMatch || compMatch || errMatch;
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
          placeholder="Search applications by title or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="bot-list-container">
        <table className="bot-table">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Job Details</th>
              <th style={{ width: '20%' }}>Company</th>
              <th style={{ width: '15%' }}>Type & Status</th>
              <th style={{ width: '25%' }}>Log Details / Error</th>
              <th style={{ width: '10%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#5f6368', padding: '20px' }}>
                  No applications found matching your search.
                </td>
              </tr>
            ) : (
              filtered.map((app, index) => {
                const dateStr = app.logged_at ? app.logged_at.replace('T', ' ') : 'N/A';
                const statusClass = app.status === 'submitted' ? 'bot-badge-submitted' : 'bot-badge-failed';
                const typeClass = app.application_type === 'easy_apply' ? 'bot-badge-easy' : 'bot-badge-external';

                return (
                  <tr key={`${app.job_id}-${index}`}>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        <a
                          href={app.job_link || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#1a73e8', textDecoration: 'none' }}
                        >
                          {app.title}
                        </a>
                      </div>
                      <div style={{ fontSize: '11px', color: '#5f6368', marginTop: '4px' }}>
                        Applied: {dateStr}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{app.company}</span>
                    </td>
                    <td>
                      <span className={`bot-badge ${typeClass}`} style={{ marginRight: '4px' }}>
                        {app.application_type}
                      </span>
                      <span className={`bot-badge ${statusClass}`}>{app.status}</span>
                    </td>
                    <td>
                      <div
                        style={{
                          maxHeight: '50px',
                          overflowY: 'auto',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: '#555',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {app.error || app.external_application_link || 'Successfully processed'}
                      </div>
                    </td>
                    <td>
                      <button
                        className="bot-btn bot-btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '11px', borderColor: '#ea4335', color: '#ea4335' }}
                        onClick={() => onDelete(history.indexOf(app))}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
