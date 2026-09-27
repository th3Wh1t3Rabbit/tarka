import {it,expect} from 'vitest'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {PerformancePortrait} from '../../src/app/PerformancePortrait'
import {MissionHarness} from '../../src/app/MissionHarness'
import {createPlaceholderSemanticCatalog} from '../../src/adventure/semanticCatalog'
import {placeholderPerformanceProfile,PERFORMANCE_INTENTIONS} from '../../src/adventure/performanceCatalog'
import {RECORDS_OFFICE_NARRATIVE} from '../../src/adventure/narrative'
const catalog=createPlaceholderSemanticCatalog(),profile=placeholderPerformanceProfile(catalog)
it('all portrait intentions expose Arthur but retain original clip, character, status and asset IDs',()=>{
 for(const intention of PERFORMANCE_INTENTIONS){
  const html=renderToStaticMarkup(createElement(PerformancePortrait,{profile,character:'archivist',request:{intention},reduced:true}))
  expect(html).toContain('alt="Arthur the Archivist placeholder performance"')
  expect(html).toContain('data-testid="performance-archivist"')
  expect(html).toContain('data-resolved-clip="demo.archivist.'+intention+'"')
  expect(html).toContain('production art late-bound')
  expect(html).not.toMatch(/public name\/art unbound|alt="Archivist/)
 }
 expect(renderToStaticMarkup(createElement(PerformancePortrait,{profile,character:'rook',request:{intention:'IDLE'}}))).toContain('alt="Rook placeholder performance"')
})
it('Mission Harness visible and semantic public names map Arthur in both motion modes, not cue IDs',()=>{
 for(const reducedMotion of [false,true]){
  const html=renderToStaticMarkup(createElement(MissionHarness,{catalog,reducedMotion}))
  expect(html).toContain('<strong>Arthur</strong>')
  expect(html).toContain('alt="Arthur the Archivist gesture.explain provisional animation"')
  expect(html).toContain('data-semantic-id="gesture.explain"')
  expect(html).not.toContain('<strong>ARCHIVIST</strong>')
 }
 expect(RECORDS_OFFICE_NARRATIVE[0]!.speaker).toBe('ARCHIVIST')
 expect(Object.keys(catalog.characters)).toEqual(['rook','archivist'])
 const missing=structuredClone(catalog)
 delete missing.assets[missing.characters.archivist['gesture.explain'].frames[0]!.assetSlot]
 const fallback=renderToStaticMarkup(createElement(MissionHarness,{catalog:missing,reducedMotion:true}))
 expect(fallback).toContain('aria-label="Arthur the Archivist gesture.explain optional asset not installed"')
})
it('accepted client runtime map SHA and exact 74-key set remain unchanged after presentation-only remediation',()=>{
 const bytes=fs.readFileSync('src/controller/content/runtime-content.json')
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('57f27ecfef64f9c149f2f80bdb1efffbc629d79fd5f6a76e21c0e943c5c95bfc')
 const map=JSON.parse(bytes.toString())
 expect(Object.keys(map.entries)).toHaveLength(74)
 expect(map.compiledEntries).toBe(74)
 expect(map.entries).not.toHaveProperty('lane_a.theory.accepted')
})
