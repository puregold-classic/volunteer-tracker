# Volunteer Tracker — 开发命令 (v2.1)
#
# 全部以 v2.1 schema 为准。v1 残留命令（seed-quality / backfill-accounts /
# migrate-* / db-shell→mongodb / etc）已删除——它们指向不存在的 npm scripts，
# 跑了只会出错。

.PHONY: help \
        dev start stop restart logs status recover \
        seed db-migrate db-generate db-studio db-reset \
        test test-watch test-coverage lint \
        backup backup-list restore \
        clean

help:
	@echo "📋 志愿者管理系统命令 (v2.1)"
	@echo ""
	@echo "本地开发（docker-compose.yml）:"
	@echo "  make dev          稳定启动 backend + postgres，前端单独 npm run dev"
	@echo "  make start        同 dev"
	@echo "  make stop         停掉本地容器"
	@echo "  make restart      重启"
	@echo "  make logs         看本地容器日志"
	@echo "  make status       查看运行状态 + 后端健康检查"
	@echo "  make recover      backend 依赖出问题时的恢复"
	@echo ""
	@echo "数据库 (本地 dev):"
	@echo "  make seed         跑 prisma db seed (10 部门 + 50 service items + 4 测试账号)"
	@echo "  make db-migrate   prisma migrate dev (开发期建迁移)"
	@echo "  make db-generate  prisma generate (生成 client)"
	@echo "  make db-studio    打开 prisma studio 可视化"
	@echo "  make db-reset     完全重置 (down -v + up + migrate deploy + seed)"
	@echo ""
	@echo "测试 + 检查:"
	@echo "  make test         vitest run（service 单元测试，纯 mock 不需要 DB）"
	@echo "  make test-watch   vitest watch"
	@echo "  make test-coverage vitest run --coverage"
	@echo "  make lint         eslint"
	@echo ""
	@echo "Mac mini sandbox 备份 (deploy 栈):"
	@echo "  make backup       手动备份一次（详见 docs/deploy/backup-strategy.md）"
	@echo "  make backup-list  列出现有备份"
	@echo "  make restore      恢复最新一份备份（destructive，会要求 RESTORE 确认）"
	@echo ""
	@echo "工具:"
	@echo "  make clean        清理 docker 资源 + node_modules + log"

# ─── 本地开发栈（docker-compose.yml — postgres + backend，前端 npm run dev） ────

dev:
	@./scripts/dev/up.sh

start: dev

stop:
	@docker compose down

restart: stop start

logs:
	@docker compose logs -f

status:
	@docker compose ps
	@echo ""
	@echo "🌐 后端健康检查:"
	@curl -s http://localhost:5000/api/health | python3 -m json.tool || echo "后端服务未运行"

recover:
	@docker compose exec -u root backend npm install
	@docker compose restart backend
	@docker compose logs --tail=80 backend

# ─── 数据库 (本地 dev) ────────────────────────────────────────────────────────

seed:
	@docker compose exec -T backend npx prisma db seed

db-migrate:
	@docker compose exec -T backend npx prisma migrate dev

db-generate:
	@docker compose exec -T backend npx prisma generate

db-studio:
	@docker compose exec backend npx prisma studio

db-reset:
	@docker compose down -v
	@docker compose up -d
	@sleep 5
	@docker compose exec -T backend npx prisma migrate deploy
	@docker compose exec -T backend npx prisma db seed

# ─── 测试 ───────────────────────────────────────────────────────────────────

test:
	@cd backend && npx vitest run

test-watch:
	@cd backend && npx vitest

test-coverage:
	@cd backend && npx vitest run --coverage

lint:
	@cd backend && npm run lint

# ─── Mac mini sandbox 备份 (deploy 栈) ───────────────────────────────────────
# 这些 target 在 Mac mini 上跑，要走 deploy 栈。详见 docs/deploy/backup-strategy.md。

backup:
	@./scripts/deploy/pg-backup.sh

backup-list:
	@ls -lht data/backups/ 2>/dev/null || echo "尚无备份目录"

restore:
	@./scripts/deploy/pg-restore.sh latest

# ─── 工具 ───────────────────────────────────────────────────────────────────

clean:
	@docker system prune -f
	@rm -rf frontend/node_modules backend/node_modules
	@find . -name "*.log" -delete
