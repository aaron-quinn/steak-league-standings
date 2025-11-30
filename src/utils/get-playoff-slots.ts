import sortByPts from './sort-by-pts';
import sortByRecord from './sort-by-record';
import type { TeamForPlayoff } from '../types/TeamForPlayoff';
import type { PlayoffSlots } from '../types/PlayoffSlots';
import type { BubbleTeam } from '../types/BubbleTeam';

interface GetPlayoffSlotsParams {
  leagueData: TeamForPlayoff[];
  divisionName1: string;
  divisionName2: string;
}

interface PlayoffResult {
  slots: PlayoffSlots;
  bubbleTeams: BubbleTeam[];
}

export default function getPlayoffsSlots({
  leagueData,
  divisionName1,
  divisionName2,
}: GetPlayoffSlotsParams): PlayoffResult {
  const division1 = leagueData
    .filter((t) => t.division === divisionName1)
    .sort(sortByRecord);
  const division2 = leagueData
    .filter((t) => t.division === divisionName2)
    .sort(sortByRecord);

  const divisionWinners = [division1[0], division2[0]]
    .sort(sortByPts)
    .map((t) => t.name);

  let nonDivisionWinners = [...division1, ...division2]
    .filter((t) => !divisionWinners.includes(t.name))
    .sort(sortByPts);
  const mostPtsNonDiv = nonDivisionWinners.shift()!.name;

  nonDivisionWinners = nonDivisionWinners.sort(sortByRecord);
  const bestRecordNonDiv = nonDivisionWinners.shift()!.name;

  nonDivisionWinners = nonDivisionWinners.sort(sortByPts);
  const secondMostPtsTeam = nonDivisionWinners.shift()!;
  const secondMostPtsNonDiv = secondMostPtsTeam.name;

  nonDivisionWinners = nonDivisionWinners.sort(sortByRecord);
  const secondBestRecordTeam = nonDivisionWinners.shift()!;
  const secondBestRecord = secondBestRecordTeam.name;

  // Get bubble teams: 2 closest by points, 2 closest by record
  const calcPointsBack = (team: TeamForPlayoff) =>
    secondMostPtsTeam.points - team.points;

  const calcWinsBack = (team: TeamForPlayoff) => {
    const secondBestWinEquiv =
      secondBestRecordTeam.wins + secondBestRecordTeam.ties * 0.5;
    const teamWinEquiv = team.wins + team.ties * 0.5;
    return secondBestWinEquiv - teamWinEquiv;
  };

  const calcRecordSpotPointsBack = (team: TeamForPlayoff) =>
    secondBestRecordTeam.points - team.points;

  // 2 closest by points
  const closestByPoints = [...nonDivisionWinners]
    .sort(sortByPts)
    .slice(0, 2)
    .map((team) => ({
      name: team.name,
      points: team.points,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      pointsBack: calcPointsBack(team),
      winsBack: calcWinsBack(team),
      recordSpotPointsBack: calcRecordSpotPointsBack(team),
      qualifier: 'points' as const,
    }));

  // 2 closest by record
  const closestByRecord = [...nonDivisionWinners]
    .sort(sortByRecord)
    .slice(0, 2)
    .map((team) => ({
      name: team.name,
      points: team.points,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      pointsBack: calcPointsBack(team),
      winsBack: calcWinsBack(team),
      recordSpotPointsBack: calcRecordSpotPointsBack(team),
      qualifier: 'record' as const,
    }));

  // Combine and dedupe (some teams may appear in both)
  const seen = new Set<string>();
  const bubbleTeams: BubbleTeam[] = [];
  for (const team of [...closestByPoints, ...closestByRecord]) {
    if (!seen.has(team.name)) {
      seen.add(team.name);
      bubbleTeams.push(team);
    }
  }

  // Sort by closest path to playoffs
  // If tied in record, use recordSpotPointsBack if it's smaller than pointsBack
  bubbleTeams.sort((a, b) => {
    const getClosestGap = (team: BubbleTeam) => {
      // If tied in record (winsBack === 0), consider recordSpotPointsBack as a path
      if (team.winsBack === 0) {
        return Math.min(team.pointsBack, team.recordSpotPointsBack);
      }
      return team.pointsBack;
    };
    return getClosestGap(a) - getClosestGap(b);
  });

  return {
    slots: {
      'Division Winner, Best Record': divisionWinners[0],
      'Other Division Winner': divisionWinners[1],
      'Non Division Winner, Most Points': mostPtsNonDiv,
      'Non Division Winner, Best Record': bestRecordNonDiv,
      'Non Division Winner, Second Most Points': secondMostPtsNonDiv,
      'Non Divison Winner, Second Best Record': secondBestRecord,
    },
    bubbleTeams,
  };
}
