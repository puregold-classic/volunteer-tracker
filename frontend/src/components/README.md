# 组件目录结构说明

## 组件命名规范
- 组件目录：PascalCase (如 MapViewer)
- 组件文件：PascalCase (如 MapViewer.jsx)
- 样式文件：组件名.scss (如 MapViewer.scss)
- 测试文件：组件名.test.jsx (如 MapViewer.test.jsx)

## 组件模板示例
```jsx
// components/Example/Example.jsx
import React from 'react'
import PropTypes from 'prop-types'
import './Example.scss'

const Example = ({ title, children }) => {
  return (
    <div className="example-component">
      <h2>{title}</h2>
      <div className="example-content">
        {children}
      </div>
    </div>
  )
}

Example.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node
}

export default Example
