const mongoose = require('mongoose');

class Database {
  constructor() {
    this.mongoose = mongoose;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) {
      console.log('✅ 使用现有数据库连接');
      return;
    }

    try {
      const dbUri = process.env.MONGODB_URI;
      
      if (!dbUri) {
        throw new Error('MONGODB_URI 未在环境变量中定义');
      }

      console.log('🔗 正在连接到 MongoDB...');
      
      await mongoose.connect(dbUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      console.log(`✅ MongoDB 连接成功: ${mongoose.connection.host}`);
      
      // 监听连接事件
      mongoose.connection.on('error', (err) => {
        console.error(`❌ MongoDB 连接错误: ${err}`);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB 断开连接');
        this.isConnected = false;
      });

      // 优雅关闭
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('👋 MongoDB 连接已关闭');
        process.exit(0);
      });

    } catch (error) {
      console.error(`❌ 数据库连接失败: ${error.message}`);
      console.log('💡 提示: 请确保 MongoDB 服务正在运行');
      console.log('   启动命令: mongod --dbpath="你的数据目录"');
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    if (!this.isConnected) return;
    
    await mongoose.connection.close();
    this.isConnected = false;
    console.log('✅ 数据库已断开连接');
  }

  async healthCheck() {
    try {
      await mongoose.connection.db.admin().ping();
      return {
        status: 'healthy',
        connection: mongoose.connection.readyState,
        host: mongoose.connection.host,
        database: mongoose.connection.name
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new Database();
