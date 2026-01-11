#!/bin/bash
# 数据库管理脚本

set -e

case "$1" in
    seed)
        echo "🌱 初始化数据库..."
        docker-compose exec backend npm run seed
        ;;
    reset)
        echo "🔄 重置数据库..."
        docker-compose down -v
        docker-compose up -d mongodb
        sleep 3
        docker-compose exec backend npm run seed
        ;;
    backup)
        echo "💾 备份数据库..."
        BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).gz"
        docker-compose exec mongodb mongodump --archive --gzip --db volunteer_tracker > "$BACKUP_FILE"
        echo "✅ 备份完成: $BACKUP_FILE"
        ;;
    restore)
        if [ -z "$2" ]; then
            echo "❌ 请指定备份文件"
            exit 1
        fi
        echo "📤 恢复数据库..."
        docker-compose exec mongodb mongorestore --archive --gzip --db volunteer_tracker < "$2"
        ;;
    shell)
        echo "🐚 进入MongoDB Shell..."
        docker-compose exec mongodb mongosh volunteer_tracker
        ;;
    *)
        echo "📋 数据库管理命令:"
        echo "  ./scripts/dev/database.sh seed     - 初始化数据"
        echo "  ./scripts/dev/database.sh reset   - 重置数据库"
        echo "  ./scripts/dev/database.sh backup  - 备份数据库"
        echo "  ./scripts/dev/database.sh restore <file> - 恢复数据库"
        echo "  ./scripts/dev/database.sh shell   - 进入MongoDB Shell"
        exit 1
        ;;
esac