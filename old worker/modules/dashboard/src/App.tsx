/** @format */

import { useState, useEffect } from 'react';
import UserInfo from './components/UserInfo';
import QuestionCache from './components/QuestionCache';
import ApplicationHistory from './components/ApplicationHistory';
import './styles/app.css';

// Type definitions
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

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'personals' | 'questions' | 'history'
  >('personals');

  // Data states
  const [personals, setPersonals] = useState<Record<string, any>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [history, setHistory] = useState<ApplicationHistoryItem[]>([]);

  // Toast notification state
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Load data from global window object
  const [status, setStatus] = useState<string>('Ready');

  useEffect(() => {
    const interval = setInterval(() => {
      const w = window as any;
      const currentStatus = w.botStatus || 'Ready';
      const lastTime = w.botStatusTime || 0;
      // If status hasn't been updated for 2 minutes, show Ready
      if (Date.now() - lastTime > 120000 && currentStatus !== 'Ready') {
        setStatus('Ready');
      } else {
        setStatus(currentStatus);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const w = window as any;
      setPersonals({ ...(w.botPersonalsData || {}) });

      const qData = w.botQuestionCacheData || {};
      setQuestions([...(qData.questions || [])]);

      setHistory([...(w.botAppHistoryData || [])]);
    }
  }, [isOpen]);

  const getStatusClass = (statusText: string) => {
    const s = statusText.toLowerCase();
    if (
      s.includes('wait') ||
      s.includes('sleep') ||
      s.includes('pause') ||
      s.includes('delay')
    )
      return 'waiting';
    if (
      s.includes('fail') ||
      s.includes('error') ||
      s.includes('blacklist') ||
      s.includes('skip') ||
      s.includes('stuck')
    )
      return 'failed';
    if (
      s.includes('success') ||
      s.includes('submitted') ||
      s.includes('applied') ||
      s.includes('done')
    )
      return 'success';
    return 'active';
  };

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const handleSave = () => {
    const w = window as any;

    // Save to window variables to preserve state in JS
    w.botPersonalsData = personals;
    w.botQuestionCacheData = {
      version: w.botQuestionCacheData?.version || 1,
      questions: questions,
    };
    w.botAppHistoryData = history;

    // Dispatch save request to Python backend
    w.botSaveRequest = {
      batch: true,
      personals: personals,
      questions: {
        version: w.botQuestionCacheData?.version || 1,
        questions: questions,
      },
      applications: history,
    };

    setIsOpen(false);
    triggerToast('Changes saved! Synced to Python bot.');
  };

  const handleCancel = () => {
    setIsOpen(false);
    triggerToast('Changes discarded.');
  };

  // Modify states handlers
  const handlePersonalChange = (key: string, value: any) => {
    setPersonals((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpdateQuestionAnswer = (id: string, newAnswer: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, answer: newAnswer } : q)),
    );
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleDeleteHistory = (index: number) => {
    setHistory((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className='bot-dashboard-scope'>
      {/* Floating Action Button */}
      <button
        className='bot-fab'
        onClick={() => setIsOpen(true)}
        title='Job Bot Dashboard'
      >
        <svg viewBox='0 0 24 24'>
          <rect x='3' y='3' width='7' height='9' rx='1' />
          <rect x='14' y='3' width='7' height='5' rx='1' />
          <rect x='14' y='12' width='7' height='9' rx='1' />
          <rect x='3' y='16' width='7' height='5' rx='1' />
        </svg>
      </button>

      {/* Floating Status Dialog Card */}
      {status && (
        <div className={`bot-status-dialog ${getStatusClass(status)}`}>
          <div className='bot-status-dialog-header'>
            <div className='bot-status-dialog-title-group'>
              <span
                className={`bot-status-dot ${getStatusClass(status)}`}
              ></span>
              <span className='bot-status-dialog-title'>
                LinkedIn Bot Status
              </span>
            </div>
            <span className='bot-status-dialog-badge'>
              {getStatusClass(status).toUpperCase()}
            </span>
          </div>
          <div className='bot-status-dialog-body'>
            <p className='bot-status-dialog-msg' title={status}>
              {status}
            </p>
          </div>
        </div>
      )}

      {/* Main Overlay Panel */}
      {isOpen && (
        <div className='bot-overlay'>
          <div className='bot-panel'>
            <div className='bot-header'>
              <div className='bot-title-group'>
                <svg
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  stroke-width='2'
                >
                  <circle cx='12' cy='12' r='10' />
                  <path d='M12 16v-4M12 8h.01' />
                </svg>
                <h2 className='bot-title'>Auto Job Applier Dashboard</h2>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginLeft: '16px',
                    padding: '4px 12px',
                    background: '#e8f0fe',
                    borderRadius: '16px',
                    fontSize: '12px',
                    color: '#1a73e8',
                    fontWeight: 500,
                  }}
                >
                  <span
                    className={`bot-status-dot ${getStatusClass(status)}`}
                    style={{ width: '8px', height: '8px' }}
                  ></span>
                  <span>{status}</span>
                </div>
              </div>
              <button
                className='bot-close-btn'
                onClick={handleCancel}
                title='Minimize'
              >
                <svg
                  width='20'
                  height='20'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  stroke-width='2'
                >
                  <line x1='18' y1='6' x2='6' y2='18' />
                  <line x1='6' y1='6' x2='18' y2='18' />
                </svg>
              </button>
            </div>

            <div className='bot-tabs'>
              <div
                className={`bot-tab ${activeTab === 'personals' ? 'active' : ''}`}
                onClick={() => setActiveTab('personals')}
              >
                User Information
              </div>
              <div
                className={`bot-tab ${activeTab === 'questions' ? 'active' : ''}`}
                onClick={() => setActiveTab('questions')}
              >
                Question Cache
              </div>
              <div
                className={`bot-tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                Application History
              </div>
            </div>

            <div className='bot-content-area'>
              {activeTab === 'personals' && (
                <UserInfo data={personals} onChange={handlePersonalChange} />
              )}
              {activeTab === 'questions' && (
                <QuestionCache
                  questions={questions}
                  onUpdateAnswer={handleUpdateQuestionAnswer}
                  onDeleteQuestion={handleDeleteQuestion}
                />
              )}
              {activeTab === 'history' && (
                <ApplicationHistory
                  history={history}
                  onDelete={handleDeleteHistory}
                />
              )}
            </div>

            <div className='bot-footer'>
              <button
                className='bot-btn bot-btn-secondary'
                onClick={handleCancel}
              >
                Discard Changes
              </button>
              <button className='bot-btn bot-btn-primary' onClick={handleSave}>
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert Notification */}
      <div className={`bot-toast ${showToast ? 'show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
