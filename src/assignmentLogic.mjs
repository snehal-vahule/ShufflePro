export const STORAGE_KEY = "shuffleProPlayers";
export const ASSIGNMENT_KEY = "shuffleProAssignments";
export const LOCKED_COURTS_KEY = "shuffleProLockedCourts";

export const skillRankMap = {
  beginner: 1,
  intermediate: 2,
  advanced: 3
};

export function makePlayerId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getSkillRank(skill) {
  const value = String(skill || "beginner").toLowerCase();
  return skillRankMap[value] ?? 1;
}

export function getSkillLabel(skill) {
  const value = String(skill || "beginner").toLowerCase();
  if (value === "beginner") return "Beginner";
  if (value === "intermediate") return "Intermediate";
  return "Advanced";
}

export function normalizePlayer(player) {
  return {
    ...player,
    id: player.id || makePlayerId(),
    skill: String(player.skill || "beginner").toLowerCase(),
    skillRank: getSkillRank(player.skill)
  };
}

export function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function mixPlayersBySkill(selectedPlayers) {
  const groups = {
    beginner: [],
    intermediate: [],
    advanced: []
  };

  selectedPlayers.forEach((player) => {
    const key = String(player.skill || "beginner").toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(player);
  });

  const mixed = [];

  Object.keys(groups).forEach((key) => {
    const shuffledGroup = shuffleArray(groups[key]);
    shuffledGroup.forEach((player) => mixed.push(player));
  });

  return shuffleArray(mixed);
}

export function canAddPlayerToCourt(court, playerSkill) {
  const playerSkillKey = String(playerSkill || "beginner").toLowerCase();
  const courtSkills = court.map((courtPlayer) => String(courtPlayer.skill || "beginner").toLowerCase());

  if (court.length >= 4) return false;

  if (playerSkillKey === "advanced") {
    return !courtSkills.includes("beginner");
  }

  if (playerSkillKey === "beginner") {
    return !courtSkills.includes("advanced");
  }

  if (playerSkillKey === "intermediate") {
    return !(courtSkills.includes("advanced") && courtSkills.includes("beginner"));
  }

  return true;
}

export function generateCourts(selectedPlayers, mode, courtTotal) {
  if (selectedPlayers.length === 0) {
    return {
      courts: Array.from({ length: courtTotal }, () => []),
      bench: []
    };
  }

  const playersPerCourt = mode === "singles" ? 2 : 4;
  const maxCourtPlayers = courtTotal * playersPerCourt;
  const mixed = mixPlayersBySkill(selectedPlayers);
  const activePlayers = mixed.slice(0, Math.min(mixed.length, maxCourtPlayers));
  const benches = mixed.slice(Math.min(mixed.length, maxCourtPlayers));
  const courts = Array.from({ length: courtTotal }, () => []);

  activePlayers.forEach((player) => {
    const candidateIndexes = [];

    courts.forEach((court, index) => {
      if (court.length >= playersPerCourt) return;
      if (canAddPlayerToCourt(court, player.skill)) {
        candidateIndexes.push(index);
      }
    });

    if (candidateIndexes.length === 0) {
      benches.push(player);
      return;
    }

    candidateIndexes.sort((a, b) => courts[a].length - courts[b].length);
    courts[candidateIndexes[0]].push(player);
  });

  return { courts, bench: benches };
}
