import config from './s4-current-browser.config.mjs'
import {fileURLToPath} from 'node:url'
// Existing test scope and external-network launch guards; static preview avoids dev filesystem watchers.
export default {...config,webServer:{command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',cwd:fileURLToPath(new URL('../',import.meta.url)),url:'http://127.0.0.1:4173',reuseExistingServer:false}}
