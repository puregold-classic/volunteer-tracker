# UI 页面设计草稿

每个文件对应一个页面，用 ASCII 布局描述当前实现，可在文件中直接标注修改意见。

| 文件 | 页面 | 对应组件 |
|---|---|---|
| [01-home.md](01-home.md) | 首页 | `HomePage.tsx` + `HomeMap` + `VolunteerList` |
| [02-me.md](02-me.md) | 个人中心 | `MePage.tsx` + `MeCenter.tsx` |
| [03-review.md](03-review.md) | 审核中心 | `ReviewPage.tsx` + `ReviewCenter.tsx` |
| [04-login.md](04-login.md) | 登录页 | `LoginPage.tsx` |
| [05-volunteer-detail.md](05-volunteer-detail.md) | 志愿者详情 | `VolunteerDetailPage.tsx` |

## 使用方式

在每个文件的 `## 修改意见` 区块中直接写你的想法，例如：

```
- [ ] 把筛选区移到左侧边栏
- [ ] 统计卡片改为横向滚动
- [ ] 地图缩小到 400px 高度
```

然后告诉我"按照 01-home 的修改意见更新"，我会直接读取并执行。
