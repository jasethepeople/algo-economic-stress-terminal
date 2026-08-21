export function normalizeScenarioTags(tags: string[]) {
  return Array.from(new Set(tags.map(tag => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 8);
}
