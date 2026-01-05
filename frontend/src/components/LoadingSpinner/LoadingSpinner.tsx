import React from 'react';
import './LoadingSpinner.scss';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color,
  text = '加载中...'
}) => {
  const sizeMap = {
    sm: '24px',
    md: '40px',
    lg: '60px'
  };

  return (
    <div className="loading-spinner">
      <div 
        className="spinner"
        style={{
          width: sizeMap[size],
          height: sizeMap[size],
          borderColor: color ? `${color} transparent transparent transparent` : undefined
        }}
      />
      {text && <div className="loading-text">{text}</div>}
    </div>
  );
};

export default LoadingSpinner;