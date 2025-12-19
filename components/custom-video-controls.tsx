
"use client"

import { PhoneOff } from "lucide-react"
import { Track } from "livekit-client"
import { useRoomContext, TrackToggle, MediaDeviceMenu } from "@livekit/components-react"
import { useRouter } from "next/navigation"

interface CustomVideoControlsProps {
  sessionDuration?: string
  isRecording?: boolean
  onStartRecording?: () => void
  onStopRecording?: () => void
  showRecordButton?: boolean
}

export function CustomVideoControls({ 
  sessionDuration, 
  isRecording = false,
  onStartRecording,
  onStopRecording,
  showRecordButton = false
}: CustomVideoControlsProps) {
  const room = useRoomContext()
  const router = useRouter()

  return (
    <>
      {/* Controls - Dark rounded bar with icon-only buttons and dropdown chevrons */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-2 rounded-full z-50 bg-black/70 backdrop-blur-sm border border-white/10 shadow-lg"
        style={{ 
          bottom: 'calc(3vh + env(safe-area-inset-bottom, 0))'
        }}
      >
        {/* Microphone with dropdown - icon only */}
        <div className="lk-button-group flex items-center">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={true}
            className="text-white hover:bg-white/10 rounded-full p-2 transition-colors"
          />
          <div className="lk-button-group-menu">
            <MediaDeviceMenu kind="audioinput" />
          </div>
        </div>

        {/* Camera with dropdown - icon only */}
        <div className="lk-button-group flex items-center">
          <TrackToggle
            source={Track.Source.Camera}
            showIcon={true}
            className="text-white hover:bg-white/10 rounded-full p-2 transition-colors"
          />
          <div className="lk-button-group-menu">
            <MediaDeviceMenu kind="videoinput" />
          </div>
        </div>

        {/* Leave button - icon only */}
        <button
          onClick={async () => {
            await room.disconnect()
            router.push('/')
          }}
          className="inline-flex items-center justify-center text-white hover:bg-white/10 rounded-full p-2 transition-colors"
        >
          <PhoneOff className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {/* Record button - separate, large, positioned next to control panel */}
      {showRecordButton && (
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className="absolute z-50 flex items-center justify-center transition-all hover:scale-105"
          style={{ 
            bottom: 'calc(3vh + env(safe-area-inset-bottom, 0) + 5px)',
            left: 'calc(50% + 110px)'
          }}
        >
          <div className={`relative flex items-center gap-2.5 border-2 border-white rounded-lg px-5 py-3.5 ${isRecording ? 'bg-red-600/20' : 'bg-black/70 backdrop-blur-sm'} shadow-lg`}>
            <div className="relative">
              {isRecording && (
                <div className="absolute inset-0 h-3.5 w-3.5 rounded-full bg-red-600 animate-ping opacity-75" />
              )}
              <div className="relative h-3.5 w-3.5 rounded-full bg-red-600" />
            </div>
            <span className="text-base font-bold text-white leading-none">RECORD</span>
          </div>
        </button>
      )}

      {/* Custom styles for LiveKit components */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .lk-button-group button {
            color: white !important;
            background: transparent !important;
            border: none !important;
            padding: 0.5rem !important;
          }
          .lk-button-group button svg {
            color: white !important;
            stroke: white !important;
          }
          .lk-button-group button:hover {
            background-color: rgba(255, 255, 255, 0.1) !important;
          }
          .lk-button-group-menu {
            margin-left: 0;
          }
          .lk-button-group-menu button {
            padding: 0.5rem !important;
            min-width: auto !important;
            color: white !important;
            background: transparent !important;
          }
          .lk-button-group-menu button svg {
            color: white !important;
            stroke: white !important;
          }
        `
      }} />

      {/* Session info - Clean, minimal badges */}
      {sessionDuration && (
        <div className="absolute top-4 md:top-6 right-4 md:right-6 bg-black/30 backdrop-blur-sm px-3 md:px-4 py-2 md:py-2.5 rounded-xl z-10 border border-white/10">
          <p className="text-[7px] md:text-[8px] text-white/60 uppercase tracking-wider mb-0.5">Session Duration</p>
          <p className="text-[9px] md:text-[11px] font-mono font-semibold text-white mb-1">{sessionDuration}</p>
          {/* Connected status - smaller, inside Session Duration box */}
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-white/10">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
            <span className="text-[8px] md:text-[10px] font-medium text-white/80">Connected</span>
          </div>
        </div>
      )}
    </>
  )
}

