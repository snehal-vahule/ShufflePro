import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canAddPlayerToCourt,
  generateCourts,
  getSkillLabel,
  getSkillRank,
  makePlayerId,
  mixPlayersBySkill,
  normalizePlayer
} from '../src/assignmentLogic.mjs';

test('normalizePlayer adds an id and normalized skill fields', () => {
  const prevWindow = globalThis.window;

  try {
    globalThis.window = { crypto: { randomUUID: () => 'uuid-123' } };
    const player = normalizePlayer({ name: 'Alex', skill: 'ADVANCED' });

    assert.equal(player.name, 'Alex');
    assert.equal(player.skill, 'advanced');
    assert.equal(player.skillRank, 3);
    assert.equal(player.id, 'uuid-123');
  } finally {
    globalThis.window = prevWindow;
  }
});

test('makePlayerId falls back to a UUID-like value when crypto is unavailable', () => {
  const prevWindow = globalThis.window;

  try {
    globalThis.window = { crypto: undefined };
    const id = makePlayerId();
    assert.match(id, /^player-/);
  } finally {
    globalThis.window = prevWindow;
  }
});

test('getSkillRank and getSkillLabel return expected values', () => {
  assert.equal(getSkillRank('beginner'), 1);
  assert.equal(getSkillRank('intermediate'), 2);
  assert.equal(getSkillRank('advanced'), 3);
  assert.equal(getSkillLabel('beginner'), 'Beginner');
  assert.equal(getSkillLabel('intermediate'), 'Intermediate');
  assert.equal(getSkillLabel('advanced'), 'Advanced');
});

test('canAddPlayerToCourt blocks illegal skill combinations', () => {
  const mixedCourt = [
    { skill: 'advanced' },
    { skill: 'intermediate' }
  ];

  assert.equal(canAddPlayerToCourt(mixedCourt, 'beginner'), false);
  assert.equal(canAddPlayerToCourt(mixedCourt, 'advanced'), true);
  assert.equal(canAddPlayerToCourt([{ skill: 'advanced' }, { skill: 'beginner' }], 'intermediate'), false);

  const validCourt = [
    { skill: 'intermediate' },
    { skill: 'intermediate' }
  ];

  assert.equal(canAddPlayerToCourt(validCourt, 'advanced'), true);
  assert.equal(canAddPlayerToCourt([{ skill: 'beginner' }, { skill: 'intermediate' }], 'beginner'), true);
});

test('mixPlayersBySkill keeps every player while grouping by skill', () => {
  const players = [
    { id: '1', skill: 'advanced' },
    { id: '2', skill: 'beginner' },
    { id: '3', skill: 'intermediate' },
    { id: '4', skill: 'beginner' },
    { id: '5', skill: 'advanced' }
  ];

  const mixed = mixPlayersBySkill(players);

  assert.equal(mixed.length, players.length);
  const ids = mixed.map((player) => player.id).sort();
  assert.deepEqual(ids, ['1', '2', '3', '4', '5']);
});

test('generateCourts fills courts without exceeding capacity and keeps all players accounted for', () => {
  const players = [
    { id: 'p1', name: 'A', skill: 'beginner' },
    { id: 'p2', name: 'B', skill: 'beginner' },
    { id: 'p3', name: 'C', skill: 'intermediate' },
    { id: 'p4', name: 'D', skill: 'intermediate' },
    { id: 'p5', name: 'E', skill: 'advanced' },
    { id: 'p6', name: 'F', skill: 'advanced' },
    { id: 'p7', name: 'G', skill: 'advanced' },
    { id: 'p8', name: 'H', skill: 'advanced' },
    { id: 'p9', name: 'I', skill: 'advanced' }
  ];

  const result = generateCourts(players, 'doubles', 2);
  const allPlayers = [...result.courts.flat(), ...result.bench];

  assert.equal(result.courts.length, 2);
  assert.ok(result.courts.every((court) => court.length <= 4));
  assert.equal(allPlayers.length, players.length);
  assert.equal(new Set(allPlayers.map((player) => player.id)).size, players.length);
  assert.ok(result.bench.length >= 1);
});
