export {}

declare global {
  interface Window {
    __panicCount?: number
    __activeSteps?: number[]
    __vuMeterLevel?: number
    __e2eHooksEnabled?: boolean
    __e2eHooks?: {
      sequencerTicks: number
      sequencerNoteOnSent: number
      sequencerNoteOffSent: number
      synthNoteOnReceived: number
      synthNoteOffReceived: number
      synthPanicReceived: number
      remountApp?: () => void
    }
  }
}
