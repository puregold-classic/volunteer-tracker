# 创建根目录结构
mkdir -p frontend/src/components/VolunteerCard
mkdir -p frontend/src/services
mkdir -p frontend/src/utils
mkdir -p frontend/public

mkdir -p backend/src/models
mkdir -p backend/src/routes
mkdir -p backend/src/middleware
mkdir -p backend/src/utils

mkdir -p data
mkdir -p scripts
mkdir -p docs

# 创建关键文件
touch frontend/src/App.jsx
touch frontend/src/main.jsx
touch frontend/index.html
touch frontend/package.json
touch frontend/vite.config.js

touch backend/src/server.js
touch backend/package.json
touch backend/.env.example

touch data/volunteers.json
touch docker-compose.yml
touch .gitignore
touch README.md

# 创建组件文件
touch frontend/src/components/VolunteerCard/VolunteerCard.jsx
touch frontend/src/components/VolunteerCard/VolunteerCard.scss
touch frontend/src/components/VolunteerCard/index.js

# 创建服务文件
touch frontend/src/services/api.js
touch frontend/src/services/volunteerService.js

# 创建后端文件
touch backend/src/models/Volunteer.js
touch backend/src/routes/volunteerRoutes.js
touch backend/src/middleware/errorHandler.js