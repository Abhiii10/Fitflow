import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EXERCISE_LIBRARY, EXERCISE_CATEGORIES, CATEGORY_COLORS, type ExerciseInfo } from '@/data/exerciseLibrary'

export function ExerciseLibrary() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<ExerciseInfo['category'] | 'all'>('all')

  const filtered = EXERCISE_LIBRARY.filter(ex => {
    const matchesSearch = search === '' ||
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      ex.targetMuscles.some(m => m.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = activeCategory === 'all' || ex.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="page-container">
      <div className="mb-5">
        <h1 className="text-xl font-mono font-bold text-cyber-green tracking-tight">Exercise Library</h1>
        <p className="text-xs text-cyber-dim font-mono">{EXERCISE_LIBRARY.length} exercises with form cues</p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search exercises or muscles..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-transparent border border-cyber-border rounded-lg text-sm text-cyber-text font-mono placeholder:text-cyber-dim focus:outline-none focus:border-cyber-green/60"
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 px-3 py-1 rounded-lg border font-mono text-xs transition-colors ${activeCategory === 'all' ? 'border-cyber-green text-cyber-green bg-cyber-green/10' : 'border-cyber-border text-cyber-dim hover:border-cyber-green/40'}`}
        >
          All
        </button>
        {EXERCISE_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex-shrink-0 px-3 py-1 rounded-lg border font-mono text-xs transition-colors ${activeCategory === cat.key ? `${CATEGORY_COLORS[cat.key]} bg-current/5` : 'border-cyber-border text-cyber-dim hover:border-cyber-green/40'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="card text-center py-8 text-cyber-dim font-mono text-sm">No exercises found</div>
        )}
        {filtered.map(ex => (
          <Link
            key={ex.name}
            to={`/exercises/${encodeURIComponent(ex.name)}`}
            className="card flex items-center justify-between group hover:border-cyber-green/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-cyber-text group-hover:text-cyber-green transition-colors">
                  {ex.name}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[ex.category]}`}>
                  {ex.category}
                </span>
              </div>
              <div className="text-xs text-cyber-dim mt-0.5 truncate">
                {ex.targetMuscles.join(' · ')}
              </div>
            </div>
            <svg className="w-4 h-4 text-cyber-dim group-hover:text-cyber-green transition-colors flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
