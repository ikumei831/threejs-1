import { defineConfig } from 'vite';
import obfuscator from 'vite-plugin-javascript-obfuscator';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  server: {
    host: true,
    allowedHosts: [
      'subereous-kathline-unexotically.ngrok-free.dev'
    ]
  },
  plugins: [
    obfuscator({
      apply: 'build',
      options: {
        compact: true,
        controlFlowFlattening: true,         // 控制流平坦化（讓代碼邏輯變極度複雜）
        controlFlowFlatteningThreshold: 1,   // 提高平坦化機率（預設是 0.75）
        deadCodeInjection: true,             // 注入死代碼
        deadCodeInjectionThreshold: 1,
        
        // === 以下為加強防禦功能 ===
        selfDefending: true,                 // 自我防禦：如果有人試圖在 F12 裡美化/格式化程式碼，代碼會直接崩潰無法執行
        disableConsoleOutput: false,         // 禁用所有 console.log，防止別人從控制台印出變數
        
        //debugProtection: true,             // 開啟除錯保護
        //debugProtectionInterval: 2000,     // 每 2 秒強制觸發一個 debugger 斷點
      }
    })
  ],
  build: {
    sourcemap: false,
    minify: true,
    chunkSizeWarningLimit: 1500,
    // 🌟 核心修正：rollupOptions 必須好好的待在 build 的肚子裡！
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        testxr: resolve(__dirname, 'testxr.html'),
        testxr2: resolve(__dirname, 'testxr2.html'),
        testxr3: resolve(__dirname, 'testxr3.html'),
        testxr4: resolve(__dirname, 'testxr4.html'),
      },
    }
  }
});