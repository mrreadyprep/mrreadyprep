import React, { useState, useEffect } from 'react';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [period, setPeriod] = useState('weekly');
  const [sortBy, setSortBy] = useState('points');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/leaderboard?period=${period}&limit=240`);
        const data = await res.json();
        setUsers(data.leaderboard || []);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      }
    };
    fetchLeaderboard();
  }, [period]);

  // Sort users based on selected field
  const sortedUsers = [...users].sort((a, b) => {
    if (sortBy === 'points') return b.points - a.points;
    if (sortBy === 'problems_solved') return b.problems_solved - a.problems_solved;
    if (sortBy === 'best_score') return b.best_score - a.best_score;
    if (sortBy === 'current_streak') return b.current_streak - a.current_streak;
    return 0;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>🏆 Leaderboard</h1>
      <p>See who's on top and get motivated!</p>

      {/* Period Toggle */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        {['weekly', 'alltime'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '10px 20px',
              backgroundColor: period === p ? '#701fa1' : '#f0f0f0',
              color: period === p ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {p === 'weekly' ? '📅 This Week' : '🌟 All Time'}
          </button>
        ))}
      </div>

      {/* Sort Options */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {[
          { value: 'points', label: 'Points' },
          { value: 'problems_solved', label: 'Problems Solved' },
          { value: 'best_score', label: 'Best Score' },
          { value: 'current_streak', label: 'Current Streak' }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => setSortBy(option.value)}
            style={{
              padding: '8px 16px',
              backgroundColor: sortBy === option.value ? '#701fa1' : '#e8e8e8',
              color: sortBy === option.value ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#fff',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#701fa1', color: 'white' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Rank</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Username</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Points</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Problems Solved</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Best Score</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Streak</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user, idx) => (
              <tr
                key={user.user_id}
                style={{
                  backgroundColor: idx % 2 === 0 ? '#f9f9f9' : '#fff',
                  borderBottom: '1px solid #eee',
                  '&:hover': { backgroundColor: '#f0f0f0' }
                }}
              >
                <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '16px' }}>
                  {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : user.rank}
                </td>
                <td style={{ padding: '12px' }}>{user.username}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{user.points || 0}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{user.problems_solved || 0}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{user.best_score || 0}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>🔥 {user.current_streak || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <p>Loading leaderboard...</p>
        </div>
      )}

      <p style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>
        Showing {users.length} {period === 'weekly' ? 'active users this week' : 'total users all time'}
      </p>
    </div>
  );
}
