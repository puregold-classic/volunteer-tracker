// src/utils/transactionUtils.js
import mongoose from 'mongoose';

/**
 * MongoDB事务处理工具
 * 封装事务操作，提供重试机制
 */
class TransactionUtils {
  
  /**
   * 执行事务操作
   * @param {Function} operations - 要执行的操作函数
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<any>} - 事务结果
   */
  static async executeTransaction(operations, maxRetries = 3) {
    const session = await mongoose.startSession();
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        let result;
        
        await session.withTransaction(async () => {
          console.log(`事务开始 (尝试 ${retries + 1}/${maxRetries})`);
          result = await operations(session);
          console.log('事务操作完成');
        });
        
        await session.endSession();
        console.log('事务提交成功');
        return result;
        
      } catch (error) {
        await session.endSession();
        retries++;
        
        console.error(`事务失败 (尝试 ${retries}/${maxRetries}):`, error.message);
        
        // 如果是可重试错误
        if (this.isRetryableError(error) && retries < maxRetries) {
          const delay = Math.pow(2, retries) * 100; // 指数退避
          console.log(`等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // 达到最大重试次数或不可重试错误
        throw new Error(`事务执行失败: ${error.message}`);
      }
    }
  }
  
  /**
   * 检查是否为可重试错误
   * @private
   */
  static isRetryableError(error) {
    const retryableCodes = [
      'TransientTransactionError',
      'WriteConflict',
      'PrimarySteppedDown',
      'ExceededTimeLimit'
    ];
    
    return retryableCodes.includes(error.code) || 
           error.message.includes('WriteConflict') ||
           error.message.includes('transaction');
  }
  
  /**
   * 批量操作的事务包装器
   * @param {Array} items - 要处理的项
   * @param {Function} processItem - 处理每个项的函数
   * @param {number} batchSize - 每批大小
   * @returns {Promise<Array>} - 处理结果
   */
  static async batchTransaction(items, processItem, batchSize = 10) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const batchResult = await this.executeTransaction(async (session) => {
          const batchPromises = batch.map(item => processItem(item, session));
          return Promise.all(batchPromises);
        });
        
        results.push(...batchResult);
        console.log(`批次 ${Math.floor(i/batchSize) + 1} 处理成功`);
        
      } catch (error) {
        console.error(`批次 ${Math.floor(i/batchSize) + 1} 处理失败:`, error);
        errors.push({
          batch: Math.floor(i/batchSize) + 1,
          error: error.message,
          items: batch
        });
      }
    }
    
    return {
      success: results,
      errors: errors.length > 0 ? errors : null,
      summary: {
        total: items.length,
        succeeded: results.length,
        failed: errors.reduce((sum, err) => sum + err.items.length, 0),
        batches: Math.ceil(items.length / batchSize)
      }
    };
  }
}

export default TransactionUtils;