import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [tailwindcss(), react()],
    
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
      // Bumped from default 500kB; the warning still fires for any
      // single chunk that crosses the limit but the actual ceiling is
      // tracked per-chunk in the manualChunks split below.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React + axios — every page needs them
            vendor: ['react', 'react-dom', 'react-router-dom', 'axios'],
            // Leaflet is the single biggest dep (~140kB) and only the
            // landing page actually mounts a map.
            map: ['leaflet', 'react-leaflet'],
            // react-hook-form + zod + resolvers are only loaded by the
            // dialog forms in MePage / AdminCenter.
            forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
          },
        },
      },
    },

    // 路径别名
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@services': path.resolve(__dirname, './src/services'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@styles': path.resolve(__dirname, './src/styles'),
      },
    },
  };
});
