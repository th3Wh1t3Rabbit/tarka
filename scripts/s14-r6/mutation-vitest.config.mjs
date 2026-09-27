import { defineConfig } from 'vitest/config'

const mode = process.env.S14_R6_MUTATION ?? ''
const inert = '\n// retained original mapping is intentionally inert and must not satisfy the action matrix\n'

export default defineConfig({
  plugins: [{
    name: 's14-r6-actual-action-mutation',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/src/adventure/content.ts')) {
        if (mode === 'P01_TAKE_PEN_2_ONLY') return code.replace("{ id: 'take-pen-2', verb: 'PICK_UP', targetId: 'pen-stand', phase: 'FORM_HELD', nextPhase: 'FORM_AND_PEN', addItems: ['loose-feather-pen'], speech: event('COPY.A1:PICK UP', 1) }", "{ id: 'take-pen-2', verb: 'PICK_UP', targetId: 'pen-stand', phase: 'FORM_HELD', nextPhase: 'FORM_AND_PEN', addItems: ['loose-feather-pen'], speech: event('COPY.A1:LOOK AT in inventory', 2) }") + inert
        if (mode === 'P02_TAKE_FORM_2_ONLY') return code.replace("{ id: 'take-form-2', verb: 'PICK_UP', targetId: 'blank-authorization-form', phase: 'PEN_HELD', nextPhase: 'FORM_AND_PEN', addItems: ['blank-terminal-authorization-form'], speech: [] }", "{ id: 'take-form-2', verb: 'PICK_UP', targetId: 'blank-authorization-form', phase: 'PEN_HELD', nextPhase: 'FORM_AND_PEN', addItems: ['blank-terminal-authorization-form'], speech: event('COPY.A1:LOOK AT in inventory', 0) }") + inert
        if (mode === 'P03_NONPRIMARY_REPRIMAND') return code.replace("speech: event('COPY.A1:Every preauthorization attempt') })),", "speech: event(phase === 'FORM_HELD' ? 'COPY.A1:USE' : 'COPY.A1:Every preauthorization attempt') })),") + inert
        if (mode === 'P04_PULL_CABINET_ONLY') return code.replace("{ id: 'pull-case-drawer', verb: 'PULL', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'CLOSED' }, setCaseFileDrawer: 'OPEN', speech: drawerOpen }", "{ id: 'pull-case-drawer', verb: 'PULL', targetId: 'official-case-file-cabinet', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'caseFileDrawer', is: 'CLOSED' }, setCaseFileDrawer: 'OPEN', speech: drawerClose }") + inert
        if (mode === 'P05_LOOK_MISC_ONLY') return code.replace("{ id: 'look-misc-contents', verb: 'LOOK_AT', targetId: 'miscellaneous-catch-all-contents', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'OPEN' }, speech: event('COPY.A2_A4:`LOOK AT MISCELLANEOUS CATCH-ALL JUNK DRAWER CONTENTS`') }", "{ id: 'look-misc-contents', verb: 'LOOK_AT', targetId: 'miscellaneous-catch-all-contents', phase: 'ANY', nextPhase: null, requiresDrawer: { drawer: 'miscDrawer', is: 'OPEN' }, speech: event('COPY.BACKGROUND:Global rules') }") + inert
        if (mode === 'P06_OLD_PICKUP_BUG') return code.replace("addItems: ['blank-terminal-authorization-form'], speech: []", "addItems: ['blank-terminal-authorization-form'], speech: event('COPY.A1:LOOK AT in inventory', 0)") + inert
        if (mode === 'P07_PEN_LINE_TO_DEAD_END') return code.replace("addItems: ['loose-feather-pen'], speech: event('COPY.A1:PICK UP', 1)", "addItems: ['loose-feather-pen'], speech: event('COPY.A1:LOOK AT in inventory', 2)") + "\n// dead.pen-pickup => COPY.A1:PICK UP[1]" + inert
        if (mode === 'P08_PRIORITY_INTERCEPT') return code.replace('export const usefulRules: InteractionRule[] = [', "export const usefulRules: InteractionRule[] = [\n  { id: 'mutation-priority', verb: 'LOOK_AT', targetId: 'request-dispenser', phase: 'ANY', nextPhase: null, speech: event('COPY.BACKGROUND:Global rules') },") + inert
        if (mode === 'P14_CUBE_REAL_ROUTE') return code.replace("'rubiks-cube': 'COPY.ARTHUR:Rubik’s Cube'", "'rubiks-cube': 'COPY.ARTHUR:Rubber Band'") + inert
        if (mode === 'P15_RUBBER_REAL_ROUTE') return code.replace("'rubber-band': 'COPY.ARTHUR:Rubber Band'", "'rubber-band': 'COPY.ARTHUR:Rubik’s Cube'") + inert
      }
      if (id.endsWith('/src/adventure/reducer.ts')) {
        if (mode === 'P09_BREAK_ARTHUR_CANONICALIZATION') return code.replace("pending.verb === 'USE') return applyInteraction(state, { ...pending, verb: 'GIVE' })", "pending.verb === 'OPEN') return applyInteraction(state, { ...pending, verb: 'GIVE' })") + inert
        if (mode === 'P10_BREAK_ACT_ON_ITEM') return code.replace("if (state.selectedVerb === 'LOOK_AT' || state.selectedVerb === 'OPEN'", "if (state.selectedVerb === 'OPEN'") + inert
      }
      if (id.endsWith('/src/app/productionCopySelectors.ts')) {
        if (mode === 'P11_HERO_SELECTOR') return code.replace('return heroTerminalSpeech(route)', "return heroTerminalSpeech(route === 'DELTA_2' ? 'THEORY_RESOLUTION' : route)") + inert
        if (mode === 'P12_ENDING_SELECTOR') return code.replace('return endingVariantSpeechForStatus(brcgResolved)', 'return endingVariantSpeechForStatus(true)') + inert
      }
      if (id.endsWith('/src/story/r55/runtimeAdapters.ts')) {
        if (mode === 'P16_REORDER_PANELS') return code.replace("if (route === 'DELTA_1') return r55SpeechByEvent('COPY.HERO:Evidence Delta 1')", "if (route === 'DELTA_1') return [...r55SpeechByEvent('COPY.HERO:Evidence Delta 1')].reverse()") + inert
        if (mode === 'P17_OMIT_CONTINUATION') return code.replace("if (route === 'DELTA_1') return r55SpeechByEvent('COPY.HERO:Evidence Delta 1')", "if (route === 'DELTA_1') return r55SpeechByEvent('COPY.HERO:Evidence Delta 1').slice(0, 2)") + inert
      }
      return null
    },
  }],
  test: { environment: 'node' },
})
