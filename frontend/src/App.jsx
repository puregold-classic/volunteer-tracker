import React from 'react'

function App() {
  return (
    <div style={{
      padding: '40px',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center'
    }}>
      <h1 style={{ color: '#2563eb', fontSize: '3rem' }}>
        🎉 Vite React 启动成功！
      </h1>
      <p style={{ fontSize: '1.2rem', margin: '20px 0' }}>
        如果你能看到这个页面，说明一切正常。
      </p>
      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: '#f3f4f6',
        borderRadius: '10px',
        display: 'inline-block'
      }}>
        <h3>服务器信息：</h3>
        <p>端口: 5173</p>
        <p>时间: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  )
}

export default App