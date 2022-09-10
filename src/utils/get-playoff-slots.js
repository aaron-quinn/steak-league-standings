import sortByPts from './sort-by-pts';
import sortByRecord from './sort-by-record';

export default function getPlayoffsSlots({
  leagueData,
  divisionName1,
  divisionName2,
}) {
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
  const mostPtsNonDiv = nonDivisionWinners.shift().name;

  nonDivisionWinners = nonDivisionWinners.sort(sortByRecord);
  const bestRecordNonDiv = nonDivisionWinners.shift().name;

  nonDivisionWinners = nonDivisionWinners.sort(sortByPts);
  const secondMostPtsNonDiv = nonDivisionWinners.shift().name;

  nonDivisionWinners = nonDivisionWinners.sort(sortByRecord);
  const secondBestRecord = nonDivisionWinners.shift().name;

  return {
    'Division Winner, Best Record': divisionWinners[0],
    'Other Division Winner': divisionWinners[1],
    'Non Division Winner, Most Points': mostPtsNonDiv,
    'Non Division Winner, Best Record': bestRecordNonDiv,
    'Non Division Winner, Second Most Points': secondMostPtsNonDiv,
    'Non Divison Winner, Second Best Record': secondBestRecord,
  };
}
