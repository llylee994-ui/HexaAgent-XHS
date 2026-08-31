import { useEffect, useId, useRef, useState } from 'react'
import { searchHexagrams } from './catalog'

export interface HexagramSearchProps {
  value: string
  onSelect(name: string): void
}

export function HexagramSearch({ value, onSelect }: HexagramSearchProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const id = useId()
  const listboxId = `hexagram-options-${id.replace(/:/g, '')}`
  const rootRef = useRef<HTMLDivElement>(null)
  const results = searchHexagrams(query)

  useEffect(() => setQuery(value), [value])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const select = (name: string) => {
    setQuery(name)
    setOpen(false)
    setActiveIndex(0)
    onSelect(name)
  }

  return (
    <div ref={rootRef} className="hexagram-search">
      <label className="field">
        <span className="field__label">卦名搜索</span>
        <input
          role="combobox"
          aria-label="搜索卦名"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              return
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((index) => Math.max(index - 1, 0))
            }
            if (event.key === 'Enter' && open && results[activeIndex]) {
              event.preventDefault()
              select(results[activeIndex].name)
            }
          }}
        />
      </label>
      {open ? (
        <div className="hexagram-search__menu">
          <p className="hexagram-search__count" aria-live="polite">
            {results.length > 0 ? `找到 ${results.length} 个卦象` : '没有匹配的卦象'}
          </p>
          <ul id={listboxId} role="listbox" className="hexagram-search__options" aria-label="卦名搜索结果">
            {results.map((item, index) => (
              <li key={item.name} role="option" aria-selected={index === activeIndex} onClick={() => select(item.name)}>
                <button type="button" className="hexagram-search__option" onClick={() => select(item.name)}>
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
