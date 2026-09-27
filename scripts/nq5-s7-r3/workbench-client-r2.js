(() => {
  const m = window.__WORKBENCH_MODEL__
  const app = document.querySelector('#app')
  const nav = document.querySelector('#nav')
  const categories = m.commentContract.categories
  const approvals = m.commentContract.states
  const integrity = window.WorkbenchIntegrity
  if (!integrity) throw new Error('WORKBENCH_INTEGRITY_CORE_MISSING')
  const unresolvedStates = ['REVISE', 'CUT', 'DEFER']
  const views = {
    acts: 'Acts / scenes', puzzle: 'Puzzle dependency', timeline: 'State / inventory', objects: 'Nine-verb desk',
    dialogue: 'Dialogue tree', performance: 'Performance score', evidence: 'Nansen evidence', journeys: 'Journey simulator',
    art: 'Art capability', renderer: 'Renderer risk', comments: 'Comment book', concepts: 'Review-only concepts',
  }
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
  const bookKey = `trace-principal-review:${m.revision}`
  let book = []
  let pendingAnchor = null
  let quarantine = null
  let comparison = null
  let selectedMigration = new Map()
  let timelineIndex = 0
  let journeyState = {}
  let performanceStep = {}
  let dialogueUsed = {}

  const save = () => localStorage.setItem(bookKey, JSON.stringify(book))
  const review = (anchor) => `<div class="review-controls" data-review-anchor="${esc(anchor)}"><button data-comment="${esc(anchor)}">Add Comment</button><button data-approve="${esc(anchor)}">Approve</button></div>`
  const cards = (items, render) => `<div class="grid">${items.map(render).join('')}</div>`
  const dl = (object) => Object.entries(object).map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : value)}</dd>`).join('')
  const commentsFor = (anchor) => book.filter((comment) => comment.anchor === anchor)
  const anchorState = (anchor) => {
    const own = commentsFor(anchor)
    if (own.some((comment) => unresolvedStates.includes(comment.approval))) return 'UNRESOLVED'
    if (own.some((comment) => ['APPROVE', 'APPROVE_WITH_NOTE'].includes(comment.approval))) return 'APPROVED'
    return own.length ? 'REVIEWED' : 'UNREVIEWED'
  }
  const actState = (act) => {
    const children = m.ownershipGraph.byOwner[act].filter((anchor) => anchor !== `act:${act}`)
    const unresolvedChildren = children.filter((anchor) => anchorState(anchor) === 'UNRESOLVED')
    const reviewed = children.filter((anchor) => anchorState(anchor) !== 'UNREVIEWED').length
    const approved = children.filter((anchor) => anchorState(anchor) === 'APPROVED').length
    const direct = anchorState(`act:${act}`)
    const state = direct === 'UNRESOLVED' || unresolvedChildren.length ? 'UNRESOLVED'
      : direct === 'APPROVED' && approved === children.length ? 'APPROVED' : 'UNREVIEWED'
    return { children, unresolvedChildren, reviewed, approved, direct, state }
  }
  const currentPayload = () => ({ schemaVersion: '3.0.0', revision: m.revision, sourceIdentity: m.sourceIdentity, anchorSourceIdentities: m.anchorSourceIdentities, comments: book })
  const download = (name, text, type) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([text], { type }))
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 0)
  }
  const encode = (value) => btoa(unescape(encodeURIComponent(value)))
  const decode = (value) => decodeURIComponent(escape(atob(value)))
  const markdownForBook = (payload) => `# Principal Review Book\n\nRevision: ${payload.revision}\n\n${payload.comments.map((comment) => `## ${comment.anchor} — ${comment.category}\n\n${comment.text}\n\n- ${comment.approval} · ${comment.author} · ${comment.timestamp}\n`).join('\n')}\n<!-- REVIEW_BOOK_JSON ${encode(JSON.stringify(payload))} -->\n`
  const markdownForComparison = (value) => `# Principal Review Revision Comparison\n\n${Object.entries(value.counts).map(([status, count]) => `- ${status}: ${count}`).join('\n')}\n\n${value.items.map((item) => `## ${item.status} · ${item.anchor}\n\n- Prior: ${item.priorSourceIdentity ?? 'NONE'}\n- Current: ${item.currentSourceIdentity ?? 'NONE'}\n- Prior comments: ${item.priorComments.length}`).join('\n\n')}\n`

  const validationContext = { revisionRegistry: m.revisionRegistry }
  const validateBook = (value) => integrity.validateReviewBook(value, validationContext)
  function compare(prior) {
    const currentEntry = m.revisionRegistry.entries.find((entry) => entry.revision === m.revision)
    const priorEntry = m.revisionRegistry.entries.find((entry) => entry.revision === prior.revision)
    if (!currentEntry || !priorEntry) throw new Error('REVISION_REGISTRY_ENTRY_MISSING')
    return { ...integrity.compareRevisions(currentEntry.anchorSourceIdentities, priorEntry.anchorSourceIdentities, prior.comments), priorRevision: prior.revision, currentRevision: m.revision }
  }

  const registryValidation = integrity.validateRevisionRegistry(m.revisionRegistry)
  if (!registryValidation.ok) throw new Error(`REVISION_REGISTRY_INVALID:${registryValidation.errors.join(',')}`)
  const storedBook = localStorage.getItem(bookKey)
  if (storedBook !== null) {
    try {
      const storedComments = JSON.parse(storedBook)
      const result = validateBook({ schemaVersion: '3.0.0', revision: m.revision, sourceIdentity: m.sourceIdentity, anchorSourceIdentities: m.anchorSourceIdentities, comments: storedComments })
      if (!result.ok) throw new Error(result.errors.join(', '))
      book = result.value.comments
    } catch (error) {
      book = []
      quarantine = `LOCAL STORAGE QUARANTINED — ${error.message}; active review book started empty and stored bytes were not changed.`
    }
  }
  window.__WORKBENCH_TEST_API__ = { ...integrity, validateBook, compare, bookKey, activeComments: () => structuredClone(book) }

  function addApproval(anchor) {
    const comment = { anchor, category: 'KEEP', approval: 'APPROVE', author: 'Principal', timestamp: new Date().toISOString(), sourceRevision: m.revision, itemId: anchor, text: 'Approved in Workbench.' }
    const result = validateBook({ ...currentPayload(), comments: [...book, comment] })
    if (!result.ok) { quarantine = `REJECTED — ${result.errors.join(', ')}; current review book was not changed.`; render(); return }
    book = result.value.comments; save(); render()
  }
  function wire() {
    app.querySelectorAll('[data-comment]').forEach((button) => { button.onclick = () => { pendingAnchor = button.dataset.comment; location.hash = 'comments' } })
    app.querySelectorAll('[data-approve]').forEach((button) => { button.onclick = () => addApproval(button.dataset.approve) })
  }
  for (const [key, label] of Object.entries(views)) {
    const button = document.createElement('button'); button.textContent = label; button.onclick = () => { location.hash = key }; nav.append(button)
  }

  function actsView() {
    const acts = cards(m.acts, (act) => {
      const state = actState(act.id)
      const links = state.unresolvedChildren.map((anchor) => `<button data-comment="${esc(anchor)}">${esc(anchor)}</button>`).join('') || 'None'
      return `<article class="card ${state.unresolvedChildren.length ? 'unresolved' : ''}" data-act="${esc(act.id)}"><h3>${esc(`${act.id} · ${act.label}`)}</h3><dl>${dl(act)}</dl><p>Computed approval: <b>${esc(state.state)}</b></p><p>Reviewed children: <b>${state.reviewed} / ${state.children.length}</b> · unresolved: <b>${state.unresolvedChildren.length}</b></p><div aria-label="Unresolved children">${links}</div>${review(`act:${act.id}`)}</article>`
    })
    const global = m.ownershipGraph.rows.filter((row) => row.owner === 'GLOBAL')
    app.innerHTML = `<h2>Act and scene navigator</h2>${acts}<h2>GLOBAL review items</h2><p>These ${global.length} items do not alter any act unless the ownership graph is explicitly revised.</p>${cards(global, (row) => `<article class="card"><h3>${esc(row.anchor)}</h3><p>${esc(row.rationale)}</p>${review(row.anchor)}</article>`)}`
  }
  function puzzleView() {
    app.innerHTML = `<h2>Puzzle dependency</h2><p>Directed chain: ${m.puzzle.map((item) => esc(item.id)).join(' → ')}</p>${m.puzzle.map((item, index) => `<article class="card"><p class="graph-edge">${esc(`${index ? m.puzzle[index - 1].id : 'START'} → ${item.id} → ${item.unlocks}`)}</p><h3>${esc(item.goal)}</h3><dl>${dl(item)}</dl>${review(`puzzle:${item.id}`)}</article>`).join('')}`
  }
  function timelineView() {
    const item = m.timeline[timelineIndex]
    app.innerHTML = `<h2>State and inventory timeline</h2><div class="controls"><button id="tback">Back</button><select id="tmile" aria-label="Direct milestone">${m.timeline.map((row, index) => `<option value="${index}" ${index === timelineIndex ? 'selected' : ''}>${esc(row.id)}</option>`).join('')}</select><button id="tnext">Forward</button></div><article class="card"><h3>${esc(item.id)}</h3><dl>${dl(item)}</dl>${review(`timeline:${item.id}`)}</article>`
    app.querySelector('#tback').onclick = () => { timelineIndex = Math.max(0, timelineIndex - 1); timelineView(); wire() }
    app.querySelector('#tnext').onclick = () => { timelineIndex = Math.min(m.timeline.length - 1, timelineIndex + 1); timelineView(); wire() }
    app.querySelector('#tmile').onchange = (event) => { timelineIndex = Number(event.target.value); timelineView(); wire() }
  }
  function objectsView() {
    app.innerHTML = `<h2>Nine-verb desk</h2><p>${m.interactions.length} cells · exact literal responses and review metadata.</p>${cards(m.interactions, (item) => `<article class="card"><h3>${esc(`${item.hotspot} · ${item.verb}`)}</h3><p>${item.exactResponses.map((line) => `<b>${esc(line.speaker)}:</b> ${esc(line.text)}`).join('<br>')}</p><dl>${dl({ repeat: item.repeat_behavior, progression: item.progressionEffect, reaction: item.characterReaction, cues: item.performanceCues, sound: item.soundCaption, artNeed: item.artNeed })}</dl>${review(item.anchor)}</article>`)}`
  }
  function dialogueView() {
    const menus = m.dialogues.menus.map((menu) => {
      const used = dialogueUsed[menu.id] || []
      const choices = menu.choices.filter((choice) => choice.persistent || !used.includes(choice.id))
      return `<article class="card"><h3>${esc(`${menu.id} · ${menu.context}`)}</h3>${choices.map((choice) => `<section><button data-choice="${esc(`${menu.id}:${choice.id}`)}">${esc(choice.label)}</button>${review(`dialogue-choice:${menu.id}:${choice.id}`)}</section>`).join('')}<button data-reset-menu="${esc(menu.id)}">Reset menu</button>${review(`dialogue-menu:${menu.id}`)}</article>`
    }).join('')
    app.innerHTML = `<h2>Dialogue-tree reader</h2><h3>Exact sequences</h3>${cards(m.dialogues.sequences, (item) => `<article class="card"><h3>${esc(item.id)}</h3><ol>${item.lines.map((line) => `<li><b>${esc(line.speaker)}:</b> ${esc(line.text)}</li>`).join('')}</ol>${review(`dialogue:${item.id}`)}</article>`)}<h3>Selectable topics</h3><div class="grid">${menus}</div>`
    app.querySelectorAll('[data-choice]').forEach((button) => { button.onclick = () => { const [menuId, choiceId] = button.dataset.choice.split(':'); const menu = m.dialogues.menus.find((item) => item.id === menuId); const choice = menu.choices.find((item) => item.id === choiceId); if (!choice.persistent) dialogueUsed[menuId] = [...(dialogueUsed[menuId] || []), choiceId]; button.insertAdjacentHTML('afterend', `<p>${choice.replies.map((line) => `<b>${esc(line.speaker)}:</b> ${esc(line.text)}`).join('<br>')}</p>`); if (!choice.persistent) button.disabled = true } })
    app.querySelectorAll('[data-reset-menu]').forEach((button) => { button.onclick = () => { dialogueUsed[button.dataset.resetMenu] = []; dialogueView(); wire() } })
  }
  function performanceView() {
    app.innerHTML = `<h2>Phrase-level performance score</h2><p>Six parallel tracks. Preview notes are visual metadata and are never announced as dialogue.</p>${cards(m.performance, (item) => { const same = m.performance.filter((row) => row.copyKey === item.copyKey); const step = performanceStep[item.copyKey] || 0; const active = same.slice(0, step + 1); return `<article class="card"><h3>${esc(item.id)}</h3><p>${esc(item.text)}</p><div class="tracks">${['FACE', 'GAZE', 'BODY', 'PROP', 'VOICE_TEXT', 'TIME'].map((track) => `<div class="track"><b>${track}</b><br>${esc(active.filter((row) => row.track === track).at(-1)?.intention || '—')}</div>`).join('')}</div><div class="preview" data-static="true"><span aria-hidden="true">GENERIC ${esc(item.actor)}</span></div><button data-perf-prev="${esc(item.copyKey)}">Previous cue</button><button data-perf-next="${esc(item.copyKey)}">Next cue</button>${review(`performance:${item.id}`)}</article>` })}`
    app.querySelectorAll('[data-perf-prev]').forEach((button) => { button.onclick = () => { const key = button.dataset.perfPrev; performanceStep[key] = Math.max(0, (performanceStep[key] || 0) - 1); performanceView(); wire() } })
    app.querySelectorAll('[data-perf-next]').forEach((button) => { button.onclick = () => { const key = button.dataset.perfNext; performanceStep[key] = Math.min(m.performance.filter((item) => item.copyKey === key).length - 1, (performanceStep[key] || 0) + 1); performanceView(); wire() } })
  }
  function evidenceView() {
    app.innerHTML = `<h2>Nansen evidence and claim view</h2><p><b>${esc(m.evidence.auditStatus)}</b> · 25 semantic views; seven bounded no-match views are explicitly separated below.</p><h3>All 25 semantic views</h3>${cards(m.evidence.records, (item) => `<article class="card"><h3>${esc(item.id)}</h3><dl>${dl(item)}</dl>${review(`evidence:${item.id}`)}</article>`)}<h3>Seven bounded no-match controls</h3>${cards(m.evidence.boundedNoMatch, (item) => `<article class="card"><h3>${esc(`${item.id} · ${item.zeroResultClass}`)}</h3><p>${esc(item.question)}</p>${review(`evidence:${item.id}`)}</article>`)}`
  }
  function journeysView() {
    app.innerHTML = `<h2>Journey simulator</h2><p>Conceptual only; real game save is never read or modified.</p>${cards(m.journeys, (journey) => { const index = journeyState[journey.id] || 0; const item = journey.steps[index]; return `<article class="card"><h3>${esc(journey.label)}</h3><p>Step ${index + 1} / ${journey.steps.length} · ${esc(item.name)}</p><button data-jback="${journey.id}">Back</button><button data-jnext="${journey.id}">Step</button><button data-jreset="${journey.id}">Reset</button>${review(`journey:${journey.id}`)}</article>` })}`
    app.querySelectorAll('[data-jback]').forEach((button) => { button.onclick = () => { journeyState[button.dataset.jback] = Math.max(0, (journeyState[button.dataset.jback] || 0) - 1); journeysView(); wire() } })
    app.querySelectorAll('[data-jnext]').forEach((button) => { button.onclick = () => { const journey = m.journeys.find((item) => item.id === button.dataset.jnext); journeyState[journey.id] = Math.min(journey.steps.length - 1, (journeyState[journey.id] || 0) + 1); journeysView(); wire() } })
    app.querySelectorAll('[data-jreset]').forEach((button) => { button.onclick = () => { journeyState[button.dataset.jreset] = 0; journeysView(); wire() } })
  }
  const artView = () => { app.innerHTML = `<h2>Art capability</h2>${cards(m.artIntentions, (item) => `<article class="card"><h3>${esc(item.intention)}</h3><dl>${dl(item)}</dl>${review(`art:${item.intention}`)}</article>`)}` }
  const rendererView = () => { app.innerHTML = `<h2>Actual thirteen-line game-renderer review</h2><p><a href="actual-renderer/index.html" target="_blank">Open actual renderer in a new tab</a></p><iframe class="renderer-frame" title="Actual game renderer" src="actual-renderer/index.html"></iframe><h3>Thirteen immutable lines</h3>${cards(m.rendererRisk, (item) => `<article class="card"><h3>${esc(item.key)}</h3><p>${esc(item.text)}</p>${review(`renderer:${item.key}`)}</article>`)}` }
  const conceptsView = () => { app.innerHTML = `<h2>Review-only concepts</h2><p>None enters runtime, inventory, catalog, proof, or the normal build.</p>${cards(m.concepts, (item) => `<article class="card review-only"><h3>${esc(`${item.id} · ${item.title}`)}</h3><dl>${dl(item)}</dl><span class="badge">NOT IN RUNTIME</span>${review(`concept:${item.id}`)}</article>`)}` }

  function commentsView() {
    const optionList = (items) => items.map((item) => `<option>${esc(item)}</option>`).join('')
    const active = pendingAnchor || m.reviewAnchors[0]
    app.innerHTML = `<h2>Principal comment book</h2><p>Revision <code>${esc(m.revision)}</code></p><p id="import-status" class="status ${quarantine ? 'quarantine' : ''}">${esc(quarantine || 'Ready. Imports are fully validated before local state changes.')}</p><label>Stable anchor<select id="anchor">${m.reviewAnchors.map((anchor) => `<option ${anchor === active ? 'selected' : ''}>${esc(anchor)}</option>`).join('')}</select></label><label>Category<select id="category">${optionList(categories)}</select></label><label>Approval<select id="approval">${optionList(approvals)}</select></label><label>Author<input id="author" maxlength="80" value="Principal"></label><label>Comment<textarea id="text" maxlength="4000"></textarea></label><button id="save">Save locally</button><button id="json">Export JSON</button><button id="md">Export Markdown</button><label>Import review book<input id="import" type="file" accept="application/json,text/markdown,.md"></label><section id="comparison"></section><section id="book"></section>`
    pendingAnchor = null
    const drawBook = () => { app.querySelector('#book').innerHTML = cards(book, (comment) => `<article class="card ${unresolvedStates.includes(comment.approval) ? 'unresolved' : ''}"><h3>${esc(`${comment.anchor} · ${comment.category}`)}</h3><p>${esc(comment.text)}</p><small>${esc(`${comment.author} · ${comment.timestamp} · ${comment.approval} · ${comment.sourceRevision}`)}</small></article>`) }
    const drawComparison = () => {
      const region = app.querySelector('#comparison')
      if (!comparison) { region.innerHTML = ''; return }
      region.innerHTML = `<h3>Prior-revision comparison</h3><p>SAME ${comparison.counts.SAME} · CHANGED ${comparison.counts.CHANGED} · MISSING ${comparison.counts.MISSING} · NEW ${comparison.counts.NEW}</p><button id="select-same">Select all SAME comments</button><button id="apply-migration">Apply selected comments</button><button id="comparison-json">Export comparison JSON</button><button id="comparison-md">Export comparison Markdown</button>${cards(comparison.items, (item) => `<article class="card" data-comparison-status="${item.status}" data-comparison-anchor="${esc(item.anchor)}"><h4>${item.status} · ${esc(item.anchor)}</h4>${item.status === 'CHANGED' ? `<p>Prior: <code>${esc(item.priorSourceIdentity)}</code><br>Current: <code>${esc(item.currentSourceIdentity)}</code></p>` : ''}<p>Prior comments: ${item.priorComments.length}</p>${item.priorComments.map((comment) => `<blockquote>${esc(comment.text)}</blockquote>`).join('')}${item.status === 'CHANGED' && item.priorComments.length ? `<button data-select-changed="${esc(item.anchor)}">Confirm changed-item comments</button>` : ''}${item.status === 'MISSING' ? '<p>Retained only in the migration record; never attached.</p>' : ''}${item.status === 'NEW' ? '<p>New and unreviewed.</p>' : ''}</article>`)}`
      region.querySelector('#select-same').onclick = () => { comparison.items.filter((item) => item.status === 'SAME').flatMap((item) => item.priorComments).forEach((comment) => selectedMigration.set(integrity.commentIdentity(comment), structuredClone(comment))); quarantine = 'SAME comments selected; no comment has been carried yet.'; app.querySelector('#import-status').textContent = quarantine }
      region.querySelectorAll('[data-select-changed]').forEach((button) => { button.onclick = () => { const item = comparison.items.find((row) => row.anchor === button.dataset.selectChanged); item.priorComments.forEach((comment) => selectedMigration.set(integrity.commentIdentity(comment), structuredClone(comment))); button.textContent = 'Changed-item comments selected'; button.disabled = true } })
      region.querySelector('#apply-migration').onclick = () => {
        const beforeStorage = localStorage.getItem(bookKey)
        try {
          const selected = [...selectedMigration.values()]
          const allowed = new Set(comparison.items.filter((item) => ['SAME', 'CHANGED'].includes(item.status)).map((item) => item.anchor))
          const candidate = structuredClone(book)
          const existing = new Set(candidate.map(integrity.commentIdentity))
          for (const comment of selected) {
            const identity = integrity.commentIdentity(comment)
            if (allowed.has(comment.anchor) && !existing.has(identity)) { existing.add(identity); candidate.push(structuredClone(comment)) }
          }
          const result = validateBook({ ...currentPayload(), comments: candidate })
          if (!result.ok) throw new Error(result.errors.join(', '))
          book = result.value.comments
          save(); selectedMigration = new Map(); quarantine = `MIGRATION APPLIED — ${selected.length} explicitly selected comment(s).`; commentsView(); wire()
        } catch (error) {
          if (localStorage.getItem(bookKey) !== beforeStorage) throw new Error('ATOMIC_MIGRATION_STORAGE_VIOLATION')
          quarantine = `MIGRATION QUARANTINED — ${error.message}; current review book and local storage were not changed.`; commentsView(); wire()
        }
      }
      region.querySelector('#comparison-json').onclick = () => download('PRINCIPAL_REVIEW_REVISION_COMPARISON.json', JSON.stringify(comparison, null, 2) + '\n', 'application/json')
      region.querySelector('#comparison-md').onclick = () => download('PRINCIPAL_REVIEW_REVISION_COMPARISON.md', markdownForComparison(comparison), 'text/markdown')
    }
    app.querySelector('#save').onclick = () => {
      const comment = { anchor: app.querySelector('#anchor').value, category: app.querySelector('#category').value, approval: app.querySelector('#approval').value, author: app.querySelector('#author').value, timestamp: new Date().toISOString(), sourceRevision: m.revision, itemId: app.querySelector('#anchor').value, text: app.querySelector('#text').value }
      const result = validateBook({ ...currentPayload(), comments: [...book, comment] })
      if (!result.ok) { quarantine = `REJECTED — ${result.errors.join(', ')}; current review book was not changed.`; commentsView(); wire(); return }
      book = result.value.comments; save(); drawBook()
    }
    app.querySelector('#json').onclick = () => download('PRINCIPAL_REVIEW_BOOK.json', JSON.stringify(currentPayload(), null, 2) + '\n', 'application/json')
    app.querySelector('#md').onclick = () => download('PRINCIPAL_REVIEW_BOOK.md', markdownForBook(currentPayload()), 'text/markdown')
    app.querySelector('#import').onchange = async (event) => {
      const before = JSON.stringify(book)
      const beforeStorage = localStorage.getItem(bookKey)
      try {
        const file = event.target.files[0]
        const text = await file.text()
        let value
        if (file.name.endsWith('.md')) {
          const match = text.match(/<!-- REVIEW_BOOK_JSON ([A-Za-z0-9+/=]+) -->/)
          if (!match) throw new Error('MARKDOWN_EMBEDDED_JSON_MISSING')
          value = JSON.parse(decode(match[1]))
        } else value = JSON.parse(text)
        const result = validateBook(value)
        if (!result.ok) throw new Error(result.errors.join(', '))
        if (value.revision === m.revision) {
          book = result.value.comments; save(); comparison = null; quarantine = 'IMPORT ACCEPTED — complete current book validated.'
        } else {
          comparison = compare(result.value); selectedMigration = new Map(); quarantine = 'COMPARISON READY — prior comments are not active until explicitly selected and applied.'
        }
      } catch (error) {
        if (JSON.stringify(book) !== before) throw new Error('ATOMIC_IMPORT_VIOLATION')
        if (localStorage.getItem(bookKey) !== beforeStorage) throw new Error('ATOMIC_IMPORT_STORAGE_VIOLATION')
        quarantine = `QUARANTINED — ${error.message}; current review book was not replaced.`
      }
      commentsView(); wire()
    }
    drawComparison(); drawBook()
  }

  function render() {
    const view = location.hash.slice(1).split('?')[0] || 'acts'
    if (view === 'acts') actsView()
    else if (view === 'puzzle') puzzleView()
    else if (view === 'timeline') timelineView()
    else if (view === 'objects') objectsView()
    else if (view === 'dialogue') dialogueView()
    else if (view === 'performance') performanceView()
    else if (view === 'evidence') evidenceView()
    else if (view === 'journeys') journeysView()
    else if (view === 'art') artView()
    else if (view === 'renderer') rendererView()
    else if (view === 'concepts') conceptsView()
    else commentsView()
    wire()
  }
  addEventListener('hashchange', render)
  render()
})()
