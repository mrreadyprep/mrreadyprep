import { useEffect, useState } from 'react'

function App() {
  const [userData, setUserData] = useState(null)
  const [currentTab, setCurrentTab] = useState('dashboard')
  const [profileName, setProfileName] = useState('')
  const [targetScore, setTargetScore] = useState(5.5)
  const [examDate, setExamDate] = useState('')
  const [vocabWords] = useState([
    { id: 1, word: "Proponent", type: "NOUN", meaning: "A person who advocates a theory, proposal, or project." },
    { id: 2, word: "Substantiate", type: "VERB", meaning: "Provide evidence to support or prove the truth of." },
    { id: 3, word: "Ambiguous", type: "ADJECTIVE", meaning: "Open to more than one interpretation." },
    { id: 4, word: "Prohibit", type: "VERB", meaning: "Formally forbid something by law or rule." }
  ])

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
    ].sort((a, b) => b.gap - a.gap)
    const goals = []
    sections.forEach(s => {
      if (s.gap <= 0) return
      if (daysLeft > 60) goals.push('Practice 1 ' + s.name + ' (gap: ' + s.gap.toFixed(1) + ')')
      else if (daysLeft > 30) { if (s.gap >= 1.0) goals.push('Do 2 ' + s.name + ' — urgent!'); else goals.push('Do 1 ' + s.name) }
      else if (daysLeft > 14) { if (s.gap >= 0.5) goals.push('Full ' + s.name + ' mock test') }
      else { if (s.gap >= 0.5) goals.push('Review ' + s.name + ' — exam soon!') }
    })
    if (daysLeft <= 60) goals.push('Review 10 vocabulary words')
    if (daysLeft <= 30) goals.push('Take a full timed practice test')
    if (daysLeft <= 7)  goals.push('Rest, review notes, sleep early')
    return goals.slice(0, 5)
  }

  const fetchDashboardData = () => {
    fetch('https://mrreadyprep.onrender.com/api/dashboard')
      .then(res => res.json())
      .then(data => { setUserData(data); setProfileName(data.username); setTargetScore(data.target_score) })
      .catch(err => console.error(err))
  }

  useEffect(() => { fetchDashboardData() }, [])

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

  const sb = (tab, icon, label) => (
    <button onClick={() => setCurrentTab(tab)} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: '500', backgroundColor: currentTab === tab ? '#701fa1' : 'transparent', color: currentTab === tab ? '#fff' : '#a0a3b1', display: 'flex', alignItems: 'center', gap: '10px' }}>
      {icon} {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', fontFamily: 'sans-serif', backgroundColor: '#f4f6fa', overflow: 'hidden', boxSizing: 'border-box' }}>

      {/* SIDEBAR */}
      <div style={{ width: '180px', flexShrink: 0, backgroundColor: '#11162d', padding: '16px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div>
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ color: '#b67bfb', fontSize: '15px', fontWeight: '600' }}>mrreadyprep</div>
            <div style={{ fontSize: '8px', color: '#7b809a', letterSpacing: '1px' }}>TOEFL IBT PREP</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {sb('dashboard', '📊', 'Dashboard')}
            {sb('reading',   '📖', 'Reading')}
            {sb('listening', '🎧', 'Listening')}
            {sb('writing',   '✍️', 'Writing')}
            {sb('speaking',  '🎙️', 'Speaking')}
            {sb('vocab',     '📚', 'Vocabulary')}
          </div>
        </div>
        <div onClick={() => setCurrentTab('settings')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 4px', borderTop: '1px solid #252a44' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#2ac56c', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', color: '#fff', fontSize: '10px', flexShrink: 0 }}>M</div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '500', color: '#fff' }}>mehmetdisbudak</div>
            <div style={{ fontSize: '9px', color: '#7b809a' }}>⚙️ Settings</div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, padding: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

        {currentTab !== 'dashboard' && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <span onClick={() => setCurrentTab('dashboard')} style={{ fontSize: '13px', fontWeight: '600', color: '#9047f5', cursor: 'pointer' }}>← Back</span>
            <h2 style={{ margin: '0 0 0 14px', fontSize: '17px', fontWeight: '700' }}>
              {currentTab === 'reading' && '📖 Reading Practice'}
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
          <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0, overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>

            {/* SOL - esnek */}
            <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: '12px', padding: '16px', border: '0.5px solid #e1e4ed', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '14px' }}>Section scores vs targets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
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
                        <span style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>{s.current} <span style={{ color: '#999', fontWeight: '400' }}>/ {s.target}</span></span>
                      </div>
                      <div style={{ height: '8px', background: '#f0f2f5', borderRadius: '4px', position: 'relative' }}>
                        <div style={{ width: curPct + '%', height: '100%', background: gap >= 1 ? '#e85555' : '#2ac56c', borderRadius: '4px' }} />
                        <div style={{ position: 'absolute', top: '-3px', left: tgtPct + '%', width: '2px', height: '14px', background: '#701fa1', borderRadius: '2px' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '14px', marginTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#888' }}><div style={{ width: '10px', height: '3px', background: '#2ac56c', borderRadius: '2px' }} /> Current</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#888' }}><div style={{ width: '3px', height: '10px', background: '#701fa1', borderRadius: '2px' }} /> Target</div>
              </div>
            </div>

            {/* SAĞ - sabit 280px */}
            <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden', boxSizing: 'border-box' }}>

              {/* Exam date */}
              <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', border: '0.5px solid #e1e4ed', flexShrink: 0, boxSizing: 'border-box' }}>
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

              {/* Score cards */}
              {[
                { name: 'Reading practice',   score: userData.reading_score,   note: '+0.5 this week', color: '#2ac56c' },
                { name: 'Listening practice', score: userData.listening_score, note: '+0.5 this week', color: '#2ac56c' },
                { name: 'Writing practice',   score: userData.writing_score,   note: 'No change',      color: '#999' },
                { name: 'Speaking practice',  score: userData.speaking_score,  note: 'Needs focus',    color: '#e85555' },
              ].map(item => (
                <div key={item.name} style={{ background: '#fff', borderRadius: '10px', padding: '8px 12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '11px', color: '#616473' }}>{item.name}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>{item.score}</div>
                    <div style={{ fontSize: '9px', color: item.color }}>{item.note}</div>
                  </div>
                </div>
              ))}

              {/* Goals */}
              <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', border: '0.5px solid #e1e4ed', flex: 1, boxSizing: 'border-box', overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>Today's goals</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
        )}

        {/* READING */}
        {currentTab === 'reading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { title: 'Part 1: Complete the Sentence', desc: 'Fill in missing parts within texts using keyboard precision.' },
              { title: 'Part 2: Read in Daily Life', desc: 'Analyze announcements, emails, and notifications from campus life.' },
              { title: 'Part 3: Academic Passage', desc: 'Read scientific or historical essays and answer comprehension queries.' }
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '70%' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#616473' }}>{p.desc}</p>
                </div>
                <button style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>Open Module</button>
              </div>
            ))}
          </div>
        )}

        {/* LISTENING */}
        {currentTab === 'listening' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {["Part 1: Choose a Response", "Part 2: Conversation", "Part 3: Announcement", "Part 4: Academic Talk"].map((title, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>{title}</h4>
                <button style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>Open Module</button>
              </div>
            ))}
          </div>
        )}

        {/* WRITING */}
        {currentTab === 'writing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { title: 'Part 1: Build a Sentence', desc: 'Assemble and restructure diverse academic clause structures.' },
              { title: 'Part 2: Write an Email', desc: 'Draft formal requests or academic inquiries with contextual formatting.' },
              { title: 'Part 3: Academic Discussion', desc: 'Contribute opinions and critical analysis to an interactive lecture forum.' }
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '70%' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#616473' }}>{p.desc}</p>
                </div>
                <button style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>Open Module</button>
              </div>
            ))}
          </div>
        )}

        {/* SPEAKING */}
        {currentTab === 'speaking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { title: 'Part 1: Listen and Repeat', desc: 'Sharpen intonation and vocal stress through audio response capture.' },
              { title: 'Part 2: Take an Interview', desc: 'Deliver clear multi-turn answers facing real-time audio inquiry scenarios.' }
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '70%' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: '700' }}>{p.title}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#616473' }}>{p.desc}</p>
                </div>
                <button style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>Open Module</button>
              </div>
            ))}
          </div>
        )}

        {/* VOCABULARY */}
        {currentTab === 'vocab' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {vocabWords.map(item => (
              <div key={item.id} style={{ backgroundColor: '#fff', padding: '16px 20px', borderRadius: '12px', border: '0.5px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>{item.word}</h4>
                    <span style={{ backgroundColor: '#f0f2f5', color: '#616473', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{item.type}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#616473' }}>{item.meaning}</p>
                </div>
                <button style={{ backgroundColor: '#fff', color: '#11162d', border: '1px solid #d1d5db', padding: '7px 12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}>Mark as Learned</button>
              </div>
            ))}
          </div>
        )}

        {/* SETTINGS */}
        {currentTab === 'settings' && (
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0, backgroundColor: '#fff', padding: '22px', borderRadius: '14px', border: '0.5px solid #e1e4ed' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700' }}>🎯 Target & Profile</h3>
              <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '11px' }}>Username</label>
                  <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '11px' }}>Target Score (0.0 - 6.0)</label>
                  <input type="number" min="0" max="6" step="0.5" value={targetScore} onChange={e => setTargetScore(e.target.value)} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" style={{ backgroundColor: '#2ac56c', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Save Changes</button>
              </form>
            </div>
            <div style={{ flex: 1, minWidth: 0, backgroundColor: '#fff', padding: '22px', borderRadius: '14px', border: '0.5px solid #e1e4ed' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700' }}>🔒 Account Security</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '11px' }}>Current Password</label>
                  <input type="password" value="••••••••" readOnly style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#888', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '11px' }}>New Password</label>
                  <input type="password" placeholder="Enter new password" style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontWeight: '600', color: '#616473', fontSize: '11px' }}>Confirm New Password</label>
                  <input type="password" placeholder="Confirm new password" style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <button style={{ backgroundColor: '#11162d', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Update Password</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App