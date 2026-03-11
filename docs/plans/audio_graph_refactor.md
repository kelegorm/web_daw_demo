# Plan: Audio Graph Refactor

## Overview

Устранить архитектурные проблемы, выявленные в system map report:
- Граф аудио собирается в нескольких местах одновременно (нет единого composition root)
- Публичные контракты хуков протекают платформенными объектами (`AudioNode`, `Tone.*`)
- Ресурсы создаются во время рендера без явного dispose-lifecycle
- Transport policy и UI напрямую зависят от `Tone.getTransport()` internals
- `noteOff` использует `setTimeout` вместо audio-time scheduling
- Конфликтующие источники правды в документации (WASM/AudioWorklet vs Tone.js)

Validation:
- `npm run test`
- `npm run test:e2e`
- `npm run build`

---

### Task 1: Intent-level контракты хуков — убрать утечку платформенных объектов

- [ ] Определить интерфейс `AudioModule` в `src/engine/types.ts`: `{ input?: AudioNode; output?: AudioNode; dispose(): void }`
- [ ] Определить интерфейс `MeterSource` в `src/engine/types.ts`: `{ observeMeter(cb: (rms: number) => void): () => void }`
- [ ] В `useToneSynth` убрать `get*Node()` геттеры из публичного контракта; synth-объект остаётся внутри engine
- [ ] В `usePanner` убрать экспорт `ToneAudioNode` / `AudioNode`; контракт: `{ setPan, setEnabled, isEnabled }`
- [ ] В `useLimiter` убрать экспорт `AudioNode`; контракт: `{ setThreshold, setEnabled, isEnabled }`
- [ ] `VUMeter` переключить на `MeterSource.observeMeter` вместо прямого `AnalyserNode` (`VUMeter.tsx#L10`)
- [ ] `TrackZone` убрать прямое использование `Tone.ToneAudioNode` / `AudioNode` (`TrackZone.tsx#L48`)
- [ ] Написать Vitest тест: публичный тип `usePanner` не содержит поля типа `AudioNode`
- [ ] Написать Vitest тест: `MeterSource.observeMeter` вызывает callback с числом в диапазоне 0–1
- [ ] Отметить выполненным

### Task 2: Единый composition root — `createAudioEngine`

- [ ] Создать `src/engine/audioEngine.ts` с функцией `createAudioEngine(): AudioEngine`
- [ ] `AudioEngine` содержит внутри все узлы: synth, panner, limiter, analyser, destination; модули реализуют `AudioModule` из Task 1
- [ ] Граф собирается внутри `createAudioEngine` по схеме: `synth.output → panner → limiter → analyser → destination`
- [ ] Убрать самостоятельное подключение к destination из `createToneSynth` (`useToneSynth.ts#L40`)
- [ ] Убрать самостоятельное подключение к destination из `createPanner` (`usePanner.ts#L67`)
- [ ] Убрать disconnect/reconnect вставку из `useLimiter` (`useLimiter.ts#L40`) — лимитер подключается только через `createAudioEngine`
- [ ] Убрать ручной disconnect/reconnect в `App.tsx#L29`
- [ ] Написать Vitest тест: `createAudioEngine()` возвращает объект с полями `synth`, `panner`, `limiter`, `analyser`
- [ ] Написать Vitest тест: после `createAudioEngine()` граф замкнут (analyser подключён к destination)
- [ ] Отметить выполненным

### Task 3: Явный lifecycle — `useEffect` + `dispose`

- [ ] Создать хук `useAudioEngine` в `src/hooks/useAudioEngine.ts`, который инициализирует `createAudioEngine()` в `useEffect` и вызывает `engine.dispose()` в cleanup
- [ ] `AudioEngine` реализует `dispose()`: вызывает `dispose()` на synth, panner, limiter; разрывает все соединения
- [ ] Убрать создание аудио-ресурсов из render-path инициализации хуков (`useToneSynth.ts#L126`, `usePanner.ts#L182`, `useLimiter.ts#L100`)
- [ ] Убрать прямое создание AudioContext/Tone-объектов в `main.tsx#L7`; инициализация только через `useAudioEngine`
- [ ] Проверить корректность в StrictMode: двойной mount/unmount не создаёт дубликатов графа
- [ ] Написать Vitest тест: после `dispose()` вызов `noteOn` не бросает исключений, просто no-op
- [ ] Написать Playwright тест: перезагрузка страницы не оставляет AudioContext в состоянии `running` после unmount
- [ ] Отметить выполненным

### Task 4: Transport service — убрать прямые вызовы `Tone.getTransport()` из UI

- [ ] Создать `src/engine/transportService.ts` с интерфейсом `TransportService`: `{ isPlaying: boolean; positionSeconds: number; currentStep: number; play(); stop(); setBpm(bpm: number) }`
- [ ] `useTransportController` (`useTransportController.ts#L83`) проксирует вызовы через `TransportService`, убрать прямой `Tone.getTransport()` из контракта
- [ ] `useSequencer` (`useSequencer.ts#L38`) получает `TransportService`, убрать прямой `Tone.getTransport()`
- [ ] `TrackZone` (`TrackZone.tsx#L88`) читает `playheadPos` / `positionSeconds` из `useTransportController`, не из Tone напрямую
- [ ] Написать Vitest тест: `TransportService.play()` переводит `isPlaying` в `true`
- [ ] Написать Vitest тест: `TransportService.stop()` сбрасывает `positionSeconds` в 0
- [ ] Написать Playwright тест: нажать Play, убедиться что playhead движется без прямого обращения к Tone в компоненте
- [ ] Отметить выполненным

### Task 5: Единая модель таймирования — убрать `setTimeout` из noteOff

- [ ] В `useSequencer.ts#L43` заменить `setTimeout` для `noteOff` на `TransportService.scheduleOnce` (зависит от Task 4)
- [ ] `noteOff` должен планироваться в audio-time через тот же механизм, что и `noteOn`
- [ ] Проверить поведение при смене BPM во время воспроизведения: длительность ноты должна пересчитываться
- [ ] Проверить поведение при паузе/возобновлении: ноты не должны зависать
- [ ] Написать Vitest тест: при BPM 120 и длительности 1 beat, `noteOff` наступает через ~500ms audio-time
- [ ] Написать Vitest тест: `noteOff` не вызывается после `stop()` транспорта
- [ ] Отметить выполненным

### Task 6: Выравнивание документации — единый источник правды

- [ ] Обновить `AGENTS.md#L7`: убрать упоминания AudioWorklet/WASM как активного runtime; зафиксировать Tone.js как текущий бэкенд
- [ ] Обновить `CLAUDE.md`: привести раздел Architecture в соответствие с новым `createAudioEngine` / `TransportService`
- [ ] Исправить `scripts/build-wasm.js#L15` и `package.json#L12` (`build:wasm`): либо убрать нерабочий скрипт, либо пометить как `experimental` с пояснением
- [ ] Создать `docs/architecture/audio_engine.md`: описать граф, контракты `AudioModule` / `MeterSource` / `TransportService`, lifecycle
- [ ] Отметить выполненным
