/// <reference types="vite/client" />

// 声明Vite环境变量的类型
interface ImportMetaEnv {
  // 声明你的API基础地址变量（和代码里的VITE_API_BASE_URL对应）
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PROXY_TARGET?: string;
  readonly VITE_APP_ENV?: string;
  // 可添加其他Vite环境变量（比如VITE_APP_TITLE），格式：readonly 变量名: 类型;
  // readonly VITE_APP_TITLE: string;
}

// 扩展ImportMeta类型，让TS识别env属性
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
