export default function sortTeamList(teams, sortOn = 'points') {
  return Object.fromEntries(
    Object.entries(teams).sort((a, b) => b[1][sortOn] - a[1][sortOn])
  );
}
