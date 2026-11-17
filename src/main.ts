import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.ts'
import { useDrillStore } from './stores/drill.ts'
import { useHistoricoStore } from './stores/historico.ts'
import './styles/tokens.css'

const app = createApp(App).use(createPinia()).use(router)

// O drill avisa o histórico a cada resposta registrada (o gancho da spec 4).
useDrillStore().definirGancho(useHistoricoStore().registrar)

app.mount('#app')
