import { defineConfig } from 'vitest/config'

const mode = process.env.S14_R5_MUTATION ?? ''

export default defineConfig({
  plugins: [{
    name: 's14-r5-true-route-mutation',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/src/adventure/content.ts')) {
        if (mode === 'P01_CUBE_DEAD_FULL_MAPPING') return `${code.replace("'rubiks-cube': 'COPY.ARTHUR:Rubik’s Cube'", "'rubiks-cube': 'COPY.ARTHUR:Rubber Band'")}\nconst S14_R5_DEAD_CUBE_MAPPING = { 'rubiks-cube': 'COPY.ARTHUR:Rubik’s Cube' }\n// 'rubiks-cube': 'COPY.ARTHUR:Rubik’s Cube'\n`
        if (mode === 'P02_RUBBER_DEAD_FULL_MAPPING') return `${code.replace("'rubber-band': 'COPY.ARTHUR:Rubber Band'", "'rubber-band': 'COPY.ARTHUR:Rubik’s Cube'")}\nconst S14_R5_DEAD_RUBBER_MAPPING = { 'rubber-band': 'COPY.ARTHUR:Rubber Band' }\n// 'rubber-band': 'COPY.ARTHUR:Rubber Band'\n`
        if (mode === 'P03_USEFUL_RULE_OWNER') return code.replace("speech: event('COPY.A1:LOOK AT in inventory', 0) },", "speech: event('COPY.A1:LOOK AT in inventory', 2) },")
        if (mode === 'P04_ITEM_RULE_OWNER') return code.replace("speech: event('COPY.A2_A4:`OPEN` or `USE` toolbox')", "speech: event('COPY.INVENTORY:OPEN or direct USE — first time')")
        if (mode === 'P05_DEAD_END_OWNER') return code.replace("speechForExactRoute('cityPickUse')", "speechForExactRoute('recordsPickUse')")
        if (mode === 'P06_INVENTORY_OWNER') return code.replace("'rubber-band': ['COPY.INVENTORY:LOOK AT', 1]", "'rubber-band': ['COPY.INVENTORY:LOOK AT', 2]")
        if (mode === 'P07_ARTHUR_DIALOGUE_OWNER') return code.replace("lines: event('COPY.ARTHUR:TELL ME AGAIN HOW NANSEN HELPS')", "lines: event('COPY.ARTHUR:DID YOU CATCH THE GAME THIS WEEKEND?')")
        if (mode === 'P12_CASE_REPEAT_TO_GUM') return code.replace("event('COPY.REPEAT:PICK UP', 0)", "event('COPY.REPEAT:PICK UP', 1)")
        if (mode === 'P13_MISC_REPEAT_TO_CASE') return code.replace("event('COPY.REPEAT:PICK UP', 1)", "event('COPY.REPEAT:PICK UP', 0)")
      }
      if (id.endsWith('/src/story/r55/runtimeAdapters.ts')) {
        if (mode === 'P08_HERO_TERMINAL_OWNER') return code.replace("if (route === 'DELTA_2') return r55SpeechByEvent('COPY.HERO:Evidence Delta 2')", "if (route === 'DELTA_2') return r55SpeechByEvent('COPY.HERO:Theory resolution')")
        if (mode === 'P09_ENDING_COMPLETION_OWNER') return code.replace("return brcgResolved ? R55_ENDING_BRCG : R55_ENDING_DEFAULT", "return brcgResolved ? R55_ENDING_BRCG : R55_ENDING_BRCG")
        if (mode === 'P11_REMOVE_CONTINUATION') return code.replace("if (route === 'DELTA_1') return r55SpeechByEvent('COPY.HERO:Evidence Delta 1')", "if (route === 'DELTA_1') return r55SpeechByEvent('COPY.HERO:Evidence Delta 1').slice(0, 2)")
        if (mode === 'P16_REORDER_PANELS') return code.replace("if (route === 'DELTA_1') return r55SpeechByEvent('COPY.HERO:Evidence Delta 1')", "if (route === 'DELTA_1') return [...r55SpeechByEvent('COPY.HERO:Evidence Delta 1')].reverse()")
      }
      if (id.endsWith('/src/adventure/r55ProductionRouteRegistry.ts')) {
        if (mode === 'P10_UNREACHABLE_DESCRIPTOR') return code.replace("] as const\n\nfunction speechFromState", ", owner('dead.unreachable', 'useful-rule', 'never-owner', { verb: 'LOOK_AT', targetId: 'wall-building', itemId: null }, { phase: 'START' }, source('COPY.BACKGROUND:Global rules'))\n] as const\n\nfunction speechFromState")
      }
      return null
    },
  }],
  test: { environment: 'node' },
})
