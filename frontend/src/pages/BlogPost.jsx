import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function BlogPost({ slug }) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
  
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/blog/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error('Post not found')
        return r.json()
      })
      .then(data => {
        if (data.success) {
          setPost(data.post)
        } else {
          setError('Could not load post')
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching blog post:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [slug])
  
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#11162d', color: '#e8e8e8', fontSize: '18px' }}>
        Loading post...
      </div>
    )
  }
  
  if (error || !post) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', minHeight: '100vh', backgroundColor: '#11162d', color: '#e8e8e8' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px', color: '#fff' }}>Post Not Found</h1>
        <p style={{ fontSize: '16px', color: '#aaa', marginBottom: '20px' }}>{error || 'The blog post you are looking for does not exist.'}</p>
        <a href="/blog" style={{ color: '#5b8def', textDecoration: 'none', fontSize: '16px', fontWeight: '500' }}>← Back to Blog</a>
      </div>
    )
  }
  
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', minHeight: '100vh', backgroundColor: '#11162d', color: '#e8e8e8', fontFamily: 'system-ui' }}>
      <a href="/blog" style={{ color: '#5b8def', textDecoration: 'none', fontSize: '16px', fontWeight: '500', marginBottom: '30px', display: 'inline-block' }}>← Back to Blog</a>
      
      <article style={{ marginTop: '30px' }}>
        <h1 style={{ fontSize: '42px', fontWeight: 'bold', marginBottom: '15px', color: '#fff', lineHeight: '1.2' }}>
          {post.title}
        </h1>
        
        <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '40px' }}>
          {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • {post.readTime} min read
        </p>
        
        <div style={{ 
          fontSize: '16px',
          lineHeight: '1.8',
          color: '#d8d8d8',
          maxWidth: '800px'
        }}>
          {post.content.split('\n').map((line, idx) => {
            // Parse markdown-like syntax
            if (line.startsWith('# ')) {
              return <h2 key={idx} style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '40px', marginBottom: '20px', color: '#fff' }}>{line.slice(2)}</h2>
            } else if (line.startsWith('## ')) {
              return <h3 key={idx} style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '30px', marginBottom: '15px', color: '#fff' }}>{line.slice(3)}</h3>
            } else if (line.startsWith('### ')) {
              return <h4 key={idx} style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '20px', marginBottom: '12px', color: '#fff' }}>{line.slice(4)}</h4>
            } else if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={idx} style={{ fontWeight: 'bold', marginBottom: '12px' }}>{line.slice(2, -2)}</p>
            } else if (line.startsWith('- ')) {
              return <li key={idx} style={{ marginLeft: '20px', marginBottom: '8px' }}>{line.slice(2)}</li>
            } else if (line.startsWith('| ') || line === '|--------|--------|') {
              return null // Skip table markup
            } else if (line === '---') {
              return <hr key={idx} style={{ margin: '40px 0', borderColor: '#2a3f7f' }} />
            } else if (line.trim() === '') {
              return <div key={idx} style={{ height: '12px' }} />
            } else {
              return <p key={idx} style={{ marginBottom: '16px' }}>{line}</p>
            }
          })}
        </div>
      </article>
      
      <div style={{ marginTop: '60px', paddingTop: '40px', borderTop: '1px solid #2a3f7f' }}>
        <a href="/blog" style={{ color: '#5b8def', textDecoration: 'none', fontSize: '16px', fontWeight: '500' }}>← Back to Blog</a>
      </div>
    </div>
  )
}
