export function canReadSharedScenario(
  scenario: { shareEnabled: boolean; shareToken: string | null } | undefined,
  token: string
) {
  return Boolean(scenario?.shareEnabled && scenario.shareToken && scenario.shareToken === token);
}
