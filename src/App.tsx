import { DawStore } from './state/DawStore'
import { DawProvider } from './context/DawProvider'
import { getAudioEngine } from './engine/engineSingleton'
import { DEFAULT_PROJECT_DOCUMENT, DEFAULT_UI_STATE } from './state/defaultState'
import Layout from './components/Layout'

const _store = new DawStore(getAudioEngine(), {
  project: DEFAULT_PROJECT_DOCUMENT,
  ui: DEFAULT_UI_STATE,
})

export default function App() {
  return (
    <DawProvider store={_store}>
      <Layout />
    </DawProvider>
  )
}
