import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'floating-vue/dist/style.css'
import FloatingVue from 'floating-vue'
import VideoWallApp from './VideoWallApp.vue'

const app = createApp(VideoWallApp);
app.use(createPinia());
app.use(FloatingVue);
app.mount('#app');
