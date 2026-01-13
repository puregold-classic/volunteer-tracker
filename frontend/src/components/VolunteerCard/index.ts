export { default } from './VolunteerCard';
export type { VolunteerCardProps } from './VolunteerCard';

/*
志愿者卡片组件样式
包含紧凑版(.volunteer-card--compact)和完整版(.volunteer-card--full)两种样式
基础类: .volunteer-card (基础卡片样式)
组件特性:
  - 悬停交互效果(阴影、位移、操作按钮显示)
  - 状态指示器(.status-indicator--active/inactive)
  - 信息展示区(姓名、ID、服务标签、统计数据)
  - 操作按钮区(.card-actions: 编辑、删除、收藏)
  - 响应式设计(移动端适配)
  - 暗黑模式支持
  - 打印样式优化
使用变量和mixin: var.$spacing-*, var.$color-*, mix.card(), mix.respond-to()等
包含特殊动画: shine(流光效果), float(漂浮效果)
*/