import React, { useState, useEffect } from 'react';

export default function Community() {
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [filter, setFilter] = useState('all_sections');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const url = filter === 'all_sections' 
          ? '/api/forum/questions' 
          : `/api/forum/questions?section=${filter}`;
        const res = await fetch(url);
        const data = await res.json();
        setPosts(data.questions || []);
      } catch (err) {
        console.error('Error fetching posts:', err);
      }
    };
    fetchPosts();
  }, [filter]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>TOEFL iBT Community</h1>
      <p>Ask questions, share tips, and learn from other test-takers.</p>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
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
        {posts.map(post => (
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
            <h3 style={{ margin: '0 0 8px 0' }}>{post.title}</h3>
            <p style={{ margin: '0 0 12px 0', color: '#666' }}>
              {post.body.substring(0, 120)}...
            </p>
            <div style={{ fontSize: '14px', color: '#999', display: 'flex', gap: '20px' }}>
              <span>By {post.username}</span>
              <span>{post.answer_count} answers</span>
            </div>
          </div>
        ))}
      </div>

      {selectedPost && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f9f3ff',
          borderRadius: '8px'
        }}>
          <h2>{selectedPost.title}</h2>
          <p>{selectedPost.body}</p>
          <div style={{ color: '#666' }}>By {selectedPost.username}</div>
        </div>
      )}
    </div>
  );
}
