import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    
    server: {
      port: 3000,
      host: true, // 监听所有地址
      open: true, // 自动打开浏览器
      
      // 开发环境代理配置
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => {
            // 如果前端请求 /api/v1/xxx，保持原样
            // 如果前端请求 /v1/xxx，加上 /api
            if (path.startsWith('/v1/')) {
              return `/api${path}`;
            }
            return path;
          },
          ws: true, // 支持WebSocket
          
          // 代理事件监听，便于调试
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log(`[DEV PROXY] ${req.method} ${req.url} → ${options.target}`);
            });
            
            proxy.on('error', (err, req, res) => {
              console.error('[DEV PROXY ERROR]', err);
            });
          }
        }
      }
    },
    
    // 构建配置
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'axios'],
            ui: ['@components']
          }
        }
      }
    },
    
    // 路径别名
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@services': path.resolve(__dirname, './src/services'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@styles': path.resolve(__dirname, './src/styles')
      }
    },
    
    // CSS预处理器配置
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
            @import "@styles/variables.scss";
            @import "@styles/mixins.scss";
            @import "@styles/animations.scss";
          `
        }
      }
    }
  };
});