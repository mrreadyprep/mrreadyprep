import React, { useState, useEffect } from 'react';

const MOCK_QUESTIONS = [
  { id: 1, username: "Alex Chen", title: "Best strategy for Reading Part 2?", body: "I'm struggling with the inference questions in Reading Part 2. What strategies have worked for you?", section: "reading", answer_count: 2, upvotes: 8 },
  { id: 2, username: "Maria Garcia", title: "How to improve reading speed without losing accuracy?", body: "Can someone share their experience with improving reading speed? I feel like I'm always running out of time.", section: "reading", answer_count: 2, upvotes: 12 },
  { id: 3, username: "Raj Patel", title: "Writing task feedback", body: "Would love feedback on my latest writing task. I'm worried about my organization.", section: "writing", answer_count: 1, upvotes: 5 },
  { id: 4, username: "Emma Wilson", title: "Integrated writing tips?", body: "Any tips for managing time between reading/listening and writing?", section: "writing", answer_count: 1, upvotes: 14 },
  { id: 5, username: "Omar Hassan", title: "Dealing with nervousness before speaking", body: "I always stumble on my first few words. Relaxation techniques?", section: "speaking", answer_count: 1, upvotes: 11 },
  { id: 6, username: "Sophie Dupont", title: "Speaking Part 4 strategy", body: "Looking for ideas on how to structure responses for independent speaking.", section: "speaking", answer_count: 1, upvotes: 7 },
  { id: 7, username: "Yuki Tanaka", title: "Improving listening comprehension", body: "I miss details while listening. Word-by-word or get the gist first?", section: "listening", answer_count: 1, upvotes: 9 },
  { id: 8, username: "Nina Petrov", title: "Study plan for 66 days", body: "I have 9 weeks. How much time daily to go from 5.0 to 5.5+?", section: "all_sections", answer_count: 1, upvotes: 13 },
];

export default function Community() {
  const [questions, setQuestions] = useState(MOCK_QUESTIONS);
  const [selectedPost, setSelectedPost] = useState(null);
  const [filter, setFilter] = useState('all_sections');

  useEffect(() => {
    const filtered = filter === 'all_sections' 
      ? MOCK_QUESTIONS 
      : MOCK_QUESTIONS.filter(q => q.section === filter);
    setQuestions(filtered);
  }, [filter]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>TOEFL iBT Community</h1>
      <p>Ask questions, share tips, and learn from other test-takers.</p>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {['all_sections', 'reading', 'listening', 'writing', 'speaking'].map(sec => (
          <button
            key={sec}
            onClick={() => setFilter(sec)}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === sec ? '#701fa1' : '#f0f0f0',
              color: filter === sec ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              textTransform: 'capitalize'
            }}
          >
            {sec.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {questions.map(post => (
          <div
            key={post.id}
            onClick={() => setSelectedPost(post)}
            style={{
              padding: '16px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: selectedPost?.id === post.id ? '#f9f3ff' : 'white',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>{post.title}</h3>
            <p style={{ margin: '0 0 12px 0', color: '#666', fontSize: '14px' }}>
              {post.body.substring(0, 100)}...
            </p>
            <div style={{ fontSize: '13px', color: '#999', display: 'flex', gap: '16px' }}>
              <span>By {post.username}</span>
              <span>{post.answer_count} answers</span>
              <span>{post.upvotes} upvotes</span>
            </div>
          </div>
        ))}
      </div>

      {selectedPost && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f9f3ff',
          borderRadius: '8px',
          borderLeft: '4px solid #701fa1'
        }}>
          <h2>{selectedPost.title}</h2>
          <p style={{ color: '#666', marginBottom: '16px' }}>By {selectedPost.username}</p>
          <p style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '20px' }}>
            {selectedPost.body}
          </p>
          <div style={{ 
            padding: '16px', 
            backgroundColor: 'white', 
            borderRadius: '4px',
            color: '#999',
            textAlign: 'center'
          }}>
            {selectedPost.answer_count} answers • Tap to see responses
          </div>
        </div>
      )}
    </div>
  );
}
