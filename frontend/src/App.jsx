import { useEffect, useState } from 'react'

function App() {
  const [userData, setUserData] = useState(null)
  const [currentTab, setCurrentTab] = useState('dashboard')
  const [profileName, setProfileName] = useState('')
  const [targetScore, setTargetScore] = useState(5.5)
  const [vocabLevel, setVocabLevel] = useState(3)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [goals, setGoals] = useState([
    { id: 1, text: "Complete 1 Reading Sentence Practice", completed: false },
    { id: 2, text: "Listen to 1 Academic Talk or Conversation", completed: false },
    { id: 3, text: "Review 5 New Vocabulary Words", completed: false }
  ])

  const [vocabWords, setVocabWords] = useState([
    { id: 1, word: "Proponent", type: "NOUN", meaning: "A person who advocates a theory, proposal, or project.", learned: false },
    { id: 2, word: "Substantiate", type: "VERB", meaning: "Provide evidence to support or prove the truth of.", learned: false },
    { id: 3, word: "Ambiguous", type: "ADJECTIVE", meaning: "Open to more than one interpretation; having a double meaning.", learned: false },
    { id: 4, word: "Prohibit", type: "VERB", meaning: "Formally forbid something by law, rule, or other authority.", learned: false }
  ])

  const fetchDashboardData = () => {
    fetch('https://mrreadyprep.onrender.com/api/dashboard')
      .then(res => res.json())
      .then(data => {
        setUserData(data)
        setProfileName(data.username)
        setTargetScore(data.target_score)
        setVocabLevel(data.vocab_level)
      })
      .catch(err => console.error("Data load error:", err))
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const handleProfileSave = (e) => {
    e.preventDefault()
    fetch('https://mrreadyprep.onrender.com/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: profileName, target_score: Number(targetScore) }),
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        alert("Changes saved successfully! 🎉")
        fetchDashboardData()
      }
    })
    .catch(err => console.error(err))
  }

  if (!userData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#ffffff', color: '#111827' }}>
        <h2 style={{ fontWeight: '600' }}>Loading mrreadyprep...</h2>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif', backgroundColor: '#fdfdfd', color: '#111827', overflow: "hidden" }}>
      
      {/* SIDEBAR NAVIGATION */}
      <div style={{ width: '270px', minWidth: '270px', backgroundColor: '#11162d', color: '#ffffff', padding: '35px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            <h1 style={{ color: '#b67bfb', margin: '0', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>mrreadyprep</h1>
            <span style={{ fontSize: '10px', color: '#7b809a', fontWeight: '700', letterSpacing: '1px' }}>TOEFL IBT PREP PLATFORM</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => setCurrentTab('dashboard')} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '14px', backgroundColor: currentTab === 'dashboard' ? '#701fa1' : 'transparent', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px' }}>📊 Dashboard</button>
            <button onClick={() => setCurrentTab('reading')} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '14px', backgroundColor: currentTab === 'reading' ? '#701fa1' : 'transparent', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px' }}>📖 Reading Module</button>
            <button onClick={() => setCurrentTab('listening')} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '14px', backgroundColor: currentTab === 'listening' ? '#701fa1' : 'transparent', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px' }}>🎧 Listening Module</button>
            <button onClick={() => setCurrentTab('writing')} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '14px', backgroundColor: currentTab === 'writing' ? '#701fa1' : 'transparent', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px' }}>✍️ Writing Module</button>
            <button onClick={() => setCurrentTab('speaking')} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '14px', backgroundColor: currentTab === 'speaking' ? '#701fa1' : 'transparent', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px' }}>🎙️ Speaking Module</button>
            <button onClick={() => setCurrentTab('vocab')} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '14px', backgroundColor: currentTab === 'vocab' ? '#701fa1' : 'transparent', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px' }}>📚 Vocab Practice</button>
          </div>
        </div>

        <div onClick={() => setCurrentTab('settings')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px 4px', borderTop: '1px solid #252a44' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#2ac56c', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', color: '#ffffff' }}>M</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>mehmetdisbudak</div>
            <div style={{ fontSize: '11px', color: '#7b809a' }}>⚙️ Account Settings</div>
          </div>
        </div>
      </div>

      {/* WORKSPACE CONTENT */}
      <div style={{ flex: 1, padding: '40px 50px', overflowY: 'hidden', height: '100vh', backgroundColor: '#f4f6fa' }}>
        
        {/* TOP COMPONENT HEADER FOR MODULES */}
        {currentTab !== 'dashboard' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <div>
              <span onClick={() => setCurrentTab('dashboard')} style={{ fontSize: '13px', fontWeight: '700', color: '#9047f5', cursor: 'pointer' }}>← Back to Dashboard</span>
              <h2 style={{ margin: '8px 0 0 0', fontSize: '26px', fontWeight: '800' }}>
                {currentTab === 'reading' && '📖 Reading Practice Workspace'}
                {currentTab === 'listening' && '🎧 Listening Practice Workspace'}
                {currentTab === 'writing' && '✍️ Writing Practice Workspace'}
                {currentTab === 'speaking' && '🎙️ Speaking Practice Workspace'}
                {currentTab === 'vocab' && '📚 Academic Vocabulary Flashcards'}
                {currentTab === 'settings' && '⚙️ Account Profile Settings'}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', padding: '8px 16px', borderRadius: '20px', border: '1px solid #e1e4ed', fontWeight: '600', fontSize: '13px' }}>👤 mehmetdisbudak</div>
          </div>
        )}

        {/* DASHBOARD TAB VIEW */}
        {currentTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '24px 30px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '24px', borderLeft: '6px solid #b67bfb', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                <span style={{ fontSize: '24px' }}>🎯</span>
                <div>
                  <div style={{ color: '#8a8d9f', fontSize: '11px', fontWeight: '700' }}>TARGET SCORE</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '2px' }}>{targetScore} <span style={{ fontSize: '14px', color: '#b5b7c4', fontWeight: '500' }}>/ 6.0</span></div>
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '24px 30px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '24px', borderLeft: '6px solid #2ac56c', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                <span style={{ fontSize: '24px' }}>🔥</span>
                <div>
                  <div style={{ color: '#8a8d9f', fontSize: '11px', fontWeight: '700' }}>DAILY STREAK</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '2px', color: '#2ac56c' }}>{userData.current_streak} <span style={{ fontSize: '14px', color: '#b5b7c4', fontWeight: '500' }}>Days</span></div>
                </div>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '24px 30px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '24px', borderLeft: '6px solid #11162d', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                <span style={{ fontSize: '24px' }}>💡</span>
                <div>
                  <div style={{ color: '#8a8d9f', fontSize: '11px', fontWeight: '700' }}>VOCAB TIER</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '2px' }}>Lvl {vocabLevel}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.01)', border: '1px solid #e9ecf2' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 20px 0', textAlign: 'center' }}>TOEFL iBT 2026 Strategy Cards</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {[
                    { tag: 'READING', color: '#b67bfb', title: 'Sentence Completion Precision', desc: 'Pay close attention to word prefixes and suffixes. Keyboard spelling accuracy determines your score points.' },
                    { tag: 'LISTENING', color: '#2ac56c', title: 'Focus on Spoken Signals', desc: "Listen for transition words like 'however', 'consequently', or 'on the other hand' to capture the professor's true intent." },
                    { tag: 'WRITING', color: '#b67bfb', title: 'Academic Discussion Cohesion', desc: 'State your opinion clearly in the online forum task. Support it with clear examples and maintain rigorous grammatical depth within the 6.0 grading scale.' },
                    { tag: 'SPEAKING', color: '#11162d', title: 'Integrated Campus Timing', desc: 'When summarizing campus situations or lectures, optimize your preparation time to structure cause-and-effect relationships seamlessly without pausing.' }
                  ].map((tip, i) => (
                    <div key={i} style={{ border: '1px solid #ebdfff', borderRadius: '16px', padding: '20px', backgroundColor: '#fcfaff', borderLeft: `5px solid ${tip.color}` }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: tip.color, letterSpacing: '0.5px' }}>{tip.tag}</span>
                      <h4 style={{ margin: '4px 0 8px 0', fontSize: '15px', fontWeight: '800' }}>{tip.title}</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#616473', lineHeight: '1.5' }}>{tip.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '24px', border: '1px solid #e9ecf2' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800', textAlign: 'center' }}>Intelligent Preparation Tracker</h4>
                <p style={{ fontSize: '13px', color: '#616473', lineHeight: '1.5', textAlign: 'center' }}>Your calculated cross-skill average is <strong style={{ color: '#9047f5' }}>4.5 / 6.0</strong>. You are currently <strong style={{ color: '#ff4d4d' }}>1.0 points</strong> away from your target goal. We suggest reviewing your lowest-performing skill matrix below to optimize efficiency.</p>
                <div style={{ backgroundColor: '#f2ecff', color: '#701fa1', padding: '12px', borderRadius: '12px', textAlign: 'center', marginTop: '15px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '800' }}>SCORE GAP</div>
                  <div style={{ fontSize: '22px', fontWeight: '900' }}>-1.0</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '24px', border: '1px solid #e9ecf2' }}>
                <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '800', textAlign: 'center' }}>Performance Overview</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { s: 'Reading', sc: userData.reading_score, p: 83 },
                    { s: 'Listening', sc: userData.listening_score, p: 75 },
                    { s: 'Writing', sc: userData.writing_score, p: 75 },
                    { s: 'Speaking', sc: userData.speaking_score, p: 66 }
                  ].map(item => (
                    <div key={item.s}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>
                        <span>{item.s}</span> <span style={{ color: '#701fa1' }}>{item.sc} / 6.0</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#eee', borderRadius: '4px', overflow: "hidden" }}>
                        <div style={{ width: `${item.p}%`, height: '100%', backgroundColor: '#701fa1' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '24px', border: '1px solid #e9ecf2' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', textAlign: 'center' }}>Today's Tasklist</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {goals.map(g => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '16px', border: '1px solid #ebdfff', backgroundColor: '#fcfaff' }}>
                      <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: '#2ac56c' }} />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#11162d' }}>{g.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* READING TAB VIEW */}
        {currentTab === 'reading' && (
          <div>
            <p style={{ color: '#616473', marginBottom: '30px', fontSize: '14px' }}>Practice with 3 different reading question types designed for the updated 2026 format.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { title: 'Part 1: Complete the Sentence', desc: 'Fill in the missing parts of letters/words within texts using your keyboard precision.' },
                { title: 'Part 2: Read in Daily Life', desc: 'Analyze announcements, emails, and institutional notifications from everyday campus life.' },
                { title: 'Part 3: Academic Passage', desc: 'Read highly specialized scientific or historical essays and answer comprehension queries.' }
              ].map((p, i) => (
                <div key={i} style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '20px', border: '1px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ maxWidth: '70%' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800' }}>{p.title}</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#616473', lineHeight: '1.5' }}>{p.desc}</p>
                  </div>
                  <button style={{ backgroundColor: '#2ac56c', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Open Module</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LISTENING TAB VIEW */}
        {currentTab === 'listening' && (
          <div>
            <p style={{ color: '#616473', marginBottom: '30px', fontSize: '14px' }}>Enhance your listening comprehension with 4 question styles updated for the 2026 exam requirements.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {["Part 1: Choose a Response", "Part 2: Conversation", "Part 3: Announcement", "Part 4: Academic Talk"].map((title, i) => (
                <div key={i} style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '20px', border: '1px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>{title}</h4>
                  <button style={{ backgroundColor: '#2ac56c', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Open Module</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WRITING TAB VIEW */}
        {currentTab === 'writing' && (
          <div>
            <p style={{ color: '#616473', marginBottom: '30px', fontSize: '14px' }}>Practice your composition workflow with 3 custom task formats built for your preparation blueprint.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { title: 'Part 1: Build a Sentence', desc: 'Demonstrate syntactic command by assembling and restructuring diverse academic clause structures seamlessly.' },
                { title: 'Part 2: Write an Email', desc: 'Draft high-quality workspace notifications, formal requests, or academic inquiries with contextual formatting precision.' },
                { title: 'Part 3: Academic Discussion', desc: 'Contribute advanced opinions, supporting synthesis data, and critical analysis to an interactive lecture forum thread.' }
              ].map((p, i) => (
                <div key={i} style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '20px', border: '1px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ maxWidth: '70%' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800' }}>{p.title}</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#616473', lineHeight: '1.5' }}>{p.desc}</p>
                  </div>
                  <button style={{ backgroundColor: '#2ac56c', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Open Module</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SPEAKING TAB VIEW */}
        {currentTab === 'speaking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <p style={{ color: '#616473', margin: '0 0 5px 0', fontSize: '14px' }}>Master active phonetic outputs across 2 specialized oral proficiency training workflows.</p>
            
            {[
              { title: 'Part 1: Listen and Repeat', desc: 'Sharpen intonation tracking, vocal stress precision, and word delivery accuracy through close audio response capture.' },
              { title: 'Part 2: Take an Interview', desc: 'Deliver quick, clear multi-turn answers and academic arguments facing real-time audio inquiry scenarios.' }
            ].map((p, i) => (
              <div key={i} style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '20px', border: '1px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '70%' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800' }}>{p.title}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#616473', lineHeight: '1.5' }}>{p.desc}</p>
                </div>
                <button style={{ backgroundColor: '#2ac56c', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>Open Module</button>
              </div>
            ))}

            {/* FULL SPEAKING MOCK TEST COMPONENT CARD */}
            <div style={{ background: '#11162d', padding: '35px', borderRadius: '24px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ backgroundColor: '#701fa1', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>OFFICIAL PROVA</span>
                  <span style={{ fontSize: '12px', color: '#a5a7b4', fontWeight: '600' }}>⏱️ Süre: ~15 Dakika</span>
                </div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '800' }}>Full Speaking Mock Test</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#a5a7b4', lineHeight: '1.5', maxWidth: '450px' }}>Sırasıyla tüm 'Listen and Repeat' ve 'Take an Interview' aşamalarını süre kısıtlamalı ve ardışık olarak simüle edin. Yapay zeka motoru sesinizi kaydederek 6.0 skalasında anında analiz sunar.</p>
              </div>
              <button onClick={() => alert("Mock test simulation initiated!")} style={{ backgroundColor: '#ffffff', color: '#11162d', border: 'none', padding: '14px 28px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}>Start Test</button>
            </div>
          </div>
        )}

        {/* VOCABULARY TAB VIEW */}
        {currentTab === 'vocab' && (
          <div>
            <p style={{ color: '#616473', marginBottom: '30px', fontSize: '14px' }}>Master high-frequency TOEFL iBT academic vocabulary words.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {vocabWords.map(item => (
                <div key={item.id} style={{ backgroundColor: '#ffffff', padding: '25px 30px', borderRadius: '20px', border: '1px solid #e1e4ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{item.word}</h4>
                      <span style={{ backgroundColor: '#f0f2f5', color: '#616473', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{item.type}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#616473' }}>{item.meaning}</p>
                  </div>
                  <button style={{ backgroundColor: '#ffffff', color: '#11162d', border: '1px solid #d1d5db', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Mark as Learned</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS TAB VIEW */}
        {currentTab === 'settings' && (
          <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, backgroundColor: '#ffffff', padding: '35px', borderRadius: '24px', border: '1px solid #e9ecf2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px' }}>
                <span style={{ fontSize: '20px' }}>🎯</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Target & Profile Info</h3>
              </div>
              <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: '700', color: '#616473', fontSize: '13px' }}>Username / Student Name</label>
                  <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: '700', color: '#616473', fontSize: '13px' }}>TOEFL iBT Target Score (0.0 - 6.0)</label>
                  <input type="number" min="0" max="6.0" step="0.5" value={targetScore} onChange={(e) => setTargetScore(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600' }} />
                </div>
                <button type="submit" style={{ backgroundColor: '#2ac56c', color: '#ffffff', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginTop: '10px' }}>Save Changes</button>
              </form>
            </div>

            <div style={{ flex: 1, backgroundColor: '#ffffff', padding: '35px', borderRadius: '24px', border: '1px solid #e9ecf2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px' }}>
                <span style={{ fontSize: '20px' }}>🔒</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Account Security</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: '700', color: '#616473', fontSize: '13px' }}>Current Password</label>
                  <input type="password" value="••••••••" readOnly style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#888' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: '700', color: '#616473', fontSize: '13px' }}>New SaaS Password</label>
                  <input type="password" placeholder="Enter new password" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: '700', color: '#616473', fontSize: '13px' }}>Confirm New Password</label>
                  <input type="password" placeholder="Confirm new password" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
                </div>
                <button style={{ backgroundColor: '#11162d', color: '#ffffff', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginTop: '10px' }}>Update Password</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App