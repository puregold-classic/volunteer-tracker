#!/bin/bash

echo "🔄 启动 MongoDB 数据库服务"
echo "========================"

# 检查 MongoDB 是否已安装
if ! command -v mongod &> /dev/null; then
    echo "❌ MongoDB 未安装"
    echo "请从以下地址下载安装："
    echo "https://www.mongodb.com/try/download/community"
    exit 1
fi

# 创建数据目录
DATA_DIR="/e/mongodb-data"
DB_DIR="$DATA_DIR/db"
LOG_DIR="$DATA_DIR/logs"

mkdir -p "$DB_DIR"
mkdir -p "$LOG_DIR"

echo "📁 数据目录: $DB_DIR"
echo "📝 日志目录: $LOG_DIR"

# 检查 MongoDB 是否已在运行
if netstat -ano 2>/dev/null | grep -q ":27017 "; then
    echo "✅ MongoDB 已在运行"
else
    echo "🚀 启动 MongoDB..."
    
    # 启动 MongoDB
    mongod --dbpath="$DB_DIR" --logpath="$LOG_DIR/mongod.log" --fork
    
    if [ $? -eq 0 ]; then
        echo "✅ MongoDB 启动成功"
        echo "📊 日志文件: $LOG_DIR/mongod.log"
    else
        echo "❌ MongoDB 启动失败"
        echo "请检查日志文件: $LOG_DIR/mongod.log"
        exit 1
    fi
fi

echo ""
echo "🔗 连接字符串: mongodb://localhost:27017"
echo "📚 数据库: volunteer_tracker"
echo ""
echo "🛑 停止 MongoDB 命令:"
echo "  mongod --dbpath=\"$DB_DIR\" --shutdown"
echo "  或"
echo "  在 mongo shell 中运行: db.adminCommand({ shutdown: 1 })"
