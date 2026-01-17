# 快速诊断脚本（保存为 check.sh）
#!/bin/bash
echo "1. 容器状态："
docker-compose ps
echo ""
echo "2. 后端日志："
docker-compose logs --tail=20 backend
echo ""
echo "3. 端口检查："
curl -f http://localhost:5000/api/health || echo "端口不通"
echo ""
echo "4. 数据库连接："
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"