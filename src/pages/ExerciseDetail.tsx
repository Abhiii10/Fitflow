import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getExerciseByName, CATEGORY_COLORS } from '@/data/exerciseLibrary'

const categoryAccentMap: Record<string, string> = {
  chest: 'text-red-400',
  back: 'text-cyber-green',
  shoulders: 'text-cyber-cyan',
  arms: 'text-yellow-400',
  legs: 'text-purple-400',
  core: 'text-orange-400',
  cardio: 'text-blue-400',
}

function getYouTubeEmbedUrl(urlOrId?: string): string | undefined {
  if (!urlOrId) return undefined

  if (/^[\w-]{11}$/.test(urlOrId)) {
    return `https://www.youtube-nocookie.com/embed/${urlOrId}`
  }

  try {
    const url = new URL(urlOrId)
    const hostname = url.hostname.replace(/^www\./, '')
    const idFromQuery = url.searchParams.get('v')
    const idFromShortUrl = hostname === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : undefined
    const idFromEmbed = url.pathname.includes('/embed/') ? url.pathname.split('/embed/')[1]?.split('/')[0] : undefined
    const videoId = idFromQuery ?? idFromShortUrl ?? idFromEmbed

    if ((hostname === 'youtube.com' || hostname === 'youtu.be' || hostname === 'youtube-nocookie.com') && videoId) {
      return `https://www.youtube-nocookie.com/embed/${videoId}`
    }
  } catch {
    return undefined
  }

  return undefined
}

function DemoFrame({
  title,
  embedUrl,
}: {
  title: string
  embedUrl: string
}) {
  return (
    <iframe
      className="aspect-video w-full bg-black"
      src={embedUrl}
      title={`${title} demo`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
    />
  )
}

function ExerciseDemo({
  exercise,
  accentColor,
}: {
  exercise: NonNullable<ReturnType<typeof getExerciseByName>>
  accentColor: string
}) {
  const demoSearchUrl =
    exercise.externalDemoUrl ??
    `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.videoSearchQuery ?? `${exercise.name} exercise form demo`)}`
  const embedUrl =
    exercise.demoEmbedUrl ??
    getYouTubeEmbedUrl(exercise.youtubeVideoId) ??
    getYouTubeEmbedUrl(exercise.externalDemoUrl)
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (embedUrl) {
    return (
      <>
        <div className="mb-4 overflow-hidden rounded-xl border border-cyber-border bg-cyber-black/50">
          <div className="group relative aspect-video w-full overflow-hidden bg-black">
            <DemoFrame title={exercise.name} embedUrl={embedUrl} />
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/10"
              aria-label={`Play ${exercise.name} demo`}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-cyber-green/50 bg-cyber-black/80 text-cyber-green shadow-glow-green">
                <svg className="ml-1 h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          </div>
          {(exercise.demoCaption || exercise.demoCredit) && (
            <div className="px-3 py-2 text-xs text-cyber-dim">
              {exercise.demoCaption && <div>{exercise.demoCaption}</div>}
              {exercise.demoCredit && (
                <a
                  href={exercise.demoSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[10px] font-mono text-cyber-dim/70 hover:text-cyber-green"
                >
                  Video: {exercise.demoCredit}
                </a>
              )}
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-3 py-6">
            <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-cyber-border bg-cyber-black shadow-glow-green">
              <div className="flex items-center justify-between border-b border-cyber-border px-3 py-2">
                <div className="min-w-0 truncate font-mono text-sm text-cyber-text">{exercise.name}</div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded p-2 text-cyber-dim transition-colors hover:text-cyber-green"
                  aria-label="Close demo"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <DemoFrame title={exercise.name} embedUrl={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`} />
            </div>
          </div>
        )}
      </>
    )
  }

  if (exercise.demoVideoPath) {
    return (
      <div className="mb-4 overflow-hidden rounded-xl border border-cyber-border bg-cyber-black/50">
        <video
          className="aspect-video w-full bg-black object-cover"
          src={exercise.demoVideoPath}
          poster={exercise.demoImagePath}
          controls
          playsInline
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
        {(exercise.demoCaption || exercise.demoCredit) && (
          <div className="px-3 py-2 text-xs text-cyber-dim">
            {exercise.demoCaption && <div>{exercise.demoCaption}</div>}
            {exercise.demoCredit && (
              <a
                href={exercise.demoSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[10px] font-mono text-cyber-dim/70 hover:text-cyber-green"
              >
                Video: {exercise.demoCredit}
              </a>
            )}
          </div>
        )}
      </div>
    )
  }

  if (exercise.demoImagePath) {
    return (
      <div className="mb-4 overflow-hidden rounded-xl border border-cyber-border bg-cyber-black/50">
        <img
          className="aspect-video w-full bg-black object-cover"
          src={exercise.demoImagePath}
          alt={`${exercise.name} demo`}
          loading="lazy"
        />
        {(exercise.demoCaption || exercise.demoCredit) && (
          <div className="px-3 py-2 text-xs text-cyber-dim">
            {exercise.demoCaption && <div>{exercise.demoCaption}</div>}
            {exercise.demoCredit && (
              <a
                href={exercise.demoSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[10px] font-mono text-cyber-dim/70 hover:text-cyber-green"
              >
                Image: {exercise.demoCredit}
              </a>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-xl border border-cyber-border bg-cyber-black/50 flex flex-col items-center justify-center px-4 py-10 gap-3 text-center">
      <svg className="w-12 h-12 text-cyber-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
      <span className="text-[11px] font-mono text-cyber-dim/50">No local demo added yet</span>
      <a
        href={demoSearchUrl}
        target="_blank"
        rel="noreferrer"
        className={`text-xs font-mono ${accentColor} hover:underline`}
      >
        {exercise.externalDemoUrl ? 'Open available demo' : 'Find a form demo'}
      </a>
    </div>
  )
}

export function ExerciseDetail() {
  const { name } = useParams<{ name: string }>()
  const exercise = getExerciseByName(decodeURIComponent(name ?? ''))

  if (!exercise) {
    return (
      <div className="page-container">
        <Link to="/exercises" className="flex items-center gap-2 text-cyber-dim hover:text-cyber-green font-mono text-sm mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Library
        </Link>
        <div className="card text-center py-10 text-cyber-dim font-mono">Exercise not found</div>
      </div>
    )
  }

  const accentColor = categoryAccentMap[exercise.category] ?? 'text-cyber-green'

  return (
    <div className="page-container">
      <Link to="/exercises" className="flex items-center gap-2 text-cyber-dim hover:text-cyber-green font-mono text-sm mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Library
      </Link>

      {/* Header */}
      <div className="mb-5">
        <h1 className={`text-xl font-mono font-bold tracking-tight ${accentColor}`}>{exercise.name}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${CATEGORY_COLORS[exercise.category]}`}>
            {exercise.category}
          </span>
          {exercise.equipment.map(e => (
            <span key={e} className="text-[11px] font-mono px-2 py-0.5 rounded border border-cyber-border text-cyber-dim">
              {e}
            </span>
          ))}
        </div>
      </div>

      <ExerciseDemo exercise={exercise} accentColor={accentColor} />

      {/* Target Muscles */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-2">Target Muscles</h2>
        <div className="flex flex-wrap gap-2">
          {exercise.targetMuscles.map(m => (
            <span key={m} className={`text-sm font-mono ${accentColor}`}>{m}</span>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-3">How to Perform</h2>
        <ol className="space-y-2">
          {exercise.instructions.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className={`flex-shrink-0 w-5 h-5 rounded-full border text-[11px] font-mono flex items-center justify-center ${accentColor} border-current`}>
                {i + 1}
              </span>
              <span className="text-sm text-cyber-text">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Form Cues */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-2">Key Form Cues</h2>
        <ul className="space-y-1.5">
          {exercise.formCues.map((cue, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="text-cyber-green flex-shrink-0">→</span>
              <span className="text-cyber-text">{cue}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Common Mistakes */}
      <div className="card mb-3">
        <h2 className="text-xs font-mono text-cyber-dim uppercase tracking-widest mb-2">Common Mistakes</h2>
        <ul className="space-y-1.5">
          {exercise.commonMistakes.map((m, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="text-red-400 flex-shrink-0">✗</span>
              <span className="text-cyber-text">{m}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Safety Note */}
      {exercise.safetyNotes && (
        <div className="p-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 mb-3">
          <div className="text-xs font-mono text-yellow-400 uppercase tracking-widest mb-1">Safety Note</div>
          <p className="text-sm text-cyber-text">{exercise.safetyNotes}</p>
        </div>
      )}
    </div>
  )
}
