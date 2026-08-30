import type { HexagramChart } from '../../domain/types'
import {
  getHexagramClassic,
  getRelevantClassicLines,
} from '../../content/classics'
import type {
  ClassicLine,
  ClassicPassage,
  ClassicSpecial,
} from '../../content/classics'

export interface ReferenceTextProps {
  chart: HexagramChart
}

function Passage({ passage }: { passage: ClassicPassage }) {
  return (
    <div className="classic-passage">
      <blockquote className="classic-passage__original">
        <span className="classic-passage__label">原文</span>
        <p>{passage.original}</p>
      </blockquote>
      <div className="classic-passage__plain">
        <span className="classic-passage__label">白话</span>
        <p>{passage.plain}</p>
      </div>
    </div>
  )
}

function LinePassage({ line, highlighted = false }: { line: ClassicLine; highlighted?: boolean }) {
  return (
    <article className={`classic-line${highlighted ? ' classic-line--moving' : ''}`}>
      <h4 className="classic-line__label">{line.label}</h4>
      <Passage passage={line} />
    </article>
  )
}

function SpecialPassage({ special, highlighted = false }: { special: ClassicSpecial; highlighted?: boolean }) {
  return (
    <article className={`classic-line${highlighted ? ' classic-line--moving' : ''}`}>
      <h4 className="classic-line__label">{special.label}</h4>
      <Passage passage={special} />
    </article>
  )
}

/** 经文参考与纳甲判断分层展示：本卦动爻突出，变卦只给整体卦辞。 */
export function ReferenceText({ chart }: ReferenceTextProps) {
  const shi = chart.original.lines.find((line) => line.shiYing === 'shi')
  const originalClassic = getHexagramClassic(chart.original.name)
  const changedClassic = chart.changed ? getHexagramClassic(chart.changed.name) : null
  const movingLines = getRelevantClassicLines(chart.original.name, chart.changingLines)

  return (
    <section className="reference-text" aria-label="卦爻参考">
      <h2 className="section-title">卦爻参考</h2>
      <p className="reference-text__meta">
        {chart.original.name}属{chart.original.palace}宫（{chart.original.palaceElement}）
        {shi ? `，世爻在第${shi.position}爻` : ''}。
      </p>

      {originalClassic ? (
        <>
          <article className="classic-section" aria-labelledby="original-classic-heading">
            <h3 id="original-classic-heading" className="classic-section__title">
              本卦 · {chart.original.name}
            </h3>
            <p className="classic-section__subtitle">卦辞</p>
            <Passage passage={originalClassic.judgement} />
          </article>

          {movingLines.length > 0 ? (
            <section className="classic-section" aria-labelledby="moving-lines-heading">
              <h3 id="moving-lines-heading" className="classic-section__title">
                本次动爻（{movingLines.length}爻）
              </h3>
              <div className="classic-lines">
                {movingLines.map((line) => (
                  <LinePassage key={line.position} line={line} highlighted />
                ))}
                {chart.allChanging && originalClassic.special ? (
                  <SpecialPassage special={originalClassic.special} highlighted />
                ) : null}
              </div>
            </section>
          ) : (
            <p className="hint">本卦无动爻，因此不单独指定某条爻辞。</p>
          )}

          <details className="classic-details">
            <summary>查看全部爻辞</summary>
            <div className="classic-lines classic-lines--all">
              {originalClassic.lines.map((line) => (
                <LinePassage key={line.position} line={line} />
              ))}
              {originalClassic.special ? (
                <SpecialPassage special={originalClassic.special} />
              ) : null}
            </div>
          </details>
        </>
      ) : (
        <p className="hint hint--warning">该卦经典文本暂缺。</p>
      )}

      {chart.changed ? (
        changedClassic ? (
          <article className="classic-section classic-section--changed" aria-labelledby="changed-classic-heading">
            <h3 id="changed-classic-heading" className="classic-section__title">
              变卦 · {chart.changed.name}
            </h3>
            <p className="classic-section__subtitle">卦辞 · 作为变化后的整体意象</p>
            <Passage passage={changedClassic.judgement} />
          </article>
        ) : (
          <p className="hint hint--warning">变卦经典文本暂缺。</p>
        )
      ) : null}

      <p className="hint reference-text__disclaimer">
        卦爻辞反映卦本身的含义，不等同于六爻纳甲综合判断。
      </p>
    </section>
  )
}
