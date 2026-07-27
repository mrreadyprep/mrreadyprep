import { useState, useEffect, useRef, useCallback } from 'react';
import './EmailWriting.css';

const EmailWriting = ({ questionData, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(420);
  const [emailBody, setEmailBody] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [showWordCount, setShowWordCount] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [showExample, setShowExample] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const calculateWordCount = (text) => {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  const handleTextChange = (e) => {
    const newText = e.target.value;
    setEmailBody(newText);
    setWordCount(calculateWordCount(newText));
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newText);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setEmailBody(history[newIndex]);
      setWordCount(calculateWordCount(history[newIndex]));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setEmailBody(history[newIndex]);
      setWordCount(calculateWordCount(history[newIndex]));
    }
  };

  const handleCut = () => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = emailBody.substring(start, end);
    navigator.clipboard.writeText(selectedText);
    const newText = emailBody.substring(0, start) + emailBody.substring(end);
    setEmailBody(newText);
    setWordCount(calculateWordCount(newText));
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = emailBody.substring(0, start) + text + emailBody.substring(end);
      setEmailBody(newText);
      setWordCount(calculateWordCount(newText));
    } catch (err) {
      console.error('Paste failed:', err);
    }
  };

  const calculateAutoScore = (text, count) => {
    let points = 0;
    const lower = text.toLowerCase();
    if (count >= 100) points += 1.5;
    else if (count >= 80) points += 1.0;
    else if (count >= 60) points += 0.5;
    const hasGreeting = /dear|hello|hi|to whom|sayın|merhaba/.test(lower);
    const hasClosing = /sincerely|regards|thanks|yours|saygılarımla|teşekkürler/.test(lower);
    const hasBody = count > 40;
    if (hasGreeting && hasClosing && hasBody) points += 1.5;
    else if ((hasGreeting || hasClosing) && hasBody) points += 1.0;
    else if (hasBody) points += 0.5;
    const taskChecks = questionData?.tasks || [];
    let taskScore = 0;
    taskChecks.forEach(task => {
      const keywords = task.keywords || [];
      const matched = keywords.some(kw => lower.includes(kw.toLowerCase()));
      if (matched) taskScore += 2 / taskChecks.length;
    });
    points += taskScore;
    return Math.min(5, Math.round(points * 10) / 10);
  };

  const handleSubmit = useCallback(async () => {
    if (isSubmitted) return;
    clearInterval(timerRef.current);
    setIsSubmitted(true);
    try {
      const response = await fetch('http://localhost:8000/api/writing/email/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: questionData.id,
          response: emailBody,
          word_count: wordCount,
          time_spent: 420 - timeLeft
        })
      });
      const data = await response.json();
      setScore(data.score);
    } catch (err) {
      console.error('Submit error:', err);
      const autoScore = calculateAutoScore(emailBody, wordCount);
      setScore(autoScore);
    }
  }, [emailBody, wordCount, timeLeft, isSubmitted, questionData]);

  const handleDownload = () => {
    const blob = new Blob([emailBody], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email_response_${questionData?.id || 'unknown'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timerPercentage = (timeLeft / 420) * 100;
  const timerColor = timeLeft > 120 ? '#22c55e' : timeLeft > 60 ? '#eab308' : '#ef4444';

  if (!questionData) return <div>Yukleniyor...</div>;

  return (
    <div className="email-writing-container">
      <div className="email-header">
        <div className="email-title">
          <span className="email-icon">✉️</span>
          <span>TOEFL Writing - Email</span>
        </div>
        <div className="email-meta">
          <span className="meta-badge">⏱️ Sure: {formatTime(timeLeft)}</span>
          <span className="meta-badge">📝 Min. 80 kelime</span>
          <span className="meta-badge">📊 Puan: 0-5</span>
        </div>
      </div>

      <div className="timer-bar-container">
        <div className="timer-bar" style={{ width: `${timerPercentage}%`, background: timerColor }} />
      </div>

      <div className="email-content">
        <div className="scenario-column">
          <div className="scenario-card">
            <div className="scenario-header">
              <span>📋</span>
              <span>Senaryo</span>
            </div>
            <p className="scenario-text">{questionData.scenario}</p>
            <div className="tasks-section">
              <p className="tasks-intro">{questionData.task_intro}</p>
              <ul className="tasks-list">
                {questionData.tasks?.map((task, idx) => (
                  <li key={idx}>{task.description}</li>
                ))}
              </ul>
            </div>
            <p className="write-instruction">Write as much as you can and in complete sentences.</p>
          </div>
        </div>

        <div className="response-column">
          <div className="response-header">Your Response:</div>
          <div className="email-fields">
            <div className="email-field">
              <span className="field-label">To:</span>
              <span className="field-value">{questionData.recipient}</span>
            </div>
            <div className="email-field">
              <span className="field-label">Subject:</span>
              <span className="field-value">{questionData.subject}</span>
            </div>
          </div>

          <div className="toolbar">
            <button onClick={handleCut} className="toolbar-btn">Cut</button>
            <button onClick={handlePaste} className="toolbar-btn">Paste</button>
            <button onClick={handleUndo} className="toolbar-btn">Undo</button>
            <button onClick={handleRedo} className="toolbar-btn">Redo</button>
            <button onClick={() => setShowWordCount(!showWordCount)} className="toolbar-btn word-count-toggle">
              {showWordCount ? '🙈 Hide' : '👁️ Show'} Word Count
            </button>
            {showWordCount && <span className="word-count-display">{wordCount}</span>}
          </div>

          <textarea
            ref={textareaRef}
            className="email-textarea"
            value={emailBody}
            onChange={handleTextChange}
            placeholder={`Dear ${questionData.recipient?.split(' ')[0] || 'Sir/Madam'},\n\n[E-postanizi buraya yazin...]\n\nSincerely,\n[Adiniz]`}
            disabled={isSubmitted}
          />

          <div className="response-actions">
            <button onClick={handleDownload} className="download-btn">
              Download response ⬇️
            </button>
            {!isSubmitted && (
              <button onClick={handleSubmit} className="submit-btn">
                Gonder ve Puanla
              </button>
            )}
          </div>

          {score !== null && (
            <div className="score-display">
              {score} / 5 Points
            </div>
          )}
        </div>
      </div>

      <div className="example-section">
        <button onClick={() => setShowExample(!showExample)} className="example-toggle">
          {showExample ? '▲' : '▼'} Example Response
        </button>
        {showExample && (
          <div className="example-content">
            <pre>{questionData.example_response}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailWriting;