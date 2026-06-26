import { useEffect, useState, useRef } from 'react'

// ─── Complete the Words Module ────────────────────────────────────────────────
const QUESTION_TIME = 180 // 3 minutes per question

function CompleteTheWords({ onBack }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [checked, setChecked] = useState(false)
  const [finished, setFinished] = useState(false)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME)
  const inputRefs = useRef({})
  const timerRef = useRef(null)
  const answersRef = useRef({})
  const exercisesRef = useRef([])
  const currentIndexRef = useRef(0)
  const checkedRef = useRef(false)

  // keep refs in sync
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { exercisesRef.current = exercises }, [exercises])
  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])
  useEffect(() => { checkedRef.current = checked }, [checked])

  useEffect(() => {
    fetch('https://mrreadyprep.onrender.com/api/reading/complete-the-words')
      .then(r => r.json())
      .then(data => { setExercises(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // countdown per question
  useEffect(() => {
    if (loading || finished || checked) return
    setTimeLeft(QUESTION_TIME)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          // auto-submit using refs (no stale closure)
          if (!checkedRef.current) {
            const ex = exercisesRef.current[currentIndexRef.current]
            let correct = 0
            let globalIdx = 0
            ex.blanks.forEach((blank) => {
              const hiddenChars = blank.hidden.split('')
              const isCorrect = hiddenChars.every((ch, i) =>
                (answersRef.current[globalIdx + i] || '').toLowerCase() === ch.toLowerCase()
              )
              if (isCorrect) correct++
              globalIdx += hiddenChars.length
            })
            setTotalCorrect(t => t + correct)
            setChecked(true)
            checkedRef.current = true
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [currentIndex, loading, finished, checked])

  const formatTime = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: '#555', fontSize: '15px' }}>
      Loading exercises...
    </div>
  )
  if (!exercises.length) return (
    <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>
      No exercises found. Make sure the backend is running.
    </div>
  )

  const ex = exercises[currentIndex]
  const totalQ = exercises.length
  const isLowTime = timeLeft <= 30

  const renderParagraph = () => {
    const parts = []
    let remaining = ex.paragraph
    let globalIdx = 0

    ex.blanks.forEach((blank, blankIdx) => {
      const wordPos = remaining.indexOf(blank.word)
      if (wordPos === -1) return

      if (wordPos > 0) parts.push(
        <span key={`text-${blankIdx}`}>{remaining.slice(0, wordPos)}</span>
      )

      const startIdx = globalIdx
      const isBlankCorrect = checked
        ? blank.hidden.split('').every((ch, i) => (answers[startIdx + i] || '').toLowerCase() === ch.toLowerCase())
        : null

      const charInputs = blank.hidden.split('').map((ch, i) => {
        const gIdx = startIdx + i
        const val = answers[gIdx] || ''
        const charCorrect = checked ? val.toLowerCase() === ch.toLowerCase() : null

        return (
          <span key={gIdx} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', width: '11px' }}>
            <input
              ref={el => inputRefs.current[gIdx] = el}
              value={val}
              maxLength={1}
              onChange={e => {
                if (checked) return
                const newVal = e.target.value.slice(-1)
                setAnswers(prev => ({ ...prev, [gIdx]: newVal }))
                if (newVal && inputRefs.current[gIdx + 1]) inputRefs.current[gIdx + 1].focus()
              }}
              onKeyDown={e => {
                if (e.key === 'Backspace' && !val) {
                  if (inputRefs.current[gIdx - 1]) inputRefs.current[gIdx - 1].focus()
                }
                if (e.key === 'Tab') { e.preventDefault(); if (inputRefs.current[gIdx + 1]) inputRefs.current[gIdx + 1].focus() }
              }}
              disabled={checked}
              style={{
                width: '11px',
                height: '14px',
                border: 'none',
                borderBottom: checked
                  ? charCorrect ? '1.5px solid #2a9d5c' : '1.5px solid #d94040'
                  : '1.5px solid #555',
                outline: 'none',
                background: 'transparent',
                textAlign: 'center',
                fontSize: '13px',
                fontFamily: 'Georgia, serif',
                color: checked ? (charCorrect ? '#1a7a44' : '#b03030') : '#1a1a1a',
                padding: 0,
                margin: 0,
                caretColor: '#701fa1',
                cursor: 'text',
                boxSizing: 'border-box',
                lineHeight: '14px',
              }}
            />
          </span>
        )
      })

      globalIdx += blank.hidden.length

      parts.push(
        <span key={`blank-${blankIdx}`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '15px', fontFamily: 'Georgia, serif', color: '#1a1a1a' }}>{blank.visible}</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'flex-end',
              gap: '2px',
              background: checked
                ? isBlankCorrect ? '#edfbf3' : '#fff2f2'
                : '#d6d8db',
              padding: '1px 3px',
              borderRadius: '2px',
              marginLeft: '1px',
              cursor: 'text',
            }}
            onClick={() => {
              const firstEmpty = blank.hidden.split('').findIndex((_, i) => !answers[startIdx + i])
              const focusIdx = firstEmpty === -1 ? startIdx + blank.hidden.length - 1 : startIdx + firstEmpty
              if (inputRefs.current[focusIdx]) inputRefs.current[focusIdx].focus()
            }}
          >
            {charInputs}
          </span>
          {checked && !isBlankCorrect && (
            <span style={{ fontSize: '11px', color: '#2a9d5c', fontWeight: '700', marginLeft: '4px', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
              → {blank.hidden}
            </span>
          )}
        </span>
      )

      remaining = remaining.slice(wordPos + blank.word.length)
    })

    if (remaining) parts.push(<span key="tail">{remaining}</span>)
    return parts
  }

  const handleSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    let correct = 0
    let gIdx = 0
    ex.blanks.forEach((blank) => {
      const ok = blank.hidden.split('').every((ch, i) => (answers[gIdx + i] || '').toLowerCase() === ch.toLowerCase())
      if (ok) correct++
      gIdx += blank.hidden.length
    })
    setTotalCorrect(prev => prev + correct)
    setChecked(true)
  }

  const handleNext = () => {
    if (currentIndex + 1 >= totalQ) {
      setFinished(true)
    } else {
      setCurrentIndex(i => i + 1)
      setAnswers({})
      setChecked(false)
      inputRefs.current = {}
      setTimeout(() => { if (inputRefs.current[0]) inputRefs.current[0].focus() }, 100)
    }
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setAnswers({})
    setChecked(false)
    setFinished(false)
    setTotalCorrect(0)
    inputRefs.current = {}
  }

  // ── Score Screen ──
  if (finished) {
    const maxScore = totalQ * 10
    const pct = Math.round((totalCorrect / maxScore) * 100)
    const grade = pct >= 90 ? { label: 'Excellent!',    color: '#2a9d5c', emoji: '🏆' }
                : pct >= 70 ? { label: 'Good job!',     color: '#701fa1', emoji: '🎉' }
                : pct >= 50 ? { label: 'Keep going',    color: '#e07b00', emoji: '💪' }
                :             { label: 'Practice more', color: '#c0392b', emoji: '📚' }
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#f2f3f5',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 10, fontFamily: 'Georgia, serif',
      }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '48px 56px', textAlign: 'center', maxWidth: '420px', width: '90%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '52px', marginBottom: '12px' }}>{grade.emoji}</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: grade.color, marginBottom: '8px' }}>{grade.label}</div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px', fontFamily: 'sans-serif' }}>You completed all {totalQ} questions</div>
          <div style={{ fontSize: '52px', fontWeight: '800', color: '#1a1a1a', lineHeight: '1', fontFamily: 'sans-serif' }}>
            {totalCorrect}
            <span style={{ fontSize: '20px', color: '#aaa', fontWeight: '400' }}>/{maxScore}</span>
          </div>
          <div style={{ margin: '20px 0 8px', height: '8px', background: '#efefef', borderRadius: '4px' }}>
            <div style={{ width: pct + '%', height: '100%', background: grade.color, borderRadius: '4px', transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ fontSize: '13px', color: '#777', marginBottom: '32px', fontFamily: 'sans-serif' }}>{pct}% correct</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleRestart} style={{ flex: 1, padding: '13px', background: '#2a9d5c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', letterSpacing: '0.5px', fontFamily: 'sans-serif' }}>
              TRY AGAIN
            </button>
            <button onClick={onBack} style={{ flex: 1, padding: '13px', background: '#fff', color: '#333', border: '1px solid #d0d5dd', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', fontFamily: 'sans-serif' }}>
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const questionScore = (() => {
    if (!checked) return null
    let correct = 0
    let gIdx = 0
    ex.blanks.forEach((blank) => {
      const ok = blank.hidden.split('').every((ch, i) => (answers[gIdx + i] || '').toLowerCase() === ch.toLowerCase())
      if (ok) correct++
      gIdx += blank.hidden.length
    })
    return correct
  })()

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#f2f3f5',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Georgia, "Times New Roman", serif',
      zIndex: 10,
      overflowY: 'auto',
    }}>
      {/* Top bar */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e0e0e0',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <button onClick={onBack} style={{
          position: 'absolute', left: '20px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '13px', color: '#888', fontFamily: 'sans-serif',
        }}>
          ← Exit
        </button>

        {/* Timer */}
        <span style={{
          fontSize: '20px',
          fontWeight: '700',
          color: isLowTime ? '#d94040' : '#1a1a1a',
          letterSpacing: '2px',
          fontFamily: 'sans-serif',
          transition: 'color 0.3s',
        }}>
          ⏱ {formatTime(timeLeft)}
        </span>

        <span style={{
          position: 'absolute', right: '24px',
          fontSize: '12px', color: '#888', fontFamily: 'sans-serif',
        }}>
          {currentIndex + 1} / {totalQ}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 120px' }}>

        <h1 style={{
          fontSize: '22px', fontWeight: '700', color: '#1a1a1a',
          textAlign: 'center', margin: '0 0 28px',
          fontFamily: 'Georgia, serif',
          maxWidth: '700px',
        }}>
          Fill in the missing letters in the paragraph
        </h1>

        {/* Passage card */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '36px 44px',
          maxWidth: '700px',
          width: '100%',
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
          boxSizing: 'border-box',
          marginBottom: checked ? '20px' : '32px',
        }}>
          <p style={{
            fontSize: '16px',
            lineHeight: '2.6',
            color: '#1a1a1a',
            margin: 0,
          }}>
            {renderParagraph()}
          </p>
        </div>

        {/* Result feedback */}
        {checked && (
          <div style={{
            maxWidth: '700px', width: '100%',
            background: questionScore === ex.blanks.length ? '#edfbf3' : '#fff8ec',
            border: '1px solid ' + (questionScore === ex.blanks.length ? '#a7e9c3' : '#f5d08a'),
            borderRadius: '10px',
            padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '24px',
            fontFamily: 'sans-serif',
            boxSizing: 'border-box',
          }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: questionScore === ex.blanks.length ? '#1a7a44' : '#c07000' }}>
              {timeLeft === 0 ? '⏱ Time\'s up! ' : ''}{questionScore === ex.blanks.length ? '🎯 Perfect score!' : `${questionScore} / ${ex.blanks.length} correct`}
            </span>
            <span style={{ fontSize: '12px', color: '#888' }}>
              Correct answers in <span style={{ color: '#2a9d5c', fontWeight: '700' }}>green</span>
            </span>
          </div>
        )}

        {/* Button */}
        {!checked ? (
          <button onClick={handleSubmit} style={{
            background: '#2a9d5c',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '16px 56px',
            fontSize: '15px',
            fontWeight: '700',
            letterSpacing: '1.5px',
            cursor: 'pointer',
            fontFamily: 'sans-serif',
            boxShadow: '0 2px 8px rgba(42,157,92,0.25)',
          }}>
            SUBMIT ANSWERS
          </button>
        ) : (
          <button onClick={handleNext} style={{
            background: currentIndex + 1 >= totalQ ? '#701fa1' : '#2a9d5c',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '16px 56px',
            fontSize: '15px',
            fontWeight: '700',
            letterSpacing: '1.5px',
            cursor: 'pointer',
            fontFamily: 'sans-serif',
          }}>
            {currentIndex + 1 >= totalQ ? 'FINISH →' : 'NEXT QUESTION →'}
          </button>
        )}

      </div>
    </div>
  )
}
// ─── Read in Daily Life Module ───────────────────────────────────────────────
const RIDL_TIME = 90 // 90 seconds per question

function ReadInDailyLife({ onBack }) {
  const [passages, setPassages] = useState([])
  const [loading, setLoading] = useState(true)
  const [passageIdx, setPassageIdx] = useState(0)
  const [questionIdx, setQuestionIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [timeLeft, setTimeLeft] = useState(RIDL_TIME)
  const timerRef = useRef(null)
  const totalAnsweredRef = useRef(0)
  const scoreRef = useRef(0)

  useEffect(() => {
    fetch('https://mrreadyprep.onrender.com/api/reading/read-in-daily-life')
      .then(r => r.json())
      .then(data => { setPassages(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Timer per question
  useEffect(() => {
    if (loading || finished || submitted) return
    setTimeLeft(RIDL_TIME)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          handleSubmit(null, true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [passageIdx, questionIdx, loading, finished, submitted])

  const formatTime = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return mm + ':' + ss
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: '#555', fontSize: '15px' }}>
      Loading passages...
    </div>
  )
  if (!passages.length) return (
    <div style={{ padding: '40px', color: '#616473', fontSize: '13px' }}>No passages found.</div>
  )

  const passage = passages[passageIdx]
  const question = passage.questions[questionIdx]
  const totalQuestions = passages.reduce((s, p) => s + p.questions.length, 0)
  const isLowTime = timeLeft <= 20

  // Calculate global question number
  let globalQ = 0
  for (let i = 0; i < passageIdx; i++) globalQ += passages[i].questions.length
  globalQ += questionIdx + 1

  const handleSubmit = (sel, autoSubmit = false) => {
    if (timerRef.current) clearInterval(timerRef.current)
    const answer = sel !== null ? sel : selected
    const correct = answer === question.answer
    if (correct) {
      scoreRef.current += 1
      setScore(s => s + 1)
    }
    totalAnsweredRef.current += 1
    setSubmitted(true)
  }

  const handleNext = () => {
    const nextQIdx = questionIdx + 1
    if (nextQIdx < passage.questions.length) {
      setQuestionIdx(nextQIdx)
      setSelected(null)
      setSubmitted(false)
    } else {
      const nextPIdx = passageIdx + 1
      if (nextPIdx < passages.length) {
        setPassageIdx(nextPIdx)
        setQuestionIdx(0)
        setSelected(null)
        setSubmitted(false)
      } else {
        setFinished(true)
      }
    }
  }

  const handleRestart = () => {
    setPassageIdx(0)
    setQuestionIdx(0)
    setSelected(null)
    setSubmitted(false)
    setFinished(false)
    setScore(0)
    scoreRef.current = 0
    totalAnsweredRef.current = 0
  }

  // Type label
  const typeLabels = {
    email: 'Email', message: 'Message Exchange', sign: 'Sign / Notice',
    poster: 'Poster', receipt: 'Receipt', advertisement: 'Advertisement',
    schedule: 'Schedule / Agenda', article: 'Article'
  }

  // Score Screen
  if (finished) {
    const pct = Math.round((scoreRef.current / totalQuestions) * 100)
    const grade = pct >= 90 ? { label: 'Excellent!', color: '#2a9d5c', emoji: '🏆' }
                : pct >= 70 ? { label: 'Good job!',  color: '#701fa1', emoji: '🎉' }
                : pct >= 50 ? { label: 'Keep going', color: '#e07b00', emoji: '💪' }
                :             { label: 'Practice more', color: '#c0392b', emoji: '📚' }
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontFamily: 'sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '48px 56px', textAlign: 'center', maxWidth: '420px', width: '90%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '52px', marginBottom: '12px' }}>{grade.emoji}</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: grade.color, marginBottom: '8px' }}>{grade.label}</div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>You completed all {totalQuestions} questions</div>
          <div style={{ fontSize: '52px', fontWeight: '800', color: '#1a1a1a', lineHeight: '1' }}>
            {scoreRef.current}<span style={{ fontSize: '20px', color: '#aaa', fontWeight: '400' }}>/{totalQuestions}</span>
          </div>
          <div style={{ margin: '20px 0 8px', height: '8px', background: '#efefef', borderRadius: '4px' }}>
            <div style={{ width: pct + '%', height: '100%', background: grade.color, borderRadius: '4px', transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ fontSize: '13px', color: '#777', marginBottom: '32px' }}>{pct}% correct</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleRestart} style={{ flex: 1, padding: '13px', background: '#2a9d5c', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>TRY AGAIN</button>
            <button onClick={onBack} style={{ flex: 1, padding: '13px', background: '#fff', color: '#333', border: '1px solid #d0d5dd', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Back</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', zIndex: 10 }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#888', padding: '8px 0' }}>← BACK</button>
        <span style={{ fontSize: '18px', fontWeight: '700', color: isLowTime ? '#d94040' : '#1a1a1a', letterSpacing: '2px', transition: 'color 0.3s' }}>
          ⏱ {formatTime(timeLeft)}
        </span>
        <button onClick={handleNext} disabled={!submitted} style={{ background: submitted ? '#2a9d5c' : '#e5e7eb', color: submitted ? '#fff' : '#aaa', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', cursor: submitted ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}>
          NEXT →
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: '3px', background: '#e5e7eb', flexShrink: 0 }}>
        <div style={{ width: (globalQ / totalQuestions * 100) + '%', height: '100%', background: '#701fa1', transition: 'width 0.3s' }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', gap: '20px', padding: '20px 24px', overflow: 'hidden', minHeight: 0 }}>

        {/* Left: Passage */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: '#701fa1', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {passage.instruction}
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: '10px', border: '2px solid #2a9d5c', padding: '20px', overflowY: 'auto', boxSizing: 'border-box' }}>
            {passage.title && (
              <div style={{ fontWeight: '700', fontSize: '14px', textAlign: 'center', marginBottom: '4px', color: '#1a1a1a' }}>{passage.title}</div>
            )}
            {passage.subtitle && (
              <div style={{ fontSize: '12px', textAlign: 'center', color: '#616473', marginBottom: '12px', fontStyle: 'italic' }}>{passage.subtitle}</div>
            )}
            <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#1a1a1a', whiteSpace: 'pre-wrap' }}>{passage.text}</div>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
            {globalQ} / {totalQuestions} · {typeLabels[passage.type] || passage.type}
          </div>
        </div>

        {/* Right: Question */}
        <div style={{ width: '420px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a', lineHeight: '1.5' }}>
            {question.question}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {question.options.map((opt, i) => {
              let bg = '#fff', border = '1px solid #d1d5db', color = '#1a1a1a'
              if (submitted) {
                if (i === question.answer) { bg = '#edfbf3'; border = '2px solid #2a9d5c'; color = '#1a7a44' }
                else if (i === selected && i !== question.answer) { bg = '#fff2f2'; border = '2px solid #d94040'; color = '#b03030' }
              } else if (i === selected) {
                bg = '#f4ecff'; border = '2px solid #701fa1'; color = '#701fa1'
              }
              return (
                <div
                  key={i}
                  onClick={() => { if (!submitted) setSelected(i) }}
                  style={{ background: bg, border, borderRadius: '8px', padding: '12px 16px', cursor: submitted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.15s', boxSizing: 'border-box' }}
                >
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: submitted && i === question.answer ? '2px solid #2a9d5c' : submitted && i === selected ? '2px solid #d94040' : i === selected ? '2px solid #701fa1' : '1.5px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {submitted && i === question.answer && <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2a9d5c', display: 'block' }} />}
                    {!submitted && i === selected && <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#701fa1', display: 'block' }} />}
                  </span>
                  <span style={{ fontSize: '13px', color, lineHeight: '1.4' }}>{opt}</span>
                </div>
              )
            })}
          </div>

          {/* Submit button */}
          {!submitted ? (
            <button
              onClick={() => { if (selected !== null) handleSubmit(selected) }}
              disabled={selected === null}
              style={{ marginTop: 'auto', padding: '13px', background: selected !== null ? '#701fa1' : '#e5e7eb', color: selected !== null ? '#fff' : '#aaa', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: selected !== null ? 'pointer' : 'not-allowed', transition: 'background 0.2s' }}
            >
              SUBMIT
            </button>
          ) : (
            <div style={{ marginTop: 'auto', padding: '12px 16px', background: selected === question.answer ? '#edfbf3' : '#fff8ec', border: '1px solid ' + (selected === question.answer ? '#a7e9c3' : '#f5d08a'), borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: selected === question.answer ? '#1a7a44' : '#c07000' }}>
              {selected === null ? "⏱ Time's up!" : selected === question.answer ? '🎯 Correct!' : '❌ Incorrect'}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [userData, setUserData] = useState(null)
  const [currentTab, setCurrentTab] = useState('dashboard')
  const [profileName, setProfileName] = useState('')
  const [targetScore, setTargetScore] = useState(5.5)
  const [examDate, setExamDate] = useState('')
  const [vocabWords, setVocabWords] = useState([])
  const [vocabFilter, setVocabFilter] = useState('all')
  const [flippedCards, setFlippedCards] = useState({})
  const [expandedFormat, setExpandedFormat] = useState(false)
  const [readingSubTab, setReadingSubTab] = useState(null)  // null | 'ctw' | 'ridl'

  const getExamDaysLeft = () => {
    if (!examDate) return null
    const today = new Date(); today.setHours(0,0,0,0)
    const exam = new Date(examDate + 'T00:00:00'); exam.setHours(0,0,0,0)
    const diff = Math.round((exam - today) / 86400000)
    return diff < 0 ? null : diff
  }

  const generateGoals = (daysLeft, data) => {
    const sections = [
      { name: 'Reading practice',   gap: 5.5 - data.reading_score },
      { name: 'Listening practice', gap: 5.0 - data.listening_score },
      { name: 'Writing practice',   gap: 5.0 - data.writing_score },
      { name: 'Speaking practice',  gap: 5.0 - data.speaking_score },
    ].filter(s => s.gap > 0).sort((a, b) => b.gap - a.gap)
    const goals = []
    const today = new Date().getDate()
    sections.forEach((s, i) => {
      if (daysLeft > 60) {
        goals.push(`Practice ${s.name} (gap: ${s.gap.toFixed(1)})`)
      } else if (daysLeft > 30) {
        goals.push(s.gap >= 1.0 ? `Do 2 ${s.name} sessions — urgent` : `Do 1 ${s.name} session`)
      } else if (daysLeft > 14) {
        if (s.gap >= 0.5) goals.push(`Full ${s.name} mock test`)
      } else {
        if (s.gap >= 1.0) {
          goals.push(`${s.name}: full focus session — biggest gap (${s.gap.toFixed(1)})`)
        } else if (s.gap >= 0.5 && i === today % sections.length) {
          goals.push(`${s.name}: quick review — exam soon`)
        }
      }
    })
    if (daysLeft <= 60) goals.push('Review 10 vocabulary words')
    if (daysLeft <= 30) goals.push('Take a full timed practice test')
    if (daysLeft <= 1)  goals.push('Rest, review notes, sleep early')
    return goals.slice(0, 5)
  }

  const fetchVocabData = () => {
    fetch('https://mrreadyprep.onrender.com/api/vocab')
      .then(res => res.json())
      .then(data => setVocabWords(data))
      .catch(err => console.error(err))
  }

  const toggleLearned = (id) => {
    fetch('https://mrreadyprep.onrender.com/api/vocab/toggle/' + id, { method: 'POST' })
      .then(res => res.json())
      .then(() => {
        setVocabWords(prev => prev.map(item =>
          item.id === id ? { ...item, learned: !item.learned } : item
        ))
        fetchDashboardData()
      })
      .catch(err => console.error(err))
  }

  const fetchDashboardData = () => {
    fetch('https://mrreadyprep.onrender.com/api/dashboard')
      .then(res => res.json())
      .then(data => { setUserData(data); setProfileName(data.username); setTargetScore(data.target_score) })
      .catch(err => console.error(err))
  }

  useEffect(() => { fetchDashboardData(); fetchVocabData() }, [])

  const handleProfileSave = (e) => {
    e.preventDefault()
    fetch('https://mrreadyprep.onrender.com/api/profile/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: profileName, target_score: Number(targetScore) }),
    }).then(res => res.json()).then(data => { if (data.status === "success") { alert("Saved!"); fetchDashboardData() } })
  }

  if (!userData) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h2>Loading mrreadyprep...</h2>
    </div>
  )

  const examDaysLeft = getExamDaysLeft()
  const streakDays = [true, true, true, true, true, false, false]
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const sb = (tab, icon, label) => (
    <button onClick={() => { setCurrentTab(tab); setReadingSubTab(null) }} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: '500', backgroundColor: currentTab === tab ? '#701fa1' : 'transparent', color: currentTab === tab ? '#fff' : '#a0a3b1', display: 'flex', alignItems: 'center', gap: '10px' }}>
      {icon} {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', fontFamily: 'sans-serif', backgroundColor: '#f4f6fa', overflow: 'hidden', boxSizing: 'border-box' }}>

      {/* SIDEBAR */}
      <div style={{ width: '200px', flexShrink: 0, backgroundColor: '#11162d', padding: '20px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div>
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ color: '#b67bfb', fontSize: '17px', fontWeight: '600' }}>mrreadyprep</div>
            <div style={{ fontSize: '9px', color: '#7b809a', letterSpacing: '1px' }}>TOEFL IBT PREP</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {sb('dashboard', '📊', 'Dashboard')}
            {sb('reading',   '📖', 'Reading')}
            {sb('listening', '🎧', 'Listening')}
            {sb('writing',   '✍️', 'Writing')}
            {sb('speaking',  '🎙️', 'Speaking')}
            {sb('vocab',     '📚', 'Vocabulary')}
          </div>
        </div>
        <div onClick={() => setCurrentTab('settings')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 4px', borderTop: '1px solid #252a44' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#2ac56c', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', color: '#fff', fontSize: '12px' }}>M</div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#fff' }}>mehmetdisbudak</div>
            <div style={{ fontSize: '10px', color: '#7b809a' }}>⚙️ Settings</div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, padding: '16px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>

        {currentTab !== 'dashboard' && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <span
              onClick={() => {
                if (readingSubTab) { setReadingSubTab(null) }
                else { setCurrentTab('dashboard') }
              }}
              style={{ fontSize: '13px', fontWeight: '600', color: '#9047f5', cursor: 'pointer' }}>
              ← Back
            </span>
            <h2 style={{ margin: '0 0 0 14px', fontSize: '18px', fontWeight: '700' }}>
              {currentTab === 'reading' && !readingSubTab && '📖 Reading Practice'}
              {currentTab === 'reading' && readingSubTab === 'ctw' && '📖 Complete the Words'}
              {currentTab === 'reading' && readingSubTab === 'ridl' && '📖 Read in Daily Life'}
              {currentTab === 'listening' && '🎧 Listening Practice'}
              {currentTab === 'writing' && '✍️ Writing Practice'}
              {currentTab === 'speaking' && '🎙️ Speaking Practice'}
              {currentTab === 'vocab' && '📚 Vocabulary'}
              {currentTab === 'settings' && '⚙️ Settings'}
            </h2>
          </div>
        )}

        {/* DASHBOARD */}
        {currentTab === 'dashboard' && (
          <>
            {/* ÜST BANT: Streak + Mock Test */}
            <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>

              {/* Streak */}
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

              {/* Mock Test */}
              <div style={{ background: '#701fa1', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', minWidth: '240px', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#d4a0f5', marginBottom: '2px' }}>Full mock test</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>All 4 sections · ~90 min</div>
                  <div style={{ fontSize: '10px', color: '#c084fc', marginTop: '3px' }}>Last taken: 3 days ago</div>
                </div>
                <button onClick={() => alert('Mock test başlatılıyor!')} style={{ marginLeft: 'auto', background: '#fff', color: '#701fa1', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Start test</button>
              </div>
            </div>

            {/* ALT: Scores + Sağ Kolon */}
            <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {/* Sol: Scores */}
              <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: '12px', padding: '16px', border: '0.5px solid #e1e4ed', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '14px' }}>Section scores vs targets</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                  {[
                    { name: 'Reading practice',   current: userData.reading_score,   target: 5.5 },
                    { name: 'Listening practice', current: userData.listening_score, target: 5.0 },
                    { name: 'Writing practice',   current: userData.writing_score,   target: 5.0 },
                    { name: 'Speaking practice',  current: userData.speaking_score,  target: 5.0 },
                  ].map(s => {
                    const curPct = Math.round((s.current / 6) * 100)
                    const tgtPct = Math.round((s.target / 6) * 100)
                    const gap = s.target - s.current
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

                {/* TOEFL 2026 Format Card */}
                <div onClick={() => setExpandedFormat(!expandedFormat)} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '0.5px solid #e1e4ed', marginTop: '16px', cursor: 'pointer', transition: 'all 0.3s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>📋 TOEFL 2026 Format</div>
                    <span style={{ fontSize: '11px', color: '#701fa1', fontWeight: '600' }}>{expandedFormat ? '▲ Less' : '▼ Details'}</span>
                  </div>
                  {!expandedFormat ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { label: 'Reading', color: '#2563eb' },
                        { label: 'Listening', color: '#16a34a' },
                        { label: 'Writing', color: '#ea580c' },
                        { label: 'Speaking', color: '#9333ea' },
                      ].map(item => (
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
                            {item.tasks.map(task => (
                              <div key={task}>· {task}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid #e1e4ed', fontSize: '11px', fontWeight: '600', color: '#616473', textAlign: 'center' }}>
                    Score: 1–6 (bands of 0.5)
                  </div>
                </div>

                {/* Motivasyon */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '0.5px solid #e1e4ed', marginTop: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>🎯 Keep Going</div>
                  <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#616473' }}>
                    {examDaysLeft === null
                      ? "Set your exam date and start your journey. Every day of practice counts!"
                      : examDaysLeft > 30
                      ? `You have ${examDaysLeft} days ahead — build strong habits now. Consistency beats cramming every time.`
                      : examDaysLeft > 14
                      ? `${examDaysLeft} days to go — you're in the final stretch. Focus on your weakest section daily.`
                      : examDaysLeft > 7
                      ? `Only ${examDaysLeft} days left — go full intensity. Mock tests every day from here.`
                      : examDaysLeft > 1
                      ? `${examDaysLeft} days to exam day — review your notes, rest well, and trust your preparation.`
                      : "Tomorrow is the day — you've put in the work. Stay calm, sleep early, and believe in yourself. 💪"}
                  </div>
                </div>

                {/* Günlük TOEFL Stratejisi */}
                <div style={{ background: 'linear-gradient(135deg, #701fa1 0%, #2563eb 100%)', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    💡 Today's Strategy
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', lineHeight: '1.5' }}>
                    {[
                      "In Reading, look for transition words (however, therefore, moreover) — they signal the author's main point.",
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

              {/* Sağ Kolon */}
              <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>

                {/* Exam date */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', border: '0.5px solid #e1e4ed', flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>Exam date</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#11162d', borderRadius: '8px', padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: '#b67bfb' }}>{examDaysLeft !== null ? examDaysLeft : '—'}</div>
                      <div style={{ fontSize: '8px', color: '#7b809a' }}>days left</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {examDate ? new Date(examDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select a date'}
                      </div>
                      <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={{ marginTop: '4px', fontSize: '10px', padding: '2px 5px', borderRadius: '5px', border: '0.5px solid #cbd5e1', background: '#f4f6fa', color: '#11162d', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>

                {/* Score cards 2x2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { name: 'Reading',   score: userData.reading_score,   note: '+0.5 this week', color: '#2ac56c' },
                    { name: 'Listening', score: userData.listening_score, note: '+0.5 this week', color: '#2ac56c' },
                    { name: 'Writing',   score: userData.writing_score,   note: 'No change',      color: '#999' },
                    { name: 'Speaking',  score: userData.speaking_score,  note: 'Needs focus',    color: '#e85555' },
                  ].map(item => (
                    <div key={item.name} style={{ background: '#fff', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid #e1e4ed' }}>
                      <div style={{ fontSize: '10px', color: '#616473', marginBottom: '3px' }}>{item.name}</div>
                      <div style={{ fontSize: '18px', fontWeight: '600' }}>{item.score}</div>
                      <div style={{ fontSize: '9px', color: item.color, marginTop: '2px' }}>{item.note}</div>
                    </div>
                  ))}
                </div>

                {/* Goals */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', border: '0.5px solid #e1e4ed', flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>Today's goals</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {examDaysLeft === null ? (
                      <div style={{ fontSize: '11px', color: '#999' }}>Select an exam date to generate your daily goals.</div>
                    ) : generateGoals(examDaysLeft, userData).map((g, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: '#444' }}>
                        <span style={{ color: '#701fa1', flexShrink: 0 }}>○</span> {g}
                      </div>
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
              {
                key: 'ctw',
                title: 'Part 1: Complete the Words',
                desc: 'Read academic passages and type the missing letters to complete key vocabulary words.',
                count: '50 questions · 5 categories',
                color: '#701fa1',
              },
              {
                key: 'ridl',
                title: 'Part 2: Read in Daily Life',
                desc: 'Read emails, messages, signs, schedules, and articles. Answer comprehension questions.',
                count: '48 passages · 124 questions',
                color: '#701fa1',
              },
              {
                key: null,
                title: 'Part 3: Academic Passage',
                desc: 'Read scientific or historical essays and answer comprehension queries.',
                count: 'Coming soon',
                color: '#9ca3af',
              },
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: '22px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '70%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#616473' }}>{p.desc}</p>
                  <span style={{ fontSize: '11px', color: p.key ? '#701fa1' : '#9ca3af', fontWeight: '600' }}>{p.count}</span>
                </div>
                <button
                  onClick={() => p.key && setReadingSubTab(p.key)}
                  style={{
                    backgroundColor: p.key ? '#701fa1' : '#e5e7eb',
                    color: p.key ? '#fff' : '#9ca3af',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: p.key ? 'pointer' : 'not-allowed',
                    fontSize: '13px',
                    flexShrink: 0,
                  }}>
                  {p.key ? 'Open Module' : 'Coming Soon'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* READING → Complete the Words */}
        {currentTab === 'reading' && readingSubTab === 'ctw' && (
          <CompleteTheWords onBack={() => setReadingSubTab(null)} />
        )}

        {/* READING → Read in Daily Life */}
        {currentTab === 'reading' && readingSubTab === 'ridl' && (
          <ReadInDailyLife onBack={() => setReadingSubTab(null)} />
        )}

        {/* LISTENING */}
        {currentTab === 'listening' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {["Part 1: Choose a Response", "Part 2: Conversation", "Part 3: Announcement", "Part 4: Academic Talk"].map((title, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: '22px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>{title}</h4>
                <button style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>Open Module</button>
              </div>
            ))}
          </div>
        )}

        {/* WRITING */}
        {currentTab === 'writing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { title: 'Part 1: Build a Sentence', desc: 'Assemble and restructure diverse academic clause structures.' },
              { title: 'Part 2: Write an Email', desc: 'Draft formal requests or academic inquiries with contextual formatting.' },
              { title: 'Part 3: Academic Discussion', desc: 'Contribute opinions and critical analysis to an interactive lecture forum.' }
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: '22px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '70%' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#616473' }}>{p.desc}</p>
                </div>
                <button style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>Open Module</button>
              </div>
            ))}
          </div>
        )}

        {/* SPEAKING */}
        {currentTab === 'speaking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { title: 'Part 1: Listen and Repeat', desc: 'Sharpen intonation and vocal stress through audio response capture.' },
              { title: 'Part 2: Take an Interview', desc: 'Deliver clear multi-turn answers facing real-time audio inquiry scenarios.' }
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: '22px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '70%' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#616473' }}>{p.desc}</p>
                </div>
                <button style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>Open Module</button>
              </div>
            ))}
          </div>
        )}

        {/* VOCABULARY */}
        {currentTab === 'vocab' && vocabWords.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
            <p style={{ color: '#616473', fontSize: '13px' }}>Loading vocabulary...</p>
          </div>
        )}
        {currentTab === 'vocab' && vocabWords.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Progress bar */}
            <div style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '0.5px solid #e1e4ed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ fontWeight: '600' }}>Progress</span>
                <span style={{ color: '#616473' }}>
                  {vocabWords.filter(w => w.learned).length} / {vocabWords.length} learned
                </span>
              </div>
              <div style={{ height: '8px', background: '#f0f2f5', borderRadius: '4px' }}>
                <div style={{
                  width: (vocabWords.filter(w => w.learned).length / vocabWords.length * 100) + '%',
                  height: '100%', background: '#2ac56c', borderRadius: '4px', transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {['all', 'learned', 'unlearned'].map(f => (
                <button key={f} onClick={() => setVocabFilter(f)} style={{
                  padding: '7px 14px', borderRadius: '8px', border: '1px solid #d1d5db',
                  backgroundColor: vocabFilter === f ? '#701fa1' : '#fff',
                  color: vocabFilter === f ? '#fff' : '#616473',
                  fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                }}>
                  {f === 'all' ? 'All' : f === 'learned' ? 'Learned' : 'Not Learned'}
                </button>
              ))}
            </div>

            {vocabWords
              .filter(item => vocabFilter === 'all' ? true : vocabFilter === 'learned' ? item.learned : !item.learned)
              .map(item => {
                const vibrantColors = ['#701fa1', '#2563eb', '#dc2626', '#16a34a', '#ea580c', '#0891b2', '#c026d3', '#ca8a04'];
                const wordColor = vibrantColors[item.id % vibrantColors.length];
                const difficultyStyles = {
                  easy: { bg: '#dcfce7', text: '#15803d' },
                  medium: { bg: '#dbeafe', text: '#1e40af' },
                  hard: { bg: '#fce7f3', text: '#9d174d' }
                };
                const difficultyBorderColors = {
                  easy: '#16a34a',
                  medium: '#2563eb',
                  hard: '#dc2626'
                };
                const borderColor = difficultyBorderColors[item.difficulty] || difficultyBorderColors.medium;
                const diffStyle = difficultyStyles[item.difficulty] || difficultyStyles.medium;
                const isFlipped = !!flippedCards[item.id];

                return (
                  <div key={item.id} onClick={() => setFlippedCards(prev => ({ ...prev, [item.id]: !prev[item.id] }))} style={{
                    backgroundColor: isFlipped ? diffStyle.bg : '#fff',
                    border: '0.5px solid #e1e4ed',
                    borderLeft: '4px solid ' + borderColor,
                    borderRadius: '12px',
                    padding: '18px',
                    minHeight: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    opacity: item.learned ? 0.6 : 1,
                    position: 'relative',
                    transition: 'background-color 0.2s ease'
                  }}>
                  <div style={{
                    position: 'absolute',
                    top: '14px',
                    right: '14px',
                    backgroundColor: '#fff',
                    color: borderColor,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}>
                    {item.difficulty?.toUpperCase()}
                  </div>

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

                    <button onClick={(e) => { e.stopPropagation(); toggleLearned(item.id); }} style={{
                      backgroundColor: item.learned ? '#2ac56c' : '#fff',
                      color: item.learned ? '#fff' : '#11162d',
                      border: '1px solid ' + (item.learned ? '#2ac56c' : '#d1d5db'),
                      padding: '6px 10px', borderRadius: '8px', fontWeight: '700',
                      cursor: 'pointer', fontSize: '11px', marginTop: '10px', alignSelf: 'flex-start'
                    }}>
                      {item.learned ? '✅ Learned' : 'Mark as Learned'}
                    </button>

                  </div>
                )
              })}
          </div>
        )}

        {/* SETTINGS */}
        {currentTab === 'settings' && (
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, minWidth: 0, backgroundColor: '#fff', padding: '24px', borderRadius: '14px', border: '0.5px solid #e1e4ed' }}>
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
                <button type="submit" style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Save Changes</button>
              </form>
            </div>
            <div style={{ flex: 1, minWidth: 0, backgroundColor: '#fff', padding: '24px', borderRadius: '14px', border: '0.5px solid #e1e4ed' }}>
              <h3 style={{ margin: '0 0 18px 0', fontSize: '15px', fontWeight: '700' }}>🔒 Account Security</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App