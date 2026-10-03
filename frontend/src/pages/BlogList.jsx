import { useState, useEffect } from 'react'

export default function BlogList() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
  
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/blog`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setPosts(data.posts.sort((a, b) => new Date(b.date) - new Date(a.date)))
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching blog posts:', err)
        setLoading(false)
      })
  }, [])
  
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', minHeight: '100vh', backgroundColor: '#11162d', color: '#e8e8e8', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '30px', textAlign: 'center', color: '#fff' }}>Blog</h1>
      
      {loading ? (
        <div style={{ textAlign: 'center', fontSize: '18px', color: '#999' }}>Loading blog posts...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', fontSize: '18px', color: '#999' }}>No blog posts yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: '30px' }}>
          {posts.map(post => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{
                display: 'block',
                padding: '24px',
                backgroundColor: '#1a2555',
                borderRadius: '12px',
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid #2a3f7f',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#202855'
                e.currentTarget.style.borderColor = '#4050cf'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1a2555'
                e.currentTarget.style.borderColor = '#2a3f7f'
              }}
            >
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '10px', color: '#fff' }}>
                {post.title}
              </h2>
              <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px' }}>
                {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • {post.readTime} min read
              </p>
              <p style={{ fontSize: '16px', color: '#d8d8d8', lineHeight: '1.6' }}>
                {post.excerpt}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
