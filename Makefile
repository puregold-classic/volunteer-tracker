# Volunteer Tracker 开发命令

.PHONY: help dev start stop restart logs seed test clean recover

help:
	@echo "📋 志愿者管理系统开发命令"
	@echo ""
	@echo "开发环境:"
	@echo "  make dev         稳定启动（后端健康检查 + 前端）"
	@echo "  make start       启动开发环境"
	@echo "  make stop        停止开发环境"
	@echo "  make restart     重启开发环境"
	@echo "  make logs        查看容器日志"
	@echo "  make recover     快速恢复后端依赖并重启"
	@echo ""
	@echo "数据库:"
	@echo "  make seed        初始化数据库"
	@echo "  make db-shell    进入数据库Shell"
	@echo "  make db-reset    重置数据库"
	@echo ""
	@echo "测试:"
	@echo "  make test        运行测试"
	@echo "  make lint        代码检查"
	@echo ""
	@echo "工具:"
	@echo "  make clean       清理临时文件"
	@echo "  make status      查看服务状态"

dev:
	@./scripts/dev/up.sh

start:
	@./scripts/dev/up.sh

stop:
	@docker-compose down

restart: stop start

logs:
	@docker-compose logs -f

seed:
	@docker-compose exec backend npm run seed

db-shell:
	@docker-compose exec mongodb mongosh volunteer_tracker

db-reset:
	@docker-compose down -v
	@docker-compose up -d mongodb
	@sleep 3
	@docker-compose exec backend npm run seed

test:
	@docker-compose exec backend npm test

lint:
	@docker-compose exec backend npm run lint

clean:
	@docker system prune -f
	@rm -rf frontend/node_modules backend/node_modules
	@find . -name "*.log" -delete

status:
	@docker-compose ps
	@echo ""
	@echo "🌐 服务状态:"
	@curl -s http://localhost:5000/api/health | python3 -m json.tool || echo "后端服务未运行"

recover:
	@docker-compose exec -u root backend npm install
	@docker-compose restart backend
	@docker-compose logs --tail=80 backend
