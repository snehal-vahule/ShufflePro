import {
  STORAGE_KEY,
  ASSIGNMENT_KEY,
  LOCKED_COURTS_KEY,
  normalizePlayer,
  generateCourts,
  getSkillLabel,
  makePlayerId,
  canAddPlayerToCourt
} from "./assignmentLogic.mjs";
import { initializeAuth } from "./auth.mjs";

const state = {
  players: [],
  currentAssignments: { courts: [], bench: [] },
  collapsedCourtState: new Set(),
  lockedCourts: new Set(),
  draggedPlayer: null,
  dragGhost: null,
  dragScrollTimer: null,
  lastPointerEvent: null
};
let storageUserId = null;

const elements = {
  playerNameInput: null,
  playerSkillSelect: null,
  addPlayerBtn: null,
  shuffleBtn: null,
  resetBtn: null,
  playerList: null,
  courtsOutput: null,
  matchType: null,
  courtCountSelect: null,
  benchList: null,
  playersSection: null,
  playerToggle: null,
  toggleBtn: null,
  playerCountBadge: null
};

function getCourtCapacity() {
  return elements.matchType.value === "singles" ? 2 : 4;
}

function getStorageKey(key) {
  return `${key}:${storageUserId}`;
}

function setStorageUser(userId) {
  storageUserId = userId;
  [STORAGE_KEY, ASSIGNMENT_KEY, LOCKED_COURTS_KEY].forEach((key) => {
    const userKey = getStorageKey(key);
    if (localStorage.getItem(userKey) === null) {
      const previousValue = localStorage.getItem(key);
      if (previousValue !== null) {
        localStorage.setItem(userKey, previousValue);
        localStorage.removeItem(key);
      }
    }
  });
}

function savePlayers() {
  localStorage.setItem(getStorageKey(STORAGE_KEY), JSON.stringify(state.players));
}

function saveAssignments() {
  localStorage.setItem(getStorageKey(ASSIGNMENT_KEY), JSON.stringify(state.currentAssignments));
}

function saveLockedCourts() {
  localStorage.setItem(getStorageKey(LOCKED_COURTS_KEY), JSON.stringify(Array.from(state.lockedCourts).sort((a, b) => a - b)));
}

function showPopup(message) {
  let popup = document.getElementById("appPopup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "appPopup";
    popup.className = "app-popup hidden";
    popup.innerHTML = `
      <div class="app-popup-backdrop"></div>
      <div class="app-popup-dialog" role="alertdialog" aria-modal="true" aria-live="assertive">
        <p class="app-popup-message"></p>
        <button type="button" class="primary app-popup-close">OK</button>
      </div>
    `;
    document.body.appendChild(popup);

    popup.querySelector(".app-popup-close").addEventListener("click", () => {
      popup.classList.add("hidden");
    });

    popup.querySelector(".app-popup-backdrop").addEventListener("click", () => {
      popup.classList.add("hidden");
    });
  }

  popup.querySelector(".app-popup-message").textContent = message;
  popup.classList.remove("hidden");
}

function showConfirm(message, onConfirm) {
  let confirmBox = document.getElementById("appConfirm");
  if (!confirmBox) {
    confirmBox = document.createElement("div");
    confirmBox.id = "appConfirm";
    confirmBox.className = "app-confirm hidden";
    confirmBox.innerHTML = `
      <div class="app-confirm-backdrop"></div>
      <div class="app-confirm-dialog" role="dialog" aria-modal="true">
        <p class="app-confirm-message"></p>
        <div class="app-confirm-actions">
          <button type="button" class="secondary app-confirm-cancel">Cancel</button>
          <button type="button" class="primary app-confirm-ok">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmBox);

    confirmBox.querySelector(".app-confirm-backdrop").addEventListener("click", () => {
      confirmBox.classList.add("hidden");
    });
    confirmBox.querySelector(".app-confirm-cancel").addEventListener("click", () => {
      confirmBox.classList.add("hidden");
    });
  }

  const confirmMessage = confirmBox.querySelector(".app-confirm-message");
  const confirmOk = confirmBox.querySelector(".app-confirm-ok");
  confirmMessage.textContent = message;
  confirmOk.onclick = () => {
    confirmBox.classList.add("hidden");
    onConfirm();
  };
  confirmBox.classList.remove("hidden");
}

function createPlayerMeta(player) {
  const meta = document.createElement("div");
  meta.className = "player-meta";

  const label = document.createElement("span");
  label.textContent = player.name;

  const badge = document.createElement("span");
  badge.className = `badge skill-${String(player.skill || "beginner").toLowerCase()}`;
  badge.textContent = getSkillLabel(player.skill);

  meta.appendChild(label);
  meta.appendChild(badge);

  return meta;
}

function renderPlayers() {
  elements.playerCountBadge.textContent = String(state.players.length);
  elements.playerList.innerHTML = "";

  if (state.players.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No players added yet.";
    elements.playerList.appendChild(li);
    return;
  }

  state.players.forEach((player, index) => {
    const item = document.createElement("li");
    item.className = "player-item";
    const meta = createPlayerMeta(player);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "danger icon-button";
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", `Remove ${player.name}`);
    deleteBtn.title = `Remove ${player.name}`;
    deleteBtn.textContent = "🗑";
    deleteBtn.addEventListener("click", () => {
      state.players.splice(index, 1);
      savePlayers();
      refreshAssignmentsFromPlayers();
      renderPlayers();
      renderCourts();
    });

    item.appendChild(meta);
    item.appendChild(deleteBtn);
    elements.playerList.appendChild(item);
  });
}

function refreshAssignmentsFromPlayers() {
  const mode = elements.matchType.value;
  const courtTotal = Number(elements.courtCountSelect.value);
  const lockedSet = new Set(state.lockedCourts);

  if (state.players.length === 0) {
    state.currentAssignments = { courts: Array.from({ length: courtTotal }, () => []), bench: [] };
    saveAssignments();
    return;
  }

  const lockedPlayers = new Set();
  const nextCourts = Array.from({ length: courtTotal }, () => []);

  for (let index = 0; index < courtTotal; index++) {
    const courtPlayers = Array.isArray(state.currentAssignments.courts[index]) ? state.currentAssignments.courts[index] : [];
    if (lockedSet.has(index)) {
      nextCourts[index] = courtPlayers.filter((player) => state.players.some((p) => p.id === player.id));
      nextCourts[index].forEach((player) => lockedPlayers.add(player.id));
    }
  }

  const nonLockedPlayers = state.players.filter((player) => !lockedPlayers.has(player.id));
  const unlockedCourtCount = Math.max(courtTotal - lockedSet.size, 0);

  if (unlockedCourtCount === 0) {
    state.currentAssignments = { courts: nextCourts, bench: [] };
    saveAssignments();
    return;
  }

  const generated = generateCourts(nonLockedPlayers, mode, unlockedCourtCount);
  const unlockedIndexes = [];

  for (let index = 0; index < courtTotal; index++) {
    if (!lockedSet.has(index)) unlockedIndexes.push(index);
  }

  generated.courts.forEach((courtPlayers, index) => {
    const targetIndex = unlockedIndexes[index];
    if (typeof targetIndex === "number") {
      nextCourts[targetIndex] = courtPlayers;
    }
  });

  state.currentAssignments = {
    courts: nextCourts,
    bench: generated.bench
  };
  saveAssignments();
}

function clearDragState() {
  if (state.dragGhost) {
    state.dragGhost.remove();
    state.dragGhost = null;
  }

  if (state.dragScrollTimer) {
    clearInterval(state.dragScrollTimer);
    state.dragScrollTimer = null;
  }

  document.removeEventListener("pointermove", moveDragGhost);
  document.removeEventListener("pointerup", handlePointerDrop);

  if (state.draggedPlayer && state.draggedPlayer.element && state.draggedPlayer.element.hasPointerCapture) {
    try {
      state.draggedPlayer.element.releasePointerCapture(state.draggedPlayer.pointerId);
    } catch (error) {
      // ignore if there is no active capture
    }
  }

  document.querySelectorAll(".court-card, #benchList").forEach((element) => {
    element.classList.remove("drag-over");
  });

  if (state.draggedPlayer && state.draggedPlayer.element) {
    state.draggedPlayer.element.classList.remove("dragging");
  }

  state.draggedPlayer = null;
  state.lastPointerEvent = null;
}

function startAutoScrollLoop() {
  if (state.dragScrollTimer) return;

  state.dragScrollTimer = setInterval(() => {
    if (!state.draggedPlayer || !state.lastPointerEvent) return;

    const scrollThreshold = 80;
    const viewportHeight = window.innerHeight;
    const { clientY } = state.lastPointerEvent;

    if (clientY < scrollThreshold) {
      window.scrollBy({ top: -18, behavior: "auto" });
    } else if (clientY > viewportHeight - scrollThreshold) {
      window.scrollBy({ top: 18, behavior: "auto" });
    }
  }, 16);
}

function moveDragGhost(event) {
  if (!state.dragGhost) return;

  event.preventDefault();
  state.lastPointerEvent = event;
  state.dragGhost.style.left = `${event.clientX}px`;
  state.dragGhost.style.top = `${event.clientY}px`;

  const target = document.elementFromPoint(event.clientX, event.clientY);
  const courtCard = target ? target.closest(".court-card") : null;
  const benchCard = target ? target.closest("#benchList") : null;

  document.querySelectorAll(".court-card, #benchList").forEach((element) => {
    element.classList.toggle("drag-over", element === courtCard || element === benchCard);
  });
}

function handlePointerDrop(event) {
  if (!state.draggedPlayer) return;

  event.preventDefault();
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const courtCard = target ? target.closest(".court-card") : null;
  const benchListTarget = target ? target.closest("#benchList") : null;

  if (courtCard) {
    const courtIndex = Number(courtCard.dataset.courtIndex);
    if (state.lockedCourts.has(courtIndex)) {
      clearDragState();
      return;
    }
    movePlayerToCourt(courtIndex);
  } else if (benchListTarget) {
    movePlayerToBench();
  }

  clearDragState();
}

function startPointerDrag(event, player, options, item) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  if (event.pointerType === "mouse" && !window.matchMedia("(pointer: coarse)").matches) {
    return;
  }

  if (options.type === "court" && typeof options.courtIndex === "number" && state.lockedCourts.has(options.courtIndex)) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  item.setPointerCapture?.(event.pointerId);

  state.draggedPlayer = {
    player,
    sourceCourtIndex: options.courtIndex ?? null,
    sourceBenchIndex: options.type === "bench" ? options.benchIndex ?? null : null,
    element: item,
    pointerId: event.pointerId
  };

  item.classList.add("dragging");

  state.dragGhost = document.createElement("div");
  state.dragGhost.className = "drag-ghost";
  state.dragGhost.textContent = player.name;
  document.body.appendChild(state.dragGhost);
  state.lastPointerEvent = event;
  moveDragGhost(event);
  startAutoScrollLoop();

  document.addEventListener("pointermove", moveDragGhost);
  document.addEventListener("pointerup", handlePointerDrop, { once: true });
}

function createDraggablePlayerItem(player, options = {}) {
  const item = document.createElement("li");
  item.className = options.type === "bench" ? "bench-player" : "court-player";
  item.draggable = !(options.type === "court" && typeof options.courtIndex === "number" && state.lockedCourts.has(options.courtIndex));
  item.dataset.playerId = player.id;
  item.appendChild(createPlayerMeta(player));

  item.addEventListener("dragstart", (event) => {
    if (options.type === "court" && typeof options.courtIndex === "number" && state.lockedCourts.has(options.courtIndex)) {
      event.preventDefault();
      return;
    }

    state.draggedPlayer = {
      player,
      sourceCourtIndex: options.courtIndex ?? null,
      sourceBenchIndex: options.type === "bench" ? options.benchIndex ?? null : null,
      element: item
    };
    item.classList.add("dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", player.id);
    }
  });

  item.addEventListener("dragend", () => {
    item.classList.remove("dragging");
    if (!state.dragGhost) {
      state.draggedPlayer = null;
    }
  });

  item.addEventListener("pointerdown", (event) => {
    startPointerDrag(event, player, options, item);
  });

  return item;
}

function movePlayerToCourt(targetCourtIndex) {
  if (!state.draggedPlayer) return;

  if (state.lockedCourts.has(targetCourtIndex)) {
    return;
  }

  const { player, sourceCourtIndex, sourceBenchIndex } = state.draggedPlayer;
  const targetCourt = state.currentAssignments.courts[targetCourtIndex];
  const playerAlreadyInTarget = targetCourt.some((courtPlayer) => courtPlayer.id === player.id);

  if (sourceCourtIndex === targetCourtIndex || playerAlreadyInTarget) {
    return;
  }

  if (targetCourt.length >= getCourtCapacity()) {
    showPopup("This court is full.");
    return;
  }

  if (sourceCourtIndex !== null) {
    const sourceCourt = state.currentAssignments.courts[sourceCourtIndex];
    const sourceIndex = sourceCourt.findIndex((courtPlayer) => courtPlayer.id === player.id);
    if (sourceIndex >= 0) {
      sourceCourt.splice(sourceIndex, 1);
    }
  }

  if (sourceBenchIndex !== null) {
    const sourceIndex = state.currentAssignments.bench.findIndex((benchPlayer) => benchPlayer.id === player.id);
    if (sourceIndex >= 0) {
      state.currentAssignments.bench.splice(sourceIndex, 1);
    }
  }

  targetCourt.push(player);
  saveAssignments();
  renderCourts();
}

function movePlayerToBench() {
  if (!state.draggedPlayer) return;

  const { player, sourceCourtIndex, sourceBenchIndex } = state.draggedPlayer;

  if (sourceBenchIndex !== null) {
    return;
  }

  if (sourceCourtIndex !== null) {
    const sourceCourt = state.currentAssignments.courts[sourceCourtIndex];
    const sourceIndex = sourceCourt.findIndex((courtPlayer) => courtPlayer.id === player.id);
    if (sourceIndex >= 0) {
      sourceCourt.splice(sourceIndex, 1);
    }
  }

  const existingBenchIndex = state.currentAssignments.bench.findIndex((benchPlayer) => benchPlayer.id === player.id);
  if (existingBenchIndex >= 0) {
    state.currentAssignments.bench.splice(existingBenchIndex, 1);
  }

  state.currentAssignments.bench.push(player);
  saveAssignments();
  renderCourts();
}

function bindDropZone(element, onDrop) {
  element.addEventListener("dragover", (event) => {
    if (element.classList.contains("court-card") && state.lockedCourts.has(Number(element.dataset.courtIndex))) {
      event.preventDefault();
      element.classList.remove("drag-over");
      return;
    }
    event.preventDefault();
    element.classList.add("drag-over");
  });

  element.addEventListener("dragleave", () => {
    element.classList.remove("drag-over");
  });

  element.addEventListener("drop", (event) => {
    event.preventDefault();
    element.classList.remove("drag-over");
    if (element.classList.contains("court-card") && state.lockedCourts.has(Number(element.dataset.courtIndex))) {
      return;
    }
    onDrop();
  });
}

function renderCourts() {
  const mode = elements.matchType.value;
  const courtTotal = Number(elements.courtCountSelect.value);

  let courts = state.currentAssignments.courts;
  let bench = state.currentAssignments.bench;

  if (state.players.length === 0) {
    elements.courtsOutput.innerHTML = '<p class="empty">No court assignments yet.</p>';
    elements.benchList.innerHTML = '<li class="empty">No players on bench.</li>';
    state.collapsedCourtState.clear();
    state.lockedCourts.clear();
    saveLockedCourts();
    return;
  }

  if (!Array.isArray(state.currentAssignments.courts) || state.currentAssignments.courts.length !== courtTotal) {
    const generated = generateCourts(state.players, mode, courtTotal);
    courts = generated.courts;
    bench = generated.bench;
  }

  state.currentAssignments = { courts, bench };
  saveAssignments();

  Array.from(state.collapsedCourtState).forEach((courtIndex) => {
    if (courtIndex < 0 || courtIndex >= courtTotal) {
      state.collapsedCourtState.delete(courtIndex);
    }
  });

  Array.from(state.lockedCourts).forEach((courtIndex) => {
    if (courtIndex < 0 || courtIndex >= courtTotal) {
      state.lockedCourts.delete(courtIndex);
    }
  });
  saveLockedCourts();

  elements.courtsOutput.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "court-grid";

  courts.forEach((court, index) => {
    const card = document.createElement("div");
    card.className = "court-card";
    if (state.collapsedCourtState.has(index)) {
      card.classList.add("collapsed");
    }
    if (state.lockedCourts.has(index)) {
      card.classList.add("locked");
    }
    card.dataset.courtIndex = String(index);
    bindDropZone(card, () => movePlayerToCourt(index));

    const header = document.createElement("div");
    header.className = "court-header";

    const title = document.createElement("h3");
    title.textContent = `Court ${index + 1}`;

    const controls = document.createElement("div");
    controls.className = "court-header-controls";

    const lockToggle = document.createElement("button");
    lockToggle.type = "button";
    lockToggle.className = "court-lock-toggle";
    const isCourtLocked = state.lockedCourts.has(index);
    lockToggle.textContent = isCourtLocked ? "🔒" : "🔓";
    lockToggle.setAttribute("aria-label", isCourtLocked ? "Unlock court from shuffling" : "Lock court from shuffling");
    lockToggle.setAttribute("aria-pressed", String(isCourtLocked));
    lockToggle.style.backgroundColor = isCourtLocked ? "rgba(239, 68, 68, 0.18)" : "rgba(34, 197, 94, 0.18)";
    lockToggle.style.color = isCourtLocked ? "#fca5a5" : "#86efac";
    lockToggle.style.borderColor = isCourtLocked ? "rgba(248, 113, 113, 0.9)" : "rgba(74, 222, 128, 0.9)";
    lockToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.lockedCourts.has(index)) {
        state.lockedCourts.delete(index);
      } else {
        state.lockedCourts.add(index);
      }
      saveLockedCourts();
      renderCourts();
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "court-toggle";
    toggle.textContent = state.collapsedCourtState.has(index) ? "+" : "−";
    toggle.setAttribute("aria-expanded", String(!state.collapsedCourtState.has(index)));
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isCollapsed = card.classList.toggle("collapsed");
      if (isCollapsed) {
        state.collapsedCourtState.add(index);
      } else {
        state.collapsedCourtState.delete(index);
      }
      toggle.textContent = isCollapsed ? "+" : "−";
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
    });

    controls.appendChild(lockToggle);
    controls.appendChild(toggle);
    header.appendChild(title);
    header.appendChild(controls);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "court-body";

    const list = document.createElement("ul");

    if (court.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No players";
      list.appendChild(li);
    } else {
      court.forEach((player) => {
        const li = createDraggablePlayerItem(player, { type: "court", courtIndex: index });
        list.appendChild(li);
      });
    }

    body.appendChild(list);
    card.appendChild(body);
    grid.appendChild(card);
  });

  elements.courtsOutput.appendChild(grid);

  elements.benchList.innerHTML = "";
  bindDropZone(elements.benchList, movePlayerToBench);
  elements.benchList.dataset.benchList = "true";

  if (bench.length === 0) {
    elements.benchList.innerHTML = "<li class=\"empty\">All players assigned to courts.</li>";
    return;
  }

  bench.forEach((player, index) => {
    const li = createDraggablePlayerItem(player, { type: "bench", benchIndex: index });
    elements.benchList.appendChild(li);
  });
}

function addPlayer() {
  const name = elements.playerNameInput.value.trim();
  const skill = elements.playerSkillSelect.value;

  if (!name) {
    showPopup("Please enter a player name.");
    elements.playerNameInput.focus();
    return;
  }

  const isDuplicate = state.players.some((player) => player.name.trim().toLowerCase() === name.toLowerCase());
  if (isDuplicate) {
    showPopup("Player name must be unique.");
    elements.playerNameInput.focus();
    return;
  }

  state.players.push({
    id: makePlayerId(),
    name,
    skill: String(skill).toLowerCase()
  });

  savePlayers();
  refreshAssignmentsFromPlayers();
  renderPlayers();
  renderCourts();

  elements.playerNameInput.value = "";
  elements.playerNameInput.focus();
}

function clearAll() {
  if (state.players.length === 0) return;

  showConfirm("Remove all players and reset the courts?", () => {
    state.players = [];
    localStorage.removeItem(getStorageKey(ASSIGNMENT_KEY));
    savePlayers();
    renderPlayers();
    renderCourts();
  });
}

function togglePlayersSection() {
  const isCollapsed = elements.playersSection.classList.toggle("collapsed");
  elements.toggleBtn.textContent = isCollapsed ? "+" : "−";
  elements.toggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
}

function bindEvents() {
  elements.addPlayerBtn.addEventListener("click", addPlayer);

  elements.playerNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addPlayer();
    }
  });

  elements.shuffleBtn.addEventListener("click", () => {
    if (state.players.length < 2) {
      showPopup("Add at least 2 players to shuffle courts.");
      return;
    }

    const courtTotal = Number(elements.courtCountSelect.value);
    if (state.lockedCourts.size >= courtTotal) {
      showPopup("Unlock at least one court before shuffling.");
      return;
    }

    const remainingPlayers = state.players.filter((player) => {
      return !Array.from(state.lockedCourts).some((courtIndex) => {
        const court = state.currentAssignments.courts[courtIndex] || [];
        return court.some((courtPlayer) => courtPlayer.id === player.id);
      });
    });

    if (remainingPlayers.length === 0) {
      showPopup("All players are on locked courts.");
      return;
    }

    const unlockedCourtCount = Math.max(courtTotal - state.lockedCourts.size, 0);
    const generated = generateCourts(remainingPlayers, elements.matchType.value, unlockedCourtCount);
    const nextCourts = Array.from({ length: courtTotal }, () => []);
    const unlockedIndexes = [];

    for (let index = 0; index < courtTotal; index++) {
      if (!state.lockedCourts.has(index)) {
        unlockedIndexes.push(index);
      }
    }

    Array.from(state.lockedCourts).forEach((courtIndex) => {
      nextCourts[courtIndex] = [...(state.currentAssignments.courts[courtIndex] || [])];
    });

    generated.courts.forEach((courtPlayers, index) => {
      const targetIndex = unlockedIndexes[index];
      if (typeof targetIndex === "number") {
        nextCourts[targetIndex] = courtPlayers;
      }
    });

    state.currentAssignments = {
      courts: nextCourts,
      bench: generated.bench
    };
    saveAssignments();
    renderCourts();
  });

  elements.resetBtn.addEventListener("click", clearAll);
  elements.matchType.addEventListener("change", () => {
    refreshAssignmentsFromPlayers();
    renderCourts();
  });
  elements.courtCountSelect.addEventListener("change", () => {
    refreshAssignmentsFromPlayers();
    renderCourts();
  });
  elements.playerToggle.addEventListener("click", togglePlayersSection);
}

function hydrateState() {
  state.players = JSON.parse(localStorage.getItem(getStorageKey(STORAGE_KEY)) || "[]").map(normalizePlayer);
  state.lockedCourts = new Set(JSON.parse(localStorage.getItem(getStorageKey(LOCKED_COURTS_KEY)) || "[]"));

  const savedAssignments = JSON.parse(localStorage.getItem(getStorageKey(ASSIGNMENT_KEY)) || "null");
  if (savedAssignments && Array.isArray(savedAssignments.courts) && Array.isArray(savedAssignments.bench)) {
    state.currentAssignments = {
      courts: savedAssignments.courts.map((court) => Array.isArray(court) ? court.map(normalizePlayer) : []),
      bench: Array.isArray(savedAssignments.bench) ? savedAssignments.bench.map(normalizePlayer) : []
    };
  } else {
    refreshAssignmentsFromPlayers();
  }
}

function initialize() {
  elements.playerNameInput = document.getElementById("playerName");
  elements.playerSkillSelect = document.getElementById("playerSkill");
  elements.addPlayerBtn = document.getElementById("addPlayerBtn");
  elements.shuffleBtn = document.getElementById("shuffleBtn");
  elements.resetBtn = document.getElementById("resetBtn");
  elements.playerList = document.getElementById("playerList");
  elements.courtsOutput = document.getElementById("courtsOutput");
  elements.matchType = document.getElementById("matchType");
  elements.courtCountSelect = document.getElementById("courtCount");
  elements.benchList = document.getElementById("benchList");
  elements.playersSection = document.getElementById("playersSection");
  elements.playerToggle = document.getElementById("playerToggle");
  elements.toggleBtn = document.querySelector(".toggle-btn");
  elements.playerCountBadge = document.getElementById("playerCountBadge");

  bindEvents();
  initializeAuth({
    onAuthenticated(user) {
      setStorageUser(user.id);
      hydrateState();
      renderPlayers();
      renderCourts();
    },
    onSignedOut() {
      storageUserId = null;
      state.players = [];
      state.currentAssignments = { courts: [], bench: [] };
      state.lockedCourts.clear();
      state.collapsedCourtState.clear();
    }
  });
}

initialize();

window.App = {
  state,
  renderPlayers,
  renderCourts,
  refreshAssignmentsFromPlayers,
  addPlayer,
  clearAll,
  showPopup,
  showConfirm,
  canAddPlayerToCourt
};
