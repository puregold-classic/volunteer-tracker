import React, { useState } from 'react';
import './App.scss';
import VolunteerList from '@components/VolunteerList';
import Header from '@components/Header';
import Footer from '@components/Footer';



function App() {
  const [viewMode, setViewMode] = useState<'compact' | 'full'>('compact');

  const handleVolunteerClick = (id: string) => {
    console.log('Clicked volunteer:', id);
    // 可以在这里实现详情页导航
    alert(`点击了志愿者 ${id}，详情功能开发中...`);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'compact' ? 'full' : 'compact');
  };

  return (
    <div className="app">
      <Header 
        title="志愿者管理系统" 
        subtitle="全球志愿者可视化平台"
      />
      
      <main className="main-content">
        <div className="controls-bar">
          <div className="view-controls">
            <button 
              className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => setViewMode('compact')}
            >
              📋 紧凑视图
            </button>
            <button 
              className={`view-btn ${viewMode === 'full' ? 'active' : ''}`}
              onClick={() => setViewMode('full')}
            >
              👁️ 完整视图
            </button>
          </div>
          
          <div className="info-text">
            点击卡片查看志愿者详情
          </div>
        </div>

        <VolunteerList 
          compact={viewMode === 'compact'}
          onVolunteerClick={handleVolunteerClick}
        />
      </main>
      
      <Footer />
    </div>
  );
}

export default App;