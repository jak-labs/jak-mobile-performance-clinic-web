"use client"

import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react"
import { Track } from "livekit-client"
import { useRoomContext } from "@livekit/components-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

interface CustomVideoControlsProps {
  sessionDuration?: string
}

export function CustomVideoControls({ sessionDuration }: CustomVideoControlsProps) {
  const room = useRoomContext()
  const localParticipant = room.localParticipant
  const router = useRouter()
  
  // Track mic and camera states reactively
  const [isMicMuted, setIsMicMuted] = useState(true)
  const [isCameraOff, setIsCameraOff] = useState(true)

  useEffect(() => {
    if (!localParticipant) return

    const updateTrackStates = () => {
      const micPublications = Array.from(localParticipant.audioTrackPublications.values())
      const cameraPublications = Array.from(localParticipant.videoTrackPublications.values())
      const micPublication = micPublications.find(pub => pub.source === Track.Source.Microphone)
      const cameraPublication = cameraPublications.find(pub => pub.source === Track.Source.Camera)
      
      setIsMicMuted(micPublication ? micPublication.isMuted : true)
      setIsCameraOff(!cameraPublication || !cameraPublication.isSubscribed || cameraPublication.isMuted)
    }

    updateTrackStates()

    // Listen for track publication changes
    const handleTrackPublished = () => updateTrackStates()
    const handleTrackUnpublished = () => updateTrackStates()
    const handleTrackMuted = () => updateTrackStates()
    const handleTrackUnmuted = () => updateTrackStates()

    localParticipant.on('trackPublished', handleTrackPublished)
    localParticipant.on('trackUnpublished', handleTrackUnpublished)
    localParticipant.on('trackMuted', handleTrackMuted)
    localParticipant.on('trackUnmuted', handleTrackUnmuted)

    return () => {
      localParticipant.off('trackPublished', handleTrackPublished)
      localParticipant.off('trackUnpublished', handleTrackUnpublished)
      localParticipant.off('trackMuted', handleTrackMuted)
      localParticipant.off('trackUnmuted', handleTrackUnmuted)
    }
  }, [localParticipant])

  return (
    <>
      {/* Controls - White pill-shaped bar with simple black icons */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2.5 md:py-3 rounded-full z-50 max-w-[calc(100vw-2rem)] md:max-w-none bg-white shadow-lg"
        style={{ 
          bottom: 'calc(3vh + env(safe-area-inset-bottom, 0))'
        }}
      >
        <button
          onClick={async () => {
            const micPub = Array.from(localParticipant.audioTrackPublications.values())
              .find(pub => pub.source === Track.Source.Microphone)
            if (micPub?.track) {
              if (micPub.isMuted) {
                await micPub.track.unmute()
              } else {
                await micPub.track.mute()
              }
            }
          }}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-transparent hover:bg-gray-100/50 text-black rounded-full h-10 w-10 md:h-12 md:w-12"
        >
          {isMicMuted ? (
            <MicOff className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
          ) : (
            <Mic className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
          )}
        </button>
        <button
          onClick={async () => {
            const cameraPub = Array.from(localParticipant.videoTrackPublications.values())
              .find(pub => pub.source === Track.Source.Camera)
            if (cameraPub?.track) {
              if (cameraPub.isMuted) {
                await cameraPub.track.unmute()
              } else {
                await cameraPub.track.mute()
              }
            }
          }}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-transparent hover:bg-gray-100/50 text-black rounded-full h-10 w-10 md:h-12 md:w-12"
        >
          {isCameraOff ? (
            <VideoOff className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
          ) : (
            <Video className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
          )}
        </button>
        <button
          onClick={async () => {
            await room.disconnect()
            router.push('/')
          }}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 rounded-full h-10 w-10 md:h-12 md:w-12"
        >
          <PhoneOff className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2} />
        </button>
      </div>

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

