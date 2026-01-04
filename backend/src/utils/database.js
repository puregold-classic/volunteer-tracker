import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

class Database {
  constructor() {
    this._connect();
  }

  _connect() {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_demo';
    
    mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => {
      console.log('✅ MongoDB连接成功');
      console.log(`📊 数据库: ${mongoose.connection.db.databaseName}`);
    })
    .catch(err => {
      console.error('❌ MongoDB连接失败:', err.message);
      console.log('⚠️  请确保MongoDB服务正在运行');
      console.log('📌 启动MongoDB命令: mongod --dbpath=/path/to/data');
      process.exit(1);
    });

    // 连接事件监听
    mongoose.connection.on('connected', () => {
      console.log('📡 MongoDB已连接');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB连接错误:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB连接断开');
    });

    // 应用终止时关闭连接
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('👋 MongoDB连接已关闭');
      process.exit(0);
    });
  }
}

export default new Database();