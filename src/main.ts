import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'sv-print/dist/style.css'
import 'print-canvas-designer/style.css'
import App from './App.vue'
import './style.css'

createApp(App).use(ElementPlus).mount('#app')
