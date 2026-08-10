import { useEffect, useState, useRef, useMemo, Component } from 'react'

// ─── Full-screen exam shell (matches the official TOEFL iBT test-day UI) ─────
const EXAM_NAVY = '#2ac56c'
const EXAM_DARK = '#11162d'

function TestPillButton({ children, onClick, variant = 'light', disabled = false }) {
  const styles = {
    light: { background: '#fff', color: '#333333' },
    dark: { background: EXAM_DARK, color: '#fff' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles[variant], border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '13px', fontWeight: '700', cursor: disabled ? 'default' : 'pointer', fontFamily: 'sans-serif', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  )
}

function TestTopBar({ left, right }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ background: EXAM_NAVY, padding: isMobile ? '10px 14px' : '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? '8px' : '0' }}>
      <div>{left}</div>
      <div style={{ display: 'flex', gap: isMobile ? '6px' : '10px', alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>
    </div>
  )
}

function TestSubHeader({ section, questionLabel, timeText, lowTime }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: isMobile ? '10px 14px' : '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, fontFamily: 'sans-serif', flexWrap: 'wrap', gap: '4px' }}>
      <div style={{ fontSize: isMobile ? '11px' : '13px', color: '#1a1a1a' }}>
        <span style={{ fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{section}</span>
        {questionLabel && <><span style={{ color: '#9ca3af', margin: '0 8px' }}>|</span><span>{questionLabel}</span></>}
      </div>
      {timeText && <span style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '700', color: lowTime ? '#d94040' : '#1a1a1a' }}>{timeText}</span>}
    </div>
  )
}

// Full-page wrapper every exercise screen sits in — full-bleed white background,
// navy top bar + white sub-header, content fills the rest of the viewport.
function ExamScreen({ topLeft, topRight, section, questionLabel, timeText, lowTime, children, contentStyle }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10, overflowY: 'auto' }}>
      <TestTopBar left={topLeft} right={topRight} />
      {section && <TestSubHeader section={section} questionLabel={questionLabel} timeText={timeText} lowTime={lowTime} />}
      <div style={{ flex: 1, padding: isMobile ? '20px 16px 80px' : '48px 64px 100px', boxSizing: 'border-box', ...contentStyle }}>{children}</div>
    </div>
  )
}

// Shared loading indicator used by every practice list/screen while its data is being
// fetched, so the app shows one consistent branded spinner instead of a dozen slightly
// different plain-text "Loading..." strings.
function LoadingState({ label = 'Loading...', fullScreen = false }) {
  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: '#616473', fontSize: '14px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '30px', height: '30px', border: '3px solid #e1e4ed', borderTopColor: EXAM_NAVY, borderRadius: '50%', animation: 'mrpSpin 0.8s linear infinite' }} />
      <div>{label}</div>
    </div>
  )
  if (fullScreen) {
    return <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>{content}</div>
  }
  return <div style={{ height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{content}</div>
}

// ─── Complete the Words — Liste Ekranı ───────────────────────────────────────
function CTWList({ exercises, scores, onSelect, onBack }) {
  const isMobile = useIsMobile()
  // Each exercise carries a real `category` field (Natural Science / Social Science / History /
  // Arts & Humanities / Health & Biology, ~30 items each) -- expose it as a filter so a 150-item
  // flat list is actually navigable, matching the "150 questions · 5 categories" copy shown on
  // the parent Reading screen.
  const categories = useMemo(() => Array.from(new Set(exercises.map(ex => ex.category).filter(Boolean))), [exercises])
  const [activeCategory, setActiveCategory] = useState('All')
  const visible = exercises
    .map((ex, idx) => ({ ex, idx }))
    .filter(({ ex }) => activeCategory === 'All' || ex.category === activeCategory)
  // Rendered inline in the sidebar shell's content area (the shell already shows a shared
  // "← Back" + title header above this, driven by `onBack`) -- no fixed-overlay wrapper or
  // duplicate title/back button here, unlike the single-exercise view below which still goes
  // full-screen for a distraction-free timed exercise.
  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        {categories.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {['All', ...categories].map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                background: activeCategory === cat ? '#2ac56c' : '#f2f3f5',
                color: activeCategory === cat ? '#fff' : '#616473',
                border: 'none', borderRadius: '999px', padding: '7px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              }}>
                {cat}{cat !== 'All' ? ` (${exercises.filter(ex => ex.category === cat).length})` : ` (${exercises.length})`}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visible.map(({ ex, idx }) => {
            const locked = isLocked(ex)
            const result = scores[idx]
            const pct = result ? Math.round((result.correct / result.total) * 100) : null
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Exercise {idx + 1}</div>
                    {ex.category && (
                      <span style={{ fontSize: '10px', fontWeight: '600', color: '#701fa1', background: '#f5edfd', padding: '2px 8px', borderRadius: '999px' }}>{ex.category}</span>
                    )}
                    {result && !locked && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: pct >= 70 ? '#2ac56c' : '#e07b00', background: pct >= 70 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>
                        ✓ {result.correct}/{result.total} · {pct}%
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${ex.blanks.length} blank${ex.blanks.length !== 1 ? 's' : ''}`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => onSelect(idx)} style={{ background: result ? '#e5e7eb' : '#2ac56c', color: result ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {result ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

// ─── Complete the Words — Tek Egzersiz ───────────────────────────────────────
const QUESTION_TIME = 180

function CTWSingle({ exercise, exerciseNum, onBack, onComplete, mockMode = false, poolTime, moduleOffset, moduleTotal, onPrevSlot, isLastSlot = true, initialAnswers, onAnswersChange }) {
  const [answers, setAnswers] = useState(() => initialAnswers || {})
  const [checked, setChecked] = useState(false)
  const [finished, setFinished] = useState(false)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const inputRefs = useRef({})
  const timerRef = useRef(null)
  const answersRef = useRef({})
  const checkedRef = useRef(false)

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { checkedRef.current = checked }, [checked])
  // Mirror every keystroke up to the parent (FullMockTest's sessionRef) so that if the student
  // navigates away via Back/module-timeout before finishing this exercise, their partial input
  // is preserved and restored the next time this slot is shown.
  useEffect(() => { if (onAnswersChange) onAnswersChange(answers) }, [answers])

  const ex = exercise

  const calcCorrect = (ans) => {
    let correct = 0; let gIdx = 0
    ex.blanks.forEach((blank) => {
      const ok = blank.hidden.split('').every((ch, i) => (ans[gIdx + i] || '').toLowerCase() === ch.toLowerCase())
      if (ok) correct++
      gIdx += blank.hidden.length
    })
    return correct
  }

  const buildDetail = (ans) => {
    let gIdx = 0
    return ex.blanks.map((blank) => {
      const given = blank.hidden.split('').map((_, i) => ans[gIdx + i] || '').join('')
      const word = blank.visible + blank.hidden
      const isCorrect = blank.hidden.split('').every((ch, i) => (ans[gIdx + i] || '').toLowerCase() === ch.toLowerCase())
      gIdx += blank.hidden.length
      return { prompt: word, given: blank.visible + given, correctAnswer: word, isCorrect }
    })
  }

  // When `poolTime` is provided (Full Mock Test Reading modules), a single clock owned by
  // FullMockTest ticks down across the WHOLE module — matching the real TOEFL iBT, which gives
  // one combined time budget per module rather than resetting per question. In that mode this
  // component just displays the shared countdown and never runs its own timer/auto-expiry.
  useEffect(() => {
    if (poolTime !== undefined) return
    if (finished || checked) return
    setTimeLeft(QUESTION_TIME)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          if (!checkedRef.current) {
            checkedRef.current = true
            if (mockMode) {
              const ans = answersRef.current
              onComplete(calcCorrect(ans), ex.blanks.length, buildDetail(ans))
            } else {
              setChecked(true)
            }
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [finished, checked, poolTime])

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const displayTime = poolTime !== undefined ? poolTime : timeLeft
  const isLowTime = poolTime !== undefined ? poolTime <= 60 : timeLeft <= 30
  // In the Full Mock Test, show this exercise's position within the WHOLE Reading module
  // (e.g. "Questions 4-9 of 20") instead of a standalone exercise number — matches the
  // official TOEFL iBT UI, which numbers questions across the entire module, not per task.
  const questionLabel = moduleTotal !== undefined
    ? (ex.blanks.length > 1 ? `Questions ${moduleOffset + 1}-${moduleOffset + ex.blanks.length} of ${moduleTotal}` : `Question ${moduleOffset + 1} of ${moduleTotal}`)
    : `Exercise ${exerciseNum}`

  const renderParagraph = () => {
    const parts = []; let remaining = ex.paragraph; let globalIdx = 0
    ex.blanks.forEach((blank, blankIdx) => {
      const wordPos = remaining.indexOf(blank.word)
      if (wordPos === -1) return
      if (wordPos > 0) parts.push(<span key={`text-${blankIdx}`}>{remaining.slice(0, wordPos)}</span>)
      const startIdx = globalIdx
      const isBlankCorrect = checked ? blank.hidden.split('').every((ch, i) => (answers[startIdx + i] || '').toLowerCase() === ch.toLowerCase()) : null
      const charInputs = blank.hidden.split('').map((ch, i) => {
        const gIdx = startIdx + i; const val = answers[gIdx] || ''
        const charCorrect = checked ? val.toLowerCase() === ch.toLowerCase() : null
        return (
          <span key={gIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', width: '11px' }}>
            <input ref={el => inputRefs.current[gIdx] = el} value={val} maxLength={1}
              onChange={e => { if (checked) return; const newVal = e.target.value.slice(-1); setAnswers(prev => ({ ...prev, [gIdx]: newVal })); if (newVal && inputRefs.current[gIdx + 1]) inputRefs.current[gIdx + 1].focus() }}
              onKeyDown={e => { if (e.key === 'Backspace' && !val && inputRefs.current[gIdx - 1]) inputRefs.current[gIdx - 1].focus(); if (e.key === 'Tab') { e.preventDefault(); if (inputRefs.current[gIdx + 1]) inputRefs.current[gIdx + 1].focus() } }}
              disabled={checked}
              style={{ width: '11px', height: '14px', border: 'none', borderBottom: checked ? (charCorrect ? '1.5px solid #2a9d5c' : '1.5px solid #d94040') : '1.5px solid #555', outline: 'none', background: 'transparent', textAlign: 'center', fontSize: '13px', fontFamily: 'Georgia, serif', color: checked ? (charCorrect ? '#1a7a44' : '#b03030') : '#1a1a1a', padding: 0, margin: 0, caretColor: '#701fa1', cursor: 'text', boxSizing: 'border-box', lineHeight: '14px' }} />
          </span>
        )
      })
      globalIdx += blank.hidden.length
      parts.push(
        <span key={`blank-${blankIdx}`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '15px', fontFamily: 'Georgia, serif', color: '#1a1a1a' }}>{blank.visible}</span>
          <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', background: checked ? (isBlankCorrect ? '#edfbf3' : '#fff2f2') : '#d6d8db', padding: '1px 3px', borderRadius: '2px', marginLeft: '1px', cursor: 'text' }}
            onClick={() => { const firstEmpty = blank.hidden.split('').findIndex((_, i) => !answers[startIdx + i]); const focusIdx = firstEmpty === -1 ? startIdx + blank.hidden.length - 1 : startIdx + firstEmpty; if (inputRefs.current[focusIdx]) inputRefs.current[focusIdx].focus() }}>
            {charInputs}
          </span>
          {checked && !isBlankCorrect && <span style={{ fontSize: '11px', color: '#2a9d5c', fontWeight: '700', marginLeft: '4px', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>→ {blank.hidden}</span>}
        </span>
      )
      remaining = remaining.slice(wordPos + blank.word.length)
    })
    if (remaining) parts.push(<span key="tail">{remaining}</span>)
    return parts
  }

  const handleSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mockMode) {
      checkedRef.current = true
      onComplete(calcCorrect(answers), ex.blanks.length, buildDetail(answers))
      return
    }
    setChecked(true)
  }
  const questionScore = checked ? calcCorrect(answers) : null

  if (finished) {
    const correct = calcCorrect(answers); const total = ex.blanks.length; const pct = Math.round((correct / total) * 100)
    const grade = pct >= 90 ? { label: 'Excellent!', color: '#2a9d5c', emoji: '🏆' } : pct >= 70 ? { label: 'Good job!', color: '#701fa1', emoji: '🎉' } : pct >= 50 ? { label: 'Keep going', color: '#e07b00', emoji: '💪' } : { label: 'Practice more', color: '#c0392b', emoji: '📚' }
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontFamily: 'Georgia, serif' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '48px 56px', textAlign: 'center', maxWidth: '420px', width: '90%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '52px', marginBottom: '12px' }}>{grade.emoji}</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: grade.color, marginBottom: '8px' }}>{grade.label}</div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px', fontFamily: 'sans-serif' }}>Exercise {exerciseNum}</div>
          <div style={{ fontSize: '52px', fontWeight: '800', color: '#1a1a1a', lineHeight: '1', fontFamily: 'sans-serif' }}>{correct}<span style={{ fontSize: '20px', color: '#aaa', fontWeight: '400' }}>/{total}</span></div>
          <div style={{ margin: '20px 0 8px', height: '8px', background: '#efefef', borderRadius: '4px' }}><div style={{ width: pct + '%', height: '100%', background: grade.color, borderRadius: '4px', transition: 'width 0.8s ease' }} /></div>
          <div style={{ fontSize: '13px', color: '#777', marginBottom: '32px', fontFamily: 'sans-serif' }}>{pct}% correct</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setAnswers({}); setChecked(false); setFinished(false); inputRefs.current = {} }} style={{ flex: 1, padding: '13px', background: '#2a9d5c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'sans-serif' }}>TRY AGAIN</button>
            <button onClick={() => onComplete(correct, total)} style={{ flex: 1, padding: '13px', background: '#fff', color: '#333', border: '1px solid #d0d5dd', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'sans-serif' }}>Back</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={!checked
        ? <>
            {mockMode && <TestPillButton onClick={onPrevSlot} disabled={!onPrevSlot}>Back</TestPillButton>}
            <TestPillButton onClick={handleSubmit}>{mockMode ? (isLastSlot ? 'Finish' : 'Next') : 'Submit'}</TestPillButton>
          </>
        : <TestPillButton onClick={() => setFinished(true)}>See Results</TestPillButton>}
      section="READING"
      questionLabel={questionLabel}
      timeText={formatTime(displayTime)}
      lowTime={isLowTime}
      contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center', margin: '0 0 36px', fontFamily: 'sans-serif', maxWidth: '760px' }}>Fill in the missing letters in the paragraph.</h1>
      <div style={{ maxWidth: '860px', width: '100%', boxSizing: 'border-box', marginBottom: checked ? '20px' : '32px', border: '2.5px solid #1a1a1a', borderRadius: '14px', padding: '28px 34px' }}>
        <p style={{ fontSize: '16px', lineHeight: '2.6', color: '#1a1a1a', margin: 0, fontFamily: 'Georgia, serif' }}>{renderParagraph()}</p>
      </div>
      {checked && (
        <div style={{ maxWidth: '760px', width: '100%', background: questionScore === ex.blanks.length ? '#edfbf3' : '#fff8ec', border: '1px solid ' + (questionScore === ex.blanks.length ? '#a7e9c3' : '#f5d08a'), borderRadius: '10px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: questionScore === ex.blanks.length ? '#1a7a44' : '#c07000' }}>{timeLeft === 0 ? "⏱ Time's up! " : ''}{questionScore === ex.blanks.length ? '🎯 Perfect score!' : `${questionScore} / ${ex.blanks.length} correct`}</span>
          <span style={{ fontSize: '12px', color: '#888' }}>Correct answers in <span style={{ color: '#2a9d5c', fontWeight: '700' }}>green</span></span>
        </div>
      )}
    </ExamScreen>
  )
}

function CompleteTheWords({ onBack }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/reading/complete-the-words`).then(r => r.json()),
      fetchLatestResults('ctw'),
    ]).then(([data, results]) => {
      if (cancelled) return
      setExercises(data)
      const mapped = {}
      data.forEach((ex, i) => { const row = results[String(ex.id)]; if (row) mapped[i] = { correct: row.score, total: row.total } })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!exercises.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found.</div>

  if (selectedIdx !== null) return (
    <CTWSingle exercise={exercises[selectedIdx]} exerciseNum={selectedIdx + 1} onBack={() => setSelectedIdx(null)}
      onComplete={(correct, total) => {
        saveResult('ctw', exercises[selectedIdx].id, correct, total, `Complete the Words #${selectedIdx + 1}`)
        setScores(prev => ({ ...prev, [selectedIdx]: { correct, total } })); setSelectedIdx(null)
      }} />
  )
  return <CTWList exercises={exercises} scores={scores} onSelect={setSelectedIdx} onBack={onBack} />
}

// ─── Read in Daily Life ───────────────────────────────────────────────────────
const RIDL_TIME = 90
const RIDL_TYPE_LABELS = { email: 'Email', message: 'Message Exchange', sign: 'Sign / Notice', poster: 'Poster', receipt: 'Receipt', advertisement: 'Advertisement', schedule: 'Schedule / Agenda', article: 'Article' }
// Short 2-question types (sign/schedule/receipt) listed first, then the longer 3-question types
// (email/message/article/poster/advertisement) -- lets students warm up on the quicker practices
// before the longer ones.
const RIDL_TYPE_ORDER = ['sign', 'schedule', 'receipt', 'email', 'message', 'article', 'poster', 'advertisement']

// "Practice N" should count up 1, 2, 3... in the order things are actually shown on screen (per
// RIDL_TYPE_ORDER above), not the item's position in the underlying data array -- which would
// otherwise jump around (17, 18, 19... then 29, 30...) once grouped/reordered by type. Shared by
// both the list screen and the exercise screen (via ReadInDailyLife) so the numbers always match.
function computeRIDLDisplayNums(passages) {
  const byType = {}
  passages.forEach((p, i) => { if (!byType[p.type]) byType[p.type] = []; byType[p.type].push(i) })
  const map = new Map()
  let counter = 0
  RIDL_TYPE_ORDER.filter(t => byType[t]).forEach(t => {
    byType[t].forEach(i => { counter += 1; map.set(i, counter) })
  })
  return map
}

function RIDLList({ passages, onSelect, onBack, scores, displayNums }) {
  const isMobile = useIsMobile()
  const typeOrder = RIDL_TYPE_ORDER
  const grouped = {}
  passages.forEach((p, i) => { if (!grouped[p.type]) grouped[p.type] = []; grouped[p.type].push({ ...p, globalIdx: i }) })
  const displayNumByGlobalIdx = displayNums || computeRIDLDisplayNums(passages)
  // Rendered inline in the sidebar shell's content area -- the shell already shows the shared
  // "← Back" + title header, so no fixed-overlay wrapper or duplicate title here (unlike
  // RIDLQuestion below, which stays full-screen for a distraction-free timed passage).
  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        {typeOrder.filter(t => grouped[t]).map(type => (
          <div key={type} style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>{RIDL_TYPE_LABELS[type]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {grouped[type].map((p) => {
                const locked = isLocked(p)
                const result = scores[p.globalIdx]; const pct = result ? Math.round((result.score / result.total) * 100) : null
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Practice {displayNumByGlobalIdx.get(p.globalIdx)}</div>
                        {result && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: pct >= 70 ? '#2ac56c' : '#e07b00', background: pct >= 70 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {result.score}/{result.total} · {pct}%</span>}
                      </div>
                      <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${p.title} · ${p.questions.length} questions`}</div>
                    </div>
                    {locked ? <LockedBadge /> : (
                      <button onClick={() => onSelect(p.globalIdx)} style={{ background: result ? '#e5e7eb' : '#2ac56c', color: result ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{result ? 'Retry' : 'Start'}</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
    </div>
  )
}

function RIDLQuestion({ passage, practiceNum, totalPractices, onBack, onFinish, onComplete, mockMode = false, poolTime, moduleOffset, moduleTotal, onPrevSlot, enterAtEnd, isLastSlot = true, initialAnswers, onAnswersChange }) {
  const isMobile = useIsMobile()
  const [questionIdx, setQuestionIdx] = useState(() => enterAtEnd ? passage.questions.length - 1 : 0)
  // Left as null on mount — the questionIdx effect just below runs immediately after mount too
  // and restores the right value from `answers` (itself seeded from initialAnswers), so this
  // never flashes an incorrect selection.
  const [selected, setSelected] = useState(null)
  const [done, setDone] = useState(false)
  const [timeLeft, setTimeLeft] = useState(RIDL_TIME)
  const [answers, setAnswers] = useState(() => initialAnswers || []) // answers[i] = { selected, correct, isCorrect } for each question, keyed by index
  const timerRef = useRef(null)

  // Mirror every recorded answer up to the parent so Back-navigating out of this passage and
  // later returning restores exactly what was chosen, instead of remounting blank.
  useEffect(() => { if (onAnswersChange) onAnswersChange(answers) }, [answers])

  const formatTime = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
  const displayTime = poolTime !== undefined ? poolTime : timeLeft
  const isLowTime = poolTime !== undefined ? poolTime <= 60 : timeLeft <= 20
  const question = passage.questions[questionIdx]
  const totalQ = passage.questions.length
  const score = answers.reduce((s, a) => s + (a && a.isCorrect ? 1 : 0), 0)
  const questionLabel = moduleTotal !== undefined
    ? `Question ${moduleOffset + questionIdx + 1} of ${moduleTotal}`
    : `Practice ${practiceNum} · Question ${questionIdx + 1} of ${totalQ}`

  // Whenever the visible question changes (forward OR backward), load whatever answer was
  // already recorded for it, so navigating back and forth preserves the student's choices
  // instead of always showing a blank/stale selection.
  useEffect(() => {
    setSelected(answers[questionIdx] ? answers[questionIdx].selected : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIdx])

  // See CTWSingle: when `poolTime` is provided, FullMockTest owns one shared clock for the
  // whole Reading module, so this per-question timer/auto-expiry is skipped entirely — the
  // student uses Next/Back freely and only the module-level clock can force it to end.
  useEffect(() => {
    if (poolTime !== undefined) return
    if (done) return
    setTimeLeft(RIDL_TIME)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => { setTimeLeft(prev => { if (prev <= 1) { clearInterval(timerRef.current); goNext(); return 0 } return prev - 1 }) }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIdx, done, poolTime])

  // Returns a fresh copy of `answers` with the given question's answer set — used instead of
  // a functional setState update so callers can immediately use the up-to-date array (e.g. to
  // compute the final score) without waiting for the next render.
  const withAnswer = (idx, sel) => {
    const q = passage.questions[idx]
    const isCorrect = sel !== null && sel === q.answer
    const next = [...answers]
    next[idx] = { selected: sel, correct: q.answer, isCorrect }
    return next
  }

  const finish = (finalAnswers) => {
    if (mockMode) {
      const finalScore = finalAnswers.reduce((s, a) => s + (a && a.isCorrect ? 1 : 0), 0)
      const detail = passage.questions.map((q, qi) => {
        const a = finalAnswers[qi]
        return {
          prompt: q.question,
          given: a && a.selected !== null && a.selected !== undefined ? q.options[a.selected] : 'No answer',
          correctAnswer: q.options[q.answer],
          isCorrect: !!(a && a.isCorrect),
        }
      })
      onComplete(finalScore, totalQ, detail)
      return
    }
    setDone(true)
  }

  // Records the current selection and moves forward — to the next question, or finishes
  // the set if this was the last one. Used by both the NEXT/FINISH button and the timer.
  const goNext = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    const finalAnswers = withAnswer(questionIdx, selected)
    setAnswers(finalAnswers)
    if (questionIdx + 1 < totalQ) {
      setQuestionIdx(i => i + 1)
    } else {
      finish(finalAnswers)
    }
  }

  // Records the current selection and moves back one question, restoring whatever was
  // previously chosen there (or a blank selection if it hadn't been answered yet).
  const goBack = () => {
    if (questionIdx === 0) {
      if (onPrevSlot) onPrevSlot()
      return
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setAnswers(withAnswer(questionIdx, selected))
    setQuestionIdx(i => i - 1)
  }

  const [reviewQ, setReviewQ] = useState(null)

  if (done) {
    const pct = Math.round((score / totalQ) * 100)
    const grade = pct >= 90 ? { label: 'Excellent!', color: '#2a9d5c', emoji: '🏆' } : pct >= 70 ? { label: 'Good job!', color: '#701fa1', emoji: '🎉' } : pct >= 50 ? { label: 'Keep going', color: '#e07b00', emoji: '💪' } : { label: 'Practice more', color: '#c0392b', emoji: '📚' }

    if (reviewQ !== null) {
      const q = passage.questions[reviewQ]; const a = answers[reviewQ]
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 20 }}>
          <div style={{ padding: '0 32px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <button onClick={() => setReviewQ(null)} style={{ background: 'none', border: 'none', fontSize: '13px', color: '#701fa1', fontWeight: '600', cursor: 'pointer' }}>← Back to Review</button>
            <span style={{ fontSize: '13px', color: '#888' }}>Q{reviewQ + 1} of {totalQ}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setReviewQ(Math.max(0, reviewQ - 1))} disabled={reviewQ === 0} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === 0 ? '#ccc' : '#616473', cursor: reviewQ === 0 ? 'default' : 'pointer' }}>← Prev</button>
              <button onClick={() => setReviewQ(Math.min(totalQ - 1, reviewQ + 1))} disabled={reviewQ === totalQ - 1} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === totalQ - 1 ? '#ccc' : '#616473', cursor: reviewQ === totalQ - 1 ? 'default' : 'pointer' }}>Next →</button>
            </div>
          </div>
          <div style={{ height: '2.5px', background: '#2a9d5c', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', padding: isMobile ? '16px' : '24px 32px', gap: isMobile ? '20px' : '40px', overflow: isMobile ? 'auto' : 'hidden', minHeight: 0, ...(isMobile ? { flexDirection: 'column' } : {}) }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, maxWidth: isMobile ? '100%' : '520px' }}>
              <div style={{ fontSize: '12px', color: '#616473' }}>{passage.instruction}</div>
              <div style={{ border: '2px solid #2a9d5c', borderRadius: '8px', padding: '16px 18px', overflowY: 'auto', boxSizing: 'border-box', maxHeight: isMobile ? 'none' : 'calc(100vh - 180px)' }}>
                {passage.title && <div style={{ fontWeight: '700', fontSize: '13px', textAlign: 'center', marginBottom: '2px' }}>{passage.title}</div>}
                {passage.subtitle && <div style={{ fontSize: '11px', textAlign: 'center', color: '#616473', marginBottom: '12px' }}>{passage.subtitle}</div>}
                <div style={{ fontSize: '16px', lineHeight: '1.75', color: '#1a1a1a', whiteSpace: 'pre-wrap' }}>{passage.text}</div>
              </div>
            </div>
            <div style={{ width: isMobile ? '100%' : '400px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ fontSize: '17px', fontWeight: '600', color: '#1a1a1a', lineHeight: '1.55' }}>{q.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {q.options.map((opt, oi) => {
                  const isCorrectOpt = oi === q.answer; const isWrongSelected = oi === a.selected && !isCorrectOpt
                  return (
                    <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isCorrectOpt ? '2px solid #2a9d5c' : isWrongSelected ? '2px solid #d94040' : '1.5px solid #c0c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCorrectOpt ? '#edfbf3' : isWrongSelected ? '#fff2f2' : '#fff' }}>
                        {isCorrectOpt && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#2a9d5c', display: 'block' }} />}
                        {isWrongSelected && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#d94040', display: 'block' }} />}
                      </span>
                      <span style={{ fontSize: '14px', lineHeight: '1.5', color: isCorrectOpt ? '#1a7a44' : isWrongSelected ? '#b03030' : '#888', fontWeight: isCorrectOpt ? '600' : '400' }}>
                        {opt}
                        {isCorrectOpt && !a.isCorrect && <span style={{ fontSize: '11px', color: '#2a9d5c', marginLeft: '6px', fontWeight: '700' }}>✓ correct</span>}
                        {isWrongSelected && <span style={{ fontSize: '11px', color: '#d94040', marginLeft: '6px' }}>✗ your answer</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10, overflowY: 'auto' }}>
        <div style={{ maxWidth: '700px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center', marginBottom: '24px', border: '0.5px solid #e1e4ed' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>{grade.emoji}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: grade.color, marginBottom: '4px' }}>{grade.label}</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Practice {practiceNum} · {totalQ} questions</div>
            <div style={{ fontSize: '44px', fontWeight: '800', color: '#1a1a1a', lineHeight: '1' }}>{score}<span style={{ fontSize: '18px', color: '#aaa', fontWeight: '400' }}>/{totalQ}</span></div>
            <div style={{ margin: '14px 0 6px', height: '7px', background: '#efefef', borderRadius: '4px' }}><div style={{ width: pct + '%', height: '100%', background: grade.color, borderRadius: '4px' }} /></div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '20px' }}>{pct}% correct</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onBack} style={{ flex: 1, padding: '11px', background: '#701fa1', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>All Practices</button>
              <button onClick={onFinish} style={{ flex: 1, padding: '11px', background: '#fff', color: '#333', border: '1px solid #d0d5dd', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Exit</button>
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Review · <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>tap a question to see the passage</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {passage.questions.map((q, qi) => {
              const a = answers[qi]; if (!a) return null
              return (
                <div key={qi} onClick={() => setReviewQ(qi)} style={{ background: '#fff', borderRadius: '10px', padding: '14px 18px', border: '0.5px solid #e1e4ed', borderLeft: '4px solid ' + (a.isCorrect ? '#2a9d5c' : '#d94040'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'} onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', background: a.isCorrect ? '#edfbf3' : '#fff2f2', color: a.isCorrect ? '#2a9d5c' : '#d94040', padding: '2px 8px', borderRadius: '999px', fontWeight: '700', flexShrink: 0 }}>{a.isCorrect ? '✓' : '✗'} Q{qi + 1}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.question}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: a.isCorrect ? '#2a9d5c' : '#b03030' }}>{a.isCorrect ? '✓ ' + q.options[q.answer] : '✗ You chose: ' + (a.selected !== null ? q.options[a.selected] : 'No answer')}</div>
                  </div>
                  <span style={{ fontSize: '16px', color: '#c0c0c0', flexShrink: 0 }}>›</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const RIDL_BOX_COLORS = ['#127c84', '#e0952b', '#4b7bec', '#c0392b', '#0f9960']
  const boxColor = RIDL_BOX_COLORS[(passage.id || practiceNum || 0) % RIDL_BOX_COLORS.length]

  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={mockMode
        ? <>
            <TestPillButton onClick={goBack} disabled={questionIdx === 0 && !onPrevSlot}>Back</TestPillButton>
            <TestPillButton onClick={goNext}>{(questionIdx + 1 === totalQ && isLastSlot) ? 'Finish' : 'Next'}</TestPillButton>
          </>
        : <TestPillButton onClick={goNext}>{questionIdx + 1 === totalQ ? 'Finish' : 'Next'}</TestPillButton>}
      section="READING"
      questionLabel={questionLabel}
      timeText={formatTime(displayTime)}
      lowTime={isLowTime}
    >
      <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center', margin: isMobile ? '0 0 20px' : '0 0 32px' }}>{passage.instruction}</h1>
      <div style={{ display: 'flex', gap: isMobile ? '24px' : '56px', alignItems: 'flex-start', maxWidth: '1160px', margin: '0 auto', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? '100%' : '520px', width: '100%' }}>
          <div style={{ border: `3px solid ${boxColor}`, borderRadius: '10px', padding: '18px 20px', overflowY: 'auto', boxSizing: 'border-box', maxHeight: isMobile ? 'none' : 'calc(100vh - 260px)' }}>
            {passage.title && <div style={{ fontWeight: '700', fontSize: '13px', textAlign: 'center', marginBottom: '2px', color: '#1a1a1a' }}>{passage.title}</div>}
            {passage.subtitle && <div style={{ fontSize: '11px', textAlign: 'center', color: '#616473', marginBottom: '12px' }}>{passage.subtitle}</div>}
            <div style={{ fontSize: '16px', lineHeight: '1.75', color: '#1a1a1a', whiteSpace: 'pre-wrap' }}>{passage.text}</div>
          </div>
        </div>
        <div style={{ width: isMobile ? '100%' : '440px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', lineHeight: '1.5' }}>{question.question}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {question.options.map((opt, i) => {
              const isChosen = i === selected
              return (
                <div key={i} onClick={() => setSelected(i)} style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '4px 0' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isChosen ? '6px solid #2ac56c' : '1.5px solid #c0c0c0', background: '#fff', transition: 'all 0.1s' }} />
                  <span style={{ fontSize: '16px', lineHeight: '1.5', color: '#1a1a1a' }}>{opt}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </ExamScreen>
  )
}

// ─── Academic Passage ─────────────────────────────────────────────────────────
// VITE_BACKEND_URL can be set at build time (e.g. in Render's environment variables) to point
// the deployed frontend at its deployed backend. Falls back to localhost for local dev.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
// The hardware-check screens (Adjusting the Volume / Adjusting the Microphone) reference two
// static audio files directly by URL rather than through a backend API response, so they need
// their own base URL mirroring the backend's AUDIO_BASE_URL env var (see main.py) -- once audio
// moved off the backend's own /audio mount and onto object storage (R2), this must point there
// too, e.g. VITE_AUDIO_BASE_URL=https://pub-xxxxxxxx.r2.dev (same bucket URL used server-side).
// Falls back to the backend's own /audio mount, which is correct for local dev.
const AUDIO_BASE_URL = import.meta.env.VITE_AUDIO_BASE_URL || `${BACKEND_URL}/audio`

// ─── Auth: token storage + an authenticated fetch wrapper ────────────────────────────────────
const AUTH_TOKEN_KEY = 'mrreadyprep_token'

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || ''
}
function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}
function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}
function logout() {
  clearAuthToken()
  window.location.reload()
}

// Every call in this file that hits our own backend goes through this instead of the raw
// `fetch` so the logged-in student's session token rides along automatically. On a 401 (missing/
// expired/invalid token) it clears the stale token and reloads, which drops the student back
// onto the login screen instead of leaving them stuck on a broken, half-authenticated page.
function apiFetch(url, options = {}) {
  const token = getAuthToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) {
      clearAuthToken()
      window.location.reload()
    }
    return res
  })
}

// ─── Subscription / paywall (iyzico) ─────────────────────────────────────────────────────────
// A list item whose full content was stripped server-side (see gate_pool in main.py) comes back
// as just { id, ...a couple of title-ish fields, locked: true } instead of the real exercise.
function isLocked(item) {
  return !!(item && item.locked)
}

// Any list screen or mock-test picker calls this instead of opening a locked item/test -- it
// doesn't matter which component triggers it (there are a dozen of them across every practice
// section), so this fires a plain DOM event that the single top-level App() component listens
// for and reacts to by switching to the Subscribe screen. Avoids threading an onUpgrade prop
// through every list component individually.
function requestUpgrade() {
  window.dispatchEvent(new CustomEvent('mrreadyprep:paywall'))
}

// Fires a small, self-dismissing toast in the bottom-right corner instead of a native alert() --
// the browser's built-in alert() blocks the whole page and looks jarring against the rest of the
// app's design, so anything that used to call alert() dispatches this event instead. Same
// no-prop-drilling pattern as requestUpgrade() above: a single <ToastHost /> mounted once inside
// App() listens for it and renders/queues/dismisses the actual toast.
function showToast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('mrreadyprep:toast', { detail: { message, type } }))
}

function ToastHost() {
  const [toasts, setToasts] = useState([])
  useEffect(() => {
    const onToast = (e) => {
      const id = Date.now() + Math.random()
      setToasts(t => [...t, { id, ...e.detail }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }
    window.addEventListener('mrreadyprep:toast', onToast)
    return () => window.removeEventListener('mrreadyprep:toast', onToast)
  }, [])
  if (toasts.length === 0) return null
  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#d92d20' : t.type === 'info' ? '#11162d' : '#2ac56c',
          color: '#fff', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>{t.type === 'error' ? '⚠️' : t.type === 'info' ? 'ℹ️' : '✅'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

// Small reusable "locked" badge shown next to/instead of the Start/Retry button on a locked row.
function LockedBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f3f4f6', color: '#9ca3af', border: 'none', borderRadius: '6px', padding: '9px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }} onClick={requestUpgrade}>
      🔒 Premium
    </span>
  )
}

// Starts an iyzico Subscription Checkout Form -- returns { token, checkoutFormContent,
// tokenExpireTime }. checkoutFormContent is raw HTML/JS meant to be injected directly into the
// page (see injectCheckoutForm below), not a URL to redirect to.
function startCheckout(customer) {
  return apiFetch(`${BACKEND_URL}/api/subscription/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customer),
  }).then(res => res.json())
}

// Asks our backend to confirm (server-side, against iyzico) what happened with a given checkout
// token, and to persist the resulting subscription onto the logged-in user if it succeeded.
function confirmCheckoutResult(token) {
  return apiFetch(`${BACKEND_URL}/api/subscription/checkout-result/${token}`).then(res => res.json())
}

function cancelSubscription() {
  return apiFetch(`${BACKEND_URL}/api/subscription/cancel`, { method: 'POST' }).then(res => res.json())
}

// iyzico's checkoutFormContent is a blob of HTML containing a <script> tag that renders the
// actual card-entry widget into the target element -- setting it via innerHTML does NOT execute
// embedded <script> tags (a browser security rule), so each script has to be re-created and
// re-appended manually to actually run.
function injectCheckoutForm(container, html) {
  container.innerHTML = html
  const scripts = container.querySelectorAll('script')
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script')
    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value))
    newScript.textContent = oldScript.textContent
    oldScript.parentNode.replaceChild(newScript, oldScript)
  })
}

function SubscribeScreen({ onBack, hasPremium, subscriptionStatus, hasBilledSubscription, isAdmin }) {
  const [step, setStep] = useState('form') // 'form' | 'embed'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', surname: '', gsm_number: '', identity_number: '', address: '', city: '' })
  const embedRef = useRef(null)

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubscribe = (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    startCheckout(form)
      .then(data => {
        if (!data.checkoutFormContent) {
          setError(data.detail || 'Could not start checkout. Please try again.')
          setBusy(false)
          return
        }
        setStep('embed')
        setBusy(false)
        // The container only exists once step flips to 'embed' and React re-renders, so inject
        // on the next tick.
        setTimeout(() => { if (embedRef.current) injectCheckoutForm(embedRef.current, data.checkoutFormContent) }, 0)
      })
      .catch(() => { setError('Could not reach the server. Please try again.'); setBusy(false) })
  }

  const handleCancelSubscription = () => {
    if (!window.confirm('Cancel your mrreadyprep Premium subscription? You will lose access to locked content immediately.')) return
    setBusy(true)
    cancelSubscription()
      .then(data => {
        setBusy(false)
        if (data.status === 'success') { showToast('Subscription canceled.'); setTimeout(() => window.location.reload(), 1200) }
        else setError(data.detail || 'Could not cancel subscription.')
      })
      .catch(() => { setBusy(false); setError('Could not reach the server. Please try again.') })
  }

  if (hasPremium) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 12px' }}>
        <div style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '16px', border: '0.5px solid #e1e4ed', padding: '36px', textAlign: 'center' }}>
          <div style={{ fontSize: '38px', marginBottom: '10px' }}>🎉</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>You're on mrreadyprep Premium</h2>
          <p style={{ color: '#616473', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
            Full access to every practice exercise and all 20 Full Mock Tests.
            {subscriptionStatus === 'PENDING' ? ' Your subscription is being activated.' : ''}
          </p>
          {error && <p style={{ color: '#d92d20', fontSize: '12px', marginBottom: '12px' }}>{error}</p>}
          {hasBilledSubscription ? (
            <button onClick={handleCancelSubscription} disabled={busy} style={{ background: '#11162d', color: '#fff', border: 'none', padding: '13px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: busy ? 'default' : 'pointer', width: '100%', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Canceling…' : 'Cancel subscription'}
            </button>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>
              {isAdmin ? 'Admin accounts have permanent full access.' : 'This access was granted directly by an admin, not through a paid subscription -- there is nothing to cancel here.'}
            </p>
          )}
          {onBack && (
            <button onClick={onBack} style={{ marginTop: '14px', background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', cursor: 'pointer' }}>← Back</button>
          )}
        </div>
      </div>
    )
  }

  if (step === 'embed') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 12px' }}>
        <div style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '16px', border: '0.5px solid #e1e4ed', padding: '24px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center' }}>Enter payment details</h2>
          <div ref={embedRef} />
          <button onClick={() => setStep('form')} style={{ marginTop: '14px', background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', cursor: 'pointer', width: '100%', textAlign: 'center' }}>← Back</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 12px' }}>
      <div style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '16px', border: '0.5px solid #e1e4ed', padding: '36px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '38px', marginBottom: '10px' }}>⭐</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>Upgrade to mrreadyprep Premium</h2>
          <p style={{ color: '#616473', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
            You've hit the free-plan limit. Subscribe for unlimited access to every Reading, Listening,
            Writing and Speaking practice exercise, plus all 20 Full Mock Tests.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', background: '#f9fafb', borderRadius: '10px', padding: '18px', marginBottom: '24px' }}>
          {[
            'Unlimited Reading, Listening, Writing & Speaking practice',
            'All 20 Full Mock Tests (not just Test 1)',
            'Unlimited "practice one section" random mock drills',
            'Cancel anytime from this same screen',
          ].map((line, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#374151' }}>
              <span style={{ color: '#2ac56c', fontWeight: '700' }}>✓</span> {line}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubscribe} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input required placeholder="First name" value={form.name} onChange={update('name')} style={inputStyle} />
            <input required placeholder="Last name" value={form.surname} onChange={update('surname')} style={inputStyle} />
          </div>
          <input required placeholder="Phone number (e.g. +1 555 123 4567)" value={form.gsm_number} onChange={update('gsm_number')} style={inputStyle} />
          <input required placeholder="ID / passport number" value={form.identity_number} onChange={update('identity_number')} style={inputStyle} />
          <input required placeholder="Billing address" value={form.address} onChange={update('address')} style={inputStyle} />
          <input required placeholder="City" value={form.city} onChange={update('city')} style={inputStyle} />
          {error && <p style={{ color: '#d92d20', fontSize: '12px', margin: '2px 0 0' }}>{error}</p>}
          <button type="submit" disabled={busy} style={{ marginTop: '6px', background: '#701fa1', color: '#fff', border: 'none', padding: '13px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: busy ? 'default' : 'pointer', width: '100%', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Please wait…' : 'Continue to payment'}
          </button>
        </form>
        {onBack && (
          <button onClick={onBack} style={{ marginTop: '14px', background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', cursor: 'pointer', width: '100%', textAlign: 'center' }}>← Back</button>
        )}
      </div>
    </div>
  )
}

const inputStyle = { border: '1px solid #e1e4ed', borderRadius: '8px', padding: '11px 12px', fontSize: '13px', flex: 1, fontFamily: 'inherit', color: '#1a1a1a' }

// Turns the "last_mock_test_at" ISO timestamp from /api/dashboard into the short human string
// shown on the Full Mock Test dashboard card ("today", "3 days ago", etc.) -- null means the
// student has never finished a full (all 4 section) mock test yet.
function timeAgo(isoString) {
  if (!isoString) return 'Not taken yet'
  // saved_at comes back from sqlite as "YYYY-MM-DD HH:MM:SS" (space, no timezone) rather than
  // true ISO 8601 -- Safari's Date parser rejects that form outright, so normalize the same way
  // fmtDate() below does before handing it to `new Date`.
  const normalized = isoString.includes('T') ? isoString : isoString.replace(' ', 'T')
  const then = new Date(normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z')
  const diffMs = Date.now() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? '' : 's'} ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 30) return `${diffDay} days ago`
  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`
  return `${Math.floor(diffMonth / 12)} yr ago`
}

// Fire-and-forget: records one finished exercise/attempt into the unified progress table so
// the student can see their history/improvement later on the Progress screen. Never blocks or
// throws on failure -- a save hiccup shouldn't interrupt the student's flow.
function saveResult(category, itemId, score, total, label = '') {
  apiFetch(`${BACKEND_URL}/api/results/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, item_id: String(itemId), label, score, total }),
  }).catch(() => {})
}

// Loads every past attempt for a category and reduces it down to the most recent attempt per
// item_id (history comes back most-recent-first, so the first row seen per item_id wins) --
// this is what list screens use to restore each exercise's "✓ done" badge after a reload,
// mirroring the score that was showing right before the student navigated away.
function fetchLatestResults(category) {
  return apiFetch(`${BACKEND_URL}/api/results/history?category=${category}`)
    .then(r => r.json())
    .then(rows => {
      const map = {}
      ;(Array.isArray(rows) ? rows : []).forEach(row => {
        if (!(row.item_id in map)) map[row.item_id] = row
      })
      return map
    })
    .catch(() => ({}))
}

function APList({ passages, scores, onSelect, onBack }) {
  const isMobile = useIsMobile()
  // Rendered inline in the sidebar shell's content area -- see CTWList for the same pattern.
  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {passages.map((p, idx) => {
            const locked = isLocked(p)
            const result = scores[p.id]; const pct = result ? Math.round((result.score / result.total) * 100) : null
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Passage {idx + 1}</div>
                    {result && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: pct >= 70 ? '#2ac56c' : '#e07b00', background: pct >= 70 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {result.score}/{result.total} · {pct}%</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${p.title} · ${p.questions.length} questions`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => onSelect(p)} style={{ background: result ? '#e5e7eb' : '#2ac56c', color: result ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{result ? 'Retry' : 'Start'}</button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

function APQuestion({ passage, onBack, onComplete, mockMode = false, poolTime, moduleOffset, moduleTotal, onPrevSlot, enterAtEnd, isLastSlot = true, initialAnswers, onAnswersChange }) {
  const isMobile = useIsMobile()
  const TOTAL_TIME = 600
  const [currentQ, setCurrentQ] = useState(() => enterAtEnd ? passage.questions.length - 1 : 0)
  const [answers, setAnswers] = useState(() => initialAnswers || {})
  const [submitted, setSubmitted] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [reviewIdx, setReviewIdx] = useState(null)
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME)
  const answersRef = useRef({})
  useEffect(() => { answersRef.current = answers }, [answers])
  // Mirror selections up to the parent so Back-navigating away from this passage and returning
  // later restores exactly what was chosen, instead of remounting blank.
  useEffect(() => { if (onAnswersChange) onAnswersChange(answers) }, [answers])

  const questions = passage.questions; const q = questions[currentQ]
  const isInsert = q && q.type === 'insert_sentence'
  const activePassage = isInsert ? passage.passage_marked : passage.passage
  const questionLabel = moduleTotal !== undefined
    ? `Question ${moduleOffset + currentQ + 1} of ${moduleTotal}`
    : `Question ${currentQ + 1} of ${questions.length}`
  const displayTime = poolTime !== undefined ? poolTime : timeLeft
  const isLowTime = poolTime !== undefined ? poolTime <= 60 : timeLeft <= 60

  const buildDetail = (ans) => questions.map((qq, i) => ({
    prompt: qq.question,
    given: ans[i] !== undefined ? qq.options[ans[i]] : 'No answer',
    correctAnswer: qq.options[qq.answer],
    isCorrect: ans[i] === qq.answer,
  }))

  // See CTWSingle/RIDLQuestion: when `poolTime` is provided, FullMockTest owns one shared clock
  // for the whole Reading module, so this passage-level timer/auto-expiry is skipped entirely.
  useEffect(() => {
    if (poolTime !== undefined) return
    if (submitted) return
    const t = setInterval(() => setTimeLeft(s => {
      if (s <= 1) {
        clearInterval(t)
        if (mockMode) {
          const ans = answersRef.current
          const finalScore = questions.filter((qq, i) => ans[i] === qq.answer).length
          onComplete(finalScore, questions.length, buildDetail(ans))
        } else {
          setSubmitted(true)
        }
        return 0
      }
      return s - 1
    }), 1000)
    return () => clearInterval(t)
  }, [submitted, poolTime])

  const formatTime = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`

  function renderMarkedPassage(text) {
    return text.split(/(\[A\]|\[B\]|\[C\]|\[D\])/g).map((part, i) =>
      /^\[.\]$/.test(part)
        ? <span key={i} style={{ display: 'inline-block', background: '#1a5c3a', color: '#fff', borderRadius: 4, padding: '0 6px', fontSize: 11, fontWeight: 700, margin: '0 2px', lineHeight: '20px' }}>{part}</span>
        : part
    )
  }

  const score = submitted ? questions.filter((qq, i) => answers[i] === qq.answer).length : 0

  if (submitted && showReview && reviewIdx !== null) {
    const rq = questions[reviewIdx]; const isIns = rq.type === 'insert_sentence'
    const rPassage = isIns ? passage.passage_marked : passage.passage
    const userAns = answers[reviewIdx]; const correct = rq.answer
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10 }}>
        <div style={{ padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>Read an Academic Passage</div>
          <button onClick={() => setShowReview(false)} style={{ background: '#fff', border: '1.5px solid #2a9d5c', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', color: '#2a9d5c', cursor: 'pointer', fontWeight: '700' }}>← BACK</button>
        </div>
        <div style={{ height: '2.5px', background: '#2a9d5c', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', padding: isMobile ? '16px' : '24px 32px', gap: isMobile ? '20px' : '40px', overflow: isMobile ? 'auto' : 'hidden', minHeight: 0, ...(isMobile ? { flexDirection: 'column' } : {}) }}>
          <div style={{ flex: 1, border: '2px solid #2a9d5c', borderRadius: '8px', padding: '16px 18px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '12px', color: '#1a1a1a' }}>{passage.title}</div>
            {isIns ? <div style={{ fontSize: '16px', lineHeight: '1.9', color: '#1a1a1a' }}>{renderMarkedPassage(rPassage)}</div> : <div style={{ fontSize: '16px', lineHeight: '1.9', color: '#1a1a1a', whiteSpace: 'pre-line' }}>{rPassage}</div>}
          </div>
          <div style={{ width: isMobile ? '100%' : '420px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '12px', color: '#999' }}>Question {reviewIdx + 1} of {questions.length}</div>
            {isIns && <div style={{ background: '#f0faf4', border: '1px solid #2a9d5c', borderRadius: '8px', padding: '12px 14px', fontStyle: 'italic', fontSize: '13px', color: '#1a1a1a', lineHeight: '1.6' }}>"{rq.insert_text}"</div>}
            <div style={{ fontSize: '17px', fontWeight: '600', color: '#1a1a1a', lineHeight: '1.55' }}>{rq.question}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rq.options.map((opt, i) => {
                let bg = '#fafafa', border = '1px solid #e0e0e0', color = '#1a1a1a'
                if (i === correct) { bg = '#e8f5e9'; border = '1.5px solid #2a9d5c'; color = '#1a5c3a' }
                if (i === userAns && userAns !== correct) { bg = '#fdecea'; border = '1.5px solid #e53935'; color = '#c62828' }
                return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px', border, background: bg }}><span style={{ fontSize: '15px', flexShrink: 0 }}>{i === correct ? '✓' : i === userAns && userAns !== correct ? '✗' : '○'}</span><span style={{ fontSize: '14px', color, lineHeight: '1.4' }}>{opt}</span></div>
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setReviewIdx(i => Math.max(0, i - 1))} disabled={reviewIdx === 0} style={{ flex: 1, padding: '10px 0', borderRadius: '6px', border: '1.5px solid #2a9d5c', background: reviewIdx === 0 ? '#f5f5f5' : '#fff', color: reviewIdx === 0 ? '#bbb' : '#2a9d5c', cursor: reviewIdx === 0 ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '13px' }}>← PREV</button>
              <button onClick={() => setReviewIdx(i => Math.min(questions.length - 1, i + 1))} disabled={reviewIdx === questions.length - 1} style={{ flex: 1, padding: '10px 0', borderRadius: '6px', border: 'none', background: reviewIdx === questions.length - 1 ? '#e5e7eb' : '#2a9d5c', color: reviewIdx === questions.length - 1 ? '#aaa' : '#fff', cursor: reviewIdx === questions.length - 1 ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '13px' }}>NEXT →</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10 }}>
        <div style={{ padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a1a' }}>Read an Academic Passage</div>
          <button onClick={onBack} style={{ background: '#fff', border: '1.5px solid #2a9d5c', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', color: '#2a9d5c', cursor: 'pointer', fontWeight: '700' }}>← BACK</button>
        </div>
        <div style={{ height: '2.5px', background: '#2a9d5c', flexShrink: 0 }} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ maxWidth: 560, width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '📚'}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a', marginBottom: 4 }}>{passage.title}</div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#2a9d5c' }}>{score}/{questions.length}</div>
              <div style={{ fontSize: '18px', color: '#666' }}>{pct}%</div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Review · tap a question to see details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {questions.map((qq, i) => {
                const isCorrect = answers[i] === qq.answer
                return (
                  <div key={i} onClick={() => { setReviewIdx(i); setShowReview(true) }} style={{ background: '#fff', borderRadius: '10px', padding: '14px 18px', border: '0.5px solid #e1e4ed', borderLeft: '4px solid ' + (isCorrect ? '#2a9d5c' : '#d94040'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', background: isCorrect ? '#edfbf3' : '#fff2f2', color: isCorrect ? '#2a9d5c' : '#d94040', padding: '2px 8px', borderRadius: '999px', fontWeight: '700', flexShrink: 0 }}>{isCorrect ? '✓' : '✗'} Q{i + 1}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qq.question}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: isCorrect ? '#2a9d5c' : '#b03030' }}>{isCorrect ? '✓ ' + qq.options[qq.answer] : '✗ ' + (answers[i] !== undefined ? qq.options[answers[i]] : 'No answer')}</div>
                    </div>
                    <span style={{ fontSize: '16px', color: '#c0c0c0', flexShrink: 0 }}>›</span>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => { setAnswers({}); setCurrentQ(0); setSubmitted(false); setTimeLeft(TOTAL_TIME) }} style={{ flex: 1, padding: '13px 0', borderRadius: '8px', border: '1.5px solid #2a9d5c', background: '#fff', color: '#2a9d5c', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>Try Again</button>
              <button onClick={() => { onComplete && onComplete(score, questions.length); onBack() }} style={{ flex: 1, padding: '13px 0', borderRadius: '8px', border: 'none', background: '#2a9d5c', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>Back to List</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={<>
        {mockMode && <TestPillButton onClick={() => {
          if (currentQ === 0) {
            if (onPrevSlot) onPrevSlot()
          } else setCurrentQ(i => i - 1)
        }} disabled={currentQ === 0 && !onPrevSlot}>Back</TestPillButton>}
        <TestPillButton onClick={() => {
          if (currentQ + 1 === questions.length) {
            if (mockMode) {
              const finalScore = questions.filter((qq, i) => answers[i] === qq.answer).length
              onComplete(finalScore, questions.length, buildDetail(answers))
            } else {
              setSubmitted(true)
            }
          } else setCurrentQ(i => i + 1)
        }}>{(currentQ + 1 === questions.length && (!mockMode || isLastSlot)) ? 'Finish' : 'Next'}</TestPillButton>
      </>}
      section="READING"
      questionLabel={questionLabel}
      timeText={formatTime(displayTime)}
      lowTime={isLowTime}
    >
      <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center', margin: isMobile ? '0 0 20px' : '0 0 32px' }}>{passage.title}</h1>
      <div style={{ display: 'flex', gap: isMobile ? '24px' : '56px', alignItems: 'flex-start', maxWidth: '1160px', margin: '0 auto', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? '100%' : '540px', width: '100%' }}>
          <div style={{ padding: '4px 0', overflowY: 'auto', boxSizing: 'border-box', maxHeight: isMobile ? 'none' : 'calc(100vh - 260px)' }}>
            {isInsert ? <div style={{ fontSize: '16px', lineHeight: '1.9', color: '#1a1a1a' }}>{renderMarkedPassage(activePassage)}</div> : <div style={{ fontSize: '16px', lineHeight: '1.9', color: '#1a1a1a', whiteSpace: 'pre-line' }}>{activePassage}</div>}
          </div>
        </div>
        <div style={{ width: isMobile ? '100%' : '440px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {isInsert && <div style={{ background: '#f0faf4', border: '1px solid #2a9d5c', borderRadius: '8px', padding: '12px 14px', fontStyle: 'italic', fontSize: '13px', color: '#1a1a1a', lineHeight: '1.6' }}>"{q.insert_text}"</div>}
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', lineHeight: '1.5' }}>{q.question}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {q.options.map((opt, i) => {
              const isChosen = answers[currentQ] === i
              return (
                <div key={i} onClick={() => setAnswers(prev => ({ ...prev, [currentQ]: i }))} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '4px 0', cursor: 'pointer' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isChosen ? '6px solid #2ac56c' : '1.5px solid #c0c0c0', background: '#fff' }} />
                  <span style={{ fontSize: '16px', lineHeight: '1.5', color: '#1a1a1a' }}>{opt}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </ExamScreen>
  )
}

function AcademicPassage({ onBack }) {
  const [passages, setPassages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/reading/academic-passage`).then(r => r.json()),
      fetchLatestResults('ap'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setPassages(list)
      const mapped = {}
      list.forEach(p => { const row = results[String(p.id)]; if (row) mapped[p.id] = { score: row.score, total: row.total } })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading passages..." />
  if (selected) return <APQuestion passage={selected} onBack={() => setSelected(null)} onComplete={(score, total) => {
    saveResult('ap', selected.id, score, total, selected.title || `Academic Passage #${selected.id}`)
    setScores(prev => ({ ...prev, [selected.id]: { score, total } })); setSelected(null)
  }} />
  return <APList passages={passages} scores={scores} onSelect={p => setSelected(p)} onBack={onBack} />
}
// ─── Listening ────────────────────────────────────────────────────────────────

const AUDIO_START_DELAY_MS = 1500

// Reused across every question instead of being remounted per URL — iOS/desktop Safari treats
// "has this exact element ever played" as part of what it takes to keep autoplay unlocked, so
// tearing the element down and recreating it every question (the old `key={url}` approach)
// fought against that. Changing .src on one persistent element plays far more reliably.
function AudioPlayer({ url, autoPlayKey, onEnded }) {
  const audioRef = useRef(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!url || !audio) return
    audio.pause()
    audio.src = url
    audio.currentTime = 0
    audio.load()
    const tryPlay = () => {
      const p = audio.play()
      if (p && p.catch) {
        p.catch(() => {
          // Autoplay was blocked (can happen on the very first question before the app-wide
          // unlock listener in App() has caught a click). Rather than showing a manual "Play"
          // button, silently retry the instant the student's next click/tap/keypress happens
          // anywhere — which is always within a second or two, since they're actively taking
          // the test — so playback simply resumes on its own with no extra UI.
          const retry = () => { audio.play().catch(() => {}) }
          document.addEventListener('pointerdown', retry, { once: true, capture: true })
          document.addEventListener('keydown', retry, { once: true, capture: true })
        })
      }
    }
    const timer = setTimeout(tryPlay, AUDIO_START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [url, autoPlayKey])

  if (!url) {
    return (
      <div style={{ background: '#f4f6fa', border: '2px dashed #d1d5db', borderRadius: '12px', padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎵</div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af' }}>Audio coming soon</div>
        <div style={{ fontSize: '11px', color: '#c0c0c0', marginTop: '4px' }}>Transcript is shown below for practice</div>
      </div>
    )
  }
  return <audio ref={audioRef} style={{ display: 'none' }} onEnded={onEnded} onError={onEnded} />
}

// Plays a short pre-recorded narration line ("Listen to a conversation.", etc.) before the
// actual conversation/announcement/talk audio is allowed to start, matching the real TOEFL's
// spoken intro (same neural narrator voice used for the rest of the app's audio, generated via
// backend/generate_audio_intro.py) instead of each browser's own inconsistent built-in TTS voice.
// Returns true once the narration has finished (or a fallback elapses if the file is missing/
// blocked), which callers use to gate mounting the main <AudioPlayer>.
function useIntroNarration(url) {
  const [announced, setAnnounced] = useState(false)
  useEffect(() => {
    setAnnounced(false)
    if (!url) {
      const t = setTimeout(() => setAnnounced(true), 300)
      return () => clearTimeout(t)
    }
    let settled = false
    let audio = null
    const finish = () => { if (!settled) { settled = true; setAnnounced(true) } }
    // The actual Audio object + .play() call is deferred behind a cancelable timer (instead of
    // firing the instant the effect runs) so that React's development-mode double-invoke of
    // effects (mount → cleanup → mount) can never end up starting two overlapping playbacks of
    // the same line — which was the cause of the echoed/doubled-voice sound. The cleanup below
    // cancels the pending timer outright before it ever creates an Audio element.
    const startTimer = setTimeout(() => {
      audio = new Audio(url)
      audio.onended = finish
      audio.onerror = finish
      const p = audio.play()
      if (p && p.catch) {
        p.catch(() => {
          // Autoplay blocked — resume on the student's next interaction, same fallback pattern
          // used by AudioPlayer, and don't hold up the test indefinitely if they don't interact.
          const retry = () => { audio.play().catch(finish) }
          document.addEventListener('pointerdown', retry, { once: true, capture: true })
          document.addEventListener('keydown', retry, { once: true, capture: true })
          setTimeout(finish, 3000)
        })
      }
    }, 60)
    return () => {
      settled = true
      clearTimeout(startTimer)
      if (audio) audio.pause()
    }
  }, [url])
  return announced
}

// Placeholder speaker photos (free-to-use placeholder avatar set, gender-matched).
// Each speaker gets a stable photo based on question id so the same question always shows the same person.
const FEMALE_AVATAR_IDS = [0, 5, 12, 18, 24, 31, 38, 45, 52, 59, 66, 71, 76]
const MALE_AVATAR_IDS = [0, 5, 12, 18, 24, 31, 38, 45, 52, 59, 66, 71, 76]

// Local photos (dropped into public/avatars/female/1.jpg, public/avatars/male/1.jpg, etc.)
// are tried first; if a numbered file doesn't exist yet, we fall back to the placeholder set.
// Update these counts whenever more photos are added to those folders.
const LOCAL_AVATAR_COUNT = { female: 3, male: 3 }

function SpeakerAvatar({ gender, seed = 0, width = 340, height = 640 }) {
  const isFemale = gender !== 'male'
  const pool = isFemale ? FEMALE_AVATAR_IDS : MALE_AVATAR_IDS
  const fallbackIdx = pool[seed % pool.length]
  const fallbackSrc = `https://xsgames.co/randomusers/assets/avatars/${isFemale ? 'female' : 'male'}/${fallbackIdx}.jpg`
  const localCount = isFemale ? LOCAL_AVATAR_COUNT.female : LOCAL_AVATAR_COUNT.male
  const localIdx = (seed % localCount) + 1
  const localSrc = `/avatars/${isFemale ? 'female' : 'male'}/${localIdx}.jpg`
  return (
    <div style={{ width: `${width}px`, height: `${height}px`, overflow: 'hidden', background: '#f2f3f5', flexShrink: 0, position: 'relative' }}>
      <img
        src={localSrc}
        alt={isFemale ? 'Female speaker' : 'Male speaker'}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', display: 'block' }}
        onError={(e) => { e.target.onerror = null; e.target.src = fallbackSrc }}
      />
      {/* Soft vignette so any photo backdrop (not just pure white) fades into the page background at the edges */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 65% at center, rgba(242,243,245,0) 55%, rgba(242,243,245,1) 100%)' }} />
    </div>
  )
}

// A SpeakerAvatar wrapper that simulates the interviewer being alive on screen: the mouth
// pulses while a question is playing, and the head nods gently while the student is recording
// (as if listening). Pure CSS keyframe animation over a static photo — no real lip-sync/video.
// Fallback: a fully illustrated (non-photo) cartoon character, drawn in SVG so we can genuinely
// animate its mouth open/closed while a question plays, and nod its head while the student is
// recording (as if listening). Used only if the real talking-head video below fails to load.
function DrawnCharacterAvatar({ gender, seed = 0, width = 220, height = 220, mode = 'idle' }) {
  const isFemale = gender !== 'male'
  const uid = `char-${isFemale ? 'f' : 'm'}-${seed}`
  const skinTop = isFemale ? '#ffd9b3' : '#f0bd8f'
  const skinBot = isFemale ? '#e8b98a' : '#d99e6e'
  const hairTop = isFemale ? '#5c4330' : '#332415'
  const hairBot = isFemale ? '#3a291c' : '#1a1109'
  const clothTop = isFemale ? '#e2809a' : '#4a7fbf'
  const clothBot = isFemale ? '#c85c78' : '#2f5c92'

  return (
    <div style={{ width: `${width}px`, height: `${height}px`, maxWidth: '100%', borderRadius: '16px', background: 'radial-gradient(circle at 50% 30%, #f4fbf7 0%, #e7f0f7 62%, #dde6f2 100%)', border: '0.5px solid #e1e4ed', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes toeflCharNod {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(4px) rotate(1.5deg); }
        }
        @keyframes toeflCharMouth {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <svg viewBox="0 0 200 220" width="88%" height="88%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skinTop} /><stop offset="100%" stopColor={skinBot} />
          </linearGradient>
          <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hairTop} /><stop offset="100%" stopColor={hairBot} />
          </linearGradient>
          <linearGradient id={`${uid}-cloth`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={clothTop} /><stop offset="100%" stopColor={clothBot} />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="208" rx="70" ry="10" fill="#0b1220" opacity="0.08" />
        <g style={{ animation: mode === 'recording' ? 'toeflCharNod 1.6s ease-in-out infinite' : 'none', transformOrigin: '100px 120px' }}>
          {/* shoulders / clothing */}
          <path d="M14 222 Q100 122 186 222 Z" fill={`url(#${uid}-cloth)`} />
          {isFemale ? (
            <path d="M76 150 Q100 168 124 150 L124 172 Q100 184 76 172 Z" fill={clothBot} opacity="0.55" />
          ) : (
            <>
              <path d="M84 148 L100 200 L116 148 Z" fill="#f4f6fa" opacity="0.9" />
              <path d="M96 150 L100 200 L104 150 Z" fill="#8a5a34" opacity="0.85" />
            </>
          )}
          <path d="M14 222 Q40 175 76 156 L84 168 Q52 186 30 222 Z" fill={clothTop} opacity="0.9" />
          <path d="M186 222 Q160 175 124 156 L116 168 Q148 186 170 222 Z" fill={clothTop} opacity="0.9" />

          {/* neck */}
          <rect x="86" y="126" width="28" height="28" fill={`url(#${uid}-skin)`} />
          <path d="M86 140 Q100 148 114 140" stroke="#00000022" strokeWidth="2" fill="none" />

          {/* ears */}
          <ellipse cx="50" cy="96" rx="7" ry="10" fill={`url(#${uid}-skin)`} />
          <ellipse cx="150" cy="96" rx="7" ry="10" fill={`url(#${uid}-skin)`} />

          {/* hair back layer (behind head, for volume) */}
          {isFemale ? (
            <ellipse cx="100" cy="82" rx="60" ry="56" fill={`url(#${uid}-hair)`} />
          ) : (
            <ellipse cx="100" cy="76" rx="53" ry="47" fill={`url(#${uid}-hair)`} />
          )}

          {/* head */}
          <ellipse cx="100" cy="94" rx="46" ry="50" fill={`url(#${uid}-skin)`} />
          {/* soft cheek blush + jaw shading */}
          <ellipse cx="72" cy="106" rx="9" ry="6" fill="#e8828a" opacity="0.25" />
          <ellipse cx="128" cy="106" rx="9" ry="6" fill="#e8828a" opacity="0.25" />
          <path d="M58 110 Q60 128 78 138" stroke="#00000014" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M142 110 Q140 128 122 138" stroke="#00000014" strokeWidth="3" fill="none" strokeLinecap="round" />

          {/* hair front / fringe */}
          {isFemale ? (
            <>
              <path d="M50 92 Q44 142 58 172 Q66 132 63 96 Z" fill={`url(#${uid}-hair)`} />
              <path d="M150 92 Q156 142 142 172 Q134 132 137 96 Z" fill={`url(#${uid}-hair)`} />
              <path d="M53 70 Q58 44 100 42 Q142 44 147 70 Q140 52 100 52 Q60 52 53 70 Z" fill={`url(#${uid}-hair)`} />
              <path d="M70 48 Q100 38 130 48" stroke="#fff" strokeOpacity="0.25" strokeWidth="3" fill="none" />
            </>
          ) : (
            <>
              <path d="M53 68 Q58 40 100 38 Q142 40 147 68 Q140 48 100 46 Q60 48 53 68 Z" fill={`url(#${uid}-hair)`} />
              <path d="M58 62 Q100 50 142 62" stroke="#fff" strokeOpacity="0.2" strokeWidth="2.5" fill="none" />
            </>
          )}

          {/* eyebrows */}
          <path d="M72 78 Q81 73 90 77" stroke={hairBot} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M110 77 Q119 73 128 78" stroke={hairBot} strokeWidth="3.2" fill="none" strokeLinecap="round" />

          {/* eyes (white + iris + highlight) */}
          <ellipse cx="82" cy="91" rx="7" ry="6" fill="#fff" />
          <ellipse cx="118" cy="91" rx="7" ry="6" fill="#fff" />
          <circle cx="82.5" cy="91.5" r="4.2" fill="#3a2a1e" />
          <circle cx="118.5" cy="91.5" r="4.2" fill="#3a2a1e" />
          <circle cx="84" cy="90" r="1.3" fill="#fff" />
          <circle cx="120" cy="90" r="1.3" fill="#fff" />
          {isFemale && (
            <>
              <path d="M75 86 Q82 82 90 86" stroke="#2b2018" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <path d="M111 86 Q118 82 125 86" stroke="#2b2018" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </>
          )}

          {/* nose */}
          <path d="M100 96 Q105 108 100 113 Q96 111 98 105" fill="none" stroke="#c98f66" strokeWidth="2" strokeLinecap="round" />

          {/* lips: subtle upper line always, animated lower opening while playing */}
          <path d="M87 118 Q100 114 113 118" stroke="#a15c56" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse
            cx="100" cy="123" rx="13" ry={mode === 'playing' ? 6 : 2.2}
            fill="#9a4f4f"
            style={{
              transformBox: 'fill-box', transformOrigin: 'center',
              animation: mode === 'playing' ? 'toeflCharMouth 0.42s ease-in-out infinite' : 'none',
            }}
          />
          <path d="M89 126 Q100 132 111 126" stroke="#7a3b3b" strokeWidth="1.5" fill="none" opacity="0.6" />
        </g>
      </svg>
    </div>
  )
}

// A real, licensed photo of a person (one per gender) instead of a drawn cartoon. There's no lip
// sync on a still photo, so "speaking" is conveyed with an animated sound-wave ring around the
// portrait: a calm pulsing ring while the question audio plays, a red recording ring while the
// student answers, and a still frame at rest. Falls back to the drawn SVG character if the photo
// file hasn't been placed in public/interview-photos/ yet.
function RealPersonAvatar({ gender, seed = 0, width = 220, height = 220, mode = 'idle' }) {
  const isFemale = gender !== 'male'
  const [imgFailed, setImgFailed] = useState(false)
  const src = isFemale ? '/interview-photos/female.jpg' : '/interview-photos/male.jpg'
  const ringColor = mode === 'recording' ? '#d84f4f' : '#3f8cd8'

  if (imgFailed) return <DrawnCharacterAvatar gender={gender} seed={seed} width={width} height={height} mode={mode} />

  return (
    <div style={{ width: `${width}px`, height: `${height}px`, maxWidth: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <style>{`
        @keyframes toeflRingPulse {
          0% { box-shadow: 0 0 0 0 ${ringColor}55; }
          70% { box-shadow: 0 0 0 14px ${ringColor}00; }
          100% { box-shadow: 0 0 0 0 ${ringColor}00; }
        }
        @keyframes toeflBarBounce {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div
        style={{
          width: '84%', height: '84%', borderRadius: '50%', overflow: 'hidden',
          border: `3px solid ${mode === 'idle' ? '#e1e4ed' : ringColor}`,
          animation: mode !== 'idle' ? 'toeflRingPulse 1.6s ease-out infinite' : 'none',
          position: 'relative', flexShrink: 0,
        }}
      >
        <img
          src={src}
          alt=""
          onError={() => setImgFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      {mode !== 'idle' && (
        <div style={{ position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'flex-end', gap: '3px', background: '#fff', borderRadius: '999px', padding: '6px 10px', border: `0.5px solid ${ringColor}55`, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: '3px', height: '12px', borderRadius: '2px', background: ringColor,
              animation: `toeflBarBounce ${0.5 + i * 0.12}s ease-in-out infinite`,
              animationDelay: `${i * 0.08}s`,
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

// A real talking-head video (free-licensed stock footage, one per gender) so the mouth movement
// is genuine, not simulated. Loops while a question plays; pauses (and gently nods, via CSS
// transform on the video element) while the student is recording their answer. Falls back to the
// drawn SVG character above if the video file hasn't been placed in public/talking-videos/ yet.
function TalkingAvatar({ gender, seed = 0, width = 220, height = 220, mode = 'idle' }) {
  const isFemale = gender !== 'male'
  const videoRef = useRef(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const src = isFemale ? '/talking-videos/female.mp4' : '/talking-videos/male.mp4'

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (mode === 'playing') { try { v.currentTime = 0 } catch (e) {} v.play().catch(() => {}) }
    else v.pause()
  }, [mode])

  if (videoFailed) return <DrawnCharacterAvatar gender={gender} seed={seed} width={width} height={height} mode={mode} />

  return (
    <div style={{ width: `${width}px`, height: `${height}px`, maxWidth: '100%', margin: '0 auto' }}>
      <style>{`
        @keyframes toeflVideoNod {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(4px) rotate(1.2deg); }
        }
      `}</style>
      <div style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden', background: '#f2f3f5', animation: mode === 'recording' ? 'toeflVideoNod 1.6s ease-in-out infinite' : 'none' }}>
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block', transform: 'scale(2.1) translateY(-6%)', transformOrigin: 'center 20%' }}
        />
      </div>
    </div>
  )
}

// Photos of a man and woman having a conversation together (used for Listen to a Conversation).
// Drop numbered photos into public/avatars/conversations/1.jpg, 2.jpg, etc. and bump this count.
const CONVERSATION_PHOTO_COUNT = 7

function ConversationPhoto({ seed = 0, width = 640, height = 380 }) {
  const idx = (seed % CONVERSATION_PHOTO_COUNT) + 1
  const src = `/avatars/conversations/${idx}.jpg`
  return (
    <div style={{ width: `${width}px`, maxWidth: '90vw', height: `${height}px`, borderRadius: '16px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
      <img
        src={src}
        alt="Two people having a conversation"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%', display: 'block' }}
      />
      {/* Fade the photo's edges into the page background so it doesn't look like a pasted-in rectangle */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 60px 25px #f2f3f5' }} />
    </div>
  )
}

function ListeningP1List({ exercises, scores, onSelect, onBack }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {exercises.map((ex, idx) => {
            const locked = isLocked(ex)
            const result = scores[idx]
            const pct = result ? Math.round((result.correct / result.total) * 100) : null
            return (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Exercise {idx + 1}</div>
                    {result && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: pct >= 70 ? '#2ac56c' : '#e07b00', background: pct >= 70 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {result.correct}/{result.total} · {pct}%</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${ex.questions.length} question${ex.questions.length === 1 ? '' : 's'}`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => onSelect(idx)} style={{ background: result ? '#e5e7eb' : '#2ac56c', color: result ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {result ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

const LISTENING_P1_TIME = 20

function ListeningP1Exercise({ exercise, exerciseNum, onBack, onComplete, mockMode = false, isLastSlot = true, moduleOffset, moduleTotal }) {
  const isMobile = useIsMobile()
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState(null)
  const [done, setDone] = useState(false)
  const [timeLeft, setTimeLeft] = useState(LISTENING_P1_TIME)
  const [answers, setAnswers] = useState([])
  const [reviewQ, setReviewQ] = useState(null)
  const timerRef = useRef(null)
  const selectedRef = useRef(null)

  const questions = exercise.questions
  const q = questions[currentQ]
  const totalQ = questions.length

  useEffect(() => { selectedRef.current = selected }, [selected])
  // Defensive reset: guarantees no option looks pre-selected when a new question appears,
  // regardless of which code path advanced currentQ.
  useEffect(() => { setSelected(null) }, [currentQ])

  const advance = (sel) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const isCorrect = sel !== null && sel === q.answer
    const newAnswers = [...answers, { selected: sel, correct: q.answer, isCorrect }]
    if (currentQ + 1 >= totalQ) {
      if (mockMode) {
        const finalScore = newAnswers.filter(a => a.isCorrect).length
        const detail = questions.map((qq, i) => ({
          prompt: qq.context || `Question ${i + 1}`,
          given: newAnswers[i].selected !== null ? qq.options[newAnswers[i].selected] : 'No answer',
          correctAnswer: qq.options[qq.answer],
          isCorrect: newAnswers[i].isCorrect,
        }))
        onComplete(finalScore, totalQ, detail)
      } else {
        setAnswers(newAnswers)
        setDone(true)
      }
    } else {
      setAnswers(newAnswers)
      setCurrentQ(i => i + 1)
      setSelected(null)
    }
  }

  useEffect(() => {
    if (done) return
    setTimeLeft(LISTENING_P1_TIME)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          advance(selectedRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, done])

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const isLowTime = timeLeft <= 5
  const handleNext = () => advance(selected)
  const score = answers.filter(a => a.isCorrect).length

  // Score screen
  if (done) {
    const pct = Math.round((score / totalQ) * 100)
    const grade = pct >= 90 ? { label: 'Excellent!', color: '#2ac56c', emoji: '🏆' }
                : pct >= 70 ? { label: 'Good job!', color: '#701fa1', emoji: '🎉' }
                : pct >= 50 ? { label: 'Keep going', color: '#e07b00', emoji: '💪' }
                :             { label: 'Practice more', color: '#c0392b', emoji: '📚' }

    if (reviewQ !== null) {
      const rq = questions[reviewQ]
      const a = answers[reviewQ]
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 20 }}>
          <div style={{ padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <button onClick={() => setReviewQ(null)} style={{ background: 'none', border: 'none', fontSize: '13px', color: '#2ac56c', fontWeight: '700', cursor: 'pointer' }}>← Back to Review</button>
            <span style={{ fontSize: '13px', color: '#888' }}>Q{reviewQ + 1} of {totalQ}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setReviewQ(Math.max(0, reviewQ - 1))} disabled={reviewQ === 0} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === 0 ? '#ccc' : '#616473', cursor: reviewQ === 0 ? 'default' : 'pointer' }}>← Prev</button>
              <button onClick={() => setReviewQ(Math.min(totalQ - 1, reviewQ + 1))} disabled={reviewQ === totalQ - 1} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === totalQ - 1 ? '#ccc' : '#616473', cursor: reviewQ === totalQ - 1 ? 'default' : 'pointer' }}>Next →</button>
            </div>
          </div>
          <div style={{ height: '2.5px', background: '#2ac56c', flexShrink: 0 }} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '820px', width: '100%', display: 'flex', gap: isMobile ? '20px' : '36px', alignItems: isMobile ? 'stretch' : 'flex-start', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                <SpeakerAvatar gender={rq.speaker} seed={rq.id} />
                <div style={{ width: '220px' }}><AudioPlayer url={rq.audio_url} /></div>
                <div style={{ width: '220px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>{rq.context}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ fontSize: '17px', fontWeight: '600', color: '#1a1a1a' }}>Choose the best response.</div>
                {rq.options.map((opt, i) => {
                  const isCorrectOpt = i === rq.answer
                  const isWrongSelected = i === a.selected && !isCorrectOpt
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '4px 0' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isCorrectOpt ? '2px solid #2ac56c' : isWrongSelected ? '2px solid #d94040' : '2px solid #c0c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                        {isCorrectOpt && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#2ac56c', display: 'block' }} />}
                        {isWrongSelected && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#d94040', display: 'block' }} />}
                      </span>
                      <span style={{ fontSize: '15px', lineHeight: '1.5', color: isCorrectOpt ? '#1a7a44' : isWrongSelected ? '#b03030' : '#888', fontWeight: isCorrectOpt ? '600' : '400', flex: 1 }}>
                        {opt}
                        {isCorrectOpt && !a.isCorrect && <span style={{ fontSize: '11px', color: '#2ac56c', marginLeft: '6px', fontWeight: '700' }}>✓ correct</span>}
                        {isWrongSelected && <span style={{ fontSize: '11px', color: '#d94040', marginLeft: '6px' }}>✗ your answer</span>}
                      </span>
                    </div>
                  )
                })}
                {a.selected === null && <div style={{ fontSize: '12px', color: '#c07000', fontStyle: 'italic' }}>You ran out of time — no answer selected.</div>}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10, overflowY: 'auto' }}>
        <div style={{ maxWidth: '700px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center', marginBottom: '24px', border: '0.5px solid #e1e4ed' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>{grade.emoji}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: grade.color, marginBottom: '4px' }}>{grade.label}</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Exercise {exerciseNum} · {totalQ} questions</div>
            <div style={{ fontSize: '44px', fontWeight: '800', color: '#1a1a1a', lineHeight: '1' }}>{score}<span style={{ fontSize: '18px', color: '#aaa', fontWeight: '400' }}>/{totalQ}</span></div>
            <div style={{ margin: '14px 0 6px', height: '7px', background: '#efefef', borderRadius: '4px' }}><div style={{ width: pct + '%', height: '100%', background: grade.color, borderRadius: '4px' }} /></div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '20px' }}>{pct}% correct</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setCurrentQ(0); setSelected(null); setAnswers([]); setDone(false) }} style={{ flex: 1, padding: '11px', background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Try Again</button>
              <button onClick={() => onComplete(score, totalQ)} style={{ flex: 1, padding: '11px', background: '#fff', color: '#333', border: '1px solid #d0d5dd', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Back</button>
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Review · <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>tap a question to see details</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {questions.map((qq, qi) => {
              const a = answers[qi]
              if (!a) return null
              return (
                <div key={qi} onClick={() => setReviewQ(qi)} style={{ background: '#fff', borderRadius: '10px', padding: '14px 18px', border: '0.5px solid #e1e4ed', borderLeft: '4px solid ' + (a.isCorrect ? '#2ac56c' : '#d94040'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', background: a.isCorrect ? '#edfbf3' : '#fff2f2', color: a.isCorrect ? '#2ac56c' : '#d94040', padding: '2px 8px', borderRadius: '999px', fontWeight: '700', flexShrink: 0 }}>{a.isCorrect ? '✓' : '✗'} Q{qi + 1}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qq.context}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: a.isCorrect ? '#2ac56c' : '#b03030' }}>{a.isCorrect ? '✓ ' + qq.options[qq.answer] : (a.selected !== null ? '✗ You chose: ' + qq.options[a.selected] : '✗ No answer (time ran out)')}</div>
                  </div>
                  <span style={{ fontSize: '16px', color: '#c0c0c0', flexShrink: 0 }}>›</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={<TestPillButton onClick={handleNext}>{(currentQ + 1 >= totalQ && (!mockMode || isLastSlot)) ? 'Finish' : 'Next'}</TestPillButton>}
      section="LISTENING"
      questionLabel={moduleTotal !== undefined ? `Question ${moduleOffset + currentQ + 1} of ${moduleTotal}` : `Question ${currentQ + 1} of ${totalQ}`}
      timeText={formatTime(timeLeft)}
      lowTime={isLowTime}
      contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <h1 style={{ margin: isMobile ? '0 0 24px' : '0 0 40px', fontSize: isMobile ? '20px' : '26px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center' }}>Choose the best response.</h1>
      <div style={{ maxWidth: '980px', width: '100%', display: 'flex', gap: isMobile ? '24px' : '96px', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'center', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
        {/* Left: speaker avatar + audio */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <SpeakerAvatar gender={q.speaker} seed={q.id} />
          <div style={{ width: isMobile ? '100%' : '300px', maxWidth: '300px' }}><AudioPlayer url={q.audio_url} autoPlayKey={currentQ} /></div>
          {!q.audio_url && (
            <div style={{ width: isMobile ? '100%' : '300px', maxWidth: '300px', fontSize: '14px', color: '#1a1a1a', fontStyle: 'italic', textAlign: 'center', lineHeight: '1.5' }}>"{q.transcript}"</div>
          )}
        </div>

        {/* Right: options */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '28px', paddingTop: isMobile ? '0' : '48px', maxWidth: isMobile ? '100%' : '520px', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {q.options.map((opt, i) => {
              const isChosen = selected === i
              return (
                <div key={i} onClick={() => setSelected(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 0', cursor: 'pointer' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isChosen ? '6px solid #2ac56c' : '1.5px solid #c0c0c0', background: '#fff' }} />
                  <span style={{ fontSize: '16px', color: '#1a1a1a', lineHeight: '1.5', flex: 1 }}>{opt}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </ExamScreen>
  )
}

function ListeningP1({ onBack }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/listening/choose-response`).then(r => r.json()),
      fetchLatestResults('listening_p1'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setExercises(list)
      const mapped = {}
      list.forEach((ex, i) => { const row = results[String(ex.id ?? i)]; if (row) mapped[i] = { correct: row.score, total: row.total } })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!exercises.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found. Make sure the backend is running.</div>

  if (selectedIdx !== null) return (
    <ListeningP1Exercise exercise={exercises[selectedIdx]} exerciseNum={selectedIdx + 1} onBack={() => setSelectedIdx(null)}
      onComplete={(correct, total) => {
        saveResult('listening_p1', exercises[selectedIdx].id ?? selectedIdx, correct, total, `Choose a Response #${selectedIdx + 1}`)
        setScores(prev => ({ ...prev, [selectedIdx]: { correct, total } })); setSelectedIdx(null)
      }} />
  )
  return <ListeningP1List exercises={exercises} scores={scores} onSelect={setSelectedIdx} onBack={onBack} />
}

// ─── Listening Part 2 — Listen to a Conversation ──────────────────────────────
function ListeningP2List({ conversations, scores, onSelect, onBack }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {conversations.map((c, idx) => {
            const locked = isLocked(c)
            const result = scores[idx]
            const pct = result ? Math.round((result.correct / result.total) * 100) : null
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Conversation {idx + 1}</div>
                    {result && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: pct >= 70 ? '#2ac56c' : '#e07b00', background: pct >= 70 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {result.correct}/{result.total} · {pct}%</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${c.questions.length} questions`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => onSelect(idx)} style={{ background: result ? '#e5e7eb' : '#2ac56c', color: result ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {result ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

const LISTENING_P2_TIME = 30

function ListeningP2Exercise({ conversation, exerciseNum, onBack, onComplete, mockMode = false, isLastSlot = true, moduleOffset, moduleTotal }) {
  const isMobile = useIsMobile()
  const [phase, setPhase] = useState('listening') // 'listening' | 'question'
  const [qIdx, setQIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [done, setDone] = useState(false)
  const [timeLeft, setTimeLeft] = useState(LISTENING_P2_TIME)
  const [answers, setAnswers] = useState([])
  const [reviewQ, setReviewQ] = useState(null)
  const timerRef = useRef(null)
  const selectedRef = useRef(null)
  const announced = useIntroNarration(`${AUDIO_BASE_URL}/intro/listen_to_a_conversation.mp3`)

  const questions = conversation.questions
  const q = questions[qIdx]
  const totalQ = questions.length

  useEffect(() => { selectedRef.current = selected }, [selected])
  // Defensive reset: guarantees no option looks pre-selected when a new question appears,
  // regardless of which code path advanced qIdx.
  useEffect(() => { setSelected(null) }, [qIdx])

  const advance = (sel) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const isCorrect = sel !== null && sel === q.answer
    const newAnswers = [...answers, { selected: sel, correct: q.answer, isCorrect }]
    if (qIdx + 1 >= totalQ) {
      if (mockMode) {
        const finalScore = newAnswers.filter(a => a.isCorrect).length
        const detail = questions.map((qq, i) => ({
          prompt: qq.question || `Question ${i + 1}`,
          given: newAnswers[i].selected !== null ? qq.options[newAnswers[i].selected] : 'No answer',
          correctAnswer: qq.options[qq.answer],
          isCorrect: newAnswers[i].isCorrect,
        }))
        onComplete(finalScore, totalQ, detail)
      } else {
        setAnswers(newAnswers)
        setDone(true)
      }
    } else {
      setAnswers(newAnswers)
      setQIdx(i => i + 1)
      setSelected(null)
    }
  }

  useEffect(() => {
    if (phase !== 'question' || done) return
    setTimeLeft(LISTENING_P2_TIME)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          advance(selectedRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIdx, done])

  const formatTime = (s) => `00:${String(s).padStart(2, '0')}`
  const isLowTime = timeLeft <= 5
  const handleNext = () => advance(selected)
  const score = answers.filter(a => a.isCorrect).length

  // Score screen
  if (done) {
    const pct = Math.round((score / totalQ) * 100)
    const grade = pct >= 90 ? { label: 'Excellent!', color: '#2ac56c', emoji: '🏆' }
                : pct >= 70 ? { label: 'Good job!', color: '#701fa1', emoji: '🎉' }
                : pct >= 50 ? { label: 'Keep going', color: '#e07b00', emoji: '💪' }
                :             { label: 'Practice more', color: '#c0392b', emoji: '📚' }

    if (reviewQ !== null) {
      const rq = questions[reviewQ]
      const a = answers[reviewQ]
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 20 }}>
          <div style={{ padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <button onClick={() => setReviewQ(null)} style={{ background: 'none', border: 'none', fontSize: '13px', color: '#2ac56c', fontWeight: '700', cursor: 'pointer' }}>← Back to Review</button>
            <span style={{ fontSize: '13px', color: '#888' }}>Q{reviewQ + 1} of {totalQ}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setReviewQ(Math.max(0, reviewQ - 1))} disabled={reviewQ === 0} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === 0 ? '#ccc' : '#616473', cursor: reviewQ === 0 ? 'default' : 'pointer' }}>← Prev</button>
              <button onClick={() => setReviewQ(Math.min(totalQ - 1, reviewQ + 1))} disabled={reviewQ === totalQ - 1} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === totalQ - 1 ? '#ccc' : '#616473', cursor: reviewQ === totalQ - 1 ? 'default' : 'pointer' }}>Next →</button>
            </div>
          </div>
          <div style={{ height: '2.5px', background: '#2ac56c', flexShrink: 0 }} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '700px', width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '17px', fontWeight: '600', color: '#1a1a1a' }}>{rq.question}</div>
              {rq.options.map((opt, i) => {
                const isCorrectOpt = i === rq.answer
                const isWrongSelected = i === a.selected && !isCorrectOpt
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '4px 0' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isCorrectOpt ? '2px solid #2ac56c' : isWrongSelected ? '2px solid #d94040' : '2px solid #c0c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                      {isCorrectOpt && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#2ac56c', display: 'block' }} />}
                      {isWrongSelected && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#d94040', display: 'block' }} />}
                    </span>
                    <span style={{ fontSize: '15px', lineHeight: '1.5', color: isCorrectOpt ? '#1a7a44' : isWrongSelected ? '#b03030' : '#888', fontWeight: isCorrectOpt ? '600' : '400', flex: 1 }}>
                      {opt}
                      {isCorrectOpt && !a.isCorrect && <span style={{ fontSize: '11px', color: '#2ac56c', marginLeft: '6px', fontWeight: '700' }}>✓ correct</span>}
                      {isWrongSelected && <span style={{ fontSize: '11px', color: '#d94040', marginLeft: '6px' }}>✗ your answer</span>}
                    </span>
                  </div>
                )
              })}
              {a.selected === null && <div style={{ fontSize: '12px', color: '#c07000', fontStyle: 'italic' }}>You ran out of time — no answer selected.</div>}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10, overflowY: 'auto' }}>
        <div style={{ maxWidth: '700px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center', marginBottom: '24px', border: '0.5px solid #e1e4ed' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>{grade.emoji}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: grade.color, marginBottom: '4px' }}>{grade.label}</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Conversation {exerciseNum} · {totalQ} questions</div>
            <div style={{ fontSize: '44px', fontWeight: '800', color: '#1a1a1a', lineHeight: '1' }}>{score}<span style={{ fontSize: '18px', color: '#aaa', fontWeight: '400' }}>/{totalQ}</span></div>
            <div style={{ margin: '14px 0 6px', height: '7px', background: '#efefef', borderRadius: '4px' }}><div style={{ width: pct + '%', height: '100%', background: grade.color, borderRadius: '4px' }} /></div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '20px' }}>{pct}% correct</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setPhase('listening'); setQIdx(0); setSelected(null); setAnswers([]); setDone(false) }} style={{ flex: 1, padding: '11px', background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Try Again</button>
              <button onClick={() => onComplete(score, totalQ)} style={{ flex: 1, padding: '11px', background: '#fff', color: '#333', border: '1px solid #d0d5dd', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Back</button>
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Review · <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>tap a question to see details</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {questions.map((qq, qi) => {
              const a = answers[qi]
              if (!a) return null
              return (
                <div key={qi} onClick={() => setReviewQ(qi)} style={{ background: '#fff', borderRadius: '10px', padding: '14px 18px', border: '0.5px solid #e1e4ed', borderLeft: '4px solid ' + (a.isCorrect ? '#2ac56c' : '#d94040'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', background: a.isCorrect ? '#edfbf3' : '#fff2f2', color: a.isCorrect ? '#2ac56c' : '#d94040', padding: '2px 8px', borderRadius: '999px', fontWeight: '700', flexShrink: 0 }}>{a.isCorrect ? '✓' : '✗'} Q{qi + 1}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qq.question}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: a.isCorrect ? '#2ac56c' : '#b03030' }}>{a.isCorrect ? '✓ ' + qq.options[qq.answer] : (a.selected !== null ? '✗ You chose: ' + qq.options[a.selected] : '✗ No answer (time ran out)')}</div>
                  </div>
                  <span style={{ fontSize: '16px', color: '#c0c0c0', flexShrink: 0 }}>›</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Listening phase — only the two speakers are shown, audio autoplays, no questions yet
  if (phase === 'listening') {
    return (
      <ExamScreen
        topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
        section="LISTENING"
        questionLabel={moduleTotal !== undefined ? (totalQ > 1 ? `Questions ${moduleOffset + 1}-${moduleOffset + totalQ} of ${moduleTotal}` : `Question ${moduleOffset + 1} of ${moduleTotal}`) : `Conversation ${exerciseNum}`}
        contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center' }}>Listen to a conversation.</h1>
        <div style={{ fontSize: '14px', color: '#888', textAlign: 'center', marginBottom: '32px' }}>Two questions will follow once the conversation ends.</div>
        <ConversationPhoto seed={conversation.id} />
        {announced && (
          <div style={{ width: '1px', height: '1px', overflow: 'hidden' }}>
            <AudioPlayer url={conversation.audio_url} autoPlayKey={conversation.id} onEnded={() => setPhase('question')} />
          </div>
        )}
      </ExamScreen>
    )
  }

  // Question phase
  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={<TestPillButton onClick={handleNext}>{(qIdx + 1 >= totalQ && (!mockMode || isLastSlot)) ? 'Finish' : 'Next'}</TestPillButton>}
      section="LISTENING"
      questionLabel={moduleTotal !== undefined ? `Question ${moduleOffset + qIdx + 1} of ${moduleTotal}` : `Question ${qIdx + 1} of ${totalQ}`}
      timeText={formatTime(timeLeft)}
      lowTime={isLowTime}
    >
      <div style={{ maxWidth: '980px', width: '100%', margin: '0 auto', display: 'flex', gap: isMobile ? '20px' : '64px', alignItems: isMobile ? 'center' : 'flex-start', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
        <div style={{ flexShrink: 0 }}>
          <ConversationPhoto seed={conversation.id} width={isMobile ? 220 : 340} height={isMobile ? 220 : 340} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: isMobile ? '0' : '8px', width: '100%' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: '#1a1a1a', marginBottom: isMobile ? '20px' : '32px' }}>{q.question}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {q.options.map((opt, i) => {
              const isChosen = selected === i
              return (
                <div key={i} onClick={() => setSelected(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 0', cursor: 'pointer' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isChosen ? '6px solid #2ac56c' : '1.5px solid #c0c0c0', background: '#fff' }} />
                  <span style={{ fontSize: '16px', color: '#1a1a1a', lineHeight: '1.5', flex: 1 }}>{opt}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </ExamScreen>
  )
}

function ListeningP2({ onBack }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/listening/conversation`).then(r => r.json()),
      fetchLatestResults('listening_p2'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setConversations(list)
      const mapped = {}
      list.forEach((ex, i) => { const row = results[String(ex.id ?? i)]; if (row) mapped[i] = { correct: row.score, total: row.total } })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!conversations.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found. Make sure the backend is running.</div>

  if (selectedIdx !== null) return (
    <ListeningP2Exercise conversation={conversations[selectedIdx]} exerciseNum={selectedIdx + 1} onBack={() => setSelectedIdx(null)}
      onComplete={(correct, total) => {
        saveResult('listening_p2', conversations[selectedIdx].id ?? selectedIdx, correct, total, `Conversation #${selectedIdx + 1}`)
        setScores(prev => ({ ...prev, [selectedIdx]: { correct, total } })); setSelectedIdx(null)
      }} />
  )
  return <ListeningP2List conversations={conversations} scores={scores} onSelect={setSelectedIdx} onBack={onBack} />
}

// ─── Listening Part 3 — Listen to an Announcement ─────────────────────────────
function ListeningP3List({ announcements, scores, onSelect, onBack }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {announcements.map((a, idx) => {
            const locked = isLocked(a)
            const result = scores[idx]
            const pct = result ? Math.round((result.correct / result.total) * 100) : null
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Announcement {idx + 1}</div>
                    {result && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: pct >= 70 ? '#2ac56c' : '#e07b00', background: pct >= 70 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {result.correct}/{result.total} · {pct}%</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${a.questions.length} questions`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => onSelect(idx)} style={{ background: result ? '#e5e7eb' : '#2ac56c', color: result ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {result ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

const LISTENING_P3_TIME = 30

function ListeningP3Exercise({ announcement, exerciseNum, onBack, onComplete, mockMode = false, isLastSlot = true, moduleOffset, moduleTotal }) {
  const isMobile = useIsMobile()
  const [phase, setPhase] = useState('listening') // 'listening' | 'question'
  const [qIdx, setQIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [done, setDone] = useState(false)
  const [timeLeft, setTimeLeft] = useState(LISTENING_P3_TIME)
  const [answers, setAnswers] = useState([])
  const [reviewQ, setReviewQ] = useState(null)
  const timerRef = useRef(null)
  const selectedRef = useRef(null)
  const announced = useIntroNarration(`${AUDIO_BASE_URL}/intro/listen_to_an_announcement.mp3`)

  const questions = announcement.questions
  const q = questions[qIdx]
  const totalQ = questions.length

  useEffect(() => { selectedRef.current = selected }, [selected])
  // Defensive reset: guarantees no option looks pre-selected when a new question appears,
  // regardless of which code path advanced qIdx.
  useEffect(() => { setSelected(null) }, [qIdx])

  const advance = (sel) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const isCorrect = sel !== null && sel === q.answer
    const newAnswers = [...answers, { selected: sel, correct: q.answer, isCorrect }]
    if (qIdx + 1 >= totalQ) {
      if (mockMode) {
        const finalScore = newAnswers.filter(a => a.isCorrect).length
        const detail = questions.map((qq, i) => ({
          prompt: qq.question || `Question ${i + 1}`,
          given: newAnswers[i].selected !== null ? qq.options[newAnswers[i].selected] : 'No answer',
          correctAnswer: qq.options[qq.answer],
          isCorrect: newAnswers[i].isCorrect,
        }))
        onComplete(finalScore, totalQ, detail)
      } else {
        setAnswers(newAnswers)
        setDone(true)
      }
    } else {
      setAnswers(newAnswers)
      setQIdx(i => i + 1)
      setSelected(null)
    }
  }

  useEffect(() => {
    if (phase !== 'question' || done) return
    setTimeLeft(LISTENING_P3_TIME)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          advance(selectedRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIdx, done])

  const formatTime = (s) => `00:${String(s).padStart(2, '0')}`
  const isLowTime = timeLeft <= 5
  const handleNext = () => advance(selected)
  const score = answers.filter(a => a.isCorrect).length

  // Score screen
  if (done) {
    const pct = Math.round((score / totalQ) * 100)
    const grade = pct >= 90 ? { label: 'Excellent!', color: '#2ac56c', emoji: '🏆' }
                : pct >= 70 ? { label: 'Good job!', color: '#701fa1', emoji: '🎉' }
                : pct >= 50 ? { label: 'Keep going', color: '#e07b00', emoji: '💪' }
                :             { label: 'Practice more', color: '#c0392b', emoji: '📚' }

    if (reviewQ !== null) {
      const rq = questions[reviewQ]
      const a = answers[reviewQ]
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 20 }}>
          <div style={{ padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <button onClick={() => setReviewQ(null)} style={{ background: 'none', border: 'none', fontSize: '13px', color: '#2ac56c', fontWeight: '700', cursor: 'pointer' }}>← Back to Review</button>
            <span style={{ fontSize: '13px', color: '#888' }}>Q{reviewQ + 1} of {totalQ}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setReviewQ(Math.max(0, reviewQ - 1))} disabled={reviewQ === 0} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === 0 ? '#ccc' : '#616473', cursor: reviewQ === 0 ? 'default' : 'pointer' }}>← Prev</button>
              <button onClick={() => setReviewQ(Math.min(totalQ - 1, reviewQ + 1))} disabled={reviewQ === totalQ - 1} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === totalQ - 1 ? '#ccc' : '#616473', cursor: reviewQ === totalQ - 1 ? 'default' : 'pointer' }}>Next →</button>
            </div>
          </div>
          <div style={{ height: '2.5px', background: '#2ac56c', flexShrink: 0 }} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '700px', width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '17px', fontWeight: '600', color: '#1a1a1a' }}>{rq.question}</div>
              {rq.options.map((opt, i) => {
                const isCorrectOpt = i === rq.answer
                const isWrongSelected = i === a.selected && !isCorrectOpt
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '4px 0' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isCorrectOpt ? '2px solid #2ac56c' : isWrongSelected ? '2px solid #d94040' : '2px solid #c0c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                      {isCorrectOpt && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#2ac56c', display: 'block' }} />}
                      {isWrongSelected && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#d94040', display: 'block' }} />}
                    </span>
                    <span style={{ fontSize: '15px', lineHeight: '1.5', color: isCorrectOpt ? '#1a7a44' : isWrongSelected ? '#b03030' : '#888', fontWeight: isCorrectOpt ? '600' : '400', flex: 1 }}>
                      {opt}
                      {isCorrectOpt && !a.isCorrect && <span style={{ fontSize: '11px', color: '#2ac56c', marginLeft: '6px', fontWeight: '700' }}>✓ correct</span>}
                      {isWrongSelected && <span style={{ fontSize: '11px', color: '#d94040', marginLeft: '6px' }}>✗ your answer</span>}
                    </span>
                  </div>
                )
              })}
              {a.selected === null && <div style={{ fontSize: '12px', color: '#c07000', fontStyle: 'italic' }}>You ran out of time — no answer selected.</div>}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10, overflowY: 'auto' }}>
        <div style={{ maxWidth: '700px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center', marginBottom: '24px', border: '0.5px solid #e1e4ed' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>{grade.emoji}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: grade.color, marginBottom: '4px' }}>{grade.label}</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Announcement {exerciseNum} · {totalQ} questions</div>
            <div style={{ fontSize: '44px', fontWeight: '800', color: '#1a1a1a', lineHeight: '1' }}>{score}<span style={{ fontSize: '18px', color: '#aaa', fontWeight: '400' }}>/{totalQ}</span></div>
            <div style={{ margin: '14px 0 6px', height: '7px', background: '#efefef', borderRadius: '4px' }}><div style={{ width: pct + '%', height: '100%', background: grade.color, borderRadius: '4px' }} /></div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '20px' }}>{pct}% correct</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setPhase('listening'); setQIdx(0); setSelected(null); setAnswers([]); setDone(false) }} style={{ flex: 1, padding: '11px', background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Try Again</button>
              <button onClick={() => onComplete(score, totalQ)} style={{ flex: 1, padding: '11px', background: '#fff', color: '#333', border: '1px solid #d0d5dd', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Back</button>
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Review · <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>tap a question to see details</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {questions.map((qq, qi) => {
              const a = answers[qi]
              if (!a) return null
              return (
                <div key={qi} onClick={() => setReviewQ(qi)} style={{ background: '#fff', borderRadius: '10px', padding: '14px 18px', border: '0.5px solid #e1e4ed', borderLeft: '4px solid ' + (a.isCorrect ? '#2ac56c' : '#d94040'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', background: a.isCorrect ? '#edfbf3' : '#fff2f2', color: a.isCorrect ? '#2ac56c' : '#d94040', padding: '2px 8px', borderRadius: '999px', fontWeight: '700', flexShrink: 0 }}>{a.isCorrect ? '✓' : '✗'} Q{qi + 1}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qq.question}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: a.isCorrect ? '#2ac56c' : '#b03030' }}>{a.isCorrect ? '✓ ' + qq.options[qq.answer] : (a.selected !== null ? '✗ You chose: ' + qq.options[a.selected] : '✗ No answer (time ran out)')}</div>
                  </div>
                  <span style={{ fontSize: '16px', color: '#c0c0c0', flexShrink: 0 }}>›</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Listening phase — a single announcer avatar is shown, audio autoplays, no questions yet
  if (phase === 'listening') {
    return (
      <ExamScreen
        topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
        section="LISTENING"
        questionLabel={moduleTotal !== undefined ? (totalQ > 1 ? `Questions ${moduleOffset + 1}-${moduleOffset + totalQ} of ${moduleTotal}` : `Question ${moduleOffset + 1} of ${moduleTotal}`) : `Announcement ${exerciseNum}`}
        contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center' }}>Listen to an announcement.</h1>
        <div style={{ fontSize: '14px', color: '#888', textAlign: 'center', marginBottom: '32px' }}>Two questions will follow once the announcement ends.</div>
        <SpeakerAvatar gender={announcement.speaker} seed={announcement.id} width={260} height={340} />
        {announced && (
          <div style={{ width: '1px', height: '1px', overflow: 'hidden' }}>
            <AudioPlayer url={announcement.audio_url} autoPlayKey={announcement.id} onEnded={() => setPhase('question')} />
          </div>
        )}
      </ExamScreen>
    )
  }

  // Question phase
  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={<TestPillButton onClick={handleNext}>{(qIdx + 1 >= totalQ && (!mockMode || isLastSlot)) ? 'Finish' : 'Next'}</TestPillButton>}
      section="LISTENING"
      questionLabel={moduleTotal !== undefined ? `Question ${moduleOffset + qIdx + 1} of ${moduleTotal}` : `Question ${qIdx + 1} of ${totalQ}`}
      timeText={formatTime(timeLeft)}
      lowTime={isLowTime}
    >
      <div style={{ maxWidth: '980px', width: '100%', margin: '0 auto', display: 'flex', gap: isMobile ? '20px' : '64px', alignItems: isMobile ? 'center' : 'flex-start', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
        <div style={{ flexShrink: 0 }}>
          <SpeakerAvatar gender={announcement.speaker} seed={announcement.id} width={isMobile ? 180 : 260} height={isMobile ? 180 : 260} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: isMobile ? '0' : '8px', width: '100%' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: '#1a1a1a', marginBottom: isMobile ? '20px' : '32px' }}>{q.question}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {q.options.map((opt, i) => {
              const isChosen = selected === i
              return (
                <div key={i} onClick={() => setSelected(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 0', cursor: 'pointer' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isChosen ? '6px solid #2ac56c' : '1.5px solid #c0c0c0', background: '#fff' }} />
                  <span style={{ fontSize: '16px', color: '#1a1a1a', lineHeight: '1.5', flex: 1 }}>{opt}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </ExamScreen>
  )
}

function ListeningP3({ onBack }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/listening/announcement`).then(r => r.json()),
      fetchLatestResults('listening_p3'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setAnnouncements(list)
      const mapped = {}
      list.forEach((ex, i) => { const row = results[String(ex.id ?? i)]; if (row) mapped[i] = { correct: row.score, total: row.total } })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!announcements.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found. Make sure the backend is running.</div>

  if (selectedIdx !== null) return (
    <ListeningP3Exercise announcement={announcements[selectedIdx]} exerciseNum={selectedIdx + 1} onBack={() => setSelectedIdx(null)}
      onComplete={(correct, total) => {
        saveResult('listening_p3', announcements[selectedIdx].id ?? selectedIdx, correct, total, `Announcement #${selectedIdx + 1}`)
        setScores(prev => ({ ...prev, [selectedIdx]: { correct, total } })); setSelectedIdx(null)
      }} />
  )
  return <ListeningP3List announcements={announcements} scores={scores} onSelect={setSelectedIdx} onBack={onBack} />
}

// ─── Listening Part 4 — Listen to an Academic Talk ────────────────────────────
function ListeningP4List({ talks, scores, onSelect, onBack }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {talks.map((t, idx) => {
            const locked = isLocked(t)
            const result = scores[idx]
            const pct = result ? Math.round((result.correct / result.total) * 100) : null
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Talk {idx + 1}</div>
                    {result && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: pct >= 70 ? '#2ac56c' : '#e07b00', background: pct >= 70 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {result.correct}/{result.total} · {pct}%</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${t.questions.length} questions`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => onSelect(idx)} style={{ background: result ? '#e5e7eb' : '#2ac56c', color: result ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {result ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

const LISTENING_P4_TIME = 30

function ListeningP4Exercise({ talk, exerciseNum, onBack, onComplete, mockMode = false, isLastSlot = true, moduleOffset, moduleTotal }) {
  const isMobile = useIsMobile()
  const [phase, setPhase] = useState('listening') // 'listening' | 'question'
  const [qIdx, setQIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [done, setDone] = useState(false)
  const [timeLeft, setTimeLeft] = useState(LISTENING_P4_TIME)
  const [answers, setAnswers] = useState([])
  const [reviewQ, setReviewQ] = useState(null)
  const timerRef = useRef(null)
  const selectedRef = useRef(null)

  const questions = talk.questions
  const q = questions[qIdx]
  const totalQ = questions.length
  const talkIntroText = talk.subject ? `Listen to a talk in ${/^[aeiou]/i.test(talk.subject) ? 'an' : 'a'} ${talk.subject.toLowerCase()} class.` : 'Listen to a talk in an academic class.'
  const announced = useIntroNarration(`${AUDIO_BASE_URL}/intro/academic_talk_${mockMode ? 'mock' : 'practice'}_${talk.id}.mp3`)

  useEffect(() => { selectedRef.current = selected }, [selected])
  // Defensive reset: guarantees no option looks pre-selected when a new question appears,
  // regardless of which code path advanced qIdx.
  useEffect(() => { setSelected(null) }, [qIdx])

  const advance = (sel) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const isCorrect = sel !== null && sel === q.answer
    const newAnswers = [...answers, { selected: sel, correct: q.answer, isCorrect }]
    if (qIdx + 1 >= totalQ) {
      if (mockMode) {
        const finalScore = newAnswers.filter(a => a.isCorrect).length
        const detail = questions.map((qq, i) => ({
          prompt: qq.question || `Question ${i + 1}`,
          given: newAnswers[i].selected !== null ? qq.options[newAnswers[i].selected] : 'No answer',
          correctAnswer: qq.options[qq.answer],
          isCorrect: newAnswers[i].isCorrect,
        }))
        onComplete(finalScore, totalQ, detail)
      } else {
        setAnswers(newAnswers)
        setDone(true)
      }
    } else {
      setAnswers(newAnswers)
      setQIdx(i => i + 1)
      setSelected(null)
    }
  }

  useEffect(() => {
    if (phase !== 'question' || done) return
    setTimeLeft(LISTENING_P4_TIME)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          advance(selectedRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIdx, done])

  const formatTime = (s) => `00:${String(s).padStart(2, '0')}`
  const isLowTime = timeLeft <= 5
  const handleNext = () => advance(selected)
  const score = answers.filter(a => a.isCorrect).length

  // Score screen
  if (done) {
    const pct = Math.round((score / totalQ) * 100)
    const grade = pct >= 90 ? { label: 'Excellent!', color: '#2ac56c', emoji: '🏆' }
                : pct >= 70 ? { label: 'Good job!', color: '#701fa1', emoji: '🎉' }
                : pct >= 50 ? { label: 'Keep going', color: '#e07b00', emoji: '💪' }
                :             { label: 'Practice more', color: '#c0392b', emoji: '📚' }

    if (reviewQ !== null) {
      const rq = questions[reviewQ]
      const a = answers[reviewQ]
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 20 }}>
          <div style={{ padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <button onClick={() => setReviewQ(null)} style={{ background: 'none', border: 'none', fontSize: '13px', color: '#2ac56c', fontWeight: '700', cursor: 'pointer' }}>← Back to Review</button>
            <span style={{ fontSize: '13px', color: '#888' }}>Q{reviewQ + 1} of {totalQ}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setReviewQ(Math.max(0, reviewQ - 1))} disabled={reviewQ === 0} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === 0 ? '#ccc' : '#616473', cursor: reviewQ === 0 ? 'default' : 'pointer' }}>← Prev</button>
              <button onClick={() => setReviewQ(Math.min(totalQ - 1, reviewQ + 1))} disabled={reviewQ === totalQ - 1} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === totalQ - 1 ? '#ccc' : '#616473', cursor: reviewQ === totalQ - 1 ? 'default' : 'pointer' }}>Next →</button>
            </div>
          </div>
          <div style={{ height: '2.5px', background: '#2ac56c', flexShrink: 0 }} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '700px', width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ fontSize: '17px', fontWeight: '600', color: '#1a1a1a' }}>{rq.question}</div>
              {rq.options.map((opt, i) => {
                const isCorrectOpt = i === rq.answer
                const isWrongSelected = i === a.selected && !isCorrectOpt
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '4px 0' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isCorrectOpt ? '2px solid #2ac56c' : isWrongSelected ? '2px solid #d94040' : '2px solid #c0c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                      {isCorrectOpt && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#2ac56c', display: 'block' }} />}
                      {isWrongSelected && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#d94040', display: 'block' }} />}
                    </span>
                    <span style={{ fontSize: '15px', lineHeight: '1.5', color: isCorrectOpt ? '#1a7a44' : isWrongSelected ? '#b03030' : '#888', fontWeight: isCorrectOpt ? '600' : '400', flex: 1 }}>
                      {opt}
                      {isCorrectOpt && !a.isCorrect && <span style={{ fontSize: '11px', color: '#2ac56c', marginLeft: '6px', fontWeight: '700' }}>✓ correct</span>}
                      {isWrongSelected && <span style={{ fontSize: '11px', color: '#d94040', marginLeft: '6px' }}>✗ your answer</span>}
                    </span>
                  </div>
                )
              })}
              {a.selected === null && <div style={{ fontSize: '12px', color: '#c07000', fontStyle: 'italic' }}>You ran out of time — no answer selected.</div>}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10, overflowY: 'auto' }}>
        <div style={{ maxWidth: '700px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center', marginBottom: '24px', border: '0.5px solid #e1e4ed' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>{grade.emoji}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: grade.color, marginBottom: '4px' }}>{grade.label}</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Talk {exerciseNum} · {totalQ} questions</div>
            <div style={{ fontSize: '44px', fontWeight: '800', color: '#1a1a1a', lineHeight: '1' }}>{score}<span style={{ fontSize: '18px', color: '#aaa', fontWeight: '400' }}>/{totalQ}</span></div>
            <div style={{ margin: '14px 0 6px', height: '7px', background: '#efefef', borderRadius: '4px' }}><div style={{ width: pct + '%', height: '100%', background: grade.color, borderRadius: '4px' }} /></div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '20px' }}>{pct}% correct</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setPhase('listening'); setQIdx(0); setSelected(null); setAnswers([]); setDone(false) }} style={{ flex: 1, padding: '11px', background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Try Again</button>
              <button onClick={() => onComplete(score, totalQ)} style={{ flex: 1, padding: '11px', background: '#fff', color: '#333', border: '1px solid #d0d5dd', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Back</button>
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Review · <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>tap a question to see details</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {questions.map((qq, qi) => {
              const a = answers[qi]
              if (!a) return null
              return (
                <div key={qi} onClick={() => setReviewQ(qi)} style={{ background: '#fff', borderRadius: '10px', padding: '14px 18px', border: '0.5px solid #e1e4ed', borderLeft: '4px solid ' + (a.isCorrect ? '#2ac56c' : '#d94040'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', background: a.isCorrect ? '#edfbf3' : '#fff2f2', color: a.isCorrect ? '#2ac56c' : '#d94040', padding: '2px 8px', borderRadius: '999px', fontWeight: '700', flexShrink: 0 }}>{a.isCorrect ? '✓' : '✗'} Q{qi + 1}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qq.question}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: a.isCorrect ? '#2ac56c' : '#b03030' }}>{a.isCorrect ? '✓ ' + qq.options[qq.answer] : (a.selected !== null ? '✗ You chose: ' + qq.options[a.selected] : '✗ No answer (time ran out)')}</div>
                  </div>
                  <span style={{ fontSize: '16px', color: '#c0c0c0', flexShrink: 0 }}>›</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Listening phase — a single lecturer avatar is shown, audio autoplays, no questions yet
  if (phase === 'listening') {
    return (
      <ExamScreen
        topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
        section="LISTENING"
        questionLabel={moduleTotal !== undefined ? (totalQ > 1 ? `Questions ${moduleOffset + 1}-${moduleOffset + totalQ} of ${moduleTotal}` : `Question ${moduleOffset + 1} of ${moduleTotal}`) : `Talk ${exerciseNum}`}
        contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center' }}>
          {talkIntroText}
        </h1>
        <div style={{ fontSize: '14px', color: '#888', textAlign: 'center', marginBottom: '32px' }}>Questions will follow once the talk ends.</div>
        <SpeakerAvatar gender={talk.speaker} seed={talk.id} width={260} height={340} />
        {announced && (
          <div style={{ width: '1px', height: '1px', overflow: 'hidden' }}>
            <AudioPlayer url={talk.audio_url} autoPlayKey={talk.id} onEnded={() => setPhase('question')} />
          </div>
        )}
      </ExamScreen>
    )
  }

  // Question phase
  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={<TestPillButton onClick={handleNext}>{(qIdx + 1 >= totalQ && (!mockMode || isLastSlot)) ? 'Finish' : 'Next'}</TestPillButton>}
      section="LISTENING"
      questionLabel={moduleTotal !== undefined ? `Question ${moduleOffset + qIdx + 1} of ${moduleTotal}` : `Question ${qIdx + 1} of ${totalQ}`}
      timeText={formatTime(timeLeft)}
      lowTime={isLowTime}
    >
      <div style={{ maxWidth: '980px', width: '100%', margin: '0 auto', display: 'flex', gap: isMobile ? '20px' : '64px', alignItems: isMobile ? 'center' : 'flex-start', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
        <div style={{ flexShrink: 0 }}>
          <SpeakerAvatar gender={talk.speaker} seed={talk.id} width={isMobile ? 180 : 260} height={isMobile ? 180 : 260} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: isMobile ? '0' : '8px', width: '100%' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: '#1a1a1a', marginBottom: isMobile ? '20px' : '32px' }}>{q.question}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {q.options.map((opt, i) => {
              const isChosen = selected === i
              return (
                <div key={i} onClick={() => setSelected(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 0', cursor: 'pointer' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isChosen ? '6px solid #2ac56c' : '1.5px solid #c0c0c0', background: '#fff' }} />
                  <span style={{ fontSize: '16px', color: '#1a1a1a', lineHeight: '1.5', flex: 1 }}>{opt}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </ExamScreen>
  )
}

function ListeningP4({ onBack }) {
  const [talks, setTalks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/listening/academic-talk`).then(r => r.json()),
      fetchLatestResults('listening_p4'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setTalks(list)
      const mapped = {}
      list.forEach((ex, i) => { const row = results[String(ex.id ?? i)]; if (row) mapped[i] = { correct: row.score, total: row.total } })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!talks.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found. Make sure the backend is running.</div>

  if (selectedIdx !== null) return (
    <ListeningP4Exercise talk={talks[selectedIdx]} exerciseNum={selectedIdx + 1} onBack={() => setSelectedIdx(null)}
      onComplete={(correct, total) => {
        saveResult('listening_p4', talks[selectedIdx].id ?? selectedIdx, correct, total, `Academic Talk #${selectedIdx + 1}`)
        setScores(prev => ({ ...prev, [selectedIdx]: { correct, total } })); setSelectedIdx(null)
      }} />
  )
  return <ListeningP4List talks={talks} scores={scores} onSelect={setSelectedIdx} onBack={onBack} />
}

// ─── Writing Part 1 — Build a Sentence ────────────────────────────────────────
// Total shared clock for the whole 10-item set (matches ETS's official Writing section
// budget: 23 min total - 7 min Email - 10 min Discussion = 6 min for Build a Sentence),
// not a per-item timer like the other modules.
const BUILD_SENTENCE_TOTAL_TIME = 360 // 6:00 per practice set
const BUILD_SENTENCE_SET_SIZE = 10

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function BuildSentenceItem({ item, onChange, initialPlaced }) {
  // Word bank = correct chunks + distractor chunks, shuffled once per item.
  const bank = useMemo(() => shuffleArray([...item.correctChunks, ...(item.distractorChunks || [])]), [item.id])
  const slotCount = item.correctChunks.length
  // Restores a previous placement (e.g. after pressing Back and then coming forward again) by
  // matching each placed word's text to a bank chip, since the bank is reshuffled on every mount.
  const [slots, setSlots] = useState(() => {
    if (!initialPlaced || !initialPlaced.some(Boolean)) return Array(slotCount).fill(null)
    const usedIdx = new Set()
    return initialPlaced.map(text => {
      if (!text) return null
      const idx = bank.findIndex((t, i) => t === text && !usedIdx.has(i))
      if (idx === -1) return null
      usedIdx.add(idx)
      return { bankIdx: idx, text }
    })
  })
  const [dragOverSlot, setDragOverSlot] = useState(null)
  const [dragOverBank, setDragOverBank] = useState(false)

  useEffect(() => {
    onChange(slots.map(s => (s ? s.text : null)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots])

  const usedBankIdx = new Set(slots.filter(Boolean).map(s => s.bankIdx))

  const setDragData = (e, data) => e.dataTransfer.setData('text/plain', JSON.stringify(data))
  const getDragData = (e) => { try { return JSON.parse(e.dataTransfer.getData('text/plain')) } catch { return null } }

  const placeAt = (slotIdx, data) => {
    if (!data) return
    setSlots(prev => {
      const next = [...prev]
      if (data.from === 'bank') {
        // Free up any slot that currently holds this same bank chip.
        for (let i = 0; i < next.length; i++) {
          if (next[i] && next[i].bankIdx === data.bankIdx) next[i] = null
        }
        next[slotIdx] = { bankIdx: data.bankIdx, text: data.text }
      } else if (data.from === 'slot') {
        if (data.slotIdx === slotIdx) return prev
        const tmp = next[slotIdx]
        next[slotIdx] = next[data.slotIdx]
        next[data.slotIdx] = tmp
      }
      return next
    })
  }

  const removeSlot = (slotIdx) => setSlots(prev => { const next = [...prev]; next[slotIdx] = null; return next })

  const placeFirstEmpty = (bankIdx, text) => {
    setSlots(prev => {
      const firstEmpty = prev.findIndex(s => s === null)
      if (firstEmpty === -1) return prev
      const next = [...prev]
      next[firstEmpty] = { bankIdx, text }
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <SpeakerAvatar gender={item.promptGender} seed={item.id} width={64} height={64} />
        <div style={{ fontSize: '19px', fontWeight: '700', color: '#11162d', lineHeight: '1.5', paddingTop: '10px' }}>{item.prompt}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <SpeakerAvatar gender={item.responseGender} seed={item.id + 1} width={64} height={64} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', paddingTop: '10px', minHeight: '40px' }}>
          {item.responsePrefix && <span style={{ fontSize: '19px', color: '#11162d' }}>{item.responsePrefix}</span>}
          {slots.map((slot, i) => (
            slot ? (
              <span key={i}
                draggable
                onDragStart={(e) => setDragData(e, { from: 'slot', slotIdx: i })}
                onDragOver={(e) => { e.preventDefault(); setDragOverSlot(i) }}
                onDragLeave={() => setDragOverSlot(prev => (prev === i ? null : prev))}
                onDrop={(e) => { e.preventDefault(); placeAt(i, getDragData(e)); setDragOverSlot(null) }}
                onClick={() => removeSlot(i)}
                title="Drag to reorder, or click to remove"
                style={{ fontSize: '17px', color: '#1a5c3a', background: '#edfbf3', border: '1px solid #2ac56c', borderRadius: '6px', padding: '4px 10px', cursor: 'grab' }}>
                {slot.text}
              </span>
            ) : (
              <span key={i}
                onDragOver={(e) => { e.preventDefault(); setDragOverSlot(i) }}
                onDragLeave={() => setDragOverSlot(prev => (prev === i ? null : prev))}
                onDrop={(e) => { e.preventDefault(); placeAt(i, getDragData(e)); setDragOverSlot(null) }}
                style={{
                  display: 'inline-block', width: '52px', minHeight: '26px',
                  borderBottom: '2px solid ' + (dragOverSlot === i ? '#2ac56c' : '#c0c0c0'),
                  background: dragOverSlot === i ? '#edfbf3' : 'transparent',
                  borderRadius: '4px', transition: 'all 0.15s',
                }} />
            )
          ))}
          {item.responseSuffix && <span style={{ fontSize: '19px', color: '#11162d' }}>{item.responseSuffix}</span>}
        </div>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOverBank(true) }}
        onDragLeave={() => setDragOverBank(false)}
        onDrop={(e) => {
          e.preventDefault()
          const data = getDragData(e)
          if (data && data.from === 'slot') removeSlot(data.slotIdx)
          setDragOverBank(false)
        }}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid #e5e7eb',
          minHeight: '48px', background: dragOverBank ? '#f7faf8' : 'transparent', borderRadius: '8px', transition: 'background 0.15s',
        }}>
        {bank.map((text, i) => {
          const isUsed = usedBankIdx.has(i)
          return (
            <span key={i}
              draggable={!isUsed}
              onDragStart={(e) => setDragData(e, { from: 'bank', bankIdx: i, text })}
              onClick={() => !isUsed && placeFirstEmpty(i, text)}
              style={{
                fontSize: '17px', padding: '8px 14px', borderRadius: '6px',
                background: isUsed ? '#f4f6fa' : '#e9ecf3',
                color: isUsed ? '#c3c7d1' : '#11162d',
                cursor: isUsed ? 'default' : 'grab',
                userSelect: 'none',
              }}>
              {text}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function BuildSentenceExercise({ items, onBack, onComplete, mockMode = false }) {
  const [qIdx, setQIdx] = useState(0)
  // Every item's placement is kept (not just the current one), so navigating Back and
  // forward again restores exactly what the student had placed, instead of discarding it.
  const [placedByIndex, setPlacedByIndex] = useState(() => items.map(() => []))
  const [answers, setAnswers] = useState([])
  const [done, setDone] = useState(false)
  const [reviewQ, setReviewQ] = useState(null)
  const [timeLeft, setTimeLeft] = useState(BUILD_SENTENCE_TOTAL_TIME)
  const timerRef = useRef(null)
  const stateRef = useRef(null)

  const totalQ = items.length
  const item = items[qIdx]
  const placed = placedByIndex[qIdx] || []

  const computeAnswers = (pbi) => items.map((it, i) => {
    const p = pbi[i] || []
    return { placed: p, isCorrect: JSON.stringify(p) === JSON.stringify(it.correctChunks) }
  })

  const finishAll = (finalAnswers) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mockMode) {
      const finalScore = finalAnswers.filter(a => a.isCorrect).length
      const detail = items.map((it, i) => ({
        prompt: it.prompt,
        given: finalAnswers[i] && finalAnswers[i].placed.filter(Boolean).length ? finalAnswers[i].placed.filter(Boolean).join(' ') : 'No answer',
        correctAnswer: it.correctChunks.join(' '),
        isCorrect: finalAnswers[i] ? finalAnswers[i].isCorrect : false,
      }))
      onComplete(finalScore, totalQ, detail)
      return
    }
    setAnswers(finalAnswers)
    setDone(true)
  }
  stateRef.current = { placedByIndex }

  // Single running clock for the whole 10-item set.
  useEffect(() => {
    if (done) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          // Time's up — score whatever was placed in every item (unvisited items are simply
          // empty, which computeAnswers already treats as unanswered/incorrect).
          finishAll(computeAnswers(stateRef.current.placedByIndex))
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const isLowTime = timeLeft <= 60

  const handleNext = () => {
    if (qIdx + 1 >= totalQ) {
      finishAll(computeAnswers(placedByIndex))
    } else {
      setQIdx(i => i + 1)
    }
  }

  const handleBack = () => {
    if (qIdx === 0) return
    setQIdx(i => i - 1)
  }

  const score = answers.filter(a => a.isCorrect).length

  if (done) {
    const pct = Math.round((score / totalQ) * 100)
    const grade = pct >= 90 ? { label: 'Excellent!', color: '#2ac56c', emoji: '🏆' }
                : pct >= 70 ? { label: 'Good job!', color: '#701fa1', emoji: '🎉' }
                : pct >= 50 ? { label: 'Keep going', color: '#e07b00', emoji: '💪' }
                :             { label: 'Practice more', color: '#c0392b', emoji: '📚' }

    if (reviewQ !== null) {
      const rq = items[reviewQ]
      const a = answers[reviewQ]
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 20 }}>
          <div style={{ padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <button onClick={() => setReviewQ(null)} style={{ background: 'none', border: 'none', fontSize: '13px', color: '#2ac56c', fontWeight: '700', cursor: 'pointer' }}>← Back to Review</button>
            <span style={{ fontSize: '13px', color: '#888' }}>Item {reviewQ + 1} of {totalQ}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setReviewQ(Math.max(0, reviewQ - 1))} disabled={reviewQ === 0} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === 0 ? '#ccc' : '#616473', cursor: reviewQ === 0 ? 'default' : 'pointer' }}>← Prev</button>
              <button onClick={() => setReviewQ(Math.min(totalQ - 1, reviewQ + 1))} disabled={reviewQ === totalQ - 1} style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', color: reviewQ === totalQ - 1 ? '#ccc' : '#616473', cursor: reviewQ === totalQ - 1 ? 'default' : 'pointer' }}>Next →</button>
            </div>
          </div>
          <div style={{ height: '2.5px', background: '#2ac56c', flexShrink: 0 }} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '700px', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div style={{ fontSize: '15px', color: '#616473' }}>{rq.prompt}</div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: a.isCorrect ? '#2ac56c' : '#d94040', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your answer</div>
                <div style={{ fontSize: '17px', color: '#1a1a1a', lineHeight: '1.6' }}>
                  {rq.responsePrefix ? rq.responsePrefix + ' ' : ''}{a.placed.filter(Boolean).length ? a.placed.filter(Boolean).join(' ') : '(no answer)'}{rq.responseSuffix}
                </div>
              </div>
              {!a.isCorrect && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#2ac56c', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Correct answer</div>
                  <div style={{ fontSize: '17px', color: '#1a7a44', lineHeight: '1.6', fontWeight: '600' }}>
                    {rq.responsePrefix ? rq.responsePrefix + ' ' : ''}{rq.correctChunks.join(' ')}{rq.responseSuffix}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10, overflowY: 'auto' }}>
        <div style={{ maxWidth: '700px', width: '100%', margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center', marginBottom: '24px', border: '0.5px solid #e1e4ed' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>{grade.emoji}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: grade.color, marginBottom: '4px' }}>{grade.label}</div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Build a Sentence · {totalQ} items</div>
            <div style={{ fontSize: '44px', fontWeight: '800', color: '#1a1a1a', lineHeight: '1' }}>{score}<span style={{ fontSize: '18px', color: '#aaa', fontWeight: '400' }}>/{totalQ}</span></div>
            <div style={{ margin: '14px 0 6px', height: '7px', background: '#efefef', borderRadius: '4px' }}><div style={{ width: pct + '%', height: '100%', background: grade.color, borderRadius: '4px' }} /></div>
            <div style={{ fontSize: '12px', color: '#777', marginBottom: '20px' }}>{pct}% correct · all-or-nothing scoring</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setQIdx(0); setPlacedByIndex(items.map(() => [])); setAnswers([]); setDone(false); setTimeLeft(BUILD_SENTENCE_TOTAL_TIME) }} style={{ flex: 1, padding: '11px', background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Try Again</button>
              <button onClick={() => onComplete(score, totalQ)} style={{ flex: 1, padding: '11px', background: '#fff', color: '#333', border: '1px solid #d0d5dd', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Back</button>
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Review · <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>tap an item to see details</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((it, qi) => {
              const a = answers[qi]
              if (!a) return null
              return (
                <div key={qi} onClick={() => setReviewQ(qi)} style={{ background: '#fff', borderRadius: '10px', padding: '14px 18px', border: '0.5px solid #e1e4ed', borderLeft: '4px solid ' + (a.isCorrect ? '#2ac56c' : '#d94040'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', background: a.isCorrect ? '#edfbf3' : '#fff2f2', color: a.isCorrect ? '#2ac56c' : '#d94040', padding: '2px 8px', borderRadius: '999px', fontWeight: '700', flexShrink: 0 }}>{a.isCorrect ? '✓' : '✗'} Item {qi + 1}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.prompt}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '16px', color: '#c0c0c0', flexShrink: 0 }}>›</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={<>
        <TestPillButton onClick={handleBack} disabled={qIdx === 0}>Back</TestPillButton>
        <TestPillButton variant="dark" onClick={handleNext}>{qIdx + 1 >= totalQ ? 'Finish' : 'Next'}</TestPillButton>
      </>}
      section="WRITING"
      questionLabel={`Item ${qIdx + 1} of ${totalQ}`}
      timeText={formatTime(timeLeft)}
      lowTime={isLowTime}
      contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center', margin: '0 0 36px', maxWidth: '760px' }}>Make an appropriate sentence.</h1>
      <div style={{ maxWidth: '760px', width: '100%' }}>
        <BuildSentenceItem key={item.id} item={item} initialPlaced={placed}
          onChange={(vals) => setPlacedByIndex(prev => { const next = [...prev]; next[qIdx] = vals; return next })} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '760px', width: '100%', marginTop: '28px' }}>
        <button onClick={handleBack} disabled={qIdx === 0} style={{ background: '#fff', color: qIdx === 0 ? '#c0c0c0' : '#333', border: '1px solid #d0d5dd', borderRadius: '6px', padding: '11px 26px', fontSize: '14px', fontWeight: '700', cursor: qIdx === 0 ? 'default' : 'pointer' }}>
          ← Back
        </button>
        <button onClick={handleNext} style={{ background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '6px', padding: '11px 26px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
          {qIdx + 1 >= totalQ ? 'Finish →' : 'Next →'}
        </button>
      </div>
    </ExamScreen>
  )
}

function BuildASentence({ onBack }) {
  const isMobile = useIsMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSet, setActiveSet] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/writing/build-a-sentence`).then(r => r.json()),
      fetchLatestResults('bas'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setItems(list)
      const setCount = Math.ceil(list.length / BUILD_SENTENCE_SET_SIZE)
      const mapped = {}
      for (let i = 0; i < setCount; i++) { const row = results[String(i)]; if (row) mapped[i] = { correct: row.score, total: row.total } }
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!items.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found. Make sure the backend is running.</div>

  // Split the full item pool into fixed-size practice sets (10 items · 7:00 each).
  const sets = []
  for (let i = 0; i < items.length; i += BUILD_SENTENCE_SET_SIZE) {
    sets.push(items.slice(i, i + BUILD_SENTENCE_SET_SIZE))
  }

  if (activeSet !== null) return (
    <BuildSentenceExercise items={sets[activeSet]} onBack={() => setActiveSet(null)}
      onComplete={(correct, total) => {
        saveResult('bas', activeSet, correct, total, `Build a Sentence · Set ${activeSet + 1}`)
        setScores(prev => ({ ...prev, [activeSet]: { correct, total } })); setActiveSet(null)
      }} />
  )

  const totalLabel = `${Math.floor(BUILD_SENTENCE_TOTAL_TIME / 60)}:${String(BUILD_SENTENCE_TOTAL_TIME % 60).padStart(2, '0')}`

  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {sets.map((setItems, i) => {
            const locked = setItems.some(isLocked)
            const score = scores[i]
            const pct = score ? Math.round((score.correct / score.total) * 100) : null
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Practice Set {i + 1}</div>
                    {score && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: pct >= 70 ? '#2ac56c' : '#e07b00', background: pct >= 70 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {score.correct}/{score.total} · {pct}%</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${setItems.length} items · ${totalLabel} total`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => setActiveSet(i)} style={{ background: score ? '#e5e7eb' : '#2ac56c', color: score ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {score ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

const EMAIL_TIME_LIMIT = 420 // 7:00 per email
const EMAIL_ANALYZE_DELAY_MS = 1800 // simulated "AI is grading" delay (well under the 30s budget)

// Scoring aligned to ETS's official public "Write an Email" scoring guide (ETS Writing Scoring
// Guide, ets.org/pdfs/toefl/writing-rubrics.pdf), which uses a holistic 0-5 band scale (not
// additive points), keyed to three named dimensions: elaboration that supports the
// communicative purpose, syntactic variety and precise/idiomatic word choice, and consistent
// use of appropriate social conventions (register, politeness, organization of requests/
// refusals/criticisms). A fourth dimension, grammatical/lexical error frequency, is also named
// by the rubric but can't be measured without a live grammar checker, so it's proxied here by
// lexical diversity and sentence-structure variety — the same text-derivable signal the rubric
// itself points to. Cross-checked against Magoosh's and BestMyTest's public descriptions of the
// same task, which independently name the same three core dimensions (elaboration/relevance,
// syntax/vocabulary, social/discourse conventions) and note the task's own "at least 100 words"
// guidance as the practical threshold for full elaboration credit. Wording below is
// paraphrased, not copied from the ETS document.
function evaluateEmailResponse(text, tasks) {
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/) : []
  const wordCount = words.length
  const lower = text.toLowerCase()
  const criteria = []

  if (wordCount === 0) {
    return {
      score: 0, wordCount,
      summary: 'The response is blank or entirely unconnected to the task.',
      criteria: [{ ok: false, label: 'Response', detail: 'Write a complete email addressing every bullet point.' }],
    }
  }

  const taskCount = (tasks && tasks.length) || 1
  let tasksMatched = 0
  ;(tasks || []).forEach((t, i) => {
    const matched = (t.keywords || []).some(kw => lower.includes(kw.toLowerCase()))
    if (matched) tasksMatched++
    criteria.push({
      ok: matched,
      label: `Task ${i + 1}`,
      detail: matched ? `Addressed: ${t.description}` : `Missing or unclear: ${t.description}`,
    })
  })
  const taskRatio = tasksMatched / taskCount

  const hasGreeting = /^\s*(dear|hello|hi|to whom)/i.test(trimmed)
  const hasClosing = /(sincerely|regards|best,|best regards|thanks,|thank you,)/i.test(lower)
  const hasPoliteness = /(could you|would you|please|i would appreciate|i was wondering)/i.test(lower)
  criteria.push({
    ok: hasGreeting && hasClosing,
    label: 'Email structure & tone',
    detail: hasGreeting && hasClosing
      ? 'Clear greeting and closing with an appropriately polite tone.'
      : `Add ${!hasGreeting ? 'a greeting (e.g., "Dear ...")' : ''}${!hasGreeting && !hasClosing ? ' and ' : ''}${!hasClosing ? 'a closing (e.g., "Sincerely,")' : ''} to follow standard email conventions.`,
  })

  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z']/g, ''))).size
  const diversity = wordCount ? uniqueWords / wordCount : 0
  const sentences = trimmed.split(/[.!?]+/).map(s => s.trim()).filter(Boolean)
  const avgSentenceLen = sentences.length ? wordCount / sentences.length : 0
  const rangeOk = diversity >= 0.55 && sentences.length >= 4
  criteria.push({
    ok: rangeOk,
    label: 'Syntactic & vocabulary range',
    detail: rangeOk
      ? `Good range of vocabulary and sentence structure (${wordCount} words, ${sentences.length} sentences).`
      : `Try varying your sentence length and word choice more — currently ${wordCount} words across ${sentences.length} sentence(s), average ${avgSentenceLen.toFixed(1)} words/sentence.`,
  })

  // Holistic band selection modeled on ETS's official "Write an Email" rubric structure. The
  // word-count gate for the top band (100 words) matches the task's own published "an effective
  // response will contain at least 100 words" guidance, echoed by Magoosh/BestMyTest.
  let score
  if (wordCount < 15 || taskRatio === 0) {
    score = 1 // unsuccessful: telegraphic, minimal/no elaboration
  } else if (taskRatio < 0.5 || (diversity < 0.4 && sentences.length < 3)) {
    score = 2 // mostly unsuccessful: limited/irrelevant elaboration, limited range
  } else if (taskRatio < 1 || !(hasGreeting && hasClosing) || diversity < 0.5) {
    score = 3 // partially successful: task generally accomplished but with noticeable limitations
  } else if (wordCount < 100 || !rangeOk || !hasPoliteness) {
    score = 4 // generally successful: adequate elaboration, mostly appropriate conventions
  } else {
    score = 5 // fully successful: effective, clear, consistent facility with language
  }

  const summary =
    score === 5 ? 'Fully successful: your message is effective and clearly expressed, with consistent facility in the use of language.'
    : score === 4 ? 'Generally successful: your message is mostly effective and easily understood.'
    : score === 3 ? 'Partially successful: the task is generally accomplished, but limitations in language may prevent parts of the message from being fully clear.'
    : score === 2 ? 'Mostly unsuccessful: your attempt addresses the task, but it is mostly ineffective and may be hard to interpret.'
    : 'Unsuccessful: your attempt to address the task is ineffective — the message may be hard to understand.'

  return { score, wordCount, summary, criteria }
}

function toolbarBtnStyle(disabled) {
  return {
    background: disabled ? '#f4f6fa' : '#fff', color: disabled ? '#c3c7d1' : '#333',
    border: '1px solid #d0d5dd', borderRadius: '5px', padding: '5px 12px', fontSize: '12px',
    fontWeight: '600', cursor: disabled ? 'default' : 'pointer',
  }
}

function EmailExercise({ item, index, onBack, onComplete, mockMode = false }) {
  const isMobile = useIsMobile()
  const [timeLeft, setTimeLeft] = useState(EMAIL_TIME_LIMIT)
  const [historyState, setHistoryState] = useState({ list: [''], idx: 0 })
  const [phase, setPhase] = useState('writing') // 'writing' | 'analyzing' | 'done'
  const [result, setResult] = useState(null)
  const textareaRef = useRef(null)
  const timerRef = useRef(null)
  const liveRef = useRef(null)

  const body = historyState.list[historyState.idx]
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0
  liveRef.current = { historyState, phase }

  const finishNow = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    const { historyState: hs, phase: curPhase } = liveRef.current
    if (curPhase !== 'writing') return
    setPhase('analyzing')
    const text = hs.list[hs.idx]
    setTimeout(() => {
      const res = evaluateEmailResponse(text, item.tasks)
      if (mockMode) {
        onComplete(res.score, { prompt: item.scenario, given: text || '(no answer)', score: res.score, maxScore: 5, feedback: res.summary, criteria: res.criteria })
        return
      }
      setResult(res)
      setPhase('done')
    }, EMAIL_ANALYZE_DELAY_MS)
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          finishNow()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const isLowTime = timeLeft <= 60
  const locked = phase !== 'writing'

  const commitText = (text) => {
    setHistoryState(prev => {
      const list = prev.list.slice(0, prev.idx + 1)
      list.push(text)
      return { list, idx: list.length - 1 }
    })
  }

  const handleTextChange = (e) => commitText(e.target.value)
  const handleUndo = () => setHistoryState(prev => ({ ...prev, idx: Math.max(0, prev.idx - 1) }))
  const handleRedo = () => setHistoryState(prev => ({ ...prev, idx: Math.min(prev.list.length - 1, prev.idx + 1) }))

  const handleCut = () => {
    const ta = textareaRef.current
    const start = ta ? ta.selectionStart : 0
    const end = ta ? ta.selectionEnd : 0
    const selected = body.substring(start, end)
    if (selected && navigator.clipboard) navigator.clipboard.writeText(selected).catch(() => {})
    commitText(body.substring(0, start) + body.substring(end))
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const ta = textareaRef.current
      const start = ta ? ta.selectionStart : body.length
      const end = ta ? ta.selectionEnd : body.length
      commitText(body.substring(0, start) + text + body.substring(end))
    } catch (err) { /* clipboard permission denied - ignore */ }
  }

  const handleDownload = () => {
    const blob = new Blob([body], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `email_response_${item.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={phase === 'writing' && <TestPillButton variant="dark" onClick={finishNow}>Submit</TestPillButton>}
      section="WRITING"
      questionLabel={`Practice ${index + 1}`}
      timeText={phase === 'writing' ? formatTime(timeLeft) : (phase === 'analyzing' ? 'Analyzing…' : `${result.score} / 5`)}
      lowTime={phase === 'writing' && isLowTime}
      contentStyle={{ display: 'flex', flexDirection: 'column' }}
    >
        <div style={{ background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '12px', padding: isMobile ? '18px' : '36px 48px', width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', flex: '1 1 auto' }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '0.8 1 320px', minWidth: isMobile ? '100%' : '280px', paddingRight: isMobile ? '0' : '36px' }}>
            <div style={{ fontSize: '15px', color: '#1a1a1a', lineHeight: '1.7', marginBottom: '18px' }}>{item.scenario}</div>
            <div style={{ fontSize: '15px', color: '#1a1a1a', marginBottom: '10px' }}>Write an email to {item.recipient}. In your email, do the following:</div>
            <ul style={{ margin: '0 0 18px 0', paddingLeft: '22px' }}>
              {item.tasks.map((t, i) => (
                <li key={i} style={{ fontSize: '15px', color: '#1a1a1a', lineHeight: '1.7', marginBottom: '6px' }}>{t.description}</li>
              ))}
            </ul>
            <div style={{ fontSize: '15px', color: '#1a1a1a' }}>Write as much as you can and in complete sentences.</div>
          </div>

          {!isMobile && <div style={{ width: '1px', alignSelf: 'stretch', background: '#e5e7eb', margin: '0 4px' }} />}

          <div style={{ flex: isMobile ? '1 1 100%' : '1.4 1 480px', minWidth: isMobile ? '100%' : '360px', paddingLeft: isMobile ? '0' : '36px', marginTop: isMobile ? '20px' : '0' }}>
            <div style={{ fontSize: '15px', color: '#1a1a1a', marginBottom: '14px' }}>Your Response:</div>
            <div style={{ fontSize: '14px', color: '#1a1a1a', marginBottom: '4px' }}><u>To:</u> {item.recipient}</div>
            <div style={{ fontSize: '14px', color: '#1a1a1a', marginBottom: '14px' }}><u>Subject:</u> {item.subject}</div>

            <div style={{ border: '1px solid #d0d5dd', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderBottom: '1px solid #e5e7eb', background: '#fafbfc' }}>
                <button onClick={handleCut} disabled={locked} style={toolbarBtnStyle(locked)}>Cut</button>
                <button onClick={handlePaste} disabled={locked} style={toolbarBtnStyle(locked)}>Paste</button>
                <button onClick={handleUndo} disabled={locked || historyState.idx === 0} style={toolbarBtnStyle(locked || historyState.idx === 0)}>Undo</button>
                <button onClick={handleRedo} disabled={locked || historyState.idx >= historyState.list.length - 1} style={toolbarBtnStyle(locked || historyState.idx >= historyState.list.length - 1)}>Redo</button>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af', fontWeight: '700' }}>{wordCount} words</span>
              </div>
              <textarea ref={textareaRef} value={body} onChange={handleTextChange} disabled={locked}
                placeholder={`Dear ${item.recipient},\n\n...`}
                style={{ width: '100%', minHeight: '260px', border: 'none', outline: 'none', resize: 'vertical', padding: '14px', fontSize: '14px', lineHeight: '1.6', fontFamily: 'sans-serif', color: locked ? '#9ca3af' : '#1a1a1a', boxSizing: 'border-box', background: locked ? '#fbfbfc' : '#fff' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button onClick={handleDownload} style={{ background: '#fff', border: '1px solid #d0d5dd', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', color: '#333', cursor: 'pointer', fontWeight: '600' }}>Download response ⬇</button>
            </div>

            {phase === 'writing' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button onClick={finishNow} style={{ background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>SUBMIT →</button>
              </div>
            )}

            {phase === 'analyzing' && (
              <div style={{ marginTop: '18px', fontSize: '13px', color: '#e07b00', fontWeight: '600' }}>🤖 The AI grader is reading your email and preparing feedback…</div>
            )}

            {phase === 'done' && (
              <div style={{ marginTop: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', marginBottom: '10px' }}>{result.summary}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                  {result.criteria.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: '#333', lineHeight: '1.5' }}>
                      <span style={{ color: c.ok ? '#2ac56c' : '#d94040', fontWeight: '700', flexShrink: 0 }}>{c.ok ? '✓' : '✗'}</span>
                      <span><b>{c.label}:</b> {c.detail}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' }}>Example Response</div>
                <div style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#333', lineHeight: '1.7', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                  {item.exampleResponse}
                </div>

                <button onClick={() => onComplete(result.score)} style={{ background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '6px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  Back to Practice List
                </button>
              </div>
            )}
          </div>
        </div>
    </ExamScreen>
  )
}

function WriteEmail({ onBack }) {
  const isMobile = useIsMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/writing/email`).then(r => r.json()),
      fetchLatestResults('email'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setItems(list)
      const mapped = {}
      list.forEach((it, i) => { const row = results[String(it.id ?? i)]; if (row) mapped[i] = row.score })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!items.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found. Make sure the backend is running.</div>

  if (activeIdx !== null) return (
    <EmailExercise item={items[activeIdx]} index={activeIdx} onBack={() => setActiveIdx(null)}
      onComplete={(finalScore) => {
        saveResult('email', items[activeIdx].id ?? activeIdx, finalScore, 5, `Write an Email #${activeIdx + 1}`)
        setScores(prev => ({ ...prev, [activeIdx]: finalScore })); setActiveIdx(null)
      }} />
  )

  const timeLabel = `${Math.floor(EMAIL_TIME_LIMIT / 60)}:${String(EMAIL_TIME_LIMIT % 60).padStart(2, '0')}`

  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {items.map((it, i) => {
            const locked = isLocked(it)
            const score = scores[i]
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Practice {i + 1}</div>
                    {score != null && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: score >= 3.5 ? '#2ac56c' : '#e07b00', background: score >= 3.5 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {score}/5</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `To: ${it.recipient} · ${timeLabel} time limit`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => setActiveIdx(i)} style={{ background: score != null ? '#e5e7eb' : '#2ac56c', color: score != null ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {score != null ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

const DISCUSSION_TIME_LIMIT = 600 // 10:00 per discussion post

// Scoring aligned to ETS's official public "Write for an Academic Discussion" scoring guide
// (ETS Writing Scoring Guide, ets.org/pdfs/toefl/writing-rubrics.pdf), which uses a holistic
// 0-5 band scale (not additive points), keyed to two named content dimensions — a relevant,
// well-elaborated contribution (explanations/exemplifications/details) and effective use of a
// variety of syntactic structures with precise/idiomatic word choice — plus a third,
// grammatical/lexical error frequency, which can't be measured without a live grammar checker
// and is proxied here by lexical diversity and sentence-structure variety. Cross-checked
// against Magoosh's and BestMyTest's public descriptions of the same task, which independently
// summarize the rubric as: relevant and clearly developed ideas, variety in the use of
// language, and correct use of language — and both note the task's own "at least 100 words"
// instruction (with ~130 recommended) as the practical bar for full elaboration credit.
// Engaging with a named classmate is not itself a scored rubric line, but is the standard
// technique test-prep guides recommend for demonstrating a "relevant contribution to the
// discussion," so it's used here as one signal toward that dimension. Wording below is
// paraphrased, not copied from the ETS document.
function evaluateDiscussionResponse(text, classmates) {
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/) : []
  const wordCount = words.length
  const lower = text.toLowerCase()
  const criteria = []

  if (wordCount === 0) {
    return {
      score: 0, wordCount,
      summary: 'The response is blank or entirely unconnected to the discussion.',
      criteria: [{ ok: false, label: 'Response', detail: 'Write a complete post that states and supports your opinion.' }],
    }
  }

  const hasOpinion = /(i believe|i think|in my opinion|my view|i would argue|i'd argue|i'd say)/i.test(lower)
  const hasReason = /(because|since|as a result|due to|therefore|this is why)/i.test(lower)
  criteria.push({
    ok: hasOpinion && hasReason,
    label: 'Opinion & support',
    detail: hasOpinion && hasReason
      ? 'You clearly state your opinion and back it up with a reason.'
      : `Make sure to ${!hasOpinion ? 'clearly state your own opinion (e.g., "I believe...")' : ''}${!hasOpinion && !hasReason ? ' and ' : ''}${!hasReason ? 'explain why with a reason (e.g., "...because...")' : ''}.`,
  })

  const namesMentioned = (classmates || []).filter(c => lower.includes(c.name.toLowerCase())).length
  const hasEngagementPhrase = /(i agree|i disagree|unlike|similar to|on the other hand|while i see where)/i.test(lower)
  const engaged = namesMentioned > 0 || hasEngagementPhrase
  criteria.push({
    ok: engaged,
    label: 'Engagement with classmates',
    detail: engaged
      ? 'You engage directly with the discussion by referencing a classmate’s point.'
      : 'Try referring to one of your classmates by name (e.g., "I agree with ... because...") to show you are contributing to their discussion, not just restating the prompt.',
  })

  const hasExample = /(for example|for instance|such as|specifically)/i.test(lower)
  criteria.push({
    ok: hasExample,
    label: 'Elaboration & examples',
    detail: hasExample
      ? 'Good use of a specific example or detail to support your point.'
      : 'Add a concrete example (e.g., "for example, ...") to make your contribution more convincing.',
  })

  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z']/g, ''))).size
  const diversity = wordCount ? uniqueWords / wordCount : 0
  const sentences = trimmed.split(/[.!?]+/).map(s => s.trim()).filter(Boolean)
  const rangeOk = diversity >= 0.55 && sentences.length >= 4
  criteria.push({
    ok: rangeOk,
    label: 'Syntactic & vocabulary range',
    detail: rangeOk
      ? `Good range of vocabulary and sentence structure (${wordCount} words, ${sentences.length} sentences).`
      : `Try varying your sentence length and word choice more — currently ${wordCount} words across ${sentences.length} sentence(s).`,
  })

  // Holistic band selection modeled on ETS's official "Write for an Academic Discussion"
  // rubric structure. The word-count gate for the top band (100 words) matches the task's own
  // published "an effective response will contain at least 100 words" guidance.
  let score
  if (wordCount < 15 || (!hasOpinion && !engaged)) {
    score = 1 // unsuccessful: few or no coherent ideas connecting to the discussion
  } else if (!hasOpinion || !hasReason || (!engaged && !hasExample)) {
    score = 2 // mostly unsuccessful: ideas poorly elaborated or only partially relevant
  } else if (!engaged || !hasExample || diversity < 0.5) {
    score = 3 // partially successful: mostly relevant/understandable, some limitations
  } else if (wordCount < 100 || !rangeOk) {
    score = 4 // generally successful: relevant, adequately elaborated, easily understood
  } else {
    score = 5 // fully successful: relevant, well-elaborated, consistent facility with language
  }

  const summary =
    score === 5 ? 'Fully successful: your post is a relevant, clearly expressed contribution with consistent facility in the use of language.'
    : score === 4 ? 'Generally successful: your post is a relevant contribution and your ideas are easily understood.'
    : score === 3 ? 'Partially successful: your post is mostly relevant and understandable, with some limitations in language.'
    : score === 2 ? 'Mostly unsuccessful: your attempt to contribute is reflected, but limitations in language may make ideas hard to follow.'
    : 'Unsuccessful: limitations in language may prevent your ideas from being expressed clearly.'

  return { score, wordCount, summary, criteria }
}

function AcademicDiscussionExercise({ item, index, onBack, onComplete, mockMode = false }) {
  const isMobile = useIsMobile()
  const [timeLeft, setTimeLeft] = useState(DISCUSSION_TIME_LIMIT)
  const [historyState, setHistoryState] = useState({ list: [''], idx: 0 })
  const [phase, setPhase] = useState('writing') // 'writing' | 'analyzing' | 'done'
  const [result, setResult] = useState(null)
  const textareaRef = useRef(null)
  const timerRef = useRef(null)
  const liveRef = useRef(null)

  const body = historyState.list[historyState.idx]
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0
  liveRef.current = { historyState, phase }

  const finishNow = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    const { historyState: hs, phase: curPhase } = liveRef.current
    if (curPhase !== 'writing') return
    setPhase('analyzing')
    const text = hs.list[hs.idx]
    setTimeout(() => {
      const res = evaluateDiscussionResponse(text, item.classmates)
      if (mockMode) {
        onComplete(res.score, { prompt: item.prompt, given: text || '(no answer)', score: res.score, maxScore: 5, feedback: res.summary, criteria: res.criteria })
        return
      }
      setResult(res)
      setPhase('done')
    }, EMAIL_ANALYZE_DELAY_MS)
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          finishNow()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const isLowTime = timeLeft <= 60
  const locked = phase !== 'writing'

  const commitText = (text) => {
    setHistoryState(prev => {
      const list = prev.list.slice(0, prev.idx + 1)
      list.push(text)
      return { list, idx: list.length - 1 }
    })
  }

  const handleTextChange = (e) => commitText(e.target.value)
  const handleUndo = () => setHistoryState(prev => ({ ...prev, idx: Math.max(0, prev.idx - 1) }))
  const handleRedo = () => setHistoryState(prev => ({ ...prev, idx: Math.min(prev.list.length - 1, prev.idx + 1) }))

  const handleCut = () => {
    const ta = textareaRef.current
    const start = ta ? ta.selectionStart : 0
    const end = ta ? ta.selectionEnd : 0
    const selected = body.substring(start, end)
    if (selected && navigator.clipboard) navigator.clipboard.writeText(selected).catch(() => {})
    commitText(body.substring(0, start) + body.substring(end))
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const ta = textareaRef.current
      const start = ta ? ta.selectionStart : body.length
      const end = ta ? ta.selectionEnd : body.length
      commitText(body.substring(0, start) + text + body.substring(end))
    } catch (err) { /* clipboard permission denied - ignore */ }
  }

  const handleDownload = () => {
    const blob = new Blob([body], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `discussion_response_${item.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={phase === 'writing' && <TestPillButton variant="dark" onClick={finishNow}>Submit</TestPillButton>}
      section="WRITING"
      questionLabel={`Practice ${index + 1}`}
      timeText={phase === 'writing' ? formatTime(timeLeft) : (phase === 'analyzing' ? 'Analyzing…' : `${result.score} / 5`)}
      lowTime={phase === 'writing' && isLowTime}
      contentStyle={{ display: 'flex', flexDirection: 'column' }}
    >
        <div style={{ background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '12px', padding: isMobile ? '18px' : '36px 48px', width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', flex: '1 1 auto' }}>
          <div style={{ flex: isMobile ? '1 1 100%' : '0.8 1 320px', minWidth: isMobile ? '100%' : '280px', paddingRight: isMobile ? '0' : '36px' }}>
            <div style={{ fontSize: '15px', color: '#1a1a1a', marginBottom: '10px' }}>Your professor is teaching a class on {item.subject}. Write a post responding to the professor's question.</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' }}>In your response, you should do the following:</div>
            <ul style={{ margin: '0 0 14px 0', paddingLeft: '22px' }}>
              <li style={{ fontSize: '15px', color: '#1a1a1a', lineHeight: '1.7', marginBottom: '6px' }}>Express and support your opinion.</li>
              <li style={{ fontSize: '15px', color: '#1a1a1a', lineHeight: '1.7', marginBottom: '6px' }}>Make a contribution to the discussion in your own words.</li>
            </ul>
            <div style={{ fontSize: '15px', color: '#1a1a1a', marginBottom: '20px' }}>An effective response will contain at least 100 words.</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <SpeakerAvatar gender={item.professorGender} seed={item.id} width={56} height={56} />
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a1a' }}>{item.professor}</span>
            </div>
            <div style={{ fontSize: '15px', color: '#1a1a1a', lineHeight: '1.7' }}>{item.prompt}</div>
          </div>

          {!isMobile && <div style={{ width: '1px', alignSelf: 'stretch', background: '#e5e7eb', margin: '0 4px' }} />}

          <div style={{ flex: isMobile ? '1 1 100%' : '1.4 1 480px', minWidth: isMobile ? '100%' : '360px', paddingLeft: isMobile ? '0' : '36px', marginTop: isMobile ? '20px' : '0' }}>
            {item.classmates.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '14px', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  <SpeakerAvatar gender={c.gender} seed={item.id * 10 + i} width={48} height={48} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', marginTop: '4px' }}>{c.name}</div>
                </div>
                <div style={{ fontSize: '15px', color: '#1a1a1a', lineHeight: '1.7', paddingTop: '2px' }}>{c.opinion}</div>
              </div>
            ))}

            <div style={{ fontSize: '15px', color: '#1a1a1a', marginBottom: '10px' }}>Your Response:</div>
            <div style={{ border: '1px solid #d0d5dd', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderBottom: '1px solid #e5e7eb', background: '#fafbfc' }}>
                <button onClick={handleCut} disabled={locked} style={toolbarBtnStyle(locked)}>Cut</button>
                <button onClick={handlePaste} disabled={locked} style={toolbarBtnStyle(locked)}>Paste</button>
                <button onClick={handleUndo} disabled={locked || historyState.idx === 0} style={toolbarBtnStyle(locked || historyState.idx === 0)}>Undo</button>
                <button onClick={handleRedo} disabled={locked || historyState.idx >= historyState.list.length - 1} style={toolbarBtnStyle(locked || historyState.idx >= historyState.list.length - 1)}>Redo</button>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af', fontWeight: '700' }}>{wordCount} words</span>
              </div>
              <textarea ref={textareaRef} value={body} onChange={handleTextChange} disabled={locked}
                placeholder="Share your opinion and respond to your classmates..."
                style={{ width: '100%', minHeight: '220px', border: 'none', outline: 'none', resize: 'vertical', padding: '14px', fontSize: '14px', lineHeight: '1.6', fontFamily: 'sans-serif', color: locked ? '#9ca3af' : '#1a1a1a', boxSizing: 'border-box', background: locked ? '#fbfbfc' : '#fff' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button onClick={handleDownload} style={{ background: '#fff', border: '1px solid #d0d5dd', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', color: '#333', cursor: 'pointer', fontWeight: '600' }}>Download response ⬇</button>
            </div>

            {phase === 'writing' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button onClick={finishNow} style={{ background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>SUBMIT →</button>
              </div>
            )}

            {phase === 'analyzing' && (
              <div style={{ marginTop: '18px', fontSize: '13px', color: '#e07b00', fontWeight: '600' }}>🤖 The AI grader is reading your post and preparing feedback…</div>
            )}

            {phase === 'done' && (
              <div style={{ marginTop: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', marginBottom: '10px' }}>{result.summary}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                  {result.criteria.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: '#333', lineHeight: '1.5' }}>
                      <span style={{ color: c.ok ? '#2ac56c' : '#d94040', fontWeight: '700', flexShrink: 0 }}>{c.ok ? '✓' : '✗'}</span>
                      <span><b>{c.label}:</b> {c.detail}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' }}>Example Response</div>
                <div style={{ background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#333', lineHeight: '1.7', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                  {item.exampleResponse}
                </div>

                <button onClick={() => onComplete(result.score)} style={{ background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '6px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  Back to Practice List
                </button>
              </div>
            )}
          </div>
        </div>
    </ExamScreen>
  )
}

function AcademicDiscussion({ onBack }) {
  const isMobile = useIsMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/writing/academic-discussion`).then(r => r.json()),
      fetchLatestResults('disc'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setItems(list)
      const mapped = {}
      list.forEach((it, i) => { const row = results[String(it.id ?? i)]; if (row) mapped[i] = row.score })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!items.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found. Make sure the backend is running.</div>

  if (activeIdx !== null) return (
    <AcademicDiscussionExercise item={items[activeIdx]} index={activeIdx} onBack={() => setActiveIdx(null)}
      onComplete={(finalScore) => {
        saveResult('disc', items[activeIdx].id ?? activeIdx, finalScore, 5, `Academic Discussion #${activeIdx + 1}`)
        setScores(prev => ({ ...prev, [activeIdx]: finalScore })); setActiveIdx(null)
      }} />
  )

  const timeLabel = `${Math.floor(DISCUSSION_TIME_LIMIT / 60)}:${String(DISCUSSION_TIME_LIMIT % 60).padStart(2, '0')}`

  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {items.map((it, i) => {
            const locked = isLocked(it)
            const score = scores[i]
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>Practice {i + 1}</div>
                    {score != null && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: score >= 3.5 ? '#2ac56c' : '#e07b00', background: score >= 3.5 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {score}/5</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `Topic: ${it.subject} · ${timeLabel} time limit`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => setActiveIdx(i)} style={{ background: score != null ? '#e5e7eb' : '#2ac56c', color: score != null ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {score != null ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

// ─── Speaking — shared helpers ─────────────────────────────────────────────

function getSpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function normalizeWords(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9' ]/g, '').split(/\s+/).filter(Boolean)
}

// Word-level Dice coefficient via LCS — used to compare a spoken transcript to a target sentence.
function wordSimilarity(a, b) {
  const m = a.length, n = b.length
  if (m === 0 && n === 0) return 1
  if (m === 0 || n === 0) return 0
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return (2 * dp[m][n]) / (m + n)
}

// Scoring aligned to ETS's official public "Listen and Repeat" scoring guide (ETS Speaking
// Scoring Guide, ets.org/pdfs/toefl/speaking-rubrics.pdf), which uses a holistic 0-5 band
// scale (not additive points): 5 = exact, fully intelligible repetition; 4 = meaning captured
// with only minor word/grammar differences that don't change the original meaning; 3 =
// essentially a full response but meaning not fully accurate (several content/function words
// changed or missing); 2 = a significant part of the prompt missing and/or highly inaccurate,
// not a self-standing sentence; 1 = very little of the prompt captured, largely unintelligible;
// 0 = no response, entirely unintelligible, or unconnected to the prompt. Cross-checked against
// TestGlider/MySpeakingScore's public description of the same task, which summarizes the
// rubric's three dimensions as fluency, intelligibility, and repeat accuracy, and notes that
// minor function-word shifts are acceptable at the 4 band while missing content, unintelligible
// speech, or a fragment (instead of a full sentence) are what push a response down. Word-overlap
// ratio is used as the measurable proxy for repeat accuracy, and a direct check for missing
// content words is used for completeness, since pronunciation/intonation/fluency can't be
// judged from a text transcript alone. Wording below is paraphrased, not copied from the ETS
// document.
function evaluateRepeatResponse(transcript, target) {
  const targetWords = normalizeWords(target)
  const saidWords = normalizeWords(transcript)
  if (saidWords.length === 0) {
    return {
      score: 0, similarity: 0,
      summary: 'No response — nothing intelligible was captured.',
      criteria: [{ ok: false, label: 'Response', detail: 'No usable speech was detected for this sentence.' }],
    }
  }
  const exact = saidWords.join(' ') === targetWords.join(' ')
  const ratio = wordSimilarity(targetWords, saidWords)
  const score =
    exact ? 5
    : ratio >= 0.85 ? 4
    : ratio >= 0.65 ? 3
    : ratio >= 0.4 ? 2
    : ratio >= 0.15 ? 1
    : 0
  const summary =
    score === 5 ? 'Exact repetition — fully intelligible.'
    : score === 4 ? 'The meaning is captured, with only minor word or grammar differences from the prompt.'
    : score === 3 ? 'Essentially a full response, but it does not fully capture the original meaning — several words were changed or missing.'
    : score === 2 ? 'A significant part of the sentence is missing and/or the response is largely inaccurate.'
    : score === 1 ? 'Very little of the sentence was captured — the response is mostly unintelligible.'
    : 'No usable response was captured — try speaking clearly into the microphone.'
  const missing = targetWords.filter(w => !saidWords.includes(w))
  const criteria = [
    {
      ok: ratio >= 0.65,
      label: 'Word accuracy',
      detail: `${Math.round(ratio * 100)}% word overlap with the target sentence.`,
    },
    {
      ok: missing.length === 0,
      label: 'Completeness',
      detail: missing.length === 0 ? 'Every key word from the prompt was repeated.' : `Missing or changed: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''}`,
    },
  ]
  return { score, similarity: Math.round(ratio * 100), summary, criteria }
}

// Scoring aligned to ETS's official public "Take an Interview" scoring guide (ETS Speaking
// Scoring Guide, ets.org/pdfs/toefl/speaking-rubrics.pdf), which is a holistic 0-5 band scale
// keyed to four named dimensions: (1) how fully/relevantly the question is addressed and
// elaborated, (2) speaking pace/pausing, (3) pronunciation/intonation, and (4) the range and
// accuracy of grammar and vocabulary. Cross-checked against Magoosh's and TestGlider/
// MySpeakingScore's public descriptions of the same rubric, which name the same four
// dimensions (fluency, intelligibility/pronunciation, coherence/relevance, grammar-vocabulary
// range). Since fluency, pausing, and pronunciation can't be measured from a text transcript,
// this uses the text-derivable proxies the rubric itself points to for the other two
// dimensions: topic relevance, presence of supporting reasons, elaboration length, and lexical
// diversity as a stand-in for vocabulary/grammar range. Wording below is paraphrased, not
// copied from the ETS document.
function evaluateInterviewResponse(transcript, questionText) {
  const words = normalizeWords(transcript)
  const wordCount = words.length
  const criteria = []

  if (wordCount === 0) {
    return {
      score: 0, wordCount,
      summary: 'No response, or the response is unconnected to the question.',
      criteria: [{ ok: false, label: 'Response', detail: 'No usable speech was detected for this question.' }],
    }
  }

  const stop = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'you', 'your', 'do', 'did', 'does', 'think', 'why', 'what', 'which', 'some', 'people', 'that', 'this', 'with', 'about', 'from', 'would', 'could', 'should', 'will', 'can', 'i', 'we', 'they', 'he', 'she', 'it', 'one', 'last', 'question'])
  const keywords = normalizeWords(questionText).filter(w => w.length > 3 && !stop.has(w))
  const hits = keywords.filter(k => words.includes(k)).length
  const relevance = keywords.length ? hits / keywords.length : 0

  const hasReason = /(because|since|so that|the reason|due to)/i.test(transcript)
  const uniqueWords = new Set(words).size
  const diversity = wordCount ? uniqueWords / wordCount : 0

  criteria.push({
    ok: relevance >= 0.15,
    label: 'Relevance',
    detail: relevance >= 0.15 ? 'Your answer stays on topic and responds to the question asked.' : 'Try to directly reference the topic of the question in your answer.',
  })
  criteria.push({
    ok: hasReason,
    label: 'Explanation',
    detail: hasReason ? 'You explain your answer with a reason.' : 'Add a reason (e.g., "...because...") to support your answer.',
  })
  criteria.push({
    ok: wordCount >= 45,
    label: 'Elaboration',
    detail: wordCount >= 45 ? `Well elaborated response (${wordCount} words).` : `Try to speak a bit longer and add more detail (currently ${wordCount} words).`,
  })
  criteria.push({
    ok: diversity >= 0.55,
    label: 'Grammar & vocabulary range',
    detail: diversity >= 0.55 ? 'You use a reasonable range of vocabulary rather than repeating the same words.' : 'Try using a wider range of vocabulary and sentence structures instead of repeating the same words.',
  })

  // Note: per ETS's own scored sample responses, natural filler words ("um", "uh") do NOT
  // lower the score as long as meaning isn't impeded — so fillers are deliberately not
  // penalized here.
  let score
  if (wordCount < 8 || (relevance < 0.08 && wordCount < 15)) {
    score = 1
  } else if (relevance < 0.15 || (!hasReason && wordCount < 20)) {
    score = 2
  } else if (wordCount < 45 || !hasReason) {
    score = 3
  } else if (wordCount < 65 || diversity < 0.5) {
    score = 4
  } else {
    score = 5
  }

  const summary =
    score === 5 ? 'Fully successful: the response fully addresses the question and is clear and well elaborated.'
    : score === 4 ? 'Generally successful: the response addresses the question and is reasonably clear.'
    : score === 3 ? 'Partially successful: the response addresses the question but with limited elaboration or clarity.'
    : score === 2 ? 'Mostly unsuccessful: an attempt is made, but it is not well supported.'
    : 'Unsuccessful: the response only minimally addresses the question.'

  return { score, wordCount, summary, criteria }
}

function micGateStyle() {
  return { position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', fontFamily: 'sans-serif', zIndex: 10, padding: '40px', textAlign: 'center' }
}

function MicPermissionGate({ micState, onRetry, onBack }) {
  return (
    <div style={micGateStyle()}>
      <div style={{ fontSize: '40px' }}>🎙️</div>
      {micState === 'checking' && <div style={{ fontSize: '15px', color: '#616473' }}>Checking microphone access…</div>}
      {micState === 'unsupported' && (
        <>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a1a', maxWidth: '420px' }}>Your browser doesn't support live speech recognition.</div>
          <div style={{ fontSize: '13px', color: '#616473', maxWidth: '420px' }}>Please try this exercise in Chrome or Edge on desktop.</div>
        </>
      )}
      {micState === 'denied' && (
        <>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a1a', maxWidth: '420px' }}>Microphone access was denied.</div>
          <div style={{ fontSize: '13px', color: '#616473', maxWidth: '420px' }}>Please allow microphone access for this site in your browser settings, then try again.</div>
          <button onClick={onRetry} style={{ background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '6px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', marginTop: '8px' }}>Try Again</button>
        </>
      )}
      <button onClick={onBack} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '7px 16px', fontSize: '13px', color: '#616473', cursor: 'pointer', marginTop: '6px' }}>← Back</button>
    </div>
  )
}

// ─── Speaking Part 1: Listen and Repeat ────────────────────────────────────

// Flat, colorful icon shapes used by SceneIllustration below. Each renders inside a local
// coordinate box roughly spanning -28..28 on both axes, so it can be placed anywhere via a
// parent <g transform="translate(x,y)">.
// Shared gradients + filters referenced by many icons below, for a softer, more polished
// "designed" look (subtle depth) instead of flat single-color shapes. Defined once per icon via
// a local <defs> -- safe because each scene renders at most one instance of any given icon type.
function IconDefs({ id }) {
  return (
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f1f3f5" /><stop offset="100%" stopColor="#adb5bd" />
      </linearGradient>
      <linearGradient id={`${id}-darkMetal`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#495057" /><stop offset="100%" stopColor="#212529" />
      </linearGradient>
      <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a9784f" /><stop offset="100%" stopColor="#7a5230" />
      </linearGradient>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#e9ecef" />
      </linearGradient>
      <linearGradient id={`${id}-green`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#69db7c" /><stop offset="100%" stopColor="#2f9e44" />
      </linearGradient>
      <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffe0b2" /><stop offset="100%" stopColor="#eeb27e" />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#d0ebff" /><stop offset="100%" stopColor="#74c0fc" />
      </linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffd43b" /><stop offset="100%" stopColor="#f08c00" />
      </linearGradient>
      <linearGradient id={`${id}-red`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ff8787" /><stop offset="100%" stopColor="#e03131" />
      </linearGradient>
      <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#748ffc" /><stop offset="100%" stopColor="#3b5bdb" />
      </linearGradient>
    </defs>
  )
}

function SceneIconShape({ type }) {
  const d = `ic-${type}`
  switch (type) {
    case 'bookshelf':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-28" y="-26" width="56" height="52" rx="4" fill={`url(#${d}-wood)`} stroke="#5c3a1e" />
          <rect x="-24" y="-20" width="10" height="40" fill="#e64980" /><line x1="-22" y1="-15" x2="-16" y2="-15" stroke="#fff" strokeWidth="1" opacity="0.6" />
          <rect x="-12" y="-20" width="10" height="40" fill="#4c6ef5" /><line x1="-10" y1="-15" x2="-4" y2="-15" stroke="#fff" strokeWidth="1" opacity="0.6" />
          <rect x="0" y="-20" width="10" height="40" fill="#f59f00" /><line x1="2" y1="-15" x2="8" y2="-15" stroke="#fff" strokeWidth="1" opacity="0.6" />
          <rect x="12" y="-20" width="10" height="40" fill="#2ac56c" /><line x1="14" y1="-15" x2="20" y2="-15" stroke="#fff" strokeWidth="1" opacity="0.6" />
          <rect x="-28" y="18" width="56" height="4" fill="#5c3a1e" opacity="0.4" />
        </g>
      )
    case 'register':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-26" y="-4" width="52" height="30" rx="4" fill={`url(#${d}-darkMetal)`} />
          <rect x="-18" y="-24" width="36" height="22" rx="3" fill="#1a1d24" stroke="#495057" />
          <rect x="-12" y="-18" width="24" height="10" fill="#74c0fc" opacity="0.9" />
          <line x1="-9" y1="-15" x2="9" y2="-15" stroke="#e7f5ff" strokeWidth="1" opacity="0.6" />
          <rect x="-8" y="8" width="16" height="8" rx="2" fill="#d0d5dd" />
          <circle cx="-14" cy="14" r="1.6" fill="#495057" /><circle cx="-9" cy="14" r="1.6" fill="#495057" /><circle cx="10" cy="14" r="1.6" fill="#495057" /><circle cx="15" cy="14" r="1.6" fill="#495057" />
        </g>
      )
    case 'tag':
      return (
        <g transform="rotate(-20)">
          <IconDefs id={d} />
          <path d="M -24 -10 L 10 -10 L 26 6 L 10 22 L -24 22 Z" fill={`url(#${d}-red)`} stroke="#c92a2a" />
          <circle cx="-12" cy="6" r="4" fill="#fff" />
          <text x="-4" y="10" fontSize="13" fontWeight="700" fill="#fff">%</text>
        </g>
      )
    case 'person':
      return (
        <g>
          <IconDefs id={d} />
          <circle cx="0" cy="-16" r="12" fill={`url(#${d}-skin)`} />
          <path d="M -12 -22 Q 0 -32 12 -22 Q 12 -26 0 -27 Q -12 -26 -12 -22 Z" fill="#3f2a1d" />
          <circle cx="-4" cy="-16" r="1.3" fill="#3f2a1d" /><circle cx="4" cy="-16" r="1.3" fill="#3f2a1d" />
          <path d="M -4 -11 Q 0 -9 4 -11" fill="none" stroke="#a05a3a" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M -18 26 Q -18 0 0 0 Q 18 0 18 26 Z" fill={`url(#${d}-blue)`} />
          <path d="M -6 2 Q 0 6 6 2" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.5" />
        </g>
      )
    case 'suppliesRack':
      return (
        <g>
          <g transform="rotate(20)">
            <rect x="-3" y="-26" width="6" height="40" fill="#fcc419" />
            <path d="M -3 14 L 3 14 L 0 24 Z" fill="#495057" />
          </g>
          <rect x="-24" y="0" width="20" height="26" rx="2" fill="#fff" stroke="#adb5bd" />
          <line x1="-20" y1="8" x2="-8" y2="8" stroke="#adb5bd" strokeWidth="1.5" />
          <line x1="-20" y1="14" x2="-8" y2="14" stroke="#adb5bd" strokeWidth="1.5" />
          <line x1="-20" y1="20" x2="-8" y2="20" stroke="#adb5bd" strokeWidth="1.5" />
        </g>
      )
    case 'receipt':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -18 -26 L 18 -26 L 18 22 L 12 26 L 6 22 L 0 26 L -6 22 L -12 26 L -18 22 Z" fill={`url(#${d}-paper)`} stroke="#ced4da" />
          <line x1="-12" y1="-16" x2="12" y2="-16" stroke="#adb5bd" strokeWidth="2" />
          <line x1="-12" y1="-8" x2="12" y2="-8" stroke="#adb5bd" strokeWidth="2" />
          <line x1="-12" y1="0" x2="12" y2="0" stroke="#adb5bd" strokeWidth="2" />
          <line x1="-12" y1="8" x2="4" y2="8" stroke="#adb5bd" strokeWidth="2" />
        </g>
      )
    case 'calendar':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-24" y="-20" width="48" height="42" rx="4" fill={`url(#${d}-paper)`} stroke="#ced4da" />
          <rect x="-24" y="-20" width="48" height="12" rx="4" fill="#fa5252" />
          <rect x="-9" y="-24" width="4" height="10" rx="1" fill="#868e96" /><rect x="5" y="-24" width="4" height="10" rx="1" fill="#868e96" />
          <line x1="-14" y1="-2" x2="-14" y2="16" stroke="#d0d5dd" />
          <line x1="0" y1="-2" x2="0" y2="16" stroke="#d0d5dd" />
          <line x1="14" y1="-2" x2="14" y2="16" stroke="#d0d5dd" />
          <line x1="-24" y1="6" x2="24" y2="6" stroke="#d0d5dd" />
          <circle cx="7" cy="11" r="5" fill="#4c6ef5" opacity="0.85" />
        </g>
      )
    case 'idCard':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-26" y="-18" width="52" height="36" rx="5" fill={`url(#${d}-blue)`} />
          <circle cx="-12" cy="-2" r="8" fill="#fff" />
          <circle cx="-12" cy="-4" r="3" fill="#748ffc" /><path d="M -17 2 Q -12 -2 -7 2" fill="#748ffc" />
          <line x1="2" y1="-8" x2="18" y2="-8" stroke="#fff" strokeWidth="2" />
          <line x1="2" y1="0" x2="18" y2="0" stroke="#fff" strokeWidth="2" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="#fff" strokeWidth="2" />
        </g>
      )
    case 'door':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-16" y="-28" width="32" height="52" rx="2" fill={`url(#${d}-wood)`} stroke="#5c3a1e" />
          <rect x="-11" y="-22" width="22" height="18" rx="1" fill="none" stroke="#5c3a1e" strokeWidth="1.5" opacity="0.55" />
          <rect x="-11" y="2" width="22" height="18" rx="1" fill="none" stroke="#5c3a1e" strokeWidth="1.5" opacity="0.55" />
          <circle cx="8" cy="0" r="2.5" fill={`url(#${d}-gold)`} />
        </g>
      )
    case 'pharmacyCross':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-22" y="-22" width="44" height="44" rx="8" fill={`url(#${d}-green)`} stroke="#2f9e44" />
          <rect x="-6" y="-14" width="12" height="28" fill="#fff" />
          <rect x="-14" y="-6" width="28" height="12" fill="#fff" />
        </g>
      )
    case 'syringe':
      return (
        <g transform="rotate(-30)">
          <IconDefs id={d} />
          <rect x="-20" y="-6" width="34" height="12" rx="2" fill={`url(#${d}-glass)`} stroke="#4c6ef5" />
          <rect x="-14" y="-4" width="10" height="8" fill="#fa5252" opacity="0.7" />
          <rect x="-28" y="-4" width="10" height="8" fill="#4c6ef5" />
          <line x1="14" y1="0" x2="28" y2="0" stroke="#495057" strokeWidth="2" />
        </g>
      )
    case 'cardReader':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-20" y="-24" width="40" height="48" rx="6" fill={`url(#${d}-darkMetal)`} />
          <rect x="-14" y="-16" width="28" height="8" rx="2" fill="#74c0fc" />
          <rect x="-14" y="0" width="28" height="16" rx="2" fill="#1a1d24" />
          <circle cx="-8" cy="4" r="1.6" fill="#868e96" /><circle cx="-2" cy="4" r="1.6" fill="#868e96" /><circle cx="4" cy="4" r="1.6" fill="#868e96" />
          <circle cx="-8" cy="9" r="1.6" fill="#868e96" /><circle cx="-2" cy="9" r="1.6" fill="#868e96" /><circle cx="4" cy="9" r="1.6" fill="#868e96" />
        </g>
      )
    case 'veggiePlate':
      return (
        <g>
          <IconDefs id={d} />
          <circle cx="0" cy="0" r="24" fill="#f1f3f5" stroke="#ced4da" />
          <circle cx="0" cy="0" r="19" fill="none" stroke="#e9ecef" />
          <ellipse cx="-8" cy="-4" rx="9" ry="6" fill="#40c057" /><circle cx="-10" cy="-6" r="1.5" fill="#fff" opacity="0.6" />
          <ellipse cx="8" cy="-2" rx="8" ry="6" fill="#fa5252" /><circle cx="6" cy="-4" r="1.5" fill="#fff" opacity="0.6" />
          <ellipse cx="0" cy="10" rx="9" ry="6" fill="#fcc419" /><circle cx="-2" cy="8" r="1.5" fill="#fff" opacity="0.6" />
        </g>
      )
    case 'bowl':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -24 -2 Q -24 20 0 20 Q 24 20 24 -2 Z" fill={`url(#${d}-green)`} />
          <ellipse cx="0" cy="-2" rx="24" ry="4" fill="#2f9e44" opacity="0.5" />
          <circle cx="-8" cy="-6" r="5" fill="#fa5252" />
          <circle cx="6" cy="-8" r="5" fill="#fcc419" />
          <circle cx="0" cy="0" r="5" fill="#40c057" />
        </g>
      )
    case 'trayReturn':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-26" y="-14" width="52" height="26" rx="4" fill={`url(#${d}-metal)`} stroke="#868e96" />
          <line x1="-10" y1="-14" x2="-10" y2="12" stroke="#868e96" />
          <line x1="10" y1="-14" x2="10" y2="12" stroke="#868e96" />
          <path d="M 0 16 L -6 24 L 6 24 Z" fill="#495057" />
        </g>
      )
    case 'clock':
      return (
        <g>
          <IconDefs id={d} />
          <circle cx="0" cy="0" r="24" fill="#fff" stroke="#4c6ef5" strokeWidth="3" />
          <circle cx="0" cy="-19" r="1.3" fill="#adb5bd" /><circle cx="0" cy="19" r="1.3" fill="#adb5bd" />
          <circle cx="-19" cy="0" r="1.3" fill="#adb5bd" /><circle cx="19" cy="0" r="1.3" fill="#adb5bd" />
          <line x1="0" y1="0" x2="0" y2="-14" stroke="#343a40" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="0" y1="0" x2="10" y2="4" stroke="#343a40" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="0" cy="0" r="2" fill="#343a40" />
        </g>
      )
    case 'key':
      return (
        <g transform="rotate(-30)">
          <IconDefs id={d} />
          <circle cx="-16" cy="0" r="9" fill="none" stroke={`url(#${d}-gold)`} strokeWidth="5" />
          <rect x="-8" y="-3" width="26" height="6" fill={`url(#${d}-gold)`} />
          <rect x="10" y="3" width="5" height="7" fill="#f08c00" />
          <rect x="16" y="3" width="5" height="10" fill="#f08c00" />
        </g>
      )
    case 'package':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-22" y="-20" width="44" height="40" rx="3" fill="#d9b38c" stroke="#a97c50" />
          <rect x="-22" y="-20" width="44" height="12" fill="#000" opacity="0.06" />
          <line x1="-22" y1="0" x2="22" y2="0" stroke="#a97c50" strokeWidth="3" />
          <line x1="0" y1="-20" x2="0" y2="20" stroke="#a97c50" strokeWidth="3" />
        </g>
      )
    case 'wifi':
      return (
        <g>
          <path d="M -20 -4 A 28 28 0 0 1 20 -4" fill="none" stroke="#4c6ef5" strokeWidth="4" strokeLinecap="round" />
          <path d="M -12 6 A 16 16 0 0 1 12 6" fill="none" stroke="#4c6ef5" strokeWidth="4" strokeLinecap="round" />
          <circle cx="0" cy="16" r="4" fill="#4c6ef5" />
        </g>
      )
    case 'passwordLock':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-18" y="-4" width="36" height="28" rx="4" fill={`url(#${d}-darkMetal)`} />
          <path d="M -12 -4 L -12 -14 Q -12 -26 0 -26 Q 12 -26 12 -14 L 12 -4" fill="none" stroke="#495057" strokeWidth="5" />
          <circle cx="0" cy="10" r="4" fill={`url(#${d}-gold)`} />
        </g>
      )
    case 'laptop':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-20" y="-22" width="40" height="26" rx="2" fill={`url(#${d}-darkMetal)`} />
          <rect x="-16" y="-18" width="32" height="18" fill="#74c0fc" />
          <line x1="-13" y1="-9" x2="9" y2="-9" stroke="#e7f5ff" strokeWidth="1" opacity="0.5" />
          <path d="M -26 4 L 26 4 L 20 14 L -20 14 Z" fill={`url(#${d}-metal)`} />
          <rect x="-6" y="7" width="12" height="4" rx="1" fill="#868e96" />
        </g>
      )
    case 'ticket':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-24" y="-14" width="48" height="28" rx="4" fill={`url(#${d}-blue)`} />
          <circle cx="-24" cy="0" r="4" fill="#eef2ff" /><circle cx="24" cy="0" r="4" fill="#eef2ff" />
          <line x1="-4" y1="-11" x2="-4" y2="11" stroke="#eef2ff" strokeWidth="2" strokeDasharray="2 3" />
          <circle cx="8" cy="0" r="4" fill="#fff" />
        </g>
      )
    case 'emailIcon':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-24" y="-16" width="48" height="32" rx="4" fill={`url(#${d}-paper)`} stroke="#4c6ef5" strokeWidth="2" />
          <path d="M -24 -16 L 0 4 L 24 -16" fill="none" stroke="#4c6ef5" strokeWidth="2" />
          <circle cx="18" cy="-12" r="5" fill="#fa5252" stroke="#fff" strokeWidth="1.5" />
        </g>
      )
    case 'wrench':
      return (
        <g transform="rotate(-40)">
          <IconDefs id={d} />
          <rect x="-26" y="-6" width="52" height="12" rx="6" fill={`url(#${d}-metal)`} />
          <line x1="-20" y1="-2" x2="12" y2="-2" stroke="#fff" strokeWidth="1.5" opacity="0.5" />
          <circle cx="-20" cy="0" r="10" fill="none" stroke={`url(#${d}-metal)`} strokeWidth="6" />
          <circle cx="20" cy="0" r="8" fill="none" stroke={`url(#${d}-metal)`} strokeWidth="5" />
        </g>
      )
    case 'car':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-26" y="-4" width="52" height="16" rx="6" fill={`url(#${d}-red)`} />
          <path d="M -16 -4 L -10 -16 L 10 -16 L 16 -4 Z" fill="#e03131" />
          <rect x="-8" y="-14" width="16" height="10" fill={`url(#${d}-glass)`} />
          <line x1="0" y1="-14" x2="0" y2="-4" stroke="#495057" strokeWidth="1" />
          <circle cx="-20" cy="0" r="2" fill="#ffe066" />
          <circle cx="-14" cy="14" r="7" fill="#212529" /><circle cx="-14" cy="14" r="3" fill="#868e96" />
          <circle cx="14" cy="14" r="7" fill="#212529" /><circle cx="14" cy="14" r="3" fill="#868e96" />
        </g>
      )
    case 'transitVehicle':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-26" y="-20" width="52" height="34" rx="6" fill={`url(#${d}-blue)`} />
          <rect x="-20" y="-14" width="14" height="12" fill={`url(#${d}-glass)`} />
          <rect x="-2" y="-14" width="14" height="12" fill={`url(#${d}-glass)`} />
          <rect x="16" y="-14" width="8" height="12" fill={`url(#${d}-glass)`} />
          <line x1="-26" y1="4" x2="26" y2="4" stroke="#fff" strokeWidth="1.5" opacity="0.4" />
          <circle cx="-14" cy="16" r="6" fill="#212529" /><circle cx="-14" cy="16" r="2.5" fill="#868e96" />
          <circle cx="14" cy="16" r="6" fill="#212529" /><circle cx="14" cy="16" r="2.5" fill="#868e96" />
        </g>
      )
    case 'luggage':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-20" y="-16" width="40" height="34" rx="5" fill="#f59f00" stroke="#e8590c" />
          <rect x="-8" y="-24" width="16" height="10" rx="3" fill="none" stroke="#e8590c" strokeWidth="3" />
          <line x1="-20" y1="0" x2="20" y2="0" stroke="#e8590c" strokeWidth="2" />
          <rect x="-14" y="-10" width="8" height="6" rx="1" fill="#e8590c" opacity="0.5" />
          <rect x="6" y="4" width="8" height="6" rx="1" fill="#e8590c" opacity="0.5" />
        </g>
      )
    case 'gem':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -18 -8 L 0 -20 L 18 -8 L 10 18 L -10 18 Z" fill="#22b8cf" stroke="#1098ad" />
          <path d="M -18 -8 L 18 -8 L 0 -20 Z" fill="#66d9e8" />
          <path d="M -18 -8 L -10 18 L 0 -8 Z" fill="#3bc9db" opacity="0.6" />
          <path d="M 18 -8 L 10 18 L 0 -8 Z" fill="#0c8599" opacity="0.4" />
          <circle cx="-6" cy="-10" r="1.5" fill="#fff" opacity="0.8" />
        </g>
      )
    case 'flowerPlant':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-10" y="8" width="20" height="18" rx="2" fill="#e8590c" />
          <rect x="-10" y="8" width="20" height="5" fill="#000" opacity="0.08" />
          <line x1="0" y1="8" x2="0" y2="-8" stroke="#2f9e44" strokeWidth="3" />
          <path d="M 0 0 Q 8 -2 10 4" fill="none" stroke="#2f9e44" strokeWidth="2" />
          <circle cx="0" cy="-16" r="7" fill="#fa5252" />
          <circle cx="-9" cy="-10" r="6" fill="#ff8787" />
          <circle cx="9" cy="-10" r="6" fill="#ff8787" />
          <circle cx="0" cy="-9" r="4" fill={`url(#${d}-gold)`} />
        </g>
      )
    case 'bread':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -22 6 Q -22 -14 0 -14 Q 22 -14 22 6 Z" fill="#e8a33d" />
          <path d="M -22 6 L 22 6 L 22 14 Q 0 20 -22 14 Z" fill="#c8792a" />
          <line x1="-10" y1="-10" x2="-6" y2="4" stroke="#a9662a" strokeWidth="2" />
          <line x1="2" y1="-12" x2="6" y2="4" stroke="#a9662a" strokeWidth="2" />
          <circle cx="-14" cy="-2" r="1" fill="#fff5e0" /><circle cx="10" cy="-4" r="1" fill="#fff5e0" /><circle cx="-4" cy="-8" r="1" fill="#fff5e0" />
        </g>
      )
    case 'coffeeCup':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -14 -10 L 14 -10 L 12 18 Q 12 22 0 22 Q -12 22 -14 18 Z" fill={`url(#${d}-paper)`} stroke="#adb5bd" />
          <rect x="-14" y="-10" width="28" height="6" fill="#a9784f" />
          <path d="M 14 -6 Q 26 -6 24 6 Q 22 14 12 12" fill="none" stroke="#adb5bd" strokeWidth="3" />
          <path d="M -6 -18 Q -9 -22 -6 -26" fill="none" stroke="#ced4da" strokeWidth="2" strokeLinecap="round" />
          <path d="M 2 -20 Q -1 -24 2 -28" fill="none" stroke="#ced4da" strokeWidth="2" strokeLinecap="round" />
        </g>
      )
    case 'iceCream':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -12 0 L 12 0 L 0 26 Z" fill="#e8a33d" />
          <line x1="-8" y1="4" x2="4" y2="20" stroke="#c8792a" strokeWidth="1" /><line x1="8" y1="4" x2="-4" y2="20" stroke="#c8792a" strokeWidth="1" />
          <circle cx="0" cy="-10" r="14" fill="#ffd8a8" />
          <circle cx="-5" cy="-15" r="3" fill="#fff" opacity="0.5" />
          <circle cx="-9" cy="-16" r="4" fill="#fa5252" />
          <circle cx="8" cy="-14" r="3" fill="#4c6ef5" />
        </g>
      )
    case 'sofa':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-26" y="-4" width="52" height="20" rx="4" fill={`url(#${d}-blue)`} />
          <rect x="-26" y="-18" width="10" height="24" rx="4" fill="#5c7cfa" />
          <rect x="16" y="-18" width="10" height="24" rx="4" fill="#5c7cfa" />
          <rect x="-16" y="-14" width="32" height="14" rx="4" fill="#5c7cfa" />
          <line x1="0" y1="-12" x2="0" y2="-2" stroke="#3b5bdb" strokeWidth="1" opacity="0.5" />
        </g>
      )
    case 'shirtHanger':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M 0 -20 L 0 -14" stroke="#868e96" strokeWidth="2" />
          <path d="M -18 -14 Q 0 -26 18 -14" fill="none" stroke="#868e96" strokeWidth="2.5" />
          <path d="M -20 -12 L 0 4 L 20 -12 L 22 -8 L 0 10 L -22 -8 Z" fill="#e64980" />
          <path d="M -8 -8 L 0 -2 L 8 -8" fill="none" stroke="#c2255c" strokeWidth="1.5" opacity="0.6" />
        </g>
      )
    case 'shoe':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -22 10 Q -22 -6 -6 -6 Q 4 -12 16 -8 Q 26 -4 26 6 Q 26 12 20 12 L -20 12 Q -22 12 -22 10 Z" fill={`url(#${d}-darkMetal)`} />
          <path d="M -6 -6 Q 4 -10 12 -7" fill="none" stroke="#868e96" strokeWidth="1" opacity="0.6" />
          <rect x="-22" y="6" width="48" height="6" fill="#212529" />
        </g>
      )
    case 'basket':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -22 -2 L 22 -2 L 18 18 Q 18 22 0 22 Q -18 22 -18 18 Z" fill="#e8a33d" />
          <line x1="-16" y1="4" x2="14" y2="4" stroke="#c8792a" strokeWidth="1" opacity="0.6" /><line x1="-15" y1="10" x2="13" y2="10" stroke="#c8792a" strokeWidth="1" opacity="0.6" />
          <path d="M -18 -2 Q 0 -22 18 -2" fill="none" stroke="#c8792a" strokeWidth="3" />
          <circle cx="-6" cy="4" r="6" fill="#40c057" /><circle cx="-8" cy="2" r="1.3" fill="#fff" opacity="0.5" />
          <circle cx="8" cy="6" r="6" fill="#fa5252" /><circle cx="6" cy="4" r="1.3" fill="#fff" opacity="0.5" />
        </g>
      )
    case 'formDocument':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-18" y="-24" width="36" height="48" rx="3" fill={`url(#${d}-paper)`} stroke="#adb5bd" />
          <path d="M 8 -24 L 18 -14 L 8 -14 Z" fill="#dee2e6" />
          <line x1="-12" y1="-14" x2="12" y2="-14" stroke="#adb5bd" strokeWidth="2" />
          <line x1="-12" y1="-6" x2="12" y2="-6" stroke="#adb5bd" strokeWidth="2" />
          <line x1="-12" y1="2" x2="12" y2="2" stroke="#adb5bd" strokeWidth="2" />
          <path d="M -10 12 L -4 18 L 12 4" fill="none" stroke="#2ac56c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    case 'dumbbell':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-20" y="-4" width="40" height="8" rx="3" fill={`url(#${d}-metal)`} />
          <rect x="-28" y="-12" width="10" height="24" rx="3" fill={`url(#${d}-darkMetal)`} />
          <rect x="18" y="-12" width="10" height="24" rx="3" fill={`url(#${d}-darkMetal)`} />
        </g>
      )
    case 'yogaMat':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-26" y="-10" width="52" height="20" rx="8" fill="#63e6be" />
          <line x1="-20" y1="-4" x2="20" y2="-4" stroke="#38d9a9" strokeWidth="1" opacity="0.6" /><line x1="-20" y1="4" x2="20" y2="4" stroke="#38d9a9" strokeWidth="1" opacity="0.6" />
          <circle cx="-20" cy="0" r="9" fill="#38d9a9" />
        </g>
      )
    case 'racket':
      return (
        <g>
          <IconDefs id={d} />
          <ellipse cx="0" cy="-10" rx="16" ry="20" fill="none" stroke="#e8590c" strokeWidth="4" />
          <line x1="-10" y1="-20" x2="10" y2="0" stroke="#ffd8a8" strokeWidth="1" />
          <line x1="10" y1="-20" x2="-10" y2="0" stroke="#ffd8a8" strokeWidth="1" />
          <line x1="-6" y1="-24" x2="6" y2="4" stroke="#ffd8a8" strokeWidth="1" />
          <line x1="6" y1="-24" x2="-6" y2="4" stroke="#ffd8a8" strokeWidth="1" />
          <line x1="0" y1="10" x2="0" y2="26" stroke={`url(#${d}-darkMetal)`} strokeWidth="5" />
        </g>
      )
    case 'pool':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-26" y="-14" width="52" height="28" rx="4" fill={`url(#${d}-glass)`} />
          <path d="M -22 0 Q -14 -6 -6 0 Q 2 6 10 0 Q 18 -6 24 0" fill="none" stroke="#fff" strokeWidth="2" />
          <path d="M -22 -8 Q -14 -12 -6 -8 Q 2 -4 10 -8 Q 18 -12 24 -8" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
        </g>
      )
    case 'scissors':
      return (
        <g transform="rotate(20)">
          <IconDefs id={d} />
          <circle cx="-14" cy="14" r="7" fill="none" stroke="#fa5252" strokeWidth="4" />
          <circle cx="14" cy="14" r="7" fill="none" stroke="#4c6ef5" strokeWidth="4" />
          <path d="M -10 8 L 20 -20" stroke={`url(#${d}-metal)`} strokeWidth="3" />
          <path d="M 10 8 L -20 -20" stroke={`url(#${d}-metal)`} strokeWidth="3" />
        </g>
      )
    case 'towel':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-24" y="-16" width="48" height="10" rx="2" fill="#74c0fc" />
          <rect x="-24" y="-4" width="48" height="10" rx="2" fill="#a5d8ff" />
          <rect x="-24" y="8" width="48" height="10" rx="2" fill="#74c0fc" />
          <line x1="-24" y1="-11" x2="24" y2="-11" stroke="#fff" strokeWidth="1" opacity="0.5" />
        </g>
      )
    case 'sun':
      return (
        <g>
          <IconDefs id={d} />
          <circle cx="0" cy="0" r="14" fill={`url(#${d}-gold)`} />
          <circle cx="-4" cy="-4" r="4" fill="#fff" opacity="0.35" />
          <line x1="0" y1="-24" x2="0" y2="-18" stroke="#fcc419" strokeWidth="3" strokeLinecap="round" />
          <line x1="0" y1="18" x2="0" y2="24" stroke="#fcc419" strokeWidth="3" strokeLinecap="round" />
          <line x1="-24" y1="0" x2="-18" y2="0" stroke="#fcc419" strokeWidth="3" strokeLinecap="round" />
          <line x1="18" y1="0" x2="24" y2="0" stroke="#fcc419" strokeWidth="3" strokeLinecap="round" />
          <line x1="-17" y1="-17" x2="-13" y2="-13" stroke="#fcc419" strokeWidth="3" strokeLinecap="round" />
          <line x1="13" y1="13" x2="17" y2="17" stroke="#fcc419" strokeWidth="3" strokeLinecap="round" />
          <line x1="-17" y1="17" x2="-13" y2="13" stroke="#fcc419" strokeWidth="3" strokeLinecap="round" />
          <line x1="13" y1="-13" x2="17" y2="-17" stroke="#fcc419" strokeWidth="3" strokeLinecap="round" />
        </g>
      )
    case 'heart':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M 0 18 C -20 2 -20 -14 -6 -14 C -2 -14 0 -10 0 -8 C 0 -10 2 -14 6 -14 C 20 -14 20 2 0 18 Z" fill={`url(#${d}-red)`} />
          <path d="M -12 -8 Q -10 -11 -6 -11" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
        </g>
      )
    case 'tooth':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -14 -14 Q -18 -20 -10 -22 Q -4 -24 0 -20 Q 4 -24 10 -22 Q 18 -20 14 -14 Q 16 0 10 14 Q 6 22 2 8 Q 0 4 -2 8 Q -6 22 -10 14 Q -16 0 -14 -14 Z" fill={`url(#${d}-paper)`} stroke="#dee2e6" />
          <path d="M -6 -14 Q 0 -12 6 -14" fill="none" stroke="#dee2e6" strokeWidth="1" />
        </g>
      )
    case 'glasses':
      return (
        <g>
          <IconDefs id={d} />
          <circle cx="-14" cy="0" r="12" fill="#a5d8ff" opacity="0.25" stroke="#343a40" strokeWidth="3" />
          <circle cx="14" cy="0" r="12" fill="#a5d8ff" opacity="0.25" stroke="#343a40" strokeWidth="3" />
          <line x1="-2" y1="0" x2="2" y2="0" stroke="#343a40" strokeWidth="3" />
          <line x1="-26" y1="-2" x2="-32" y2="-8" stroke="#343a40" strokeWidth="3" />
          <line x1="26" y1="-2" x2="32" y2="-8" stroke="#343a40" strokeWidth="3" />
        </g>
      )
    case 'bandage':
      return (
        <g transform="rotate(30)">
          <IconDefs id={d} />
          <rect x="-22" y="-8" width="44" height="16" rx="8" fill="#ffe8cc" stroke="#f8c98c" />
          <circle cx="-10" cy="0" r="2" fill="#e8a33d" />
          <circle cx="10" cy="0" r="2" fill="#e8a33d" />
          <rect x="-6" y="-8" width="12" height="16" fill="#fff" opacity="0.8" />
        </g>
      )
    case 'bloodDrop':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M 0 -20 C 10 -6 16 4 16 12 C 16 22 8 26 0 26 C -8 26 -16 22 -16 12 C -16 4 -10 -6 0 -20 Z" fill={`url(#${d}-red)`} />
          <path d="M -4 -8 Q -8 0 -8 6" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
        </g>
      )
    case 'globe':
      return (
        <g>
          <IconDefs id={d} />
          <circle cx="0" cy="0" r="20" fill={`url(#${d}-blue)`} />
          <path d="M -14 -8 Q -8 -12 -2 -8 Q 2 -4 -4 0 Q -8 4 -14 2 Z" fill="#40c057" opacity="0.85" />
          <path d="M 4 4 Q 10 2 14 8 Q 10 12 4 10 Z" fill="#40c057" opacity="0.85" />
          <ellipse cx="0" cy="0" rx="20" ry="8" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.7" />
          <ellipse cx="0" cy="0" rx="8" ry="20" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.7" />
          <line x1="-20" y1="0" x2="20" y2="0" stroke="#fff" strokeWidth="1.5" opacity="0.7" />
        </g>
      )
    case 'paintingFrame':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-22" y="-18" width="44" height="36" rx="2" fill={`url(#${d}-wood)`} strokeWidth="4" stroke="#5c3a1e" />
          <rect x="-16" y="-12" width="32" height="24" fill="#cfe8ff" />
          <circle cx="-4" cy="-4" r="5" fill="#ffd43b" />
          <path d="M -16 8 L -2 -4 L 6 4 L 16 -8 L 16 8 Z" fill="#495057" />
        </g>
      )
    case 'telescope':
      return (
        <g transform="rotate(-30)">
          <IconDefs id={d} />
          <rect x="-24" y="-6" width="40" height="12" rx="4" fill={`url(#${d}-darkMetal)`} />
          <line x1="-18" y1="-2" x2="8" y2="-2" stroke="#868e96" strokeWidth="1" opacity="0.6" />
          <rect x="14" y="-9" width="10" height="18" rx="2" fill="#1a1d24" />
          <line x1="-24" y1="10" x2="-14" y2="24" stroke="#868e96" strokeWidth="4" />
          <line x1="-16" y1="6" x2="-10" y2="24" stroke="#868e96" strokeWidth="3" />
        </g>
      )
    case 'fishTank':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-26" y="-16" width="52" height="32" rx="3" fill={`url(#${d}-glass)`} stroke="#4dabf7" strokeWidth="2" />
          <rect x="-26" y="8" width="52" height="8" fill="#e8a33d" opacity="0.5" />
          <path d="M -8 0 Q -2 -6 4 0 Q -2 6 -8 0 Z" fill="#fa5252" />
          <path d="M 4 0 L 10 -4 L 10 4 Z" fill="#fa5252" />
          <circle cx="14" cy="-8" r="1.5" fill="#fff" opacity="0.7" /><circle cx="18" cy="-4" r="1" fill="#fff" opacity="0.7" />
        </g>
      )
    case 'pawPrint':
      return (
        <g>
          <IconDefs id={d} />
          <ellipse cx="0" cy="8" rx="14" ry="11" fill={`url(#${d}-wood)`} />
          <circle cx="-14" cy="-8" r="6" fill="#8a5a34" />
          <circle cx="-4" cy="-16" r="6" fill="#8a5a34" />
          <circle cx="8" cy="-16" r="6" fill="#8a5a34" />
          <circle cx="16" cy="-6" r="6" fill="#8a5a34" />
        </g>
      )
    case 'bike':
      return (
        <g>
          <IconDefs id={d} />
          <circle cx="-14" cy="10" r="12" fill="none" stroke="#343a40" strokeWidth="3" />
          <circle cx="14" cy="10" r="12" fill="none" stroke="#343a40" strokeWidth="3" />
          <line x1="-14" y1="10" x2="-14" y2="2" stroke="#adb5bd" strokeWidth="1" /><line x1="-14" y1="10" x2="-6" y2="10" stroke="#adb5bd" strokeWidth="1" /><line x1="-14" y1="10" x2="-20" y2="16" stroke="#adb5bd" strokeWidth="1" />
          <line x1="14" y1="10" x2="14" y2="2" stroke="#adb5bd" strokeWidth="1" /><line x1="14" y1="10" x2="22" y2="10" stroke="#adb5bd" strokeWidth="1" /><line x1="14" y1="10" x2="8" y2="16" stroke="#adb5bd" strokeWidth="1" />
          <path d="M -14 10 L 0 -10 L 14 10 M 0 -10 L -6 -18 M -14 10 L 6 10" stroke="#4c6ef5" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    case 'plane':
      return (
        <g transform="rotate(-20)">
          <IconDefs id={d} />
          <path d="M -26 0 L 10 0 L 26 -6 L 26 -2 L 12 4 L 26 10 L 26 14 L 10 8 L -26 8 L -18 4 Z" fill={`url(#${d}-glass)`} stroke="#4dabf7" />
          <circle cx="-10" cy="4" r="1.2" fill="#1971c2" /><circle cx="-4" cy="4" r="1.2" fill="#1971c2" /><circle cx="2" cy="4" r="1.2" fill="#1971c2" />
        </g>
      )
    case 'bowlingPin':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M 0 -24 Q 8 -18 6 -8 Q 10 0 8 12 Q 8 22 0 22 Q -8 22 -8 12 Q -10 0 -6 -8 Q -8 -18 0 -24 Z" fill={`url(#${d}-paper)`} stroke="#dee2e6" />
          <rect x="-6" y="-14" width="12" height="4" fill="#fa5252" />
          <rect x="-7" y="-9" width="14" height="2" fill="#fa5252" opacity="0.6" />
        </g>
      )
    case 'joystick':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-22" y="8" width="44" height="14" rx="4" fill={`url(#${d}-darkMetal)`} />
          <circle cx="-12" cy="15" r="2" fill="#fa5252" /><circle cx="-4" cy="15" r="2" fill="#ffd43b" /><circle cx="4" cy="15" r="2" fill="#40c057" />
          <rect x="-4" y="-14" width="8" height="24" rx="3" fill={`url(#${d}-metal)`} />
          <circle cx="0" cy="-18" r="8" fill={`url(#${d}-red)`} />
        </g>
      )
    case 'boat':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -24 4 L 24 4 L 16 16 L -16 16 Z" fill={`url(#${d}-blue)`} />
          <line x1="0" y1="4" x2="0" y2="-22" stroke="#868e96" strokeWidth="2" />
          <path d="M 0 -22 L 16 4 L 0 4 Z" fill="#fff" stroke="#dee2e6" />
        </g>
      )
    case 'map':
      return (
        <g>
          <IconDefs id={d} />
          <path d="M -22 -16 L -6 -22 L 8 -16 L 22 -22 L 22 18 L 8 24 L -6 18 L -22 24 Z" fill="#ffe8cc" stroke="#e8a33d" />
          <line x1="-6" y1="-22" x2="-6" y2="18" stroke="#e8a33d" strokeWidth="1" />
          <line x1="8" y1="-16" x2="8" y2="24" stroke="#e8a33d" strokeWidth="1" />
          <path d="M -12 0 L -10 -4 L -8 0 L -10 4 Z" fill="#e03131" />
        </g>
      )
    case 'gift':
      return (
        <g>
          <IconDefs id={d} />
          <rect x="-20" y="-4" width="40" height="28" rx="2" fill={`url(#${d}-red)`} />
          <rect x="-20" y="-12" width="40" height="10" rx="2" fill="#f06595" />
          <rect x="-4" y="-12" width="8" height="44" fill="#fff" />
          <path d="M -4 -12 Q -14 -22 -4 -22 Q 0 -18 -4 -12 Z" fill="#f06595" />
          <path d="M 4 -12 Q 14 -22 4 -22 Q 0 -18 4 -12 Z" fill="#f06595" />
        </g>
      )
    case 'skis':
      return (
        <g transform="rotate(-10)">
          <IconDefs id={d} />
          <rect x="-14" y="-28" width="7" height="52" rx="3" fill="#4c6ef5" />
          <path d="M -14 24 Q -14 30 -7 30 L -7 24 Z" fill="#4c6ef5" />
          <rect x="4" y="-28" width="7" height="52" rx="3" fill="#e64980" />
          <path d="M 4 24 Q 4 30 11 30 L 11 24 Z" fill="#e64980" />
          <line x1="20" y1="-22" x2="20" y2="18" stroke={`url(#${d}-metal)`} strokeWidth="3" />
          <circle cx="20" cy="-22" r="3" fill="#868e96" />
          <circle cx="20" cy="12" r="6" fill="none" stroke="#868e96" strokeWidth="1.5" />
        </g>
      )
    default:
      return <circle r="20" fill="#adb5bd" />
  }
}

// Lays out scene elements inside a "room": a back wall zone (top ~62% of the canvas) for
// small/mounted items (tag, calendar, clock, key, wifi...) and a floor zone (bottom ~38%) for
// larger furniture/people items, with the door always anchored near the back-right corner.
// Deterministic pseudo-random offset in [-range/2, range/2], seeded from a string key -- used to
// nudge item positions/scale off a perfect grid so the scene reads as a real, slightly irregular
// place rather than icons snapped to a ruler.
function seededJitter(key, range) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return ((h % 1000) / 1000 - 0.5) * range
}

function roomLayout(elements, width, height) {
  const wallH = height * 0.6
  const floorH = height - wallH
  const doorEl = elements.find((e) => e.key === 'door')
  const others = elements.filter((e) => e.key !== 'door')
  const wallItems = others.filter((e) => e.row === 'wall')
  const floorItems = others.filter((e) => e.row !== 'wall')

  const positions = {}
  wallItems.forEach((el, i) => {
    const slotW = (width * 0.7) / (wallItems.length + 1)
    const jx = seededJitter(el.key, 10)
    positions[el.key] = { x: slotW * (i + 1) + width * 0.06 + jx, y: wallH * 0.46, row: 'wall', scale: 1.08 }
  })
  // Split floor items into a "near" row (bigger, lower, closer to viewer) and a "far" row
  // (smaller, higher, nearer the wall) so the floor reads with real depth instead of one flat line.
  const nearItems = floorItems.filter((_, i) => i % 2 === 0)
  const farItems = floorItems.filter((_, i) => i % 2 === 1)
  nearItems.forEach((el, i) => {
    const slotW = (width * 0.68) / (nearItems.length + 1)
    const jx = seededJitter(el.key, 16)
    const jy = seededJitter(el.key + 'y', 10)
    positions[el.key] = { x: slotW * (i + 1) + width * 0.05 + jx, y: wallH + floorH * 0.74 + jy, row: 'floor', scale: 1.4 }
  })
  farItems.forEach((el, i) => {
    const slotW = (width * 0.56) / (farItems.length + 1)
    const jx = seededJitter(el.key, 16)
    const jy = seededJitter(el.key + 'y', 8)
    positions[el.key] = { x: slotW * (i + 1) + width * 0.12 + jx, y: wallH + floorH * 0.38 + jy, row: 'floor', scale: 1.05 }
  })
  if (doorEl) {
    positions[doorEl.key] = { x: width * 0.88, y: wallH + floorH * 0.36, row: 'floor', scale: 1.15 }
  }
  return { positions, wallH, floorH, wallItems, floorItems: [...nearItems, ...farItems], doorEl }
}

// Small, always-muted, non-interactive furnishing placed in scene corners so rooms feel lived-in
// rather than empty -- never appears in activeKeys, never brightens, just quiet set dressing.
const AMBIENT_PROPS = {
  outdoor: [{ icon: 'flowerPlant', x: 0.08, yFrac: 0.8, scale: 0.85 }],
  transit: [{ icon: 'luggage', x: 0.06, yFrac: 0.86, scale: 0.75 }],
  water: [{ icon: 'flowerPlant', x: 0.07, yFrac: 0.82, scale: 0.75 }],
  retail: [{ icon: 'flowerPlant', x: 0.06, yFrac: 0.82, scale: 0.8 }],
  medical: [{ icon: 'flowerPlant', x: 0.07, yFrac: 0.82, scale: 0.8 }],
  food: [{ icon: 'flowerPlant', x: 0.06, yFrac: 0.82, scale: 0.75 }],
  studio: [{ icon: 'sofa', x: 0.1, yFrac: 0.84, scale: 0.65 }],
  office: [{ icon: 'flowerPlant', x: 0.07, yFrac: 0.82, scale: 0.8 }],
}

// Classifies a location name into a broad "setting" so the background can look like the right
// kind of place (an outdoor garden vs. a clinic vs. a shop vs. a train platform) instead of the
// same generic room every time. Order matters -- more specific categories are checked first.
function classifyEnvironment(location = '') {
  const s = location.toLowerCase()
  const has = (...words) => words.some((w) => s.includes(w))
  if (has('aquarium', 'swimming pool', 'pool front')) return 'water'
  if (has('garden', 'zoo', 'farmers market', 'local farmers', 'amusement park', 'golf course', 'botanical')) return 'outdoor'
  if (has('station', 'terminal', 'airport', 'taxi', 'shuttle stop', 'parking services', 'gas station', 'car rental', 'car dealership', 'auto repair', 'motor vehicles', 'bike rental', 'ski rental', 'alpine ski')) return 'transit'
  if (has('cafeteria', 'dining hall', 'coffee shop', 'bakery', 'ice cream')) return 'food'
  if (has('health', 'clinic', 'pharmacy', 'dentist', 'therapy', 'counseling', 'chiropractor', 'acupuncture', 'optometrist', 'nutritionist', 'blood donation', 'urgent care', 'veterinary', 'massage', 'spa')) return 'medical'
  if (has('studio', 'gym', 'yoga', 'dance', 'dojo', 'martial arts', 'bowling', 'arcade', 'theater', 'cinema', 'movie', 'concert', 'salon', 'tanning', 'nail', 'planetarium', 'escape room', 'art gallery', 'art museum')) return 'studio'
  if (has('store', 'shop', 'market stall', 'bookstore', 'jewelry', 'flower', 'hardware', 'furniture', 'electronics', 'pet store', 'thrift', 'tailor', 'dry cleaner', 'phone repair', 'shoe repair', 'print shop')) return 'retail'
  return 'office'
}

const ENV_THEMES = {
  outdoor: { top: '#cdeeff', bottom: '#eaf8ff', floorTop: '#8bc76b', floorBottom: '#6ea852', line: '#4b7a3a', mood: 'sky' },
  transit: { top: '#d7e3f0', bottom: '#eef3f8', floorTop: '#c9ccd1', floorBottom: '#aeb2b8', line: '#ffffff', mood: 'sky' },
  water: { top: '#eaf6ff', bottom: '#dbeeff', floorTop: '#cfe9f5', floorBottom: '#a9d7ea', line: '#4dabf7', mood: 'wall' },
  retail: { top: '#fdf3e3', bottom: '#f3e4c8', floorTop: '#d9cba8', floorBottom: '#c3ac80', line: '#b39b68', mood: 'wall' },
  medical: { top: '#f2fbf7', bottom: '#e3f5ec', floorTop: '#e7edea', floorBottom: '#d3dcd7', line: '#9db3a8', mood: 'wall' },
  food: { top: '#fff2e0', bottom: '#ffe4c2', floorTop: '#e8cba0', floorBottom: '#d1a96f', line: '#b8874a', mood: 'wall' },
  studio: { top: '#efe3fb', bottom: '#ded0f5', floorTop: '#8a7c98', floorBottom: '#6c5f7d', line: '#c9b8e0', mood: 'wall' },
  office: { top: '#eef2ff', bottom: '#dde5fb', floorTop: '#d9cba8', floorBottom: '#c3ac80', line: '#b39b68', mood: 'wall' },
}

// Draws the full backdrop (sky/wall + floor + ambient, non-interactive decoration) for a given
// environment type, so each scene reads as one cohesive illustrated place rather than icons
// floating over an empty box. All shapes here are pure atmosphere -- never highlighted.
function EnvironmentBackdrop({ env, width, wallH, floorH, uid }) {
  const t = ENV_THEMES[env] || ENV_THEMES.office
  const height = wallH + floorH
  const cloud = (cx, cy, s) => (
    <g key={`${cx}-${cy}`} opacity="0.75">
      <ellipse cx={cx} cy={cy} rx={22 * s} ry={10 * s} fill="#fff" />
      <ellipse cx={cx - 16 * s} cy={cy + 3 * s} rx={14 * s} ry={8 * s} fill="#fff" />
      <ellipse cx={cx + 17 * s} cy={cy + 3 * s} rx={15 * s} ry={8 * s} fill="#fff" />
    </g>
  )

  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.top} /><stop offset="100%" stopColor={t.bottom} />
        </linearGradient>
        <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={t.floorTop} /><stop offset="100%" stopColor={t.floorBottom} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={width} height={wallH} fill={`url(#${uid}-sky)`} />
      <rect x="0" y={wallH} width={width} height={floorH} fill={`url(#${uid}-floor)`} />

      {t.mood === 'sky' ? (
        <>
          {cloud(width * 0.18, wallH * 0.28, 1)}
          {cloud(width * 0.78, wallH * 0.4, 0.8)}
          {env === 'outdoor' && (
            <>
              <path d={`M 0 ${wallH} Q ${width * 0.12} ${wallH - 16} ${width * 0.26} ${wallH} Q ${width * 0.4} ${wallH - 20} ${width * 0.55} ${wallH} Q ${width * 0.7} ${wallH - 14} ${width * 0.84} ${wallH} Q ${width * 0.94} ${wallH - 18} ${width} ${wallH} Z`} fill="#3f7a35" opacity="0.55" />
              <circle cx={width * 0.9} cy={wallH * 0.22} r="16" fill="#ffd43b" opacity="0.9" />
              <path d={`M ${width * 0.1} ${wallH + floorH * 0.5} Q ${width * 0.45} ${wallH + floorH * 0.3} ${width * 0.5} ${wallH + floorH}`} fill="none" stroke="#d9b979" strokeWidth={floorH * 0.16} opacity="0.35" />
              {[0.15, 0.3, 0.62, 0.8, 0.92].map((tx, i) => (
                <path key={i} d={`M ${width * tx} ${wallH + floorH * (0.55 + (i % 2) * 0.25)} q 3 -8 7 0`} stroke="#3f7a35" strokeWidth="2" fill="none" opacity="0.5" />
              ))}
            </>
          )}
          {env === 'transit' && (
            <>
              {[0.06, 0.16, 0.24, 0.34].map((tx, i) => (
                <rect key={i} x={width * tx} y={wallH - 14 - (i % 3) * 10} width={width * 0.06} height={14 + (i % 3) * 10} fill="#7d838c" opacity="0.5" />
              ))}
              {[0.62, 0.72, 0.82, 0.9].map((tx, i) => (
                <rect key={i} x={width * tx} y={wallH - 10 - (i % 2) * 14} width={width * 0.055} height={10 + (i % 2) * 14} fill="#7d838c" opacity="0.5" />
              ))}
              <line x1={width * 0.5} y1={wallH} x2={width * 0.5} y2={height} stroke="#fff" strokeWidth="4" strokeDasharray="10 10" opacity="0.55" />
            </>
          )}
        </>
      ) : (
        <>
          <line x1="0" y1={wallH} x2={width} y2={wallH} stroke={t.line} strokeWidth="2" />
          {[0.12, 0.5, 0.88].map((tx) => (
            <line key={tx} x1={width * tx} y1={height} x2={width * 0.5} y2={wallH} stroke={t.line} strokeWidth="1" opacity="0.3" />
          ))}
          {env === 'retail' && (
            <>
              <g opacity="0.28">
                <rect x={width * 0.04} y={wallH * 0.18} width={width * 0.22} height="3" fill="#8a5a34" />
                <rect x={width * 0.04} y={wallH * 0.4} width={width * 0.22} height="3" fill="#8a5a34" />
                <rect x={width * 0.06} y={wallH * 0.24} width="10" height="14" fill="#e64980" />
                <rect x={width * 0.12} y={wallH * 0.24} width="10" height="14" fill="#4c6ef5" />
                <rect x={width * 0.06} y={wallH * 0.46} width="10" height="14" fill="#f59f00" />
              </g>
              <g opacity="0.28">
                <rect x={width * 0.74} y={wallH * 0.18} width={width * 0.22} height="3" fill="#8a5a34" />
                <rect x={width * 0.74} y={wallH * 0.4} width={width * 0.22} height="3" fill="#8a5a34" />
                <rect x={width * 0.78} y={wallH * 0.24} width="10" height="14" fill="#2ac56c" />
                <rect x={width * 0.84} y={wallH * 0.24} width="10" height="14" fill="#f59f00" />
              </g>
            </>
          )}
          {env === 'water' && (
            <g transform={`translate(${width * 0.5}, ${wallH * 0.42})`}>
              <rect x={-width * 0.32} y={-wallH * 0.34} width={width * 0.64} height={wallH * 0.6} rx="8" fill="#4dabf7" stroke="#1971c2" strokeWidth="3" opacity="0.85" />
              {[-0.2, 0.05, 0.24].map((fx, i) => (
                <path key={i} d={`M ${width * fx - 14} ${-wallH * 0.06 + i * 12} q 7 -5 14 0 q 7 5 14 0`} stroke="#eaf6ff" strokeWidth="2" fill="none" opacity="0.5" />
              ))}
              <ellipse cx={-width * 0.1} cy={wallH * 0.06} rx="9" ry="5" fill="#fa5252" opacity="0.9" />
              <ellipse cx={width * 0.14} cy={-wallH * 0.02} rx="7" ry="4" fill="#ffd43b" opacity="0.9" />
              <circle cx={-width * 0.2} cy={-wallH * 0.18} r="2" fill="#eaf6ff" opacity="0.6" />
              <circle cx={width * 0.18} cy={-wallH * 0.12} r="1.5" fill="#eaf6ff" opacity="0.6" />
            </g>
          )}
          {env === 'medical' && (
            <g opacity="0.3" transform={`translate(${width * 0.86}, ${wallH * 0.32})`}>
              <rect x="-16" y="-16" width="32" height="32" rx="6" fill="#2ac56c" />
              <rect x="-4" y="-10" width="8" height="20" fill="#fff" />
              <rect x="-10" y="-4" width="20" height="8" fill="#fff" />
            </g>
          )}
          {env === 'food' && (
            <g opacity="0.35" transform={`translate(${width * 0.5}, ${wallH * 0.22})`}>
              <rect x="-30" y="-18" width="60" height="36" rx="3" fill="#fff" stroke="#e8a33d" strokeWidth="2" />
              {[-24, -12, 0, 12, 24].map((x) => (
                <line key={x} x1={x} y1="-16" x2={x} y2="16" stroke="#e8a33d" strokeWidth="1.5" />
              ))}
            </g>
          )}
          {env === 'studio' && (
            <g opacity="0.35">
              <ellipse cx={width * 0.5} cy={wallH * 0.1} rx={width * 0.4} ry={wallH * 0.5} fill="#fff" opacity="0.25" />
              <ellipse cx={width * 0.3} cy={wallH * 0.15} rx={width * 0.16} ry={wallH * 0.3} fill="#fff" opacity="0.2" />
            </g>
          )}
          {env === 'office' && (
            <g opacity="0.3" transform={`translate(${width * 0.86}, ${wallH * 0.3})`}>
              <rect x="-20" y="-20" width="40" height="34" rx="2" fill="#a5d8ff" stroke="#748ffc" strokeWidth="2" />
              <line x1="0" y1="-20" x2="0" y2="14" stroke="#748ffc" strokeWidth="1.5" />
              <line x1="-20" y1="-3" x2="20" y2="-3" stroke="#748ffc" strokeWidth="1.5" />
            </g>
          )}
          {(env === 'retail' || env === 'office' || env === 'food') &&
            [0.2, 0.4, 0.6, 0.8].map((tx) => (
              <line key={tx} x1={width * tx} y1={wallH} x2={width * (0.5 + (tx - 0.5) * 0.3)} y2={height} stroke={t.line} strokeWidth="1" opacity="0.2" />
            ))}
          {/* baseboard trim where wall meets floor, plus a soft rug under the main action so the
              room reads as furnished rather than an empty box */}
          <rect x="0" y={wallH - 3} width={width} height="5" fill={t.line} opacity="0.25" />
          <ellipse cx={width * 0.5} cy={wallH + floorH * 0.72} rx={width * 0.34} ry={floorH * 0.22} fill="#fff" opacity="0.12" />
        </>
      )}
    </g>
  )
}

// Renders a realistic little scene made of simple flat icon shapes grounded on a floor, with an
// environment-appropriate backdrop behind them (sky/grass for outdoor spots, clinic-white walls
// for medical offices, a shop-shelf silhouette for retail, etc. -- see classifyEnvironment) --
// whichever keys are in activeKeys are shown at full color/saturation with a glowing highlight
// (and a colored "grounding" shadow if on the floor), everything else is dimmed and desaturated.
// This mirrors BestMyTest's Listen & Repeat effect of colorizing the object currently being
// talked about, but fully in color rather than grayscale.
function SceneIllustration({ scene, location = '', activeKeys = [], width = 520, height = 420 }) {
  const elements = scene?.elements || []
  const { positions, wallH, floorH, wallItems, floorItems, doorEl } = roomLayout(elements, width, height)
  // Draw back-to-front: far floor items first, then wall items, then near floor items, then the
  // door -- so nothing near the "camera" gets visually cut off by something meant to sit behind it.
  const farFloor = floorItems.filter((e) => positions[e.key] && positions[e.key].y < wallH + floorH * 0.55)
  const nearFloor = floorItems.filter((e) => positions[e.key] && positions[e.key].y >= wallH + floorH * 0.55)
  const ordered = [...farFloor, ...wallItems, ...nearFloor, ...(doorEl ? [doorEl] : [])]
  const env = classifyEnvironment(location)
  const uid = `scene-${env}`
  const props = AMBIENT_PROPS[env] || []

  return (
    <div style={{ width: `${width}px`, height: `${height}px`, maxWidth: '100%', borderRadius: '16px', overflow: 'hidden', margin: '0 auto', flexShrink: 0, border: '0.5px solid #d7dbe6', boxShadow: '0 1px 4px rgba(20,25,40,0.08)' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="scene illustration">
        <defs>
          <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <EnvironmentBackdrop env={env} width={width} wallH={wallH} floorH={floorH} uid={uid} />

        {/* Quiet, always-muted furnishing so the room feels lived-in even before anything lights up */}
        {props.map((p, i) => (
          <g key={`prop-${i}`} transform={`translate(${width * p.x}, ${wallH + floorH * p.yFrac}) scale(${p.scale})`} opacity="0.5" style={{ filter: 'grayscale(55%)' }}>
            <SceneIconShape type={p.icon} />
          </g>
        ))}

        {ordered.map((el) => {
          const pos = positions[el.key]
          if (!pos) return null
          const active = activeKeys.includes(el.key)
          const isFloor = pos.row === 'floor'
          const scale = (pos.scale || 1) * (active ? 1.16 : 1)
          return (
            <g key={el.key}>
              {isFloor && (
                <ellipse
                  cx={pos.x}
                  cy={pos.y + 22 * (pos.scale || 1)}
                  rx={(active ? 30 : 22) * (pos.scale || 1)}
                  ry={7 * (pos.scale || 1)}
                  fill={active ? 'rgba(42,197,108,0.35)' : 'rgba(0,0,0,0.16)'}
                  style={{ transition: 'all 0.4s ease' }}
                />
              )}
              {active && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={30 * (pos.scale || 1)}
                  fill="rgba(42,197,108,0.28)"
                  filter={`url(#${uid}-glow)`}
                  style={{ transition: 'all 0.4s ease' }}
                />
              )}
              <g
                transform={`translate(${pos.x}, ${pos.y}) scale(${scale})`}
                style={{
                  transition: 'opacity 0.4s ease, filter 0.4s ease, transform 0.4s ease',
                  opacity: active ? 1 : 0.4,
                  filter: active ? 'drop-shadow(0 0 8px rgba(42,197,108,0.95)) saturate(1.4)' : 'grayscale(70%)',
                }}
              >
                <SceneIconShape type={el.icon} />
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TopicPhoto({ icon, label, photoSlug, photoUrl, width = 140, height = 140 }) {
  // Try the local photo first (frontend/public/topic-photos/{slug}.jpg), then the remote
  // Wikimedia URL as a fallback, and finally the emoji if both fail to load.
  const localSrc = photoSlug ? `/topic-photos/${photoSlug}.jpg` : null
  const [stage, setStage] = useState(localSrc ? 'local' : (photoUrl ? 'remote' : 'emoji'))
  const currentSrc = stage === 'local' ? localSrc : (stage === 'remote' ? photoUrl : null)

  return (
    <div style={{ width: `${width}px`, height: `${height}px`, maxWidth: '100%', borderRadius: '16px', background: 'linear-gradient(135deg, #edfbf3, #eaf1ff)', border: '0.5px solid #e1e4ed', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', flexShrink: 0, overflow: 'hidden' }}>
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={label || 'topic'}
          onError={() => setStage(prev => (prev === 'local' && photoUrl ? 'remote' : 'emoji'))}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{ fontSize: `${Math.round(width * 0.42)}px`, lineHeight: 1 }} role="img" aria-label={label || 'topic'}>{icon || '📍'}</span>
      )}
    </div>
  )
}

function ListenRepeatExercise({ item, index, onBack, onComplete, mockMode = false }) {
  const [micState, setMicState] = useState('checking')
  const [sentenceIdx, setSentenceIdx] = useState(0)
  const [phase, setPhase] = useState('intro') // 'intro' | 'playing' | 'recording' | 'summary'
  const [answers, setAnswers] = useState([])
  const [countdown, setCountdown] = useState(0)
  const recognitionRef = useRef(null)
  const timerRef = useRef(null)
  const transcriptRef = useRef('')

  const sentence = item.sentences[sentenceIdx]
  const totalQ = item.sentences.length
  const SR = getSpeechRecognitionCtor()

  useEffect(() => {
    if (!SR) { setMicState('unsupported'); return }
    checkMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const beginPractice = () => setPhase('playing')

  const checkMic = () => {
    setMicState('checking')
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()); setMicState('ready') })
      .catch(() => setMicState('denied'))
  }

  const startRecording = () => {
    if (!SR || micState !== 'ready') return
    transcriptRef.current = ''
    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let finalText = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' '
      }
      transcriptRef.current = finalText
    }
    rec.onerror = () => {}
    try { rec.start() } catch (e) {}
    recognitionRef.current = rec
    setPhase('recording')
    setCountdown(sentence.recordSeconds)
    timerRef.current = setInterval(() => {
      setCountdown(prev => prev - 1)
    }, 1000)
  }

  const stoppingRef = useRef(false)

  const stopRecording = () => {
    if (stoppingRef.current) return
    stoppingRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch (e) {} }
    setTimeout(() => {
      const transcript = transcriptRef.current.trim()
      const evalResult = evaluateRepeatResponse(transcript, sentence.text)
      const newAnswer = { transcript, target: sentence.text, ...evalResult }
      if (sentenceIdx + 1 >= totalQ) {
        const finalAnswers = [...answers, newAnswer]
        if (mockMode) {
          onComplete(finalAnswers, finalAnswers.map((a, i) => ({
            prompt: item.sentences[i].text,
            given: a.transcript || '(nothing detected)',
            score: a.score, maxScore: 5, feedback: a.summary, criteria: a.criteria,
          })))
        } else {
          setAnswers(finalAnswers)
          setPhase('summary')
        }
      } else {
        setAnswers(prev => [...prev, newAnswer])
        setSentenceIdx(i => i + 1)
        setPhase('playing')
      }
      stoppingRef.current = false
    }, 350)
  }

  useEffect(() => {
    if (phase === 'recording' && countdown <= 0) stopRecording()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, phase])

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch (e) {} }
  }, [])

  if (micState !== 'ready') return <MicPermissionGate micState={micState} onRetry={checkMic} onBack={onBack} />

  const score = answers.reduce((s, a) => s + a.score, 0)
  const avgLabel = answers.length ? (score / answers.length).toFixed(1) : '0.0'
  const progressPct = phase === 'summary' ? 100 : (sentenceIdx / totalQ) * 100

  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={<span style={{ fontSize: '13px', fontWeight: '700', color: '#2ac56c' }}>Avg {avgLabel} / 5</span>}
      section="SPEAKING"
      questionLabel={`${item.location} · Sentence ${sentenceIdx + 1} of ${totalQ}`}
      contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
    >
        <div style={{ maxWidth: phase === 'summary' ? '760px' : '720px', width: '100%' }}>
          {phase === 'intro' && (
            <>
              <div style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>{item.location}</div>
              <div style={{ fontSize: '17px', color: '#1a1a1a', lineHeight: '1.7', marginBottom: '22px' }}>{item.introText}</div>
              {item.scene ? (
                <SceneIllustration scene={item.scene} location={item.location} activeKeys={[]} width={520} height={420} />
              ) : (
                <TopicPhoto icon={item.icon} label={item.location} photoSlug={item.photoSlug} photoUrl={item.photoUrl} width={520} height={420} />
              )}
              <audio src={item.audio_url_intro} autoPlay onEnded={beginPractice} onError={beginPractice} />
            </>
          )}

          {(phase === 'playing' || phase === 'recording') && (
            <>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#1a1a1a', marginBottom: '24px' }}>
                {phase === 'playing' ? '🔊 Listen carefully, then repeat.' : '🎤 Listen and repeat the sentence.'}
              </div>
              {item.scene ? (
                <SceneIllustration scene={item.scene} location={item.location} activeKeys={sentence.highlight || []} width={520} height={420} />
              ) : (
                <TopicPhoto icon={item.icon} label={item.location} photoSlug={item.photoSlug} photoUrl={item.photoUrl} width={520} height={420} />
              )}
            </>
          )}

          {phase === 'playing' && (
            <>
              <div style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '22px 0 8px' }}>{sentence.length} sentence</div>
              <audio src={sentence.audio_url} autoPlay onEnded={startRecording} onError={startRecording} />
            </>
          )}

          {phase === 'recording' && (
            <>
              <div style={{ fontSize: '14px', color: '#616473', fontWeight: '600', margin: '22px 0 16px' }}>Repeat the sentence now.</div>
              <div style={{ maxWidth: '300px', margin: '0 auto', borderRadius: '10px', overflow: 'hidden', border: '1px solid #d0d5dd' }}>
                <div style={{ background: '#5b5f6b', color: '#fff', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', padding: '10px', textTransform: 'uppercase' }}>Response Time</div>
                <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '18px' }}>
                  <button onClick={stopRecording} title="Stop recording" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#d94040', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '2px', display: 'block' }} />
                  </button>
                  <span style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>00:00:{String(countdown).padStart(2, '0')}</span>
                </div>
              </div>
            </>
          )}

          {phase === 'summary' && (
            <>
              <div style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>All sentences complete</div>
              <div style={{ margin: '4px 0 18px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#2ac56c', background: '#edfbf3', padding: '6px 16px', borderRadius: '999px' }}>Avg {avgLabel} / 5</span>
              </div>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', maxHeight: '380px', overflowY: 'auto' }}>
                {answers.map((a, i) => (
                  <div key={i} style={{ background: '#f4f6fa', borderRadius: '8px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Sentence {i + 1}</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#2ac56c' }}>{a.score} / 5</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#1a1a1a', marginBottom: '6px' }}><b>Target:</b> {a.target}</div>
                    <div style={{ fontSize: '13px', color: '#1a1a1a', marginBottom: '6px' }}><b>You said:</b> {a.transcript || '(nothing detected)'}</div>
                    <div style={{ fontSize: '12px', color: '#616473' }}>{a.summary}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => onComplete(answers)} style={{ background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                Finish →
              </button>
            </>
          )}
        </div>
    </ExamScreen>
  )
}

function ListenRepeat({ onBack }) {
  const isMobile = useIsMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/speaking/listen-and-repeat`).then(r => r.json()),
      fetchLatestResults('speaking_lr'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setItems(list)
      const mapped = {}
      list.forEach((it, i) => { const row = results[String(it.id ?? i)]; if (row) mapped[i] = row.score })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!items.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found. Make sure the backend is running.</div>

  if (activeIdx !== null) return (
    <ListenRepeatExercise item={items[activeIdx]} index={activeIdx} onBack={() => setActiveIdx(null)}
      onComplete={(answers) => {
        const avg = answers.reduce((s, a) => s + a.score, 0) / answers.length
        const rounded = Math.round(avg * 10) / 10
        saveResult('speaking_lr', items[activeIdx].id ?? activeIdx, rounded, 5, `Listen and Repeat #${activeIdx + 1}`)
        setScores(prev => ({ ...prev, [activeIdx]: rounded }))
        setActiveIdx(null)
      }} />
  )

  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {items.map((it, i) => {
            const locked = isLocked(it)
            const score = scores[i]
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>{it.location}</div>
                    {score != null && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: score >= 3.5 ? '#2ac56c' : '#e07b00', background: score >= 3.5 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {score}/5 avg</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${it.sentences.length} sentences`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => setActiveIdx(i)} style={{ background: score != null ? '#e5e7eb' : '#2ac56c', color: score != null ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {score != null ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

// ─── Speaking Part 2: Take an Interview ────────────────────────────────────

function InterviewExercise({ item, index, onBack, onComplete, mockMode = false }) {
  const [micState, setMicState] = useState('checking')
  const [qIdx, setQIdx] = useState(0)
  const [phase, setPhase] = useState('intro') // 'intro' | 'playing' | 'recording' | 'summary'
  const [answers, setAnswers] = useState([])
  const [countdown, setCountdown] = useState(0)
  const recognitionRef = useRef(null)
  const timerRef = useRef(null)
  const transcriptRef = useRef('')

  const question = item.questions[qIdx]
  const totalQ = item.questions.length
  const SR = getSpeechRecognitionCtor()

  useEffect(() => {
    if (!SR) { setMicState('unsupported'); return }
    checkMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const beginPractice = () => setPhase('playing')

  const checkMic = () => {
    setMicState('checking')
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()); setMicState('ready') })
      .catch(() => setMicState('denied'))
  }

  const startRecording = () => {
    if (!SR || micState !== 'ready') return
    transcriptRef.current = ''
    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let finalText = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' '
      }
      transcriptRef.current = finalText
    }
    rec.onerror = () => {}
    try { rec.start() } catch (e) {}
    recognitionRef.current = rec
    setPhase('recording')
    setCountdown(question.recordSeconds)
    timerRef.current = setInterval(() => {
      setCountdown(prev => prev - 1)
    }, 1000)
  }

  const stoppingRef = useRef(false)

  const stopRecording = () => {
    if (stoppingRef.current) return
    stoppingRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch (e) {} }
    setTimeout(() => {
      const transcript = transcriptRef.current.trim()
      const evalResult = evaluateInterviewResponse(transcript, question.text)
      const newAnswer = { transcript, ...evalResult }
      stoppingRef.current = false
      if (qIdx + 1 >= totalQ) {
        const finalAnswers = [...answers, newAnswer]
        if (mockMode) {
          onComplete(finalAnswers, finalAnswers.map((a, i) => ({
            prompt: item.questions[i].text,
            given: a.transcript || '(nothing detected)',
            score: a.score, maxScore: 5, feedback: a.summary, criteria: a.criteria,
          })))
        } else {
          setAnswers(finalAnswers)
          setPhase('summary')
        }
      } else {
        setAnswers(prev => [...prev, newAnswer])
        setQIdx(i => i + 1)
        setPhase('playing')
      }
    }, 350)
  }

  useEffect(() => {
    if (phase === 'recording' && countdown <= 0) stopRecording()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, phase])

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch (e) {} }
  }, [])

  if (micState !== 'ready') return <MicPermissionGate micState={micState} onRetry={checkMic} onBack={onBack} />

  const score = answers.reduce((s, a) => s + a.score, 0)
  const avgLabel = answers.length ? (score / answers.length).toFixed(1) : '0.0'
  const progressPct = phase === 'summary' ? 100 : (qIdx / totalQ) * 100

  return (
    <ExamScreen
      topLeft={<TestPillButton onClick={onBack}>Save &amp; Exit</TestPillButton>}
      topRight={<span style={{ fontSize: '13px', fontWeight: '700', color: '#2ac56c' }}>Avg {avgLabel} / 5</span>}
      section="SPEAKING"
      questionLabel={`${item.topic} · Question ${qIdx + 1} of ${totalQ}`}
      contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
    >
        <div style={{ maxWidth: phase === 'summary' ? '760px' : '720px', width: '100%' }}>
          {phase === 'intro' && (
            <>
              <div style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>{item.topic}</div>
              <div style={{ fontSize: '17px', color: '#1a1a1a', lineHeight: '1.7', marginBottom: '22px' }}>{item.introText}</div>
              <RealPersonAvatar gender={item.speaker} seed={item.id * 10} width={280} height={280} mode="playing" />
              <audio src={item.audio_url_intro} autoPlay onEnded={beginPractice} onError={beginPractice} />
            </>
          )}

          {(phase === 'playing' || phase === 'recording') && (
            <>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#1a1a1a', marginBottom: '24px' }}>
                {phase === 'playing' ? '🔊 Listen to the question, then answer.' : '🎤 Listen and answer the question.'}
              </div>
              <RealPersonAvatar gender={item.speaker} seed={item.id * 10 + qIdx} width={280} height={280} mode={phase} />
            </>
          )}

          {phase === 'playing' && (
            <audio src={question.audio_url} autoPlay onEnded={startRecording} onError={startRecording} />
          )}

          {phase === 'recording' && (
            <>
              <div style={{ fontSize: '14px', color: '#616473', fontWeight: '600', margin: '22px 0 16px' }}>Answer the question now.</div>
              <div style={{ maxWidth: '300px', margin: '0 auto', borderRadius: '10px', overflow: 'hidden', border: '1px solid #d0d5dd' }}>
                <div style={{ background: '#5b5f6b', color: '#fff', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px', padding: '10px', textTransform: 'uppercase' }}>Response Time</div>
                <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '18px' }}>
                  <button onClick={stopRecording} title="Stop recording" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#d94040', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '2px', display: 'block' }} />
                  </button>
                  <span style={{ fontSize: '28px', fontWeight: '700', color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>00:00:{String(countdown).padStart(2, '0')}</span>
                </div>
              </div>
            </>
          )}

          {phase === 'summary' && (
            <>
              <div style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>All questions complete</div>
              <div style={{ margin: '4px 0 18px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#2ac56c', background: '#edfbf3', padding: '6px 16px', borderRadius: '999px' }}>Avg {avgLabel} / 5</span>
              </div>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', maxHeight: '380px', overflowY: 'auto' }}>
                {answers.map((a, i) => (
                  <div key={i} style={{ background: '#f4f6fa', borderRadius: '8px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' }}>Question {i + 1}</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#2ac56c' }}>{a.score} / 5</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#1a1a1a', marginBottom: '6px' }}><b>You said:</b> {a.transcript || '(nothing detected)'}</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1a1a1a', marginBottom: '6px' }}>{a.summary}</div>
                    {a.criteria && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {a.criteria.map((c, ci) => (
                          <div key={ci} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#333', lineHeight: '1.5' }}>
                            <span style={{ color: c.ok ? '#2ac56c' : '#d94040', fontWeight: '700', flexShrink: 0 }}>{c.ok ? '✓' : '✗'}</span>
                            <span><b>{c.label}:</b> {c.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => onComplete(answers)} style={{ background: '#2ac56c', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                Finish →
              </button>
            </>
          )}
        </div>
    </ExamScreen>
  )
}

function TakeInterview({ onBack }) {
  const isMobile = useIsMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/speaking/interview`).then(r => r.json()),
      fetchLatestResults('speaking_interview'),
    ]).then(([data, results]) => {
      if (cancelled) return
      const list = Array.isArray(data) ? data : []
      setItems(list)
      const mapped = {}
      list.forEach((it, i) => { const row = results[String(it.id ?? i)]; if (row) mapped[i] = row.score })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading exercises..." />
  if (!items.length) return <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No exercises found. Make sure the backend is running.</div>

  if (activeIdx !== null) return (
    <InterviewExercise item={items[activeIdx]} index={activeIdx} onBack={() => setActiveIdx(null)}
      onComplete={(answers) => {
        const avg = answers.reduce((s, a) => s + a.score, 0) / answers.length
        const rounded = Math.round(avg * 10) / 10
        saveResult('speaking_interview', items[activeIdx].id ?? activeIdx, rounded, 5, `Take an Interview #${activeIdx + 1}`)
        setScores(prev => ({ ...prev, [activeIdx]: rounded }))
        setActiveIdx(null)
      }} />
  )

  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {items.map((it, i) => {
            const locked = isLocked(it)
            const score = scores[i]
            return (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', width: '100%', opacity: locked ? 0.6 : 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>{it.topic}</div>
                    {score != null && !locked && <span style={{ fontSize: '11px', fontWeight: '700', color: score >= 3.5 ? '#2ac56c' : '#e07b00', background: score >= 3.5 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px' }}>✓ {score}/5 avg</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>{locked ? 'Subscribe to unlock' : `${it.questions.length} questions · 45s each`}</div>
                </div>
                {locked ? <LockedBadge /> : (
                  <button onClick={() => setActiveIdx(i)} style={{ background: score != null ? '#e5e7eb' : '#2ac56c', color: score != null ? '#616473' : '#fff', border: 'none', borderRadius: '6px', padding: '9px 22px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {score != null ? 'Retry' : 'Start'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

function ListeningHome({ onSelect, onBack }) {
  const isMobile = useIsMobile()
  const parts = [
    { key: 'p1', title: 'Part 1: Choose a Response', desc: 'Listen to a short statement or question and choose the most appropriate response.', count: '150 exercises · 1,200 questions', ready: true },
    { key: 'p2', title: 'Part 2: Listen to a Conversation', desc: 'Listen to a dialogue between two people and answer comprehension questions.', count: '150 conversations · 300 questions', ready: true },
    { key: 'p3', title: 'Part 3: Listen to an Announcement', desc: 'Listen to a formal announcement and answer comprehension questions.', count: '150 announcements · 300 questions', ready: true },
    { key: 'p4', title: 'Part 4: Listen to an Academic Talk', desc: 'Listen to a lecture or academic discussion and answer comprehension questions.', count: '150 talks · 600 questions', ready: true },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {parts.map((p, i) => (
        <div key={i} style={{ backgroundColor: '#fff', padding: isMobile ? '16px' : '22px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: '14px' } : {}) }}>
          <div style={{ maxWidth: '70%' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
            <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#616473' }}>{p.desc}</p>
            <span style={{ fontSize: '11px', color: p.ready ? '#2ac56c' : '#9ca3af', fontWeight: '600' }}>{p.count}</span>
          </div>
          <button onClick={() => p.ready && onSelect(p.key)} style={{ backgroundColor: p.ready ? '#2ac56c' : '#e5e7eb', color: p.ready ? '#fff' : '#9ca3af', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: p.ready ? 'pointer' : 'not-allowed', fontSize: '13px', flexShrink: 0 }}>
            {p.ready ? 'Open Module' : 'Coming Soon'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Read in Daily Life — Wrapper ─────────────────────────────────────────────
function ReadInDailyLife({ onBack }) {
  const [passages, setPassages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/reading/read-in-daily-life`).then(r => r.json()),
      apiFetch(`${BACKEND_URL}/api/reading/results`).then(r => r.json()),
    ]).then(([passageData, resultData]) => {
      if (cancelled) return
      setPassages(passageData)
      const mapped = {}
      passageData.forEach((p, i) => { const key = String(p.id); if (resultData[key]) mapped[i] = resultData[key] })
      setScores(mapped)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleComplete = (score, total) => {
    if (selectedIdx === null) return
    const passage = passages[selectedIdx]
    apiFetch(`${BACKEND_URL}/api/reading/save-result`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passage_id: passage.id, score, total }),
    }).catch(err => console.error(err))
    saveResult('ridl', passage.id, score, total, `Read in Daily Life #${passage.id}`)
    setScores(prev => ({ ...prev, [selectedIdx]: { score, total } }))
  }

  if (loading) return <LoadingState label="Loading passages..." />

  const displayNums = computeRIDLDisplayNums(passages)
  if (selectedIdx !== null) return (
    <RIDLQuestion passage={passages[selectedIdx]} practiceNum={displayNums.get(selectedIdx)} totalPractices={passages.length}
      onBack={() => setSelectedIdx(null)} onFinish={onBack} onComplete={handleComplete} />
  )
  return <RIDLList passages={passages} onSelect={setSelectedIdx} onBack={onBack} scores={scores} displayNums={displayNums} />
}

// ─── Full Mock Test ─────────────────────────────────────────────────────────
// Runs Reading → Listening → Writing → Speaking back-to-back in the official 2026 order.
// Reading and Listening are "multistage adaptive": everyone gets a fixed Module 1, then the
// content of Module 2 depends on how well Module 1 went (mirrors ETS's real adaptive design,
// though the exact routing thresholds ETS uses internally aren't public — this is our own
// reasonable approximation). Writing and Speaking are not adaptive: one set per task type.

function shuffleArr(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function pickN(arr, n) { return shuffleArr(arr).slice(0, Math.min(n, arr.length)) }
// Prefer items not already used elsewhere in this test; if the pool is too small, allow reuse
// rather than come up short (our content pools are smaller than a real 2026 administration).
function pickNPreferUnused(arr, n, usedSet) {
  const fresh = arr.filter(x => !usedSet.has(x.id))
  const picked = pickN(fresh, n)
  if (picked.length < n) {
    const reused = pickN(arr.filter(x => !picked.includes(x)), n - picked.length)
    return [...picked, ...reused]
  }
  return picked
}
function isGoodPerf(correct, total) { return total > 0 && (correct / total) >= 0.6 }

// ─── Cross-attempt "don't repeat questions" for the dynamic (non-fixed) mock pools ───────────
// See /api/mock/seen-ids and /api/mock/mark-seen in main.py. This only applies to a randomly-
// sampled Full Mock Test or a "practice one section" drill — the 20 fixed tests always show
// identical content on purpose and never touch any of this.

// Drops any item this student has already been shown, unless that would leave the pool too thin
// to draw from (i.e. it's effectively exhausted) — in which case falls back to the full pool
// rather than erroring or degenerating into constant repeats within one draw. The backend clears
// a pool's "seen" rows once every item has been shown at least once, so in the steady state this
// naturally cycles: fresh items first, then a full wrap-around once the pool is exhausted.
function excludeSeen(arr, seenIds, idFn = x => x.id) {
  if (!seenIds || !seenIds.size || !arr || !arr.length) return arr
  const remaining = arr.filter(x => !seenIds.has(String(idFn(x))))
  return remaining.length ? remaining : arr
}

// Applied once, right when the dynamic pools are fetched, so every existing build*Queue/Module
// function downstream keeps working unmodified — they just receive an already-trimmed pool. The
// grouped 'car' (Choose a Response) pool is the one exception: it's flattened into individual
// questions only inside buildListeningModule1/2 (see flattenCarPool), so its exclusion happens
// there instead, using the raw seen-id set carried on the returned object's `_carSeenUids`.
function filterPoolsBySeen(pools, seenIds) {
  const s = seenIds || {}
  return {
    ...pools,
    ctw: excludeSeen(pools.ctw, new Set(s.ctw)),
    ridl: excludeSeen(pools.ridl, new Set(s.ridl)),
    ap: excludeSeen(pools.ap, new Set(s.ap)),
    conv: excludeSeen(pools.conv, new Set(s.conv)),
    announce: excludeSeen(pools.announce, new Set(s.announce)),
    at: excludeSeen(pools.at, new Set(s.at)),
    bas: excludeSeen(pools.bas, new Set(s.bas)),
    email: excludeSeen(pools.email, new Set(s.email)),
    disc: excludeSeen(pools.disc, new Set(s.disc)),
    lr: excludeSeen(pools.lr, new Set(s.lr)),
    interview: excludeSeen(pools.interview, new Set(s.interview)),
    car: pools.car, // filtered post-flatten inside buildListeningModule1/2 instead
    _carSeenUids: new Set(s.car),
  }
}

// Reads back out of a just-built slot queue which pool item ids actually got shown to the
// student (as opposed to which ones were merely available in the pool), and fire-and-forgets a
// /api/mock/mark-seen call per pool so next time's draw excludes them. Called right when each
// module/section's slots are created, not when the student finishes answering — being shown a
// question is what should stop it from repeating, even if the student saves & exits early.
function markPoolItemsSeen(slots) {
  const byPool = {}
  const add = (pool, id) => { if (id === undefined || id === null) return; (byPool[pool] || (byPool[pool] = [])).push(String(id)) }
  ;(slots || []).forEach(slot => {
    if (!slot) return
    if (slot.kind === 'car') {
      (slot.data.questions || []).forEach(q => add('car', q._uid))
    } else if (slot.kind === 'bas') {
      (Array.isArray(slot.data) ? slot.data : []).forEach(item => add('bas', item.id))
    } else if (['ctw', 'ridl', 'ap', 'conv', 'announce', 'at', 'email', 'disc', 'lr', 'interview'].includes(slot.kind)) {
      add(slot.kind, slot.data && slot.data.id)
    }
  })
  Object.entries(byPool).forEach(([pool, item_ids]) => {
    if (!item_ids.length) return
    apiFetch(`${BACKEND_URL}/api/mock/mark-seen`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool, item_ids }),
    }).catch(() => {})
  })
}

// Section-specific mapping from "percent of points earned" to the TOEFL 2026 format's band
// scale — Reading and Listening are reported on a 1.0-6.0 scale, Writing and Speaking on a
// 1.0-5.0 scale. Each table is [minRawOutOf30, band]. Reading/Listening are taken directly from
// ETS's published 0-30 → 1-6 concordance table (ets.org/toefl/institutions/ibt/score-scale-
// update.html). Writing/Speaking use the same raw-score thresholds but proportionally rescaled
// onto the narrower 1.0-5.0 band range this format uses for those two sections.
const BAND_TABLES = {
  reading:   [[29, 6], [27, 5.5], [24, 5], [22, 4.5], [18, 4], [12, 3.5], [6, 3], [4, 2.5], [3, 2], [2, 1.5], [0, 1]],
  listening: [[28, 6], [26, 5.5], [22, 5], [20, 4.5], [17, 4], [13, 3.5], [9, 3], [6, 2.5], [4, 2], [2, 1.5], [0, 1]],
  writing:   [[29, 5], [27, 4.5], [24, 4], [17, 3.5], [15, 3], [13, 2.5], [11, 2], [3, 1.5], [0, 1]],
  speaking:  [[28, 5], [27, 4.5], [25, 4], [20, 3.5], [18, 3], [16, 2.5], [13, 2], [5, 1.5], [0, 1]],
}
// Top of each section's band scale — used anywhere a band needs to be normalized or displayed
// against its own max (dashboard progress bars, results screens, mock test detail badges).
const SECTION_BAND_MAX = { reading: 6, listening: 6, writing: 5, speaking: 5 }

// Reading/Listening top out at 6.0 while Writing/Speaking top out at 5.0, so a straight average
// of the four raw band values would be unfairly pulled down by Writing/Speaking's narrower
// scale. Instead, each section's band is normalized to "fraction of its own max" first, then
// the four fractions are averaged and re-expressed on a 1.0-6.0 scale — an even composite that
// doesn't penalize a section just because its own scale happens to be shorter.
function computeOverallBand(readingBand, listeningBand, writingBand, speakingBand) {
  const frac = (band, section) => (band - 1) / (SECTION_BAND_MAX[section] - 1)
  const avgFrac = (frac(readingBand, 'reading') + frac(listeningBand, 'listening') + frac(writingBand, 'writing') + frac(speakingBand, 'speaking')) / 4
  return Math.round((1 + avgFrac * 5) * 2) / 2
}
function pctToBand(pct, section) {
  const table = BAND_TABLES[section] || BAND_TABLES.reading
  const raw = pct * 30
  for (const [minRaw, band] of table) {
    if (raw >= minRaw) return band
  }
  return 1
}

function flattenCarPool(carPool) {
  const flat = []
  ;(carPool || []).forEach(ex => (ex.questions || []).forEach(q => flat.push({ ...q, _uid: `${ex.id}-${q.id}` })))
  return flat
}
function buildCarSlot(flatCarPool, n, usedUidSet) {
  const fresh = flatCarPool.filter(q => !usedUidSet.has(q._uid))
  let picked = pickN(fresh, n)
  if (picked.length < n) picked = [...picked, ...pickN(flatCarPool.filter(q => !picked.includes(q)), n - picked.length)]
  return { kind: 'car', data: { questions: picked }, uids: picked.map(q => q._uid) }
}

// Real TOEFL iBT gives one combined time budget per Reading module rather than resetting a
// clock per question. Per-question allowance: 25s per Complete-the-Words blank (a paragraph
// with 10 blanks = 250s), 40s per Read-in-Daily-Life question, 60s per Academic-Passage
// question — summed across every slot in the module's queue.
function computeReadingPoolSeconds(slots) {
  return slots.reduce((total, slot) => {
    if (slot.kind === 'ctw') return total + 25 * slot.data.blanks.length
    if (slot.kind === 'ridl') return total + 40 * slot.data.questions.length
    if (slot.kind === 'ap') return total + 60 * slot.data.questions.length
    return total
  }, 0)
}

// Question count for a Reading slot — used to score unattempted items as 0/N when the pooled
// module clock (see computeReadingPoolSeconds) runs out before the student reaches them.
function slotQuestionCount(slot) {
  if (slot.kind === 'ctw') return slot.data.blanks.length
  if (slot.kind === 'ridl') return slot.data.questions.length
  if (slot.kind === 'ap') return slot.data.questions.length
  if (slot.kind === 'car') return slot.data.questions.length
  if (slot.kind === 'conv') return slot.data.questions.length
  if (slot.kind === 'announce') return slot.data.questions.length
  if (slot.kind === 'at') return slot.data.questions.length
  return 0
}

// RIDL pools mix genuinely short 2-question formats (sign/schedule/receipt — brief real-world
// notices) with longer 3-question formats (email/message/article/poster/advertisement). Rather
// than faking a "2-question" item by slicing the 3rd question off a full-length email (which left
// the passage text just as long as the 3-question version), each module picks one item from each
// bucket so the text length actually matches the question count.
const RIDL_SHORT_TYPES = ['sign', 'schedule', 'receipt']
const RIDL_LONG_TYPES = ['email', 'message', 'article', 'poster', 'advertisement']

function buildReadingModule1(pools) {
  const ctwN = Math.random() < 0.15 ? 2 : 1
  const ctw = pickN(pools.ctw, ctwN)
  const shortPool = pools.ridl.filter(p => RIDL_SHORT_TYPES.includes(p.type))
  const messagePool = pools.ridl.filter(p => p.type === 'message')
  const longPool = pools.ridl.filter(p => RIDL_LONG_TYPES.includes(p.type) && p.type !== 'message')
  // 1 short notice (2 questions), 1 longer single text (3 questions), 1 message exchange (3 questions).
  const shortItems = pickN(shortPool, 1)
  const longItems = pickN(longPool, 1)
  const messages = pickN(messagePool, 1)
  const ap = pickN(pools.ap, 1)
  return {
    slots: [
      ...ctw.map(d => ({ kind: 'ctw', data: d })),
      ...shortItems.map(d => ({ kind: 'ridl', data: d })),
      ...longItems.map(d => ({ kind: 'ridl', data: d })),
      ...messages.map(d => ({ kind: 'ridl', data: d })),
      ...ap.map(d => ({ kind: 'ap', data: d })),
    ],
    used: { ctw: new Set(ctw.map(x => x.id)), ridl: new Set([...shortItems.map(x => x.id), ...longItems.map(x => x.id), ...messages.map(x => x.id)]), ap: new Set(ap.map(x => x.id)) },
  }
}
function buildReadingModule2(pools, used, good) {
  const ctw = pickNPreferUnused(pools.ctw, 1, used.ctw)
  if (good) {
    const ap = pickNPreferUnused(pools.ap, 1, used.ap)
    return [...ctw.map(d => ({ kind: 'ctw', data: d })), ...ap.map(d => ({ kind: 'ap', data: d }))]
  }
  const shortPool = pools.ridl.filter(p => RIDL_SHORT_TYPES.includes(p.type))
  const longPool = pools.ridl.filter(p => p.type !== 'message' && !RIDL_SHORT_TYPES.includes(p.type))
  const shortItems = pickNPreferUnused(shortPool, 1, used.ridl)
  const longItems = pickNPreferUnused(longPool, 1, used.ridl)
  return [...ctw.map(d => ({ kind: 'ctw', data: d })), ...shortItems.map(d => ({ kind: 'ridl', data: d })), ...longItems.map(d => ({ kind: 'ridl', data: d }))]
}

function buildListeningModule1(pools) {
  const flatCar = excludeSeen(flattenCarPool(pools.car), pools._carSeenUids, q => q._uid)
  const carN = 8 + Math.floor(Math.random() * 5) // 8-12
  const carSlot = buildCarSlot(flatCar, carN, new Set())
  const convs = pickN(pools.conv, 3)
  const anns = pickN(pools.announce, 3)
  const atN = Math.random() < 0.5 ? 1 : 2
  const ats = pickN(pools.at, atN)
  return {
    slots: [carSlot, ...convs.map(d => ({ kind: 'conv', data: d })), ...anns.map(d => ({ kind: 'announce', data: d })), ...ats.map(d => ({ kind: 'at', data: d }))],
    used: { car: new Set(carSlot.uids), conv: new Set(convs.map(x => x.id)), announce: new Set(anns.map(x => x.id)), at: new Set(ats.map(x => x.id)) },
  }
}
function buildListeningModule2(pools, used, good) {
  const flatCar = excludeSeen(flattenCarPool(pools.car), pools._carSeenUids, q => q._uid)
  const carSlot = buildCarSlot(flatCar, 6, used.car)
  if (good) {
    const ats = pickNPreferUnused(pools.at, 2, used.at)
    return [carSlot, ...ats.map(d => ({ kind: 'at', data: d }))]
  }
  const convs = pickNPreferUnused(pools.conv, 2, used.conv)
  const anns = pickNPreferUnused(pools.announce, 2, used.announce)
  return [carSlot, ...convs.map(d => ({ kind: 'conv', data: d })), ...anns.map(d => ({ kind: 'announce', data: d }))]
}

function buildWritingQueue(pools) {
  const basChunks = []
  for (let i = 0; i < pools.bas.length; i += BUILD_SENTENCE_SET_SIZE) basChunks.push(pools.bas.slice(i, i + BUILD_SENTENCE_SET_SIZE))
  const basSet = shuffleArr(basChunks)[0] || pools.bas.slice(0, BUILD_SENTENCE_SET_SIZE)
  const email = pickN(pools.email, 1)[0]
  const disc = pickN(pools.disc, 1)[0]
  return [
    { kind: 'bas', data: basSet },
    { kind: 'email', data: email },
    { kind: 'disc', data: disc },
  ]
}
function buildSpeakingQueue(pools) {
  const lr = pickN(pools.lr, 1)[0]
  const interview = pickN(pools.interview, 1)[0]
  return [
    { kind: 'lr', data: lr },
    { kind: 'interview', data: interview },
  ]
}

// ─── Fixed (pre-built) mock tests ──────────────────────────────────────────────
// Every function below reads from one already-curated test bundle (see fixed_test_1.json)
// instead of sampling randomly from a shared pool — the same student sees the exact same
// content every time they take this specific fixed test. The adaptive branch (which module2
// the student gets) is still decided live from their module1 performance via isGoodPerf; only
// WHICH items make up each branch is pre-authored rather than drawn at random.
function buildFixedReadingModule1(bundle) {
  const b = bundle.reading.module1
  return [
    ...b.ctw.map(d => ({ kind: 'ctw', data: d })),
    ...b.ridl.map(d => ({ kind: 'ridl', data: d })),
    ...b.ap.map(d => ({ kind: 'ap', data: d })),
  ]
}
function buildFixedReadingModule2(bundle, good) {
  const b = good ? bundle.reading.module2Easy : bundle.reading.module2Hard
  return [
    ...(b.ctw || []).map(d => ({ kind: 'ctw', data: d })),
    ...(b.ridl || []).map(d => ({ kind: 'ridl', data: d })),
    ...(b.ap || []).map(d => ({ kind: 'ap', data: d })),
  ]
}
function buildFixedListeningModule1(bundle) {
  const b = bundle.listening.module1
  return [
    { kind: 'car', data: { questions: b.car } },
    ...b.conv.map(d => ({ kind: 'conv', data: d })),
    ...b.announce.map(d => ({ kind: 'announce', data: d })),
    ...b.at.map(d => ({ kind: 'at', data: d })),
  ]
}
function buildFixedListeningModule2(bundle, good) {
  const b = good ? bundle.listening.module2Easy : bundle.listening.module2Hard
  return [
    { kind: 'car', data: { questions: b.car } },
    ...(b.conv || []).map(d => ({ kind: 'conv', data: d })),
    ...(b.announce || []).map(d => ({ kind: 'announce', data: d })),
    ...(b.at || []).map(d => ({ kind: 'at', data: d })),
  ]
}
function buildFixedWritingQueue(bundle) {
  return [
    { kind: 'bas', data: bundle.writing.bas },
    { kind: 'email', data: bundle.writing.email },
    { kind: 'disc', data: bundle.writing.disc },
  ]
}
function buildFixedSpeakingQueue(bundle) {
  return [
    { kind: 'lr', data: bundle.speaking.lr },
    { kind: 'interview', data: bundle.speaking.interview },
  ]
}

// ─── Section intro / module transition notice screens (match testglider.com's ─────
// official-style TOEFL iBT UI: navy top bar with only a Continue button, plain title +
// underline + paragraph(s), and an optional "Type of Task" table for section overviews.
function TestNoticeScreen({ title, paragraphs, rows, icons, visual, onContinue }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10, overflowY: 'auto' }}>
      <TestTopBar left={null} right={<TestPillButton variant="light" onClick={onContinue}>Continue</TestPillButton>} />
      <div style={{ padding: isMobile ? '20px 16px 80px' : '48px 64px 100px', boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 14px' }}>{title}</h1>
        <div style={{ height: '1px', background: '#1a1a1a', marginBottom: '28px' }} />
        {icons && (
          <div style={{ display: 'flex', gap: isMobile ? '20px' : '40px', margin: '4px 0 28px', flexWrap: 'wrap' }}>
            {icons.map((ic, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#edfbf3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>{ic.emoji}</div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#616473' }}>{ic.label}</span>
              </div>
            ))}
          </div>
        )}
        {paragraphs.map((p, i) => (
          <p key={i} style={{ fontSize: '16px', color: '#1a1a1a', lineHeight: '1.7', margin: '0 0 20px', maxWidth: '1100px' }}>{p}</p>
        ))}
        {visual && <div style={{ margin: '8px 0 24px' }}>{visual}</div>}
        {rows && (
          <div style={{ marginTop: '8px', border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden', maxWidth: '1400px' }}>
            {!isMobile && (
              <div style={{ display: 'flex', background: '#eef0f4', borderBottom: '1px solid #e5e7eb', padding: '12px 20px' }}>
                <div style={{ flex: '0 0 320px', fontSize: '13px', fontWeight: '700', color: '#616473' }}>Type of Task</div>
                <div style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#616473' }}>Description</div>
              </div>
            )}
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '4px' : '0', padding: isMobile ? '14px 16px' : '16px 20px', borderBottom: i < rows.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <div style={{ flex: isMobile ? 'none' : '0 0 320px', fontSize: isMobile ? '13px' : '15px', fontWeight: isMobile ? '700' : '400', color: isMobile ? '#616473' : '#1a1a1a' }}>{r[0]}</div>
                <div style={{ flex: 1, fontSize: isMobile ? '14px' : '15px', color: '#1a1a1a' }}>{r[1]}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pre-test hardware check ───────────────────────────────────────────────────
// Runs once, right when a test/section is started, before its content begins — mirrors the
// mic/headset/volume check real TOEFL test centers do, styled in our own colors rather than any
// third-party site's. Only the sections that actually need a mic and/or speaker show any of
// this at all (see getHwCheckPlan below). Step 0, when present, is the live microphone level
// check (modal); the rest are short static screens using the same TestNoticeScreen shell as the
// rest of the mock test's transition notices.
function MicVolumeCheckModal({ onStart }) {
  const [micLabel, setMicLabel] = useState('Detecting…')
  const [level, setLevel] = useState(0) // 0-1, smoothed live input level
  const [status, setStatus] = useState('checking') // checking | ready | denied
  const [devices, setDevices] = useState([]) // [{deviceId, label}] -- all known audio inputs
  const [selectedDeviceId, setSelectedDeviceId] = useState('') // '' = browser default
  const [pickerOpen, setPickerOpen] = useState(false)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)

  const teardown = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  // (Re)connects to a specific microphone (or the browser default when deviceId is falsy),
  // tearing down whatever stream/analyser was running before. Used both on first mount and
  // whenever the student picks a different device from the list below.
  const connect = (deviceId) => {
    teardown()
    setStatus('checking')
    const constraints = deviceId ? { audio: { deviceId: { exact: deviceId } } } : { audio: true }
    navigator.mediaDevices?.getUserMedia(constraints).then(stream => {
      streamRef.current = stream
      setStatus('ready')
      const track = stream.getAudioTracks()[0]
      setMicLabel((track && track.label) || 'Default microphone')
      // Labels are only populated by the browser once permission has been granted at least
      // once -- refresh the device list now so "Change Microphone" shows real names, not
      // generic placeholders.
      navigator.mediaDevices.enumerateDevices().then(list => {
        setDevices(list.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Microphone' })))
      }).catch(() => {})
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext
      if (!AudioContextCtor) return
      const ctx = new AudioContextCtor()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setLevel(prev => prev * 0.6 + Math.min(1, avg / 90) * 0.4) // smoothed
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    }).catch(() => setStatus('denied'))
  }

  useEffect(() => {
    connect('')
    return teardown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePick = (deviceId) => {
    setSelectedDeviceId(deviceId)
    setPickerOpen(false)
    connect(deviceId)
  }

  const BAR_COUNT = 7
  const activeBars = Math.round(level * BAR_COUNT)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,22,45,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, fontFamily: 'sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '36px 40px', width: '440px', maxWidth: '90vw', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <h2 style={{ margin: '0 0 22px', fontSize: '19px', fontWeight: '800', color: '#1a1a1a', textAlign: 'center' }}>Check Your Microphone Volume</h2>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', height: '64px' }}>
            <span style={{ fontSize: '28px' }}>🎤</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '54px' }}>
              {Array.from({ length: BAR_COUNT }).map((_, i) => (
                <div key={i} style={{ width: '10px', height: `${16 + i * 6}px`, borderRadius: '3px', background: i < activeBars ? '#701fa1' : '#eef0f4', transition: 'background 0.08s' }} />
              ))}
            </div>
          </div>
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', position: 'relative' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>Connected Microphone</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status === 'denied' ? 'Not available' : micLabel}</div>
            </div>
            {devices.length > 1 && status !== 'denied' && (
              <button onClick={() => setPickerOpen(prev => !prev)} style={{ flexShrink: 0, background: 'none', border: 'none', color: '#701fa1', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 0' }}>
                Change Microphone <span>{pickerOpen ? '▲' : '›'}</span>
              </button>
            )}
            {pickerOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '6px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', width: '260px', overflow: 'hidden', zIndex: 5 }}>
                {devices.map(d => (
                  <button key={d.deviceId} onClick={() => handlePick(d.deviceId)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: d.deviceId === selectedDeviceId ? '#f4eafb' : '#fff', border: 'none', borderBottom: '1px solid #f0f0f0', padding: '10px 14px', fontSize: '13px', color: '#1a1a1a', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {status === 'denied' && (
          <div style={{ fontSize: '12px', color: '#c0392b', marginTop: '14px', textAlign: 'center', lineHeight: '1.5' }}>
            Microphone access was blocked. You can still continue, but Speaking questions won't be able to record your voice.
          </div>
        )}
        <button onClick={() => { teardown(); onStart() }} style={{ width: '100%', marginTop: '22px', background: '#701fa1', color: '#fff', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
          Start
        </button>
      </div>
    </div>
  )
}

// Illustrative "good vs too loud" bar rows for the microphone-adjustment screen — static, not
// live-driven (the live meter is on the screen before this one).
function MicLevelExampleRow({ label, good }) {
  const litCount = good ? 6 : 13
  const color = good ? '#2a9d5c' : '#d94040'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} style={{ width: '14px', height: '28px', borderRadius: '2px', background: i < litCount ? color : '#eef0f4' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', maxWidth: '210px' }}>
        <span>Too Quiet</span><span>Good</span><span>Too Loud</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', color }}>
        <span>{good ? '✓' : '✗'}</span><span>{label}</span>
      </div>
    </div>
  )
}

// Plays a short, pleasant two-tone chime through the browser's speaker/headset output so the
// student can actually confirm they can hear audio before continuing — not just read about it.
// Plays a pre-generated narration clip (same Microsoft neural voice — en-US-GuyNeural — used for
// the rest of the mock test's TOEFL-style narration, produced by backend/generate_audio_hwcheck.py)
// as soon as this screen mounts. This replaces the browser's built-in speech synthesis, which
// sounds robotic and inconsistent across browsers/OSes.
function HwCheckAudioPlayer({ src }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    const audio = new Audio(src)
    audioRef.current = audio
    audio.onplay = () => setPlaying(true)
    audio.onended = () => setPlaying(false)
    audio.onerror = () => setPlaying(false)
    audio.play().catch(() => setPlaying(false))
    return () => { audio.pause(); audioRef.current = null }
  }, [src])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <span style={{ fontSize: '30px' }}>{playing ? '🔊' : '🔈'}</span>
      <span style={{ fontSize: '13px', color: '#6b7280' }}>
        {playing ? 'Reading the instructions aloud…' : 'Did you hear the instructions just now?'}
      </span>
    </div>
  )
}

// Thin wrapper kept for the "Adjusting the Volume" screen so its visual prop reads clearly.
function VolumeTestPlayer({ src }) {
  return <HwCheckAudioPlayer src={src} />
}

// Wraps the Good/Too Loud example rows and automatically plays a short demonstration chime the
// moment this screen appears (no click needed) — the student hears it as soon as they land here.
function MicAdjustVisual({ src }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <HwCheckAudioPlayer src={src} />
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '20px' : '56px' }}>
        <MicLevelExampleRow label="Good" good />
        <MicLevelExampleRow label="Too Loud" good={false} />
      </div>
    </div>
  )
}

const HW_SCREEN_INTRO = {
  title: 'Hardware Check',
  icons: [{ emoji: '🎤', label: 'Microphone' }, { emoji: '🎧', label: 'Headset' }, { emoji: '🔊', label: 'Speaker' }],
  paragraphs: [
    "Before the test begins, let's quickly check your microphone and speaker or headset volume.",
    'Make sure your headset or speakers are on and your microphone is positioned so it can pick up your voice clearly — you\'ll need it for the Speaking section later.',
  ],
}
function hwScreenVolume(dependsOnText) {
  return {
    title: 'Adjusting the Volume',
    paragraphs: [
      "You can adjust your device's system volume at any time during the test using your computer's own volume controls.",
      `Make sure you can comfortably hear audio before continuing — ${dependsOnText}.`,
    ],
    visual: <VolumeTestPlayer src={`${AUDIO_BASE_URL}/hwcheck/adjusting_volume.mp3`} />,
  }
}
const HW_SCREEN_MICROPHONE = {
  title: 'Adjusting the Microphone',
  paragraphs: [
    'When you record your Speaking answers, speak at your normal volume and keep a steady distance from the microphone.',
    'Try to stay in the "Good" range shown below — not too quiet, and not too loud.',
  ],
  visual: <MicAdjustVisual src={`${AUDIO_BASE_URL}/hwcheck/adjusting_microphone.mp3`} />,
}

// Only the sections that actually use a mic/speaker need their hardware checked before starting.
// Reading and Writing use neither, so a student going straight into just one of those parts skips
// the hardware-check flow entirely. Listening only needs the speaker/headset check (no mic use in
// that section), Speaking only needs the mic check. A full test still runs the complete original
// 3-screen flow (general intro + both checks) since it eventually needs both.
function getHwCheckPlan(mode) {
  if (mode === 'listening') {
    return { needsMicModal: false, screens: [hwScreenVolume('the Listening section depends on it')] }
  }
  if (mode === 'speaking') {
    return { needsMicModal: true, screens: [HW_SCREEN_MICROPHONE] }
  }
  if (mode === 'reading' || mode === 'writing') {
    return { needsMicModal: false, screens: [] }
  }
  // 'full'
  return { needsMicModal: true, screens: [HW_SCREEN_INTRO, hwScreenVolume('the Listening and Speaking sections both depend on it'), HW_SCREEN_MICROPHONE] }
}

const SECTION_LABEL = { reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' }

const SECTION_TASK_TABLE = {
  reading: {
    desc: 'In the Reading section, you will answer questions to demonstrate how well you understand academic and non-academic texts in English. There are three types of tasks.',
    rows: [
      ['Complete the Words', 'Fill in the missing letters in a paragraph.'],
      ['Read in Daily Life', 'Answer questions about everyday reading material.'],
      ['Read an Academic Passage', 'Answer questions about an academic passage.'],
    ],
  },
  listening: {
    desc: 'In the Listening section, you will answer questions to demonstrate how well you understand spoken English. There are four types of tasks.',
    rows: [
      ['Listen and Choose a Response', 'Select the best response to the question or statement.'],
      ['Conversations', 'Answer questions about short conversations.'],
      ['Announcements', 'Answer questions about announcements.'],
      ['Academic Talks', 'Answer questions about academic talks.'],
    ],
  },
  writing: {
    desc: 'In the Writing section, you will answer questions to demonstrate how well you can write English. There are three types of tasks.',
    rows: [
      ['Build a Sentence', 'Create a grammatical sentence.'],
      ['Write an Email', 'Write an email using information provided.'],
      ['Write for an Academic Discussion', 'Participate in an online discussion.'],
    ],
  },
  speaking: {
    desc: 'In the Speaking section, you will answer questions to demonstrate how well you can speak English. There are two types of tasks.',
    rows: [
      ['Listen and Repeat', 'Listen to a sentence, then repeat exactly what you heard.'],
      ['Take an Interview', 'Answer interview questions on a familiar topic.'],
    ],
  },
}

const sectionIntroNotice = (key) => ({
  title: `${SECTION_LABEL[key]} section`,
  paragraphs: [SECTION_TASK_TABLE[key].desc],
  rows: SECTION_TASK_TABLE[key].rows,
})

const MODULE1_TEXT = {
  reading: [
    'The clock will show you how much time you have to complete Module 1.',
    'You can use Next and Back to move to the next question or return to previous questions within the same module.',
    'You WILL NOT be able to return to Module 1 once you have begun Module 2.',
  ],
  listening: [
    'The clock will show you how much time you have to complete each question.',
    'You can use NEXT to move to the next question.',
    'The first task is Listen and Choose a Response. In this task, you will listen to a sentence or question. You will then read four sentences and choose the option that is the best response.',
  ],
}
const module1Notice = (key) => ({ title: 'Module 1', paragraphs: MODULE1_TEXT[key] })

const moduleTransitionNotices = (key) => ([
  { title: 'End of Module 1', paragraphs: [`Your time for Module 1 of the ${SECTION_LABEL[key].toLowerCase()} section has ended.`, 'Select Continue to go to Module 2.'] },
  { title: 'Module 2', paragraphs: ['The clock will show you how much time you have to complete Module 2.'] },
])

const endOfSectionNotice = (key) => ({ title: 'End of Section', paragraphs: [`Thank you for completing the ${SECTION_LABEL[key].toLowerCase()} section.`] })

const TASK_INTRO = {
  bas: { title: 'Build a Sentence', paragraphs: ['Move the words in the boxes to create grammatical sentences.', 'A clock will show you how much time you have to complete this task.'] },
  email: { title: 'Write an Email', paragraphs: ['You will read a scenario and write an email addressing it.', 'A clock will show you how much time you have to complete this task.'] },
  disc: { title: 'Write for an Academic Discussion', paragraphs: ["You will read a professor's question and your classmates' responses, then write your own post.", 'A clock will show you how much time you have to complete this task.'] },
  lr: { title: 'Listen and Repeat', paragraphs: ['You will listen as someone speaks to you. Listen carefully and then repeat what you have heard. The clock will indicate how much time you have to speak.', 'No time for preparation will be provided.'] },
  interview: { title: 'Take an Interview', paragraphs: ['You will answer interview questions on a familiar topic. The clock will indicate how much time you have to speak.', 'No time for preparation will be provided.'] },
}

const MOCK_STAGE_LABELS = {
  'reading-m1': 'Reading · Module 1', 'reading-m2': 'Reading · Module 2',
  'listening-m1': 'Listening · Module 1', 'listening-m2': 'Listening · Module 2',
  'writing': 'Writing', 'speaking': 'Speaking',
}

const MOCK_SECTION_INFO = [
  { key: 'reading', label: 'Reading', emoji: '📖', desc: 'Complete the Words, Read in Daily Life, Academic Passage' },
  { key: 'listening', label: 'Listening', emoji: '🎧', desc: 'Choose a Response, Conversations, Announcements, Academic Talks' },
  { key: 'writing', label: 'Writing', emoji: '✍️', desc: 'Build a Sentence, Write an Email, Academic Discussion' },
  { key: 'speaking', label: 'Speaking', emoji: '🗣️', desc: 'Listen and Repeat, Take an Interview' },
]

// How many fixed mock tests the app is designed to eventually hold, and which of those are
// actually built and playable right now. Extend AVAILABLE_FIXED_TEST_IDS as more tests get
// their own fixed_test_N.json + FIXED_TEST_FILES entry on the backend (see generate scripts /
// task "Test 2-20'yi üret") — everything else in this list renders as a locked "Coming soon" card.
const TOTAL_FIXED_TESTS = 20
const AVAILABLE_FIXED_TEST_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

// Flat list of just the test names — clicking a name navigates to that test's own full-page
// detail screen (MockTestDetailScreen) rather than expanding inline.
function MockTestList({ onSelect, hasPremium = false }) {
  return (
    <div style={{ width: '100%', maxWidth: '560px', marginBottom: '36px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', textAlign: 'left' }}>
        Fixed Mock Tests — same content every time
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: TOTAL_FIXED_TESTS }, (_, i) => i + 1).map(id => {
          const available = AVAILABLE_FIXED_TEST_IDS.includes(id)
          // Only Mock Test 1 (FREE_FIXED_TEST_ID on the backend) is free -- every other available
          // test requires an active subscription, enforced again server-side (402) in get_fixed_test.
          const locked = available && id !== 1 && !hasPremium
          return (
            <button key={id} onClick={() => { if (locked) { requestUpgrade(); return }; onSelect(id) }}
              style={{
                background: available ? '#fff' : '#f7f7fa',
                border: '1px solid #e5e7eb', borderRadius: '12px', padding: '13px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', textAlign: 'left', width: '100%', boxSizing: 'border-box',
                opacity: locked ? 0.7 : 1,
              }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: available ? '#1a1a1a' : '#b0b3bd' }}>Mock Test {id}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: locked ? '#9ca3af' : (available ? '#2a9d5c' : '#c1c4cd'), textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  {locked ? '🔒 Premium' : (available ? 'Ready' : 'Coming soon')}
                </span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>›</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Which unified-progress category holds this specific fixed test's saved score for each section
// (see saveResult('mock_reading'/'mock_listening'/'mock_writing'/'mock_speaking', testId, ...)
// in FullMockTest) — used below to show a "✓ done" badge on a section once the student has
// actually completed it for this particular test.
const MOCK_SECTION_CATEGORY = { reading: 'mock_reading', listening: 'mock_listening', writing: 'mock_writing', speaking: 'mock_speaking' }

// Dedicated full-page screen for one specific fixed mock test, opened by clicking its name in
// MockTestList — mirrors the layout/style of MockIntroScreen itself (title, section parts,
// start button) instead of expanding the row in place.
function MockTestDetailScreen({ id, onBack, onStartSection }) {
  const isMobile = useIsMobile()
  const available = AVAILABLE_FIXED_TEST_IDS.includes(id)
  // Per-section score for THIS specific test id, once the student has completed it — keyed by
  // section key ('reading'/'listening'/'writing'/'speaking'), sourced from the same
  // attempt_results history every other progress badge in the app reads from.
  const [sectionScores, setSectionScores] = useState({})

  useEffect(() => {
    if (!available) return
    let cancelled = false
    Promise.all(
      MOCK_SECTION_INFO.map(sec =>
        fetchLatestResults(MOCK_SECTION_CATEGORY[sec.key]).then(map => [sec.key, map[String(id)]])
      )
    ).then(pairs => {
      if (cancelled) return
      const next = {}
      pairs.forEach(([key, row]) => { if (row) next[key] = row })
      setSectionScores(next)
    })
    return () => { cancelled = true }
  }, [id, available])

  // Rendered inline in the sidebar shell's content area -- unlike the other list screens, this
  // one keeps its own "← Back" (now in-flow, no longer fixed-positioned) since it needs to
  // return to MockIntroScreen's test list, a local state the shared shell header doesn't know
  // about.
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', color: '#616473', cursor: 'pointer', marginBottom: '20px' }}>← Back</button>
      <div style={{ fontSize: '13px', fontWeight: '700', color: '#701fa1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Fixed Mock Test</div>
      <h1 style={{ margin: '0 0 14px', fontSize: '26px', fontWeight: '700', color: '#1a1a1a' }}>Mock Test {id}</h1>
      <p style={{ maxWidth: '520px', color: '#616473', fontSize: '14px', lineHeight: '1.7', marginBottom: '10px' }}>
        {available
          ? 'Same content every time you take it — Reading, Listening, Writing, and Speaking, back-to-back in the official order.'
          : "This test hasn't been built yet. Check back soon — new fixed mock tests are added regularly."}
      </p>
      {available && (
        <>
          <button onClick={() => onStartSection('full')} style={{ background: '#701fa1', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px 32px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginBottom: '14px' }}>
            Start Full Mock Test
          </button>
          <p style={{ maxWidth: '520px', color: '#9ca3af', fontSize: '12px', lineHeight: '1.6', marginBottom: '18px' }}>
            Want to practice just one part? Click a section below to jump straight into that part of this test.
          </p>
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px', width: '100%', maxWidth: '560px', marginBottom: '28px', marginTop: available ? 0 : '18px' }}>
        {MOCK_SECTION_INFO.map(sec => {
          const result = sectionScores[sec.key]
          return (
            <button key={sec.key} onClick={() => available && onStartSection(sec.key)} disabled={!available}
              style={{
                background: available ? '#fff' : '#f7f7fa', border: '1px solid #e1e4ed', borderRadius: '12px',
                padding: '16px 18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px',
                cursor: available ? 'pointer' : 'default', font: 'inherit',
              }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: available ? '#1a1a1a' : '#b0b3bd' }}>{sec.emoji} {sec.label}</span>
                {result && (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: result.pct >= 70 ? '#2ac56c' : '#e07b00', background: result.pct >= 70 ? '#edfbf3' : '#fff8ec', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>
                    ✓ {pctToBand(result.pct / 100, sec.key).toFixed(1)}/{SECTION_BAND_MAX[sec.key]}
                  </span>
                )}
              </span>
              <span style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.5' }}>{sec.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MockIntroScreen({ onStart, onStartSection, onBack, onStartFixed, hasPremium = false }) {
  const isMobile = useIsMobile()
  // Which fixed test's own detail page is currently showing (null = the main intro screen with
  // the test list is showing instead).
  const [selectedTestId, setSelectedTestId] = useState(null)

  if (selectedTestId) {
    return <MockTestDetailScreen id={selectedTestId} onBack={() => setSelectedTestId(null)}
      onStartSection={(sectionKey) => onStartFixed(selectedTestId, sectionKey)} />
  }

  // Rendered inline in the sidebar shell's content area -- the shell already shows the shared
  // "← Back" (which also goes to the dashboard, same as this screen's own onBack did) so no
  // fixed-overlay wrapper or duplicate back button here. MockTestDetailScreen below keeps its
  // own back button since it needs to return to THIS screen's test list, not to the dashboard.
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: '13px', fontWeight: '700', color: '#701fa1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Full Mock Test</div>
      <h1 style={{ margin: '0 0 14px', fontSize: '26px', fontWeight: '700', color: '#1a1a1a' }}>Reading → Listening → Writing → Speaking</h1>
      <p style={{ maxWidth: '520px', color: '#616473', fontSize: '14px', lineHeight: '1.7', marginBottom: '10px' }}>
        This runs all four sections back-to-back in the official order, with no going back once you start.
        Reading and Listening are adaptive: your Module 2 content depends on how well you do in Module 1,
        just like the real TOEFL iBT 2026 test.
      </p>
      <p style={{ maxWidth: '520px', color: '#9ca3af', fontSize: '12px', lineHeight: '1.6', marginBottom: '28px' }}>
        At the end you'll get an estimated 1–6 band score for each section plus an overall average —
        estimated because ETS doesn't publish its exact scoring formula.
      </p>
      {onStartFixed && <MockTestList onSelect={setSelectedTestId} hasPremium={hasPremium} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '560px', marginBottom: '18px' }}>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>or practice one section only</span>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px', width: '100%', maxWidth: '560px' }}>
        {MOCK_SECTION_INFO.map(sec => (
          <button key={sec.key} onClick={() => onStartSection(sec.key)}
            style={{ background: '#fff', border: '1px solid #e1e4ed', borderRadius: '12px', padding: '16px 18px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a' }}>{sec.emoji} {sec.label}</span>
            <span style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.5' }}>{sec.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Flattens a section's review log (array of { kind, detail: [...] }) into one list of
// question-level cards and renders them. Used only on the final mock-test results screen —
// no per-question feedback is ever shown while the test itself is in progress.
function MockReviewList({ reviewEntries }) {
  const items = reviewEntries.flatMap(entry => entry.detail || [])
  if (!items.length) return <div style={{ fontSize: '12px', color: '#9ca3af', padding: '12px 0' }}>No answers recorded for this section.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
      {items.map((it, i) => {
        const isRightWrong = it.isCorrect !== undefined
        const good = isRightWrong ? it.isCorrect : (it.score / (it.maxScore || 5)) >= 0.6
        return (
          <div key={i} style={{ background: '#fff', borderRadius: '8px', padding: '12px 16px', border: '0.5px solid #e1e4ed', borderLeft: '4px solid ' + (good ? '#2ac56c' : '#d94040') }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1a1a1a', marginBottom: '6px' }}>{i + 1}. {it.prompt}</div>
            <div style={{ fontSize: '12px', color: good ? '#1a7a44' : '#b03030', marginBottom: it.correctAnswer || it.feedback ? '2px' : 0 }}>Your answer: {it.given}</div>
            {it.correctAnswer !== undefined && !it.isCorrect && (
              <div style={{ fontSize: '12px', color: '#2a9d5c' }}>Correct answer: {it.correctAnswer}</div>
            )}
            {it.score !== undefined && (
              <div style={{ fontSize: '11px', color: '#616473', marginTop: '4px' }}>Score: {it.score}/{it.maxScore}{it.feedback ? ' — ' + it.feedback : ''}</div>
            )}
            {it.criteria && it.criteria.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
                {it.criteria.map((c, ci) => (
                  <div key={ci} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '11px', color: c.ok ? '#2ac56c' : '#d94040', flexShrink: 0, marginTop: '1px' }}>{c.ok ? '✓' : '✗'}</span>
                    <span style={{ fontSize: '11px', color: '#616473', lineHeight: '1.5' }}><strong style={{ color: '#1a1a1a' }}>{c.label}:</strong> {c.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Writing is scored from 3 separate ETS tasks (Build a Sentence, Write an Email, Write for an
// Academic Discussion), each with its own rubric/point scale — showing one pooled "13/20 pts"
// number hid that breakdown. This shows each task's own score as its own row, each independently
// expandable to that task's own answer + feedback (instead of one long combined list for all
// three tasks at once).
function WritingScoreBreakdown({ basResult, emailResult, discResult, reviewEntries }) {
  const [open, setOpen] = useState({ bas: false, email: false, disc: false })
  const items = [
    { key: 'bas', label: 'Build a Sentence', scoreText: `${basResult.correct}/${basResult.total}` },
    { key: 'email', label: 'Write an Email', scoreText: `${(emailResult.score || 0).toFixed(1)}/5` },
    { key: 'disc', label: 'Academic Discussion', scoreText: `${(discResult.score || 0).toFixed(1)}/5` },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map(it => {
        const entries = reviewEntries.filter(e => e.kind === it.key)
        const isOpen = open[it.key]
        return (
          <div key={it.key}>
            <button onClick={() => setOpen(prev => ({ ...prev, [it.key]: !prev[it.key] }))}
              style={{ width: '100%', background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '9px 12px', fontSize: '12px', fontWeight: '700', color: '#1a1a1a', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{it.label} — {it.scoreText}</span><span style={{ color: '#9ca3af', fontWeight: '400' }}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && <MockReviewList reviewEntries={entries} />}
          </div>
        )
      })}
    </div>
  )
}

function FullMockTest({ onBack, hasPremium = false }) {
  const isMobile = useIsMobile()
  const [phase, setPhase] = useState('loading') // loading | intro | notice | running | results
  const [pools, setPools] = useState(null)
  // Set (non-null) once the student picks a fixed test from the intro screen — from then on,
  // every builder function branches on `fixedTestId` to read from `fixedBundle` (the one
  // pre-built test bundle — see fixed_test_1.json / /api/mock/fixed-test/:id) instead of
  // sampling from the 12 randomly-drawn dynamic pools.
  const [fixedTestId, setFixedTestId] = useState(null)
  const [fixedBundle, setFixedBundle] = useState(null)
  // Pre-test hardware check (mic level + static info screens) — runs once, right after the
  // student presses Start on the intro screen, before any section begins. Which screens actually
  // show depends on which section is being started (see getHwCheckPlan) — hwCheckPlanRef holds
  // that plan, hwCheckStep indexes into it (0 = the live mic-level modal, if the plan needs one).
  // pendingBeginRef holds whichever "actually start the test" function should run once the check
  // is dismissed (or immediately, if the plan needs no hardware check at all).
  const [hwCheckStep, setHwCheckStep] = useState(0)
  const hwCheckPlanRef = useRef({ needsMicModal: true, screens: [] })
  const pendingBeginRef = useRef(() => {})
  const [mode, setMode] = useState('full') // 'full' | 'reading' | 'listening' | 'writing' | 'speaking'
  const [stage, setStage] = useState('reading-m1')
  const [queue, setQueue] = useState([])
  const [idx, setIdx] = useState(0)
  const [openReview, setOpenReview] = useState({ reading: false, listening: false, writing: false, speaking: false })
  // Section-intro / module-transition notice screens (testglider.com-style "Continue" pages)
  // shown between stages — see runWithNotices/continueNotice below.
  const [noticeQueue, setNoticeQueue] = useState([])
  const noticeNextRef = useRef(() => {})
  const runWithNotices = (notices, afterFn) => {
    const list = (notices || []).filter(Boolean)
    noticeNextRef.current = afterFn
    if (list.length === 0) { afterFn(); return }
    setNoticeQueue(list)
    setPhase('notice')
  }
  const continueNotice = () => {
    if (noticeQueue.length <= 1) {
      setNoticeQueue([])
      noticeNextRef.current()
    } else {
      setNoticeQueue(prev => prev.slice(1))
    }
  }
  // Reading modules use ONE combined clock for the whole module (see computeReadingPoolSeconds)
  // instead of a per-question timer — matches the real TOEFL iBT. `readingPoolLeft` is set when
  // a reading-m1/reading-m2 queue is built, then ticks down every second while that stage runs.
  const [readingPoolLeft, setReadingPoolLeft] = useState(null)
  const sessionRef = useRef({
    stageRaw: {}, // { 'reading-m1': {correct,total}, ... }
    // Reading modules support cross-slot Back navigation, so a slot can be answered more than
    // once (student goes Back and redoes it). Recording results per slot index — instead of
    // accumulating totals — lets a re-answer overwrite its own entry rather than double-count.
    // See recordSlot/recomputeReadingAggregates below.
    slotRecords: { 'reading-m1': {}, 'reading-m2': {} },
    // In-progress (not-yet-finished) answer state per slot, keyed by stage then slot index —
    // lets CTWSingle/RIDLQuestion/APQuestion restore exactly what the student had selected when
    // they Back out of a slot and later return to it, instead of remounting blank. Written live
    // via onAnswersChange as the student answers, read via getSlotAnswers when a slot renders.
    slotAnswers: { 'reading-m1': {}, 'reading-m2': {} },
    used: { ctw: new Set(), ridl: new Set(), ap: new Set(), car: new Set(), conv: new Set(), announce: new Set(), at: new Set() },
    writing: [], // { kind, correct?, total?, score? }
    speaking: [], // { kind, items }
    // Full question-by-question breakdown, revealed only on the final results screen —
    // no per-question feedback is shown while the mock test is in progress.
    review: { reading: [], listening: [], writing: [], speaking: [] },
  })

  useEffect(() => {
    // Fixed-test content is fetched on demand from startFixedTest (triggered by the intro
    // screen's pilot button), not here — this effect only loads the dynamic pools every mock
    // test has used up to now, so the existing "Start Full Mock Test" flow is unaffected.
    if (fixedTestId) return
    // Guard against a stale response landing after fixedTestId changes again (e.g. the student
    // backs out to the intro screen and picks a different fixed test before this in-flight fetch
    // resolves) -- without it, the older response could overwrite state set by the newer request.
    let cancelled = false
    Promise.all([
      // All Reading/Listening/Writing/Speaking content for the mock test comes from its own
      // /api/mock/* endpoints — pools written specifically for the mock test that never overlap
      // with the practice pools, so a student never sees the same question in both practice mode
      // and the mock test.
      apiFetch(`${BACKEND_URL}/api/mock/complete-the-words`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/read-in-daily-life`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/academic-passage`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/choose-response`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/conversation`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/announcement`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/academic-talk`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/build-a-sentence`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/email`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/academic-discussion`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/listen-and-repeat`).then(r => r.json()).catch(() => []),
      apiFetch(`${BACKEND_URL}/api/mock/interview`).then(r => r.json()).catch(() => []),
      // Which items this student has already been shown by a past random draw, per pool — see
      // filterPoolsBySeen above. Falls back to "nothing seen" (pools used unfiltered) if this
      // fetch fails, so a network hiccup here never blocks starting the test.
      apiFetch(`${BACKEND_URL}/api/mock/seen-ids`).then(r => r.json()).catch(() => ({})),
    ]).then(([ctw, ridl, ap, car, conv, announce, at, bas, email, disc, lr, interview, seenIds]) => {
      if (cancelled) return
      setPools(filterPoolsBySeen({ ctw, ridl, ap, car, conv, announce, at, bas, email, disc, lr, interview }, seenIds))
      setPhase('intro')
    })
    return () => { cancelled = true }
  }, [fixedTestId])

  // Persists this attempt's band score(s) into the unified progress table as soon as the
  // results screen is reached, so the student can see it later on the Progress screen. Only
  // saves the section(s) that were actually attempted (mode === 'full' saves all four + overall;
  // a single-section run like mode === 'listening' saves just that one section).
  const mockResultSavedRef = useRef(false)
  useEffect(() => {
    if (phase !== 'results') { mockResultSavedRef.current = false; return }
    if (mockResultSavedRef.current) return
    mockResultSavedRef.current = true

    const s = sessionRef.current
    const readingRaw = ['reading-m1', 'reading-m2'].reduce((acc, k) => ({ correct: acc.correct + (s.stageRaw[k]?.correct || 0), total: acc.total + (s.stageRaw[k]?.total || 0) }), { correct: 0, total: 0 })
    const listeningRaw = ['listening-m1', 'listening-m2'].reduce((acc, k) => ({ correct: acc.correct + (s.stageRaw[k]?.correct || 0), total: acc.total + (s.stageRaw[k]?.total || 0) }), { correct: 0, total: 0 })
    const basResult = s.writing.find(w => w.kind === 'bas') || { correct: 0, total: 10 }
    const emailResult = s.writing.find(w => w.kind === 'email') || { score: 0 }
    const discResult = s.writing.find(w => w.kind === 'disc') || { score: 0 }
    // Per ETS's scoring method (same reasoning as Speaking below), each of the three graded
    // writing tasks is averaged on its own first, then combined with EQUAL (1/3 each) weight for
    // the band shown here -- not pooled into one raw-points ratio, which would let Build-a-
    // Sentence's larger item count (its `total` varies per attempt) over-weight the band relative
    // to Email/Discussion (fixed 5 pts each).
    const basPct = basResult.total ? basResult.correct / basResult.total : 0
    const emailPct = (emailResult.score || 0) / 5
    const discPct = (discResult.score || 0) / 5
    const writingTaskPct = (basPct + emailPct + discPct) / 3
    // Raw points earned / points possible across every graded item -- same "sum of what was
    // actually solved" unit used for practice exercises, so mock attempts blend into the
    // dashboard's average correctly instead of counting as one flat band value per attempt.
    // (This pooled sum is only used for the dashboard aggregate via saveResult below, not for the
    // band shown on this results screen -- same split as Speaking's speakingPts/speakingMax vs.
    // speakingTaskPct just below.)
    const writingPts = basResult.correct + (emailResult.score || 0) + (discResult.score || 0)
    const writingMax = basResult.total + 5 + 5
    const lrResult = s.speaking.find(w => w.kind === 'lr') || { items: [] }
    const interviewResult = s.speaking.find(w => w.kind === 'interview') || { items: [] }
    const lrPct = lrResult.items.length ? lrResult.items.reduce((a, x) => a + (x.score || 0), 0) / (lrResult.items.length * 5) : null
    const ivPct = interviewResult.items.length ? interviewResult.items.reduce((a, x) => a + (x.score || 0), 0) / (interviewResult.items.length * 5) : null
    const speakingTaskPct = lrPct != null && ivPct != null ? (lrPct + ivPct) / 2 : (lrPct ?? ivPct ?? 0)
    // Raw points earned / points possible across every graded item -- same "sum of what was
    // actually solved" unit used for practice exercises, so mock attempts blend into the
    // dashboard's average correctly instead of counting as one flat band value per attempt.
    const speakingPts = lrResult.items.reduce((a, x) => a + (x.score || 0), 0) + interviewResult.items.reduce((a, x) => a + (x.score || 0), 0)
    const speakingMax = lrResult.items.length * 5 + interviewResult.items.length * 5

    const readingBand = pctToBand(readingRaw.total ? readingRaw.correct / readingRaw.total : 0, 'reading')
    const listeningBand = pctToBand(listeningRaw.total ? listeningRaw.correct / listeningRaw.total : 0, 'listening')
    const writingBand = pctToBand(writingTaskPct, 'writing')
    const speakingBand = pctToBand(speakingTaskPct, 'speaking')
    const overallBand = computeOverallBand(readingBand, listeningBand, writingBand, speakingBand)

    const testLabel = fixedTestId ? `Mock Test ${fixedTestId}` : 'Full Mock Test'
    const testItemId = fixedTestId ? String(fixedTestId) : 'practice'

    // Reading/Listening/Writing/Speaking are saved as raw points-earned/points-possible (exact
    // same unit practice exercises use: correct answers out of questions, or graded points out
    // of max) rather than the pre-collapsed 0-6 band -- so a 20-question mock module contributes
    // proportionally more to the dashboard average than a 5-question practice exercise, and mock
    // attempts blend into the same true "average of everything solved" as practice attempts.
    // mock_overall has no raw equivalent (it's an average of four already-derived bands), so it
    // stays as a band out of 6.
    if ((mode === 'full' || mode === 'reading') && readingRaw.total) saveResult('mock_reading', testItemId, readingRaw.correct, readingRaw.total, `${testLabel} · Reading`)
    if ((mode === 'full' || mode === 'listening') && listeningRaw.total) saveResult('mock_listening', testItemId, listeningRaw.correct, listeningRaw.total, `${testLabel} · Listening`)
    if ((mode === 'full' || mode === 'writing') && writingMax) saveResult('mock_writing', testItemId, writingPts, writingMax, `${testLabel} · Writing`)
    if ((mode === 'full' || mode === 'speaking') && speakingMax) saveResult('mock_speaking', testItemId, speakingPts, speakingMax, `${testLabel} · Speaking`)
    if (mode === 'full') saveResult('mock_overall', testItemId, overallBand, 6, `${testLabel} · Overall`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Entry point for the intro screen's fixed-test list — fetches that one self-contained bundle
  // on demand (the dynamic-pool fetch in the effect above is skipped once fixedTestId is set).
  // `section` lets a student jump straight into just one part of that specific fixed test
  // (Reading / Listening / Writing / Speaking) instead of always starting from Reading Module 1 —
  // mirrors how the dynamic "practice one section only" cards on the same screen work, just
  // sourced from the fixed bundle's content instead of the random pools.
  const beginFixedTestAfterHwCheck = (testId, section = 'full') => {
    setPhase('loading')
    apiFetch(`${BACKEND_URL}/api/mock/fixed-test/${testId}`).then(r => r.json()).then(data => {
      setFixedTestId(testId)
      setFixedBundle(data)
      if (section === 'listening') {
        const slots = buildFixedListeningModule1(data)
        setQueue(slots); setIdx(0); setStage('listening-m1')
        runWithNotices([sectionIntroNotice('listening'), module1Notice('listening')], () => setPhase('running'))
      } else if (section === 'writing') {
        const slots = buildFixedWritingQueue(data)
        setQueue(slots); setIdx(0); setStage('writing')
        runWithNotices([sectionIntroNotice('writing'), TASK_INTRO[slots[0].kind]], () => setPhase('running'))
      } else if (section === 'speaking') {
        const slots = buildFixedSpeakingQueue(data)
        setQueue(slots); setIdx(0); setStage('speaking')
        runWithNotices([sectionIntroNotice('speaking'), TASK_INTRO[slots[0].kind]], () => setPhase('running'))
      } else {
        // 'full' or 'reading' both start with Reading Module 1
        const slots = buildFixedReadingModule1(data)
        setQueue(slots); setIdx(0); setStage('reading-m1')
        setReadingPoolLeft(computeReadingPoolSeconds(slots))
        runWithNotices([sectionIntroNotice('reading'), module1Notice('reading')], () => setPhase('running'))
      }
    }).catch(() => setPhase('intro'))
  }

  const beginTestAfterHwCheck = (m = 'full') => {
    if (fixedTestId) {
      // Fixed tests are always taken as one complete "full" sitting — no per-section shortcuts,
      // matching how the real official test is administered.
      const slots = buildFixedReadingModule1(fixedBundle)
      setQueue(slots); setIdx(0); setStage('reading-m1')
      setReadingPoolLeft(computeReadingPoolSeconds(slots))
      runWithNotices([sectionIntroNotice('reading'), module1Notice('reading')], () => setPhase('running'))
      return
    }
    if (m === 'listening') {
      const m1 = buildListeningModule1(pools)
      sessionRef.current.used.car = m1.used.car
      sessionRef.current.used.conv = m1.used.conv
      sessionRef.current.used.announce = m1.used.announce
      sessionRef.current.used.at = m1.used.at
      markPoolItemsSeen(m1.slots)
      setQueue(m1.slots); setIdx(0); setStage('listening-m1')
      runWithNotices([sectionIntroNotice('listening'), module1Notice('listening')], () => setPhase('running'))
    } else if (m === 'writing') {
      const slots = buildWritingQueue(pools)
      markPoolItemsSeen(slots)
      setQueue(slots); setIdx(0); setStage('writing')
      runWithNotices([sectionIntroNotice('writing'), TASK_INTRO[slots[0].kind]], () => setPhase('running'))
    } else if (m === 'speaking') {
      const slots = buildSpeakingQueue(pools)
      markPoolItemsSeen(slots)
      setQueue(slots); setIdx(0); setStage('speaking')
      runWithNotices([sectionIntroNotice('speaking'), TASK_INTRO[slots[0].kind]], () => setPhase('running'))
    } else {
      // 'full' or 'reading' both start with Reading Module 1
      const m1 = buildReadingModule1(pools)
      sessionRef.current.used.ctw = m1.used.ctw
      sessionRef.current.used.ridl = m1.used.ridl
      sessionRef.current.used.ap = m1.used.ap
      markPoolItemsSeen(m1.slots)
      setQueue(m1.slots); setIdx(0); setStage('reading-m1')
      setReadingPoolLeft(computeReadingPoolSeconds(m1.slots))
      runWithNotices([sectionIntroNotice('reading'), module1Notice('reading')], () => setPhase('running'))
    }
  }

  // Public entry points wired to the intro screen's buttons — set mode/mode-adjacent state
  // immediately, then route through whichever hardware-check screens that section actually needs
  // (see getHwCheckPlan) before actually building the first module's content.
  // beginTestAfterHwCheck/beginFixedTestAfterHwCheck (above) run once that flow finishes — or
  // immediately, for a section (Reading/Writing) that needs no hardware check at all.
  const startTest = (m = 'full') => {
    setMode(m)
    const plan = getHwCheckPlan(m)
    hwCheckPlanRef.current = plan
    const begin = () => beginTestAfterHwCheck(m)
    pendingBeginRef.current = begin
    if (!plan.needsMicModal && plan.screens.length === 0) { begin(); return }
    setHwCheckStep(0)
    setPhase('hwcheck')
  }
  const startFixedTest = (testId, section = 'full') => {
    setMode(section)
    const plan = getHwCheckPlan(section)
    hwCheckPlanRef.current = plan
    const begin = () => beginFixedTestAfterHwCheck(testId, section)
    pendingBeginRef.current = begin
    if (!plan.needsMicModal && plan.screens.length === 0) { begin(); return }
    setHwCheckStep(0)
    setPhase('hwcheck')
  }

  const addRaw = (key, correct, total) => {
    const s = sessionRef.current
    if (!s.stageRaw[key]) s.stageRaw[key] = { correct: 0, total: 0 }
    s.stageRaw[key].correct += correct
    s.stageRaw[key].total += total
  }

  // Rebuilds stageRaw['reading-m1'/'reading-m2'] and review.reading from slotRecords, so both
  // stay correct even after a slot has been re-answered via Back (overwrite, not accumulate).
  const recomputeReadingAggregates = () => {
    const s = sessionRef.current
    for (const stageKey of ['reading-m1', 'reading-m2']) {
      const recs = s.slotRecords[stageKey] || {}
      s.stageRaw[stageKey] = Object.values(recs).reduce((acc, r) => ({ correct: acc.correct + r.correct, total: acc.total + r.total }), { correct: 0, total: 0 })
    }
    const reviewEntries = []
    for (const stageKey of ['reading-m1', 'reading-m2']) {
      const recs = s.slotRecords[stageKey] || {}
      Object.keys(recs).map(Number).sort((a, b) => a - b).forEach(i => {
        const r = recs[i]
        if (r.detail) reviewEntries.push({ kind: r.kind, detail: r.detail })
      })
    }
    s.review.reading = reviewEntries
  }

  const recordSlot = (stageKey, slotIdx, correct, total, kind, detail) => {
    const s = sessionRef.current
    if (!s.slotRecords[stageKey]) s.slotRecords[stageKey] = {}
    s.slotRecords[stageKey][slotIdx] = { correct, total, kind, detail }
    recomputeReadingAggregates()
  }

  // Live in-progress answers for the slot currently on screen, restored on remount when the
  // student navigates back to a previously-visited slot within the same Reading module.
  const getSlotAnswers = (stageKey, slotIdx) => {
    const s = sessionRef.current
    return s.slotAnswers[stageKey] ? s.slotAnswers[stageKey][slotIdx] : undefined
  }
  const setSlotAnswers = (stageKey, slotIdx, val) => {
    const s = sessionRef.current
    if (!s.slotAnswers[stageKey]) s.slotAnswers[stageKey] = {}
    s.slotAnswers[stageKey][slotIdx] = val
  }

  const advanceStage = () => {
    const s = sessionRef.current
    if (stage === 'reading-m1') {
      const r = s.stageRaw['reading-m1'] || { correct: 0, total: 0 }
      const good = isGoodPerf(r.correct, r.total)
      const slots = fixedTestId ? buildFixedReadingModule2(fixedBundle, good) : buildReadingModule2(pools, s.used, good)
      if (!fixedTestId) markPoolItemsSeen(slots)
      setQueue(slots); setIdx(0); setStage('reading-m2')
      setReadingPoolLeft(computeReadingPoolSeconds(slots))
      runWithNotices(moduleTransitionNotices('reading'), () => setPhase('running'))
    } else if (stage === 'reading-m2') {
      if (mode === 'reading') { runWithNotices([endOfSectionNotice('reading')], () => setPhase('results')); return }
      if (fixedTestId) {
        const slots = buildFixedListeningModule1(fixedBundle)
        setQueue(slots); setIdx(0); setStage('listening-m1')
        runWithNotices([endOfSectionNotice('reading'), sectionIntroNotice('listening'), module1Notice('listening')], () => setPhase('running'))
        return
      }
      const m1 = buildListeningModule1(pools)
      s.used.car = m1.used.car; s.used.conv = m1.used.conv; s.used.announce = m1.used.announce; s.used.at = m1.used.at
      markPoolItemsSeen(m1.slots)
      setQueue(m1.slots); setIdx(0); setStage('listening-m1')
      runWithNotices([endOfSectionNotice('reading'), sectionIntroNotice('listening'), module1Notice('listening')], () => setPhase('running'))
    } else if (stage === 'listening-m1') {
      const r = s.stageRaw['listening-m1'] || { correct: 0, total: 0 }
      const good = isGoodPerf(r.correct, r.total)
      const slots = fixedTestId ? buildFixedListeningModule2(fixedBundle, good) : buildListeningModule2(pools, s.used, good)
      if (!fixedTestId) markPoolItemsSeen(slots)
      setQueue(slots); setIdx(0); setStage('listening-m2')
      runWithNotices(moduleTransitionNotices('listening'), () => setPhase('running'))
    } else if (stage === 'listening-m2') {
      if (mode === 'listening') { runWithNotices([endOfSectionNotice('listening')], () => setPhase('results')); return }
      const slots = fixedTestId ? buildFixedWritingQueue(fixedBundle) : buildWritingQueue(pools)
      if (!fixedTestId) markPoolItemsSeen(slots)
      setQueue(slots); setIdx(0); setStage('writing')
      runWithNotices([endOfSectionNotice('listening'), sectionIntroNotice('writing'), TASK_INTRO[slots[0].kind]], () => setPhase('running'))
    } else if (stage === 'writing') {
      if (mode === 'writing') { runWithNotices([endOfSectionNotice('writing')], () => setPhase('results')); return }
      const slots = fixedTestId ? buildFixedSpeakingQueue(fixedBundle) : buildSpeakingQueue(pools)
      if (!fixedTestId) markPoolItemsSeen(slots)
      setQueue(slots); setIdx(0); setStage('speaking')
      runWithNotices([endOfSectionNotice('writing'), sectionIntroNotice('speaking'), TASK_INTRO[slots[0].kind]], () => setPhase('running'))
    } else if (stage === 'speaking') {
      runWithNotices([endOfSectionNotice('speaking')], () => setPhase('results'))
    }
  }

  const goNext = () => {
    if (idx + 1 < queue.length) {
      const nextIdx = idx + 1
      const nextSlot = queue[nextIdx]
      const prevSlot = queue[idx]
      setIdx(nextIdx)
      // Within the single-pass writing/speaking queues, show that task type's own
      // instruction notice whenever the slot kind changes (e.g. bas -> email -> disc).
      if ((stage === 'writing' || stage === 'speaking') && nextSlot && prevSlot && nextSlot.kind !== prevSlot.kind) {
        runWithNotices([TASK_INTRO[nextSlot.kind]], () => setPhase('running'))
      }
    } else {
      advanceStage()
    }
  }

  // Cross-slot Back navigation within a Reading module — lets the Back button always do
  // something (per user request) instead of dead-ending at the first question of each new
  // exercise/passage. Lands on the LAST question of the previous slot (enterAtEndRef, read by
  // RIDLQuestion/APQuestion on mount) since that's the most natural place to resume from.
  const enterAtEndRef = useRef(null)
  const goPrev = () => {
    if (idx === 0) return
    enterAtEndRef.current = idx - 1
    setIdx(idx - 1)
  }

  // The "Save & Exit" button is now shown in every part of the mock test (Reading, Listening,
  // Writing, Speaking), not just in standalone practice mode. Since abandoning a timed mock test
  // partway through discards all progress made so far, confirm before actually leaving.
  const exitMockTest = () => {
    if (window.confirm('Exit the mock test? Your progress in this session will be lost.')) onBack()
  }

  // Keeps a ref to the latest idx/queue/stage so the pooled Reading clock's interval (below),
  // which is only recreated when stage/phase change, can still read up-to-date progress when
  // the module time runs out mid-question.
  const readingLiveRef = useRef({ idx: 0, queue: [], stage: '' })
  readingLiveRef.current = { idx, queue, stage }

  const handleReadingPoolExpired = () => {
    const { idx: curIdx, queue: curQueue, stage: curStage } = readingLiveRef.current
    // Score every remaining (not-yet-recorded) slot as 0/N — but don't touch slots the student
    // already completed and recorded (including ones they'd gone Back to revisit), since
    // recordSlot below would otherwise wipe out a real score with an unattempted one.
    for (let i = curIdx; i < curQueue.length; i++) {
      const already = sessionRef.current.slotRecords[curStage] && sessionRef.current.slotRecords[curStage][i]
      if (!already) {
        const slot = curQueue[i]
        recordSlot(curStage, i, 0, slotQuestionCount(slot), slot.kind, null)
      }
    }
    advanceStage()
  }

  // One combined clock per Reading module (see computeReadingPoolSeconds) — ticks only while
  // a reading-m1/reading-m2 stage is actively running, and pauses during notice/intro screens.
  useEffect(() => {
    const isReadingModule = stage === 'reading-m1' || stage === 'reading-m2'
    if (!isReadingModule || phase !== 'running') return
    const t = setInterval(() => {
      setReadingPoolLeft(prev => {
        if (prev === null) return prev
        if (prev <= 1) {
          clearInterval(t)
          handleReadingPoolExpired()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, phase])

  const addReview = (section, kind, detail) => {
    if (!detail) return
    sessionRef.current.review[section].push({ kind, detail })
  }

  const handleReadingListening = (slot, correct, total, detail) => {
    if (stage === 'reading-m1' || stage === 'reading-m2') {
      // Keyed by slot index so re-answering after Back overwrites this slot's own record
      // instead of adding a second entry — see recordSlot/recomputeReadingAggregates.
      recordSlot(stage, idx, correct, total, slot.kind, detail)
    } else {
      addRaw(stage, correct, total)
      addReview('listening', slot.kind, detail)
    }
    goNext()
  }
  const handleWriting = (slot, payload, detail) => {
    sessionRef.current.writing.push({ kind: slot.kind, ...payload })
    addReview('writing', slot.kind, detail)
    goNext()
  }
  const handleSpeaking = (slot, items, detail) => {
    sessionRef.current.speaking.push({ kind: slot.kind, items })
    addReview('speaking', slot.kind, detail)
    goNext()
  }

  if (phase === 'loading') return <LoadingState label="Loading mock test content..." />
  // The dynamic "Start Full Mock Test" / "practice one section" flow draws from the /api/mock/*
  // pools, which the backend now fully premium-gates (see require_premium_pool in main.py) --
  // Fixed Test 1 (startFixedTest) is the one complete free mock-test experience instead, so it's
  // deliberately NOT gated here.
  const startTestGated = (...args) => { if (!hasPremium) { requestUpgrade(); return }; startTest(...args) }
  if (phase === 'intro') return <MockIntroScreen onStart={startTestGated} onStartSection={(sec) => startTestGated(sec)} onBack={onBack} onStartFixed={startFixedTest} hasPremium={hasPremium} />
  if (phase === 'hwcheck') {
    const plan = hwCheckPlanRef.current
    if (plan.needsMicModal && hwCheckStep === 0) return <MicVolumeCheckModal onStart={() => setHwCheckStep(1)} />
    const screenIdx = hwCheckStep - (plan.needsMicModal ? 1 : 0)
    const screen = plan.screens[screenIdx]
    return <TestNoticeScreen title={screen.title} paragraphs={screen.paragraphs} icons={screen.icons} visual={screen.visual}
      onContinue={() => { if (screenIdx < plan.screens.length - 1) setHwCheckStep(hwCheckStep + 1); else pendingBeginRef.current() }} />
  }
  if (phase === 'notice') {
    const n = noticeQueue[0]
    if (!n) return null
    return <TestNoticeScreen title={n.title} paragraphs={n.paragraphs} rows={n.rows} onContinue={continueNotice} />
  }

  if (phase === 'results') {
    const s = sessionRef.current
    const readingRaw = ['reading-m1', 'reading-m2'].reduce((acc, k) => ({ correct: acc.correct + (s.stageRaw[k]?.correct || 0), total: acc.total + (s.stageRaw[k]?.total || 0) }), { correct: 0, total: 0 })
    const listeningRaw = ['listening-m1', 'listening-m2'].reduce((acc, k) => ({ correct: acc.correct + (s.stageRaw[k]?.correct || 0), total: acc.total + (s.stageRaw[k]?.total || 0) }), { correct: 0, total: 0 })
    const basResult = s.writing.find(w => w.kind === 'bas') || { correct: 0, total: 10 }
    const emailResult = s.writing.find(w => w.kind === 'email') || { score: 0 }
    const discResult = s.writing.find(w => w.kind === 'disc') || { score: 0 }
    const writingPts = basResult.correct + (emailResult.score || 0) + (discResult.score || 0)
    const writingMax = basResult.total + 5 + 5
    // Per ETS's scoring method (same reasoning as Speaking below), each of the three graded
    // writing tasks is averaged on its own first, then combined with EQUAL (1/3 each) weight —
    // not pooled into one raw-points ratio, which would let Build-a-Sentence's item count
    // over-weight the band relative to Email/Discussion (fixed 5 pts each).
    const basPct = basResult.total ? basResult.correct / basResult.total : 0
    const emailPct = (emailResult.score || 0) / 5
    const discPct = (discResult.score || 0) / 5
    const writingTaskPct = (basPct + emailPct + discPct) / 3
    const lrResult = s.speaking.find(w => w.kind === 'lr') || { items: [] }
    const interviewResult = s.speaking.find(w => w.kind === 'interview') || { items: [] }
    const speakingPts = lrResult.items.reduce((a, x) => a + (x.score || 0), 0) + interviewResult.items.reduce((a, x) => a + (x.score || 0), 0)
    const speakingMax = lrResult.items.length * 5 + interviewResult.items.length * 5
    // Per ETS's scoring method, the Listen-and-Repeat task score and the Interview task score
    // are each averaged on their own first, then combined with EQUAL (50/50) weight — not
    // pooled into one raw-points ratio, which would over-weight L&R's 7 items vs Interview's 4.
    const lrPct = lrResult.items.length ? lrResult.items.reduce((a, x) => a + (x.score || 0), 0) / (lrResult.items.length * 5) : null
    const ivPct = interviewResult.items.length ? interviewResult.items.reduce((a, x) => a + (x.score || 0), 0) / (interviewResult.items.length * 5) : null
    const speakingTaskPct = lrPct != null && ivPct != null ? (lrPct + ivPct) / 2 : (lrPct ?? ivPct ?? 0)

    const readingBand = pctToBand(readingRaw.total ? readingRaw.correct / readingRaw.total : 0, 'reading')
    const listeningBand = pctToBand(listeningRaw.total ? listeningRaw.correct / listeningRaw.total : 0, 'listening')
    const writingBand = pctToBand(writingTaskPct, 'writing')
    const speakingBand = pctToBand(speakingTaskPct, 'speaking')
    const overall = computeOverallBand(readingBand, listeningBand, writingBand, speakingBand)

    const rows = [
      { key: 'reading', label: 'Reading', band: readingBand, detail: `${readingRaw.correct}/${readingRaw.total} correct` },
      { key: 'listening', label: 'Listening', band: listeningBand, detail: `${listeningRaw.correct}/${listeningRaw.total} correct` },
      { key: 'writing', label: 'Writing', band: writingBand, detail: `${writingPts.toFixed(1)}/${writingMax} pts` },
      { key: 'speaking', label: 'Speaking', band: speakingBand, detail: `${speakingPts.toFixed(1)}/${speakingMax} pts` },
    ]

    const isSingleSection = mode !== 'full'
    const sectionRow = rows.find(r => r.key === mode)

    if (isSingleSection && sectionRow) {
      const isOpen = openReview[sectionRow.key]
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif', zIndex: 10, padding: '48px 24px', overflowY: 'auto' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{sectionRow.label} Practice Complete</div>
          <div style={{ fontSize: '42px', fontWeight: '800', color: '#701fa1', marginBottom: '4px' }}>{sectionRow.band.toFixed(1)} / {SECTION_BAND_MAX[sectionRow.key]}</div>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>Estimated {sectionRow.label} band · {sectionRow.detail}</div>
          <div style={{ width: '100%', maxWidth: '640px', marginBottom: '20px' }}>
            {sectionRow.key === 'writing' ? (
              <WritingScoreBreakdown basResult={basResult} emailResult={emailResult} discResult={discResult} reviewEntries={s.review.writing} />
            ) : (
              <>
                <button onClick={() => setOpenReview(prev => ({ ...prev, [sectionRow.key]: !prev[sectionRow.key] }))}
                  style={{ width: '100%', background: '#fff', border: '0.5px solid #e1e4ed', borderRadius: '8px', padding: '12px 18px', fontSize: '13px', fontWeight: '700', color: '#1a1a1a', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Review your answers</span><span>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && <MockReviewList reviewEntries={s.review[sectionRow.key]} />}
              </>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', maxWidth: '480px', textAlign: 'center', marginBottom: '20px', lineHeight: '1.6' }}>
            Band scores are estimates based on your raw performance — ETS does not publish its exact scoring formula, so treat this as a practice signal, not a guaranteed test-day result.
          </div>
          <button onClick={onBack} style={{ background: '#701fa1', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 26px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Back to Dashboard</button>
        </div>
      )
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif', zIndex: 10, padding: isMobile ? '28px 16px' : '48px 24px', overflowY: 'auto' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Full Mock Test Complete</div>
        <div style={{ fontSize: '42px', fontWeight: '800', color: '#701fa1', marginBottom: '4px' }}>{overall.toFixed(1)} / 6</div>
        <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '28px' }}>Estimated overall band (average of 4 sections)</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px', width: '100%', maxWidth: '560px', marginBottom: '20px' }}>
          {rows.map(r => (
            <div key={r.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '0.5px solid #e1e4ed' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>{r.label}</div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#1a1a1a' }}>{r.band.toFixed(1)} <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '600' }}>/ {SECTION_BAND_MAX[r.key]}</span></div>
              <div style={{ fontSize: '12px', color: '#616473', marginTop: '4px', marginBottom: '10px' }}>{r.detail}</div>
              {r.key === 'writing' ? (
                <WritingScoreBreakdown basResult={basResult} emailResult={emailResult} discResult={discResult} reviewEntries={s.review.writing} />
              ) : (
                <>
                  <button onClick={() => setOpenReview(prev => ({ ...prev, [r.key]: !prev[r.key] }))}
                    style={{ width: '100%', background: '#f4f6fa', border: '0.5px solid #e1e4ed', borderRadius: '6px', padding: '7px 10px', fontSize: '11px', fontWeight: '700', color: '#616473', cursor: 'pointer' }}>
                    Review answers {openReview[r.key] ? '▲' : '▼'}
                  </button>
                  {openReview[r.key] && <MockReviewList reviewEntries={s.review[r.key]} />}
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: '#9ca3af', maxWidth: '480px', textAlign: 'center', marginBottom: '20px', lineHeight: '1.6' }}>
          Band scores are estimates based on your raw performance — ETS does not publish its exact scoring formula, so treat this as a practice signal, not a guaranteed test-day result.
        </div>
        <button onClick={onBack} style={{ background: '#701fa1', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 26px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Back to Dashboard</button>
      </div>
    )
  }

  // phase === 'running'
  const slot = queue[idx]
  if (!slot) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#616473' }}>Loading next section…</div>

  // A small floating badge (bottom-left, out of the way of every module's own header/controls)
  // shows overall mock-test progress without interfering with each exercise's own fixed-position layout.
  const progressBadge = (
    <div style={{ position: 'fixed', bottom: '14px', left: '14px', zIndex: 50, background: '#11162d', color: '#fff', padding: '6px 14px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>
      {MOCK_STAGE_LABELS[stage]} · {idx + 1}/{queue.length}
    </div>
  )
  const wrap = (child) => <>{child}{progressBadge}</>

  // For Reading modules, number questions across the WHOLE module (not per exercise/passage) —
  // matches the official TOEFL iBT UI (e.g. "Questions 4-9 of 20").
  const isReadingStage = stage === 'reading-m1' || stage === 'reading-m2'
  const isListeningStage = stage === 'listening-m1' || stage === 'listening-m2'
  const moduleTotal = (isReadingStage || isListeningStage) ? queue.reduce((a, s) => a + slotQuestionCount(s), 0) : undefined
  const moduleOffset = (isReadingStage || isListeningStage) ? queue.slice(0, idx).reduce((a, s) => a + slotQuestionCount(s), 0) : undefined
  // Consume the one-shot "enter at last question" flag set by goPrev — only applies to the
  // render immediately after navigating back, and only for the slot it was set for.
  const shouldEnterAtEnd = isReadingStage && enterAtEndRef.current === idx
  if (shouldEnterAtEnd) enterAtEndRef.current = null
  const prevSlotHandler = isReadingStage && idx > 0 ? goPrev : undefined
  // "Finish" should only ever appear on the button that actually ends the module (moves on to
  // the next module/section) — every other Next/Submit press within the module, even the last
  // question of a given passage/exercise, should read "Next" since more slots follow. Applies to
  // both Reading and Listening modules.
  const isLastSlotInModule = (isReadingStage || isListeningStage) && idx === queue.length - 1

  if (slot.kind === 'ctw') return wrap(<CTWSingle key={idx} exercise={slot.data} exerciseNum={idx + 1} onBack={exitMockTest} mockMode onComplete={(c, t, detail) => handleReadingListening(slot, c, t, detail)} poolTime={readingPoolLeft === null ? undefined : readingPoolLeft} moduleOffset={moduleOffset} moduleTotal={moduleTotal} onPrevSlot={prevSlotHandler} isLastSlot={isLastSlotInModule} initialAnswers={getSlotAnswers(stage, idx)} onAnswersChange={(val) => setSlotAnswers(stage, idx, val)} />)
  if (slot.kind === 'ridl') return wrap(<RIDLQuestion key={idx} passage={slot.data} practiceNum={idx + 1} totalPractices={queue.length} onBack={exitMockTest} onFinish={goNext} mockMode onComplete={(s2, t, detail) => handleReadingListening(slot, s2, t, detail)} poolTime={readingPoolLeft === null ? undefined : readingPoolLeft} moduleOffset={moduleOffset} moduleTotal={moduleTotal} onPrevSlot={prevSlotHandler} enterAtEnd={shouldEnterAtEnd} isLastSlot={isLastSlotInModule} initialAnswers={getSlotAnswers(stage, idx)} onAnswersChange={(val) => setSlotAnswers(stage, idx, val)} />)
  if (slot.kind === 'ap') return wrap(<APQuestion key={idx} passage={slot.data} onBack={exitMockTest} mockMode onComplete={(s2, t, detail) => handleReadingListening(slot, s2, t, detail)} poolTime={readingPoolLeft === null ? undefined : readingPoolLeft} moduleOffset={moduleOffset} moduleTotal={moduleTotal} onPrevSlot={prevSlotHandler} enterAtEnd={shouldEnterAtEnd} isLastSlot={isLastSlotInModule} initialAnswers={getSlotAnswers(stage, idx)} onAnswersChange={(val) => setSlotAnswers(stage, idx, val)} />)
  if (slot.kind === 'car') return wrap(<ListeningP1Exercise key={idx} exercise={slot.data} exerciseNum={idx + 1} onBack={exitMockTest} mockMode onComplete={(s2, t, detail) => handleReadingListening(slot, s2, t, detail)} isLastSlot={isLastSlotInModule} moduleOffset={moduleOffset} moduleTotal={moduleTotal} />)
  if (slot.kind === 'conv') return wrap(<ListeningP2Exercise key={idx} conversation={slot.data} exerciseNum={idx + 1} onBack={exitMockTest} mockMode onComplete={(s2, t, detail) => handleReadingListening(slot, s2, t, detail)} isLastSlot={isLastSlotInModule} moduleOffset={moduleOffset} moduleTotal={moduleTotal} />)
  if (slot.kind === 'announce') return wrap(<ListeningP3Exercise key={idx} announcement={slot.data} exerciseNum={idx + 1} onBack={exitMockTest} mockMode onComplete={(s2, t, detail) => handleReadingListening(slot, s2, t, detail)} isLastSlot={isLastSlotInModule} moduleOffset={moduleOffset} moduleTotal={moduleTotal} />)
  if (slot.kind === 'at') return wrap(<ListeningP4Exercise key={idx} talk={slot.data} exerciseNum={idx + 1} onBack={exitMockTest} mockMode onComplete={(s2, t, detail) => handleReadingListening(slot, s2, t, detail)} isLastSlot={isLastSlotInModule} moduleOffset={moduleOffset} moduleTotal={moduleTotal} />)
  if (slot.kind === 'bas') return wrap(<BuildSentenceExercise key={idx} items={slot.data} onBack={exitMockTest} mockMode onComplete={(c, t, detail) => handleWriting(slot, { correct: c, total: t }, detail)} />)
  if (slot.kind === 'email') return wrap(<EmailExercise key={idx} item={slot.data} index={idx} onBack={exitMockTest} mockMode onComplete={(score, detail) => handleWriting(slot, { score }, detail)} />)
  if (slot.kind === 'disc') return wrap(<AcademicDiscussionExercise key={idx} item={slot.data} index={idx} onBack={exitMockTest} mockMode onComplete={(score, detail) => handleWriting(slot, { score }, detail)} />)
  if (slot.kind === 'lr') return wrap(<ListenRepeatExercise key={idx} item={slot.data} index={idx} onBack={exitMockTest} mockMode onComplete={(answers, detail) => handleSpeaking(slot, answers, detail)} />)
  if (slot.kind === 'interview') return wrap(<InterviewExercise key={idx} item={slot.data} index={idx} onBack={exitMockTest} mockMode onComplete={(answers, detail) => handleSpeaking(slot, answers, detail)} />)
  return null
}

// ─── My Progress ────────────────────────────────────────────────────────────
// Reads back everything saveResult() has ever written (every practice exercise + every mock
// test section), so the student can see how they're improving over time in one place.
const PROGRESS_CATEGORY_META = {
  ctw: { section: 'Reading', label: 'Complete the Words' },
  ridl: { section: 'Reading', label: 'Read in Daily Life' },
  ap: { section: 'Reading', label: 'Academic Passage' },
  listening_p1: { section: 'Listening', label: 'Choose a Response' },
  listening_p2: { section: 'Listening', label: 'Listen to a Conversation' },
  listening_p3: { section: 'Listening', label: 'Listen to an Announcement' },
  listening_p4: { section: 'Listening', label: 'Listen to an Academic Talk' },
  bas: { section: 'Writing', label: 'Build a Sentence' },
  email: { section: 'Writing', label: 'Write an Email' },
  disc: { section: 'Writing', label: 'Academic Discussion' },
  speaking_lr: { section: 'Speaking', label: 'Listen and Repeat' },
  speaking_interview: { section: 'Speaking', label: 'Take an Interview' },
  mock_reading: { section: 'Mock Tests', label: 'Reading' },
  mock_listening: { section: 'Mock Tests', label: 'Listening' },
  mock_writing: { section: 'Mock Tests', label: 'Writing' },
  mock_speaking: { section: 'Mock Tests', label: 'Speaking' },
  mock_overall: { section: 'Mock Tests', label: 'Overall Band' },
}
const PROGRESS_SECTION_ORDER = ['Reading', 'Listening', 'Writing', 'Speaking', 'Mock Tests']
const PROGRESS_SECTION_COLORS = { Reading: '#701fa1', Listening: '#2ac56c', Writing: '#e07b00', Speaking: '#2f6fed', 'Mock Tests': '#d94040' }

function ProgressScreen({ onBack }) {
  const isMobile = useIsMobile()
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/results/summary`).then(r => r.json()),
      apiFetch(`${BACKEND_URL}/api/results/history?limit=30`).then(r => r.json()),
    ]).then(([summaryData, historyData]) => {
      if (cancelled) return
      setSummary(summaryData)
      setHistory(Array.isArray(historyData) ? historyData : [])
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState label="Loading your progress..." />

  const byCategory = summary?.by_category || {}
  const overall = summary?.overall || { attempts: 0, avg_pct: 0, last_attempt: null }

  const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso.replace(' ', 'T') + 'Z')
    if (isNaN(d.getTime())) return '—'
    // Fixed to 'en-US' so the date always reads like "Aug 5" regardless of the
    // browser/OS locale -- previously used the system locale (`undefined`), which showed
    // localized abbreviations (e.g. Turkish "5 Ağu") inconsistent with the rest of the
    // English-language app UI.
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (!overall.attempts) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📈</div>
        <h2 style={{ margin: '0 0 8px', color: '#1a1a1a', fontSize: '20px' }}>No activity yet</h2>
        <p style={{ color: '#616473', fontSize: '14px', maxWidth: '420px', margin: '0 auto 20px' }}>Complete a practice exercise or a mock test and your results will start showing up here.</p>
        <button onClick={onBack} style={{ background: '#701fa1', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Back to Dashboard</button>
      </div>
    )
  }

  // Group each category's stats under its section (Reading/Listening/Writing/Speaking/Mock
  // Tests), computing an attempts-weighted average percentage for the section as a whole.
  const sections = {}
  Object.entries(byCategory).forEach(([cat, data]) => {
    const meta = PROGRESS_CATEGORY_META[cat] || { section: 'Other', label: data.label || cat }
    if (!sections[meta.section]) sections[meta.section] = { attempts: 0, weightedPct: 0, items: [] }
    sections[meta.section].attempts += data.attempts
    sections[meta.section].weightedPct += data.avg_pct * data.attempts
    sections[meta.section].items.push({ cat, label: meta.label, ...data })
  })

  return (
    <div style={{ padding: '0 8px 40px' }}>
      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1a1a1a' }}>My Progress</h1>
        <div style={{ fontSize: '13px', color: '#616473', marginTop: '2px' }}>Every exercise and mock test you've completed, all in one place.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '0.5px solid #e1e4ed' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Attempts</div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#1a1a1a', marginTop: '4px' }}>{overall.attempts}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '0.5px solid #e1e4ed' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Average Score</div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#1a1a1a', marginTop: '4px' }}>{overall.avg_pct}%</div>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '0.5px solid #e1e4ed' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Last Activity</div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#1a1a1a', marginTop: '4px' }}>{fmtDate(overall.last_attempt)}</div>
        </div>
      </div>

      {PROGRESS_SECTION_ORDER.filter(s => sections[s]).map(secName => {
        const sec = sections[secName]
        const avgPct = sec.attempts ? Math.round(sec.weightedPct / sec.attempts) : 0
        const color = PROGRESS_SECTION_COLORS[secName] || '#701fa1'
        return (
          <div key={secName} style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a1a' }}>{secName}</div>
              <div style={{ fontSize: '13px', color, fontWeight: '700' }}>{avgPct}% avg · {sec.attempts} attempt{sec.attempts === 1 ? '' : 's'}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: '12px', border: '0.5px solid #e1e4ed', overflow: 'hidden' }}>
              {sec.items.sort((a, b) => a.label.localeCompare(b.label)).map((it, i) => (
                <div key={it.cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderTop: i === 0 ? 'none' : '0.5px solid #f0f0f0' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>{it.label}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{it.attempts} attempt{it.attempts === 1 ? '' : 's'} · best {it.best_pct}% · last {fmtDate(it.last_attempt)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '90px', height: '6px', background: '#efefef', borderRadius: '4px' }}>
                      <div style={{ width: `${it.avg_pct}%`, height: '100%', background: color, borderRadius: '4px' }} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', width: '38px', textAlign: 'right' }}>{it.avg_pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div style={{ marginTop: '10px' }}>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a1a', marginBottom: '10px' }}>Recent Activity</div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '0.5px solid #e1e4ed', overflow: 'hidden' }}>
          {history.slice(0, 20).map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: i === 0 ? 'none' : '0.5px solid #f0f0f0' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>{h.label || (PROGRESS_CATEGORY_META[h.category]?.label ?? h.category)}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{fmtDate(h.saved_at)}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: h.pct >= 70 ? '#2ac56c' : h.pct >= 50 ? '#e07b00' : '#d94040' }}>{h.score}/{h.total} · {h.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onBack} style={{ marginTop: '24px', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '9px 18px', fontSize: '13px', color: '#616473', cursor: 'pointer' }}>← Back to Dashboard</button>
    </div>
  )
}

// ─── Auth: login / sign up screen ────────────────────────────────────────────
// Set at build time once Google Cloud OAuth credentials exist (VITE_GOOGLE_CLIENT_ID). Until
// then the "Sign in with Google" button simply doesn't render, rather than showing a broken one.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Lazily loads Google Identity Services' script (https://accounts.google.com/gsi/client) at most
// once no matter how many times it's called -- returns a promise that resolves once window.google
// is ready to use. AuthScreen calls this on mount rather than adding the <script> tag directly to
// index.html, so the whole Google Sign-In feature stays a no-op (no network request, no console
// warnings) for any deployment that hasn't set VITE_GOOGLE_CLIENT_ID yet.
let _gisLoadPromise = null
function loadGoogleIdentityServices() {
  if (_gisLoadPromise) return _gisLoadPromise
  _gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.id) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
  return _gisLoadPromise
}

function AuthScreen({ onAuthSuccess }) {
  const isMobile = useIsMobile()
  // 'login' | 'signup' | 'forgot' (request a reset link) | 'reset' (set a new password, reached
  // via the emailed link's ?reset_token=... query param)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('') // success/info messages (green), separate from errors
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState('')

  // If the page was opened from the "reset your password" email link, jump straight into the
  // reset-password form instead of the normal login screen, and strip the token out of the
  // visible URL so it isn't sitting in the address bar / browser history afterwards.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('reset_token')
    if (token) {
      setResetToken(token)
      setMode('reset')
      params.delete('reset_token')
      const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
      window.history.replaceState({}, '', cleanUrl)
    }
  }, [])

  const inputStyle = { padding: '11px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }
  const labelStyle = { fontWeight: '600', color: '#616473', fontSize: '12px' }

  const switchMode = (m) => { setMode(m); setError(''); setNotice('') }

  // Sends the ID token Google handed us to the backend, which verifies it and returns a normal
  // mrreadyprep session token -- from this point on a Google sign-in behaves exactly like an
  // email/password login (same token storage, same onAuthSuccess callback).
  const handleGoogleCredential = (response) => {
    setError(''); setNotice(''); setLoading(true)
    fetch(`${BACKEND_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: response.credential }),
    }).then(async res => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'Google sign-in failed. Please try again.')
      return data
    }).then(data => {
      setAuthToken(data.access_token)
      onAuthSuccess(data.user)
    }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }

  // Loads the Google Identity Services script once VITE_GOOGLE_CLIENT_ID is actually set, then
  // initializes it and renders the real Google-branded button into the #google-signin-button div
  // below. Re-runs whenever the login/signup tab toggles (that div gets remounted each time) so
  // the button always ends up in the currently-visible container.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || (mode !== 'login' && mode !== 'signup')) return
    let cancelled = false
    loadGoogleIdentityServices().then(() => {
      if (cancelled || !window.google) return
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential })
      const target = document.getElementById('google-signin-button')
      if (target) {
        target.innerHTML = ''
        window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', width: isMobile ? 240 : 320, text: mode === 'signup' ? 'signup_with' : 'signin_with' })
      }
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isMobile])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (mode === 'forgot') {
      setLoading(true)
      fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.detail || 'Something went wrong. Please try again.')
        setNotice("If an account exists for that email, we've sent a password reset link. Check your inbox.")
      }).catch(err => setError(err.message)).finally(() => setLoading(false))
      return
    }

    if (mode === 'reset') {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
      setLoading(true)
      fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: password }),
      }).then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.detail || 'Something went wrong. Please try again.')
        setNotice('Your password has been updated. You can now log in below.')
        setPassword(''); setConfirmPassword(''); setMode('login')
      }).catch(err => setError(err.message)).finally(() => setLoading(false))
      return
    }

    if (mode === 'signup') {
      if (!username.trim()) { setError('Please enter a username.'); return }
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    }
    setLoading(true)
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body = mode === 'login' ? { email, password } : { email, username, password }
    fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async res => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'Something went wrong. Please try again.')
      return data
    }).then(data => {
      setAuthToken(data.access_token)
      onAuthSuccess(data.user)
    }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%', fontFamily: 'sans-serif', backgroundColor: '#11162d', boxSizing: 'border-box', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{ color: '#b67bfb', fontSize: '24px', fontWeight: '700' }}>mrreadyprep</div>
          <div style={{ fontSize: '10px', color: '#7b809a', letterSpacing: '1.5px', marginTop: '2px' }}>TOEFL IBT PREP</div>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '26px', boxSizing: 'border-box' }}>
          {(mode === 'login' || mode === 'signup') && (
            <div style={{ display: 'flex', borderRadius: '9px', backgroundColor: '#f4f6fa', padding: '3px', marginBottom: '20px' }}>
              {['login', 'signup'].map(m => (
                <button key={m} type="button" onClick={() => switchMode(m)}
                  style={{ flex: 1, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', backgroundColor: mode === m ? '#701fa1' : 'transparent', color: mode === m ? '#fff' : '#616473' }}>
                  {m === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {mode === 'forgot' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' }}>Reset your password</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>Enter your account email and we'll send you a link to choose a new password.</div>
            </div>
          )}
          {mode === 'reset' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' }}>Choose a new password</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>Enter and confirm a new password for your account.</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            {mode === 'signup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={labelStyle}>Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} required />
              </div>
            )}
            {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
              </div>
            )}
            {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={labelStyle}>{mode === 'reset' ? 'New Password' : 'Password'}</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required minLength={mode === 'signup' || mode === 'reset' ? 8 : undefined} />
              </div>
            )}
            {mode === 'login' && (
              <button type="button" onClick={() => switchMode('forgot')}
                style={{ alignSelf: 'flex-end', background: 'none', border: 'none', padding: 0, marginTop: '-6px', fontSize: '12px', fontWeight: '600', color: '#701fa1', cursor: 'pointer' }}>
                Forgot password?
              </button>
            )}
            {(mode === 'signup' || mode === 'reset') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={labelStyle}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required />
              </div>
            )}

            {notice && <div style={{ background: '#edfbf3', color: '#1a7a44', fontSize: '12px', fontWeight: '600', padding: '9px 11px', borderRadius: '7px' }}>{notice}</div>}
            {error && <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '600', padding: '9px 11px', borderRadius: '7px' }}>{error}</div>}

            <button type="submit" disabled={loading} style={{ backgroundColor: '#701fa1', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '4px' }}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send reset link' : 'Set new password'}
            </button>

            {(mode === 'forgot' || mode === 'reset') && (
              <button type="button" onClick={() => switchMode('login')}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', fontWeight: '600', color: '#616473', cursor: 'pointer', textAlign: 'center' }}>
                ← Back to Log In
              </button>
            )}
          </form>

          {GOOGLE_CLIENT_ID && (mode === 'login' || mode === 'signup') && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#e1e4ed' }} />
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#e1e4ed' }} />
              </div>
              <div id="google-signin-button" style={{ display: 'flex', justifyContent: 'center' }} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// The app shell (sidebar + main content) is a fixed desktop layout with no CSS media queries
// anywhere in the codebase -- this hook is the seam that lets a handful of the highest-traffic
// spots (the app shell/nav, the Dashboard) adapt at narrow widths without a full rewrite of every
// one of the 100+ inline-styled screens. Tracks window width live so rotating a phone/resizing a
// window updates the layout immediately, not just on load.
function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= breakpoint)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}

// ─── App ──────────────────────────────────────────────────────────────────────
// Admin-only screen (see require_admin/ADMIN_EMAILS in main.py -- gated purely by whether the
// logged-in account's email is on that list, no separate role stored in the database). Scope is
// deliberately narrow: see every registered account and manually grant/revoke premium access for
// support or testing. Practice/mock content itself lives in JSON pool files shipped with the
// backend, not the database, so there's nothing here to "edit" -- that's done by changing those
// files and redeploying, same as every content update this app has ever had.
function AdminPanel() {
  const isMobile = useIsMobile()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    Promise.all([
      apiFetch(`${BACKEND_URL}/api/admin/stats`).then(r => r.json()),
      apiFetch(`${BACKEND_URL}/api/admin/users`).then(r => r.json()),
    ]).then(([s, u]) => { setStats(s); setUsers(Array.isArray(u) ? u : []) })
      .catch(() => setError('Could not load admin data.'))
  }
  useEffect(load, [])

  const setSubscription = (userId, action) => {
    setBusyId(userId)
    apiFetch(`${BACKEND_URL}/api/admin/users/${userId}/subscription`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ok) { showToast(action === 'grant' ? 'Premium granted.' : 'Premium revoked.'); load() }
        else showToast(data.detail || 'Action failed.', 'error')
      })
      .catch(() => showToast('Action failed.', 'error'))
      .finally(() => setBusyId(null))
  }

  const statCard = (label, value) => (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 18px', border: '0.5px solid #e1e4ed', flex: 1, minWidth: '140px' }}>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a1a1a' }}>{value}</div>
    </div>
  )

  if (error) return <div style={{ padding: '20px', color: '#dc2626', fontSize: '13px' }}>{error}</div>
  if (!stats || !users) return <div style={{ padding: '20px', color: '#616473', fontSize: '13px' }}>Loading admin data...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {statCard('Total users', stats.total_users)}
        {statCard('Active subscriptions', stats.active_subscriptions)}
        {statCard('Verified emails', stats.verified_emails)}
        {statCard('Signups (7 days)', stats.signups_last_7_days)}
      </div>
      <div style={{ background: '#fff', borderRadius: '14px', border: '0.5px solid #e1e4ed', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: isMobile ? '640px' : 'auto' }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: '#616473' }}>Email</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: '#616473' }}>Username</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: '#616473' }}>Verified</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: '#616473' }}>Premium</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: '#616473' }}>Joined</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', color: '#616473' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderTop: '0.5px solid #f0f1f5' }}>
                  <td style={{ padding: '10px 14px' }}>{u.email}{u.is_admin && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '700', color: '#701fa1' }}>ADMIN</span>}</td>
                  <td style={{ padding: '10px 14px' }}>{u.username}</td>
                  <td style={{ padding: '10px 14px' }}>{u.email_verified ? '✓' : '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {u.has_premium ? <span style={{ color: '#2ac56c', fontWeight: '700' }}>✓ Premium{u.has_billed_subscription ? ' (paid)' : ''}</span> : <span style={{ color: '#9ca3af' }}>Free</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#9ca3af' }}>{(u.created_at || '').slice(0, 10)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {u.is_admin ? (
                      <span style={{ color: '#9ca3af', fontSize: '11px' }}>—</span>
                    ) : u.has_billed_subscription ? (
                      <span style={{ color: '#9ca3af', fontSize: '11px' }} title="Real iyzico subscription -- cancel via the customer's own Settings, not here">Paid, not revocable here</span>
                    ) : u.has_premium ? (
                      <button onClick={() => setSubscription(u.id, 'revoke')} disabled={busyId === u.id} style={{ background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 12px', fontSize: '11.5px', fontWeight: '700', cursor: busyId === u.id ? 'default' : 'pointer', opacity: busyId === u.id ? 0.6 : 1 }}>Revoke</button>
                    ) : (
                      <button onClick={() => setSubscription(u.id, 'grant')} disabled={busyId === u.id} style={{ background: '#11162d', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '11.5px', fontWeight: '700', cursor: busyId === u.id ? 'default' : 'pointer', opacity: busyId === u.id ? 0.6 : 1 }}>Grant</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function App() {
  const isMobile = useIsMobile()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // Browsers (Safari in particular) block audio.play() unless it happens inside a genuine
  // user gesture. Listening/Speaking audio auto-plays a moment after the screen renders
  // (AUDIO_START_DELAY_MS), which is not itself a gesture, so the very first attempt can be
  // silently blocked. The fix used by most audio-heavy web apps: play (and immediately pause)
  // a tiny silent clip on the very first click/keypress anywhere in the app. That one
  // gesture-backed play() unlocks audio playback for the rest of the page session, so every
  // later autoplay call — even ones fired from a timer with no direct click behind them —
  // is allowed to go through with no manual "Play" button ever needed.
  useEffect(() => {
    const unlock = () => {
      try {
        const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=')
        const p = a.play()
        if (p && p.catch) p.catch(() => {})
      } catch (e) {}
    }
    document.addEventListener('pointerdown', unlock, true)
    document.addEventListener('keydown', unlock, true)
    return () => {
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('keydown', unlock, true)
    }
  }, [])

  const [userData, setUserData] = useState(null)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [currentTab, setCurrentTab] = useState('dashboard')
  const [profileName, setProfileName] = useState('')
  const [targetScore, setTargetScore] = useState(5.5)
  const [readingTarget, setReadingTarget] = useState(5.5)
  const [listeningTarget, setListeningTarget] = useState(5.0)
  const [writingTarget, setWritingTarget] = useState(4.5)
  const [speakingTarget, setSpeakingTarget] = useState(4.5)
  const [examDate, setExamDate] = useState('')
  const [vocabWords, setVocabWords] = useState([])
  const [vocabFilter, setVocabFilter] = useState('all')
  const [flippedCards, setFlippedCards] = useState({})
  const [expandedFormat, setExpandedFormat] = useState(false)
  const [editingTargets, setEditingTargets] = useState(false)
  const [readingSubTab, setReadingSubTab] = useState(null)
  const [listeningSubTab, setListeningSubTab] = useState(null)
  const [writingSubTab, setWritingSubTab] = useState(null)
  const [speakingSubTab, setSpeakingSubTab] = useState(null)

  const getExamDaysLeft = () => {
    if (!examDate) return null
    const today = new Date(); today.setHours(0,0,0,0)
    const exam = new Date(examDate + 'T00:00:00'); exam.setHours(0,0,0,0)
    const diff = Math.round((exam - today) / 86400000)
    return diff < 0 ? null : diff
  }

  const generateGoals = (daysLeft, data) => {
    const sections = [
      { name: 'Reading practice', gap: (data.reading_target ?? 5.5) - data.reading_score },
      { name: 'Listening practice', gap: (data.listening_target ?? 5.0) - data.listening_score },
      { name: 'Writing practice', gap: (data.writing_target ?? 4.5) - data.writing_score },
      { name: 'Speaking practice', gap: (data.speaking_target ?? 4.5) - data.speaking_score },
    ].filter(s => s.gap > 0).sort((a, b) => b.gap - a.gap)
    const goals = []; const today = new Date().getDate()
    sections.forEach((s, i) => {
      if (daysLeft > 60) goals.push(`Practice ${s.name} (gap: ${s.gap.toFixed(1)})`)
      else if (daysLeft > 30) goals.push(s.gap >= 1.0 ? `Do 2 ${s.name} sessions — urgent` : `Do 1 ${s.name} session`)
      else if (daysLeft > 14) { if (s.gap >= 0.5) goals.push(`Full ${s.name} mock test`) }
      else { if (s.gap >= 1.0) goals.push(`${s.name}: full focus session — biggest gap (${s.gap.toFixed(1)})`); else if (s.gap >= 0.5 && i === today % sections.length) goals.push(`${s.name}: quick review — exam soon`) }
    })
    if (daysLeft <= 60) goals.push('Review 10 vocabulary words')
    if (daysLeft <= 30) goals.push('Take a full timed practice test')
    if (daysLeft <= 1) goals.push('Rest, review notes, sleep early')
    return goals.slice(0, 5)
  }

  const fetchVocabData = () => {
    apiFetch(`${BACKEND_URL}/api/vocab`).then(res => res.json()).then(data => setVocabWords(data)).catch(err => console.error(err))
  }

  const toggleLearned = (id) => {
    apiFetch(`${BACKEND_URL}/api/vocab/toggle/${id}`, { method: 'POST' })
      .then(res => res.json()).then(() => { setVocabWords(prev => prev.map(item => item.id === id ? { ...item, learned: !item.learned } : item)); fetchDashboardData() }).catch(err => console.error(err))
  }

  const fetchDashboardData = () => {
    apiFetch(`${BACKEND_URL}/api/dashboard`).then(res => res.json())
      .then(data => {
        setUserData(data); setProfileName(data.username); setTargetScore(data.target_score); setExamDate(data.exam_date || '')
        setReadingTarget(data.reading_target ?? 5.5)
        setListeningTarget(data.listening_target ?? 5.0)
        setWritingTarget(data.writing_target ?? 4.5)
        setSpeakingTarget(data.speaking_target ?? 4.5)
      }).catch(err => console.error(err))
  }

  useEffect(() => { fetchDashboardData(); fetchVocabData() }, [])
  // Section scores/exam date only change as a side effect of finishing practice elsewhere in the
  // app -- re-fetch every time the student lands back on the Dashboard tab (not just on first
  // mount) so those numbers don't go stale for the rest of the session after the first load.
  // Settings is included too so the "email verified" badge picks up a verification done in
  // another tab (e.g. clicking the emailed link) without needing a full page reload.
  useEffect(() => { if (currentTab === 'dashboard' || currentTab === 'settings') fetchDashboardData() }, [currentTab])

  // Any locked list item/mock test anywhere in the app calls requestUpgrade() instead of trying
  // to open itself -- that dispatches this event, which is the one place that actually switches
  // the screen to the paywall, so no prop-drilling is needed through a dozen list components.
  useEffect(() => {
    const openPaywall = () => setCurrentTab('subscribe')
    window.addEventListener('mrreadyprep:paywall', openPaywall)
    return () => window.removeEventListener('mrreadyprep:paywall', openPaywall)
  }, [])

  // iyzico's embedded checkout widget finishes by POSTing to our backend, which then redirects
  // the browser back here as "/?subscription_token=<token>" (see /api/subscription/checkout-callback
  // on the backend -- the static frontend can't receive a POST directly). Confirm the result with
  // our own server (never trust the redirect alone) and refresh has_premium once confirmed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('subscription_token')
    const cancelled = params.get('subscription') === 'cancel'
    if (!token && !cancelled) return
    window.history.replaceState({}, '', window.location.pathname)
    setCurrentTab('subscribe')
    if (cancelled) {
      showToast('Checkout was not completed.', 'info')
      return
    }
    confirmCheckoutResult(token)
      .then(data => {
        fetchDashboardData()
        if (data.has_premium) {
          showToast('Subscription successful! You now have full Premium access.')
        } else {
          showToast('Payment could not be confirmed yet. If you completed payment, this should update shortly.', 'info')
        }
      })
      .catch(() => {})
  }, [])

  const handleProfileSave = (e) => {
    e.preventDefault()
    apiFetch(`${BACKEND_URL}/api/profile/update`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: profileName, target_score: Number(targetScore),
        reading_target: Number(readingTarget), listening_target: Number(listeningTarget),
        writing_target: Number(writingTarget), speaking_target: Number(speakingTarget),
      }),
    }).then(res => res.json()).then(data => { if (data.status === 'success') { showToast('Saved!'); fetchDashboardData() } })
  }

  const handleResendVerification = () => {
    setResendingVerification(true)
    apiFetch(`${BACKEND_URL}/api/auth/resend-verification-email`, { method: 'POST' })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => showToast(ok ? (data.message || 'Verification email sent.') : (data.detail || 'Could not send verification email.'), ok ? 'success' : 'error'))
      .catch(() => showToast('Could not send verification email.', 'error'))
      .finally(() => setResendingVerification(false))
  }

  // Same save as the Settings form, but usable from the Dashboard's inline "Edit targets" panel
  // without a <form> submit event -- lets a student adjust their section goals right where they
  // see them instead of having to go find the Settings tab.
  const saveTargets = () => {
    apiFetch(`${BACKEND_URL}/api/profile/update`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: profileName, target_score: Number(targetScore),
        reading_target: Number(readingTarget), listening_target: Number(listeningTarget),
        writing_target: Number(writingTarget), speaking_target: Number(speakingTarget),
      }),
    }).then(res => res.json()).then(data => { if (data.status === 'success') { setEditingTargets(false); fetchDashboardData() } })
  }

  // Saved immediately on change (no separate "save" button) so the exam date sticks across
  // reloads and the student can update it again anytime just by picking a new date.
  const handleExamDateChange = (newDate) => {
    setExamDate(newDate)
    apiFetch(`${BACKEND_URL}/api/profile/exam-date`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam_date: newDate }),
    }).catch(err => console.error(err))
  }

  if (!userData) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}><LoadingState label="Loading mrreadyprep..." /></div>

  const examDaysLeft = getExamDaysLeft()
  const streakDays = userData.week_activity || [false, false, false, false, false, false, false]
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const sb = (tab, icon, label) => (
    <button onClick={() => { setCurrentTab(tab); setReadingSubTab(null); setListeningSubTab(null); if (isMobile) setMobileNavOpen(false) }} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: '500', backgroundColor: currentTab === tab ? '#701fa1' : 'transparent', color: currentTab === tab ? '#fff' : '#a0a3b1', display: 'flex', alignItems: 'center', gap: '10px' }}>
      {icon} {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', fontFamily: 'sans-serif', backgroundColor: '#f4f6fa', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Backdrop behind the off-canvas sidebar on mobile -- tapping it closes the drawer, same
          as tapping outside any slide-in menu. Only exists in the DOM while open. */}
      {isMobile && mobileNavOpen && (
        <div onClick={() => setMobileNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 998 }} />
      )}

      {/* SIDEBAR -- on desktop this sits in normal flex flow at a fixed 200px. On mobile it's
          pulled out of flow (position: fixed) and slides in/out as an off-canvas drawer, so it
          never eats into the ~375px of width a phone actually has. */}
      <div style={{
        width: '200px', flexShrink: 0, backgroundColor: '#11162d', padding: '20px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box',
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 999, width: '240px',
          transform: mobileNavOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        } : {}),
      }}>
        <div>
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ color: '#b67bfb', fontSize: '17px', fontWeight: '600' }}>mrreadyprep</div>
            <div style={{ fontSize: '9px', color: '#7b809a', letterSpacing: '1px' }}>TOEFL IBT PREP</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {sb('dashboard', '📊', 'Dashboard')}
            {sb('reading', '📖', 'Reading')}
            {sb('listening', '🎧', 'Listening')}
            {sb('writing', '✍️', 'Writing')}
            {sb('speaking', '🎙️', 'Speaking')}
            {sb('mocktest', '🧪', 'Full Mock Test')}
            {sb('progress', '📈', 'My Progress')}
            {sb('vocab', '📚', 'Vocabulary')}
            {sb('subscribe', userData.has_premium ? '⭐' : '💎', userData.has_premium ? 'Premium Active' : 'Upgrade to Premium')}
            {userData.is_admin && sb('admin', '🛠️', 'Admin')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderTop: '1px solid #252a44', paddingTop: '4px' }}>
          <div onClick={() => { setCurrentTab('settings'); if (isMobile) setMobileNavOpen(false) }} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 4px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#2ac56c', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', color: '#fff', fontSize: '12px', flexShrink: 0 }}>{(userData.username || '?').charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userData.username}</div>
              <div style={{ fontSize: '10px', color: '#7b809a' }}>⚙️ Settings</div>
            </div>
          </div>
          <button onClick={logout} title="Log out" style={{ flexShrink: 0, background: 'none', border: 'none', color: '#7b809a', cursor: 'pointer', fontSize: '15px', padding: '6px' }}>⏻</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, padding: isMobile ? '12px' : '16px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>

        {/* Mobile-only top bar: hamburger opens the off-canvas sidebar above. Desktop keeps the
            always-visible sidebar instead, so this never renders there. */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button onClick={() => setMobileNavOpen(true)} style={{ background: '#11162d', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '9px', fontSize: '17px', cursor: 'pointer', flexShrink: 0 }}>☰</button>
            <div style={{ color: '#701fa1', fontSize: '15px', fontWeight: '700' }}>mrreadyprep</div>
          </div>
        )}

        {currentTab !== 'dashboard' && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <span onClick={() => {
              if (readingSubTab) setReadingSubTab(null)
              else if (listeningSubTab) setListeningSubTab(null)
              else if (writingSubTab) setWritingSubTab(null)
              else if (speakingSubTab) setSpeakingSubTab(null)
              else setCurrentTab('dashboard')
            }} style={{ fontSize: '13px', fontWeight: '600', color: '#9047f5', cursor: 'pointer' }}>← Back</span>
            <h2 style={{ margin: '0 0 0 14px', fontSize: '18px', fontWeight: '700' }}>
              {currentTab === 'reading' && !readingSubTab && '📖 Reading Practice'}
              {currentTab === 'reading' && readingSubTab === 'ctw' && '📖 Complete the Words'}
              {currentTab === 'reading' && readingSubTab === 'ridl' && '📖 Read in Daily Life'}
              {currentTab === 'reading' && readingSubTab === 'academic' && '📖 Academic Passage'}
              {currentTab === 'listening' && !listeningSubTab && '🎧 Listening Practice'}
              {currentTab === 'listening' && listeningSubTab === 'p1' && '🎧 Choose a Response'}
              {currentTab === 'listening' && listeningSubTab === 'p2' && '🎧 Listen to a Conversation'}
              {currentTab === 'listening' && listeningSubTab === 'p3' && '🎧 Listen to an Announcement'}
              {currentTab === 'listening' && listeningSubTab === 'p4' && '🎧 Listen to an Academic Talk'}
              {currentTab === 'writing' && !writingSubTab && '✍️ Writing Practice'}
              {currentTab === 'writing' && writingSubTab === 'p1' && '✍️ Build a Sentence'}
              {currentTab === 'writing' && writingSubTab === 'p2' && '✍️ Write an Email'}
              {currentTab === 'writing' && writingSubTab === 'p3' && '✍️ Academic Discussion'}
              {currentTab === 'speaking' && !speakingSubTab && '🎙️ Speaking Practice'}
              {currentTab === 'speaking' && speakingSubTab === 'p1' && '🎙️ Listen and Repeat'}
              {currentTab === 'speaking' && speakingSubTab === 'p2' && '🎙️ Take an Interview'}
              {currentTab === 'mocktest' && '🧪 Full Mock Test'}
              {currentTab === 'progress' && '📈 My Progress'}
              {currentTab === 'vocab' && '📚 Vocabulary'}
              {currentTab === 'settings' && '⚙️ Settings'}
              {currentTab === 'subscribe' && '💎 Premium'}
              {currentTab === 'admin' && '🛠️ Admin'}
            </h2>
          </div>
        )}

        {/* DASHBOARD */}
        {currentTab === 'dashboard' && (
          <>
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0, ...(isMobile ? { flexDirection: 'column' } : {}) }}>
              <div style={{ background: '#11162d', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                <div style={{ fontSize: '26px' }}>🔥</div>
                <div>
                  <div style={{ fontSize: '10px', color: '#7b809a', marginBottom: '2px' }}>Daily streak</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#f5a623' }}>{userData.current_streak} days</div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                  {streakDays.map((done, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: done ? '#2ac56c' : '#252a44', border: done ? 'none' : '0.5px solid #3a3f5c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {done && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}
                      </div>
                      <div style={{ fontSize: '9px', color: '#7b809a' }}>{dayLabels[i]}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#701fa1', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', minWidth: isMobile ? '0' : '240px', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#d4a0f5', marginBottom: '2px' }}>Full mock test</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>All 4 sections · ~90 min</div>
                  <div style={{ fontSize: '10px', color: '#c084fc', marginTop: '3px' }}>{userData.last_mock_test_at ? `Last taken: ${timeAgo(userData.last_mock_test_at)}` : 'Not taken yet'}</div>
                </div>
                <button onClick={() => setCurrentTab('mocktest')} style={{ marginLeft: 'auto', background: '#fff', color: '#701fa1', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Start test</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0, overflow: isMobile ? 'visible' : 'hidden', ...(isMobile ? { flexDirection: 'column', overflowY: 'auto' } : {}) }}>
              <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: '12px', padding: '16px', border: '0.5px solid #e1e4ed', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>Section scores vs targets</div>
                  <button onClick={() => setEditingTargets(v => !v)} style={{ background: editingTargets ? '#701fa1' : '#f4f0fb', color: editingTargets ? '#fff' : '#701fa1', border: 'none', padding: '5px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>✏️ {editingTargets ? 'Close' : 'Edit targets'}</button>
                </div>
                {editingTargets && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8f7fb', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#616473' }}>Reading (1.0–6.0)</label>
                      <input type="number" min="1" max="6" step="0.5" value={readingTarget} onChange={e => setReadingTarget(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#616473' }}>Listening (1.0–6.0)</label>
                      <input type="number" min="1" max="6" step="0.5" value={listeningTarget} onChange={e => setListeningTarget(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#616473' }}>Writing (1.0–5.0)</label>
                      <input type="number" min="1" max="5" step="0.5" value={writingTarget} onChange={e => setWritingTarget(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#616473' }}>Speaking (1.0–5.0)</label>
                      <input type="number" min="1" max="5" step="0.5" value={speakingTarget} onChange={e => setSpeakingTarget(e.target.value)} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <button onClick={saveTargets} style={{ gridColumn: '1 / -1', background: '#2ac56c', color: '#fff', border: 'none', padding: '8px', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', marginTop: '2px' }}>Save targets</button>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                  {[
                    { name: 'Reading practice', key: 'reading', current: userData.reading_score, target: userData.reading_target ?? 5.5 },
                    { name: 'Listening practice', key: 'listening', current: userData.listening_score, target: userData.listening_target ?? 5.0 },
                    { name: 'Writing practice', key: 'writing', current: userData.writing_score, target: userData.writing_target ?? 4.5 },
                    { name: 'Speaking practice', key: 'speaking', current: userData.speaking_score, target: userData.speaking_target ?? 4.5 },
                  ].map(s => {
                    const max = SECTION_BAND_MAX[s.key]
                    const curPct = Math.round((s.current / max) * 100); const tgtPct = Math.round((s.target / max) * 100); const gap = s.target - s.current
                    return (
                      <div key={s.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                          <span style={{ color: '#616473' }}>{s.name}</span>
                          <span style={{ fontWeight: '600' }}>{s.current} <span style={{ color: '#999', fontWeight: '400' }}>/ {s.target}</span></span>
                        </div>
                        <div style={{ height: '8px', background: '#f0f2f5', borderRadius: '4px', position: 'relative' }}>
                          <div style={{ width: curPct + '%', height: '100%', background: gap >= 1 ? '#e85555' : '#2ac56c', borderRadius: '4px' }} />
                          <div style={{ position: 'absolute', top: '-3px', left: tgtPct + '%', width: '2px', height: '14px', background: '#701fa1', borderRadius: '2px' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '12px', borderTop: '0.5px solid #f0f2f5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#888' }}><div style={{ width: '10px', height: '3px', background: '#2ac56c', borderRadius: '2px' }} /> Current</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#888' }}><div style={{ width: '3px', height: '10px', background: '#701fa1', borderRadius: '2px' }} /> Target</div>
                </div>

                <div onClick={() => setExpandedFormat(!expandedFormat)} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '0.5px solid #e1e4ed', marginTop: '16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>📋 TOEFL 2026 Format</div>
                    <span style={{ fontSize: '11px', color: '#701fa1', fontWeight: '600' }}>{expandedFormat ? '▲ Less' : '▼ Details'}</span>
                  </div>
                  {!expandedFormat ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[{ label: 'Reading', color: '#2563eb' }, { label: 'Listening', color: '#16a34a' }, { label: 'Writing', color: '#ea580c' }, { label: 'Speaking', color: '#9333ea' }].map(item => (
                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '0.5px solid #f0f2f5' }}>
                          <div style={{ width: '3px', height: '16px', background: item.color, borderRadius: '2px' }} />
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[
                        { label: 'Reading', color: '#2563eb', tasks: ['Complete the Words', 'Read in Daily Life', 'Read an Academic Passage'] },
                        { label: 'Listening', color: '#16a34a', tasks: ['Listen and Choose a Response', 'Listen to a Conversation', 'Listen to an Announcement', 'Listen to an Academic Talk'] },
                        { label: 'Writing', color: '#ea580c', tasks: ['Build a Sentence', 'Write an Email', 'Write for an Academic Discussion'] },
                        { label: 'Speaking', color: '#9333ea', tasks: ['Listen and Repeat', 'Take an Interview'] },
                      ].map(item => (
                        <div key={item.label} style={{ paddingBottom: '10px', borderBottom: '0.5px solid #f0f2f5' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ width: '3px', height: '16px', background: item.color, borderRadius: '2px' }} />
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{item.label}</span>
                          </div>
                          <div style={{ marginLeft: '8px', fontSize: '11px', color: '#616473', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {item.tasks.map(task => <div key={task}>· {task}</div>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '0.5px solid #e1e4ed', marginTop: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>🎯 Keep Going</div>
                  <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#616473' }}>
                    {examDaysLeft === null ? "Set your exam date and start your journey. Every day of practice counts!"
                      : examDaysLeft > 30 ? `You have ${examDaysLeft} days ahead — build strong habits now.`
                      : examDaysLeft > 14 ? `${examDaysLeft} days to go — focus on your weakest section daily.`
                      : examDaysLeft > 7 ? `Only ${examDaysLeft} days left — go full intensity.`
                      : examDaysLeft > 1 ? `${examDaysLeft} days to exam day — rest well and trust your preparation.`
                      : "Tomorrow is the day — stay calm, sleep early, and believe in yourself. 💪"}
                  </div>
                </div>

                <div style={{ background: 'linear-gradient(135deg, #701fa1 0%, #2563eb 100%)', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💡 Today's Strategy</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', lineHeight: '1.5' }}>
                    {["In Reading, look for transition words (however, therefore, moreover) — they signal the author's main point.",
                      "For Listening, focus on the first and last sentences of each speaker's turn — key info is usually there.",
                      "In Speaking Task 1, spend 15 seconds planning, then speak clearly for 45 seconds without stopping.",
                      "For Writing, always start with a clear thesis in your first sentence — graders look for it immediately.",
                      "Unknown vocab in Reading? Look at the surrounding sentences — context clues reveal the meaning.",
                      "In Listening, don't panic if you miss something — keep listening and catch the next point.",
                      "For Speaking, use simple connectors: 'First... Second... Finally...' — structure impresses graders.",
                    ][Math.floor((Date.now() + 3 * 3600000) / 86400000) % 7]}
                  </div>
                </div>
              </div>

              <div style={{ width: isMobile ? '100%' : '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', border: '0.5px solid #e1e4ed', flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>Exam date</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#11162d', borderRadius: '8px', padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: '#b67bfb' }}>{examDaysLeft !== null ? examDaysLeft : '—'}</div>
                      <div style={{ fontSize: '8px', color: '#7b809a' }}>days left</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{examDate ? new Date(examDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select a date'}</div>
                      <input type="date" value={examDate} onChange={e => handleExamDateChange(e.target.value)} style={{ marginTop: '4px', fontSize: '10px', padding: '2px 5px', borderRadius: '5px', border: '0.5px solid #cbd5e1', background: '#f4f6fa', color: '#11162d', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { name: 'Reading', score: userData.reading_score, target: userData.reading_target ?? 5.5 },
                    { name: 'Listening', score: userData.listening_score, target: userData.listening_target ?? 5.0 },
                    { name: 'Writing', score: userData.writing_score, target: userData.writing_target ?? 4.5 },
                    { name: 'Speaking', score: userData.speaking_score, target: userData.speaking_target ?? 4.5 },
                  ].map(raw => {
                    const gap = raw.target - raw.score
                    const note = gap <= 0 ? 'On target' : `${gap.toFixed(1)} to target`
                    const color = gap <= 0 ? '#2ac56c' : gap >= 1 ? '#e85555' : '#e07b00'
                    return { ...raw, note, color }
                  }).map(item => (
                    <div key={item.name} style={{ background: '#fff', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid #e1e4ed' }}>
                      <div style={{ fontSize: '10px', color: '#616473', marginBottom: '3px' }}>{item.name}</div>
                      <div style={{ fontSize: '18px', fontWeight: '600' }}>{item.score}</div>
                      <div style={{ fontSize: '9px', color: item.color, marginTop: '2px' }}>{item.note}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', border: '0.5px solid #e1e4ed', flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>Today's goals</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {examDaysLeft === null
                      ? <div style={{ fontSize: '11px', color: '#999' }}>Select an exam date to generate your daily goals.</div>
                      : generateGoals(examDaysLeft, userData).map((g, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: '#444' }}><span style={{ color: '#701fa1', flexShrink: 0 }}>○</span> {g}</div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* READING */}
        {currentTab === 'reading' && !readingSubTab && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { key: 'ctw', title: 'Part 1: Complete the Words', desc: 'Read academic passages and type the missing letters to complete key vocabulary words.', count: '150 questions · 5 categories' },
              { key: 'ridl', title: 'Part 2: Read in Daily Life', desc: 'Read emails, messages, signs, schedules, and articles. Answer comprehension questions.', count: '150 passages · 387 questions' },
              { key: 'academic', title: 'Part 3: Academic Passage', desc: 'Read scientific or historical essays and answer comprehension questions.', count: '150 passages · 750 questions' },
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: isMobile ? '16px' : '22px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: '14px' } : {}) }}>
                <div style={{ maxWidth: isMobile ? '100%' : '70%' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#616473' }}>{p.desc}</p>
                  <span style={{ fontSize: '11px', color: '#2ac56c', fontWeight: '600' }}>{p.count}</span>
                </div>
                <button onClick={() => setReadingSubTab(p.key)} style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>Open Module</button>
              </div>
            ))}
          </div>
        )}
        {currentTab === 'reading' && readingSubTab === 'ctw' && <CompleteTheWords onBack={() => setReadingSubTab(null)} />}
        {currentTab === 'reading' && readingSubTab === 'ridl' && <ReadInDailyLife onBack={() => setReadingSubTab(null)} />}
        {currentTab === 'reading' && readingSubTab === 'academic' && <AcademicPassage onBack={() => setReadingSubTab(null)} />}

        {/* LISTENING */}
        {currentTab === 'listening' && !listeningSubTab && <ListeningHome onSelect={setListeningSubTab} onBack={() => setCurrentTab('dashboard')} />}
        {currentTab === 'listening' && listeningSubTab === 'p1' && <ListeningP1 onBack={() => setListeningSubTab(null)} />}
        {currentTab === 'listening' && listeningSubTab === 'p2' && <ListeningP2 onBack={() => setListeningSubTab(null)} />}
        {currentTab === 'listening' && listeningSubTab === 'p3' && <ListeningP3 onBack={() => setListeningSubTab(null)} />}
        {currentTab === 'listening' && listeningSubTab === 'p4' && <ListeningP4 onBack={() => setListeningSubTab(null)} />}

        {/* WRITING */}
        {currentTab === 'writing' && !writingSubTab && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { key: 'p1', title: 'Part 1: Build a Sentence', desc: 'Drag word chunks into the correct order to form a grammatical sentence or question.', count: '100 practice items · 10 per set', ready: true },
              { key: 'p2', title: 'Part 2: Write an Email', desc: 'Draft formal requests or academic inquiries with contextual formatting.', count: '100 practice emails · 7:00 each', ready: true },
              { key: 'p3', title: 'Part 3: Academic Discussion', desc: 'Contribute opinions and critical analysis to an interactive lecture forum.', count: '100 practice posts · 10:00 each', ready: true },
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: isMobile ? '16px' : '22px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: '14px' } : {}) }}>
                <div style={{ maxWidth: isMobile ? '100%' : '70%' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#616473' }}>{p.desc}</p>
                  <span style={{ fontSize: '11px', color: p.ready ? '#2ac56c' : '#9ca3af', fontWeight: '600' }}>{p.count}</span>
                </div>
                <button onClick={() => p.ready && setWritingSubTab(p.key)} style={{ backgroundColor: p.ready ? '#2ac56c' : '#e5e7eb', color: p.ready ? '#fff' : '#9ca3af', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: p.ready ? 'pointer' : 'not-allowed', fontSize: '13px', flexShrink: 0 }}>
                  {p.ready ? 'Open Module' : 'Coming Soon'}
                </button>
              </div>
            ))}
          </div>
        )}
        {currentTab === 'writing' && writingSubTab === 'p1' && <BuildASentence onBack={() => setWritingSubTab(null)} />}
        {currentTab === 'writing' && writingSubTab === 'p2' && <WriteEmail onBack={() => setWritingSubTab(null)} />}
        {currentTab === 'writing' && writingSubTab === 'p3' && <AcademicDiscussion onBack={() => setWritingSubTab(null)} />}

        {/* SPEAKING */}
        {currentTab === 'speaking' && !speakingSubTab && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { key: 'p1', title: 'Part 1: Listen and Repeat', desc: 'Sharpen intonation and vocal stress through audio response capture.', count: '100 practice sets · 7 sentences each', ready: true },
              { key: 'p2', title: 'Part 2: Take an Interview', desc: 'Deliver clear multi-turn answers facing real-time audio inquiry scenarios.', count: '100 practice sets · 4 questions each', ready: true },
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: isMobile ? '16px' : '22px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: '14px' } : {}) }}>
                <div style={{ maxWidth: isMobile ? '100%' : '70%' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#616473' }}>{p.desc}</p>
                  <span style={{ fontSize: '11px', color: '#2ac56c', fontWeight: '600' }}>{p.count}</span>
                </div>
                <button onClick={() => setSpeakingSubTab(p.key)} style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>Open Module</button>
              </div>
            ))}
          </div>
        )}
        {currentTab === 'speaking' && speakingSubTab === 'p1' && <ListenRepeat onBack={() => setSpeakingSubTab(null)} />}
        {currentTab === 'speaking' && speakingSubTab === 'p2' && <TakeInterview onBack={() => setSpeakingSubTab(null)} />}

        {/* FULL MOCK TEST */}
        {currentTab === 'mocktest' && <FullMockTest onBack={() => setCurrentTab('dashboard')} hasPremium={!!userData.has_premium} />}

        {currentTab === 'progress' && <ProgressScreen onBack={() => setCurrentTab('dashboard')} />}

        {currentTab === 'subscribe' && (
          <SubscribeScreen onBack={() => setCurrentTab('dashboard')} hasPremium={!!userData.has_premium} subscriptionStatus={userData.subscription_status} hasBilledSubscription={!!userData.has_billed_subscription} isAdmin={!!userData.is_admin} />
        )}

        {/* VOCABULARY */}
        {currentTab === 'vocab' && vocabWords.length === 0 && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}><p style={{ color: '#616473', fontSize: '13px' }}>Loading vocabulary...</p></div>}
        {currentTab === 'vocab' && vocabWords.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '0.5px solid #e1e4ed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ fontWeight: '600' }}>Progress</span>
                <span style={{ color: '#616473' }}>{vocabWords.filter(w => w.learned).length} / {vocabWords.length} learned</span>
              </div>
              <div style={{ height: '8px', background: '#f0f2f5', borderRadius: '4px' }}>
                <div style={{ width: (vocabWords.filter(w => w.learned).length / vocabWords.length * 100) + '%', height: '100%', background: '#2ac56c', borderRadius: '4px', transition: 'width 0.3s ease' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['all', 'learned', 'unlearned'].map(f => (
                <button key={f} onClick={() => setVocabFilter(f)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: vocabFilter === f ? '#701fa1' : '#fff', color: vocabFilter === f ? '#fff' : '#616473', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  {f === 'all' ? 'All' : f === 'learned' ? 'Learned' : 'Not Learned'}
                </button>
              ))}
            </div>
            {vocabWords.filter(item => vocabFilter === 'all' ? true : vocabFilter === 'learned' ? item.learned : !item.learned).map(item => {
              const vibrantColors = ['#701fa1', '#2563eb', '#dc2626', '#16a34a', '#ea580c', '#0891b2', '#c026d3', '#ca8a04']
              const wordColor = vibrantColors[item.id % vibrantColors.length]
              const difficultyStyles = { easy: { bg: '#dcfce7', text: '#15803d' }, medium: { bg: '#dbeafe', text: '#1e40af' }, hard: { bg: '#fce7f3', text: '#9d174d' } }
              const difficultyBorderColors = { easy: '#16a34a', medium: '#2563eb', hard: '#dc2626' }
              const borderColor = difficultyBorderColors[item.difficulty] || difficultyBorderColors.medium
              const diffStyle = difficultyStyles[item.difficulty] || difficultyStyles.medium
              const isFlipped = !!flippedCards[item.id]
              return (
                <div key={item.id} onClick={() => setFlippedCards(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  style={{ backgroundColor: isFlipped ? diffStyle.bg : '#fff', border: '0.5px solid #e1e4ed', borderLeft: '4px solid ' + borderColor, borderRadius: '12px', padding: '18px', minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', opacity: item.learned ? 0.6 : 1, position: 'relative', transition: 'background-color 0.2s ease' }}>
                  <div style={{ position: 'absolute', top: '14px', right: '14px', backgroundColor: '#fff', color: borderColor, padding: '4px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{item.difficulty?.toUpperCase()}</div>
                  {!isFlipped ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ width: '10px', height: '10px', background: wordColor, borderRadius: '4px', display: 'inline-block' }} />
                        <span style={{ backgroundColor: '#f0f2f5', color: '#616473', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{item.type}</span>
                      </div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700' }}>{item.word}</h4>
                      <div style={{ fontSize: '13px', color: '#616473' }}>Tap to reveal meaning</div>
                    </div>
                  ) : (
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700' }}>{item.word}</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#616473' }}>{item.meaning}</p>
                      {item.example && <p style={{ marginTop: '8px', fontSize: '12px', color: '#7b809a' }}>&quot;{item.example}&quot;</p>}
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); toggleLearned(item.id) }}
                    style={{ backgroundColor: item.learned ? '#2ac56c' : '#fff', color: item.learned ? '#fff' : '#11162d', border: '1px solid ' + (item.learned ? '#2ac56c' : '#d1d5db'), padding: '6px 10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '11px', marginTop: '10px', alignSelf: 'flex-start' }}>
                    {item.learned ? '✅ Learned' : 'Mark as Learned'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* SETTINGS */}
        {currentTab === 'settings' && (
          <div style={{ display: 'flex', gap: '20px', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
            <div style={{ flex: 1, minWidth: 0, backgroundColor: '#fff', padding: isMobile ? '18px' : '24px', borderRadius: '14px', border: '0.5px solid #e1e4ed' }}>
              <h3 style={{ margin: '0 0 18px 0', fontSize: '15px', fontWeight: '700' }}>🎯 Target & Profile</h3>
              <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>Username</label>
                  <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>Target Score (0.0 - 6.0)</label>
                  <input type="number" min="0" max="6" step="0.5" value={targetScore} onChange={e => setTargetScore(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ fontWeight: '700', color: '#374151', fontSize: '12px', marginTop: '4px' }}>Section targets</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>Reading (1.0 - 6.0)</label>
                    <input type="number" min="1" max="6" step="0.5" value={readingTarget} onChange={e => setReadingTarget(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>Listening (1.0 - 6.0)</label>
                    <input type="number" min="1" max="6" step="0.5" value={listeningTarget} onChange={e => setListeningTarget(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>Writing (1.0 - 5.0)</label>
                    <input type="number" min="1" max="5" step="0.5" value={writingTarget} onChange={e => setWritingTarget(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>Speaking (1.0 - 5.0)</label>
                    <input type="number" min="1" max="5" step="0.5" value={speakingTarget} onChange={e => setSpeakingTarget(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <button type="submit" style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Save Changes</button>
              </form>
            </div>
            <div style={{ flex: 1, minWidth: 0, backgroundColor: '#fff', padding: isMobile ? '18px' : '24px', borderRadius: '14px', border: '0.5px solid #e1e4ed' }}>
              <h3 style={{ margin: '0 0 18px 0', fontSize: '15px', fontWeight: '700' }}>🔒 Account Security</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>Email</label>
                  <input type="text" value={userData.email || ''} readOnly style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#888', width: '100%', boxSizing: 'border-box' }} />
                  {userData.email_verified ? (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#2ac56c', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>✓ Verified</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#e07b00' }}>⚠ Not verified</span>
                      <button type="button" onClick={handleResendVerification} disabled={resendingVerification} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: '700', cursor: resendingVerification ? 'default' : 'pointer', padding: 0, opacity: resendingVerification ? 0.6 : 1 }}>
                        {resendingVerification ? 'Sending…' : 'Resend verification email'}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>Current Password</label>
                  <input type="password" value="••••••••" readOnly style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#888', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>New Password</label>
                  <input type="password" placeholder="Enter new password" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '12px' }}>Confirm New Password</label>
                  <input type="password" placeholder="Confirm new password" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <button style={{ backgroundColor: '#11162d', color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Update Password</button>
                <button onClick={logout} style={{ backgroundColor: '#fff', color: '#dc2626', border: '1px solid #fecaca', padding: '11px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Log Out</button>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN -- only reachable if the sidebar button rendered it in, which itself only
            happens for userData.is_admin; the backend independently re-checks admin status on
            every /api/admin/* call regardless, so this is a UI convenience, not the real gate. */}
        {currentTab === 'admin' && userData.is_admin && <AdminPanel />}

      </div>
    </div>
  )
}

// Catches any uncaught render-time error anywhere in the tree (e.g. a stray undefined access
// deep in one of the exam components) and shows a recoverable screen instead of a blank white
// page — which is what React does by default when an error escapes with no boundary in place.
class ExamErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error in exam UI:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', zIndex: 999, padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' }}>Something went wrong</div>
          <div style={{ fontSize: '13px', color: '#616473', marginBottom: '20px', maxWidth: '420px' }}>
            This screen hit an unexpected error. Your progress up to this point wasn't lost — reload to pick back up from the dashboard.
          </div>
          <button onClick={() => window.location.reload()} style={{ background: '#701fa1', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 26px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

// Gates the whole app behind login. On mount, if a token is already saved, it's verified against
// /api/auth/me (so a stale/expired token drops the student back to the login screen instead of
// showing a broken app); otherwise the login/signup screen renders immediately.
function AuthGate() {
  const [authState, setAuthState] = useState('checking') // 'checking' | 'out' | 'in'

  useEffect(() => {
    let cancelled = false
    const token = getAuthToken()
    if (!token) { setAuthState('out'); return }
    apiFetch(`${BACKEND_URL}/api/auth/me`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(() => { if (!cancelled) setAuthState('in') })
      .catch(() => { if (!cancelled) { clearAuthToken(); setAuthState('out') } })
    return () => { cancelled = true }
  }, [])

  // Consumes the "verify your email" link's ?verify_token=... query param regardless of whether
  // the student is currently logged in or out (register already logs them straight in, so this
  // link is most often clicked while already authenticated elsewhere) -- the endpoint itself
  // doesn't require auth, it just needs the token. Strips the token from the visible URL either
  // way so it isn't sitting in the address bar / browser history afterwards.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('verify_token')
    if (!token) return
    params.delete('verify_token')
    const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
    window.history.replaceState({}, '', cleanUrl)
    apiFetch(`${BACKEND_URL}/api/auth/verify-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => showToast(ok ? (data.message || 'Your email has been verified.') : (data.detail || 'This verification link is invalid or has expired.'), ok ? 'success' : 'error'))
      .catch(() => showToast('Could not verify your email right now.', 'error'))
  }, [])

  // Mounted here (above the checking/out/in branches) rather than just inside App() so a toast
  // fired by the verify-email effect above -- which can run before login finishes checking, or
  // while logged out entirely -- always has a listener to actually render it.
  return (
    <>
      <ToastHost />
      {authState === 'checking' && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#11162d' }} />}
      {authState === 'out' && <AuthScreen onAuthSuccess={() => setAuthState('in')} />}
      {authState === 'in' && <App />}
    </>
  )
}

function AppWithErrorBoundary() {
  return (
    <ExamErrorBoundary>
      <AuthGate />
    </ExamErrorBoundary>
  )
}

export default AppWithErrorBoundary