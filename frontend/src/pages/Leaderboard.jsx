import React, { useState, useEffect } from 'react';

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [sortBy, setSortBy] = useState('problems_solved');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/leaderboard?sort=${sortBy}`);
        const data = await res.json();
        setUsers(data.leaderboard || []);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      }
    };
    fetchLeaderboard();
  }, [sortBy]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h1>Leaderboard</h1>
      <p>See who's on top and get motivated!</p>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        {[
          { value: 'problems_solved', label: 'Problems Solved' },
          { value: 'best_score', label: 'Best Score' },
          { value: 'current_streak', label: 'Current Streak' }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => setSortBy(option.value)}
            style={{
              padding: '8px 16px',
              backgroundColor: sortBy === option.value ? '#701fa1' : '#f0f0f0',
              color: sortBy === option.value ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <thead style={{ backgroundColor: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Rank</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>User</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Problems Solved</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Best Score</th>
              <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Current Streak</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => (
              <tr key={user.id} style={{
                borderBottom: '1px solid #eee',
                backgroundColor: idx < 3 ? '#fffef5' : 'white'
              }}>
                <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '16px', color: '#701fa1' }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </td>
                <td style={{ padding: '12px', fontWeight: '500' }}>{user.username}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{user.problems_solved}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#701fa1', fontWeight: 'bold' }}>
                  {user.best_score?.toFixed(1)}/6.0
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <span style={{ backgroundColor: '#e8f4f8', padding: '4px 8px', borderRadius: '4px' }}>
                    {user.current_streak} days
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
          Loading leaderboard...
        </div>
      )}
    </div>
  );
}
