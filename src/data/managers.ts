import type { Manager } from '../types/Manager';

export default function getManagers(): Manager[] {
  const managers: Manager[] = [
    {
      name: 'Jason Shebilske 🪦',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0014',
          steak: false,
        },
      },
    },
    {
      name: 'Lucas Reller 🪦',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0006',
          steak: false,
        },
      },
    },
    {
      name: 'Aaron Quinn',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0002',
          steak: true,
        },
        2024: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0002',
          steak: false,
        },
        2023: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0002',
          steak: true,
        },
        2022: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0002',
          steak: true,
        },
        2021: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0002',
          steak: false,
        },
        2020: {
          steak: true,
        },
        2019: {
          steak: true,
        },
        2018: {
          steak: true,
        },
        2017: {
          steak: true,
        },
        2016: {
          steak: true,
        },
      },
    },
    {
      name: 'John McKechnie',
      teams: {
        2023: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0009',
          steak: false,
        },
        2022: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0009',
          steak: false,
        },
        2021: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0009',
          steak: true,
        },
        2020: {
          steak: true,
        },
        2019: {
          steak: true,
        },
        2018: {
          steak: true,
        },
        2017: {
          steak: false,
        },
        2016: {
          steak: false,
        },
      },
    },
    {
      name: 'Andrew Parr',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0010',
          steak: true,
        },
        2024: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0010',
          steak: true,
        },
        2023: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0010',
          steak: true,
        },
        2022: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0010',
          steak: false,
        },
        2021: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0010',
          steak: false,
        },
        2020: {
          steak: true,
        },
        2019: {
          steak: false,
        },
        2018: {
          steak: true,
        },
        2017: {
          steak: true,
          champion: true,
        },
        2016: {
          steak: false,
        },
      },
    },
    {
      name: 'D.J. Trainor',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0004',
          steak: true,
        },
        2024: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0004',
          steak: false,
        },
        2023: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0004',
          steak: false,
        },
        2022: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0004',
          steak: false,
        },
        2021: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0004',
          steak: false,
        },
        2020: {
          steak: true,
        },
        2019: {
          steak: true,
        },
      },
    },
    {
      name: 'Ryan Pohle 🪦',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0003',
          steak: false,
        },
        2024: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0003',
          steak: true,
        },
        2023: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0003',
          steak: true,
        },
        2022: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0003',
          steak: false,
        },
      },
    },
    {
      name: 'Brigham Heyn',
      teams: {
        2021: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0003',
          steak: false,
        },
        2017: {
          steak: true,
        },
        2016: {
          steak: true,
        },
      },
    },
    {
      name: 'Harry Thompson 🪦',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0011',
          steak: false,
        },
        2024: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0011',
          steak: true,
        },
        2023: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0011',
          steak: false,
        },
        2022: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0011',
          steak: false,
        },
        2021: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0011',
          steak: true,
          champion: true,
        },
        2020: {
          steak: true,
          champion: true,
        },
        2019: {
          steak: true,
        },
        2018: {
          steak: true,
        },
        2017: {
          steak: true,
        },
        2016: {
          steak: true,
        },
      },
    },
    {
      name: 'Shannon McKeown',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0012',
          steak: true,
        },
        2024: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0012',
          steak: false,
        },
        2023: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0012',
          steak: true,
        },
        2022: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0012',
          steak: false,
        },
        2021: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0012',
          steak: false,
        },
        2020: {
          steak: true,
        },
        2019: {
          steak: false,
        },
        2018: {
          steak: false,
        },
        2017: {
          steak: true,
        },
        2016: {
          steak: false,
        },
      },
    },
    {
      name: 'Chris Benzine',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0013',
          steak: true,
        },
        2024: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0013',
          steak: true,
        },
        2023: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0013',
          steak: true,
        },
        2022: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0013',
          steak: false,
        },
        2021: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0013',
          steak: false,
        },
        2019: {
          steak: true,
        },
      },
    },
    {
      name: 'Kurt Kroll',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0005',
          steak: true,
        },
        2024: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0005',
          steak: false,
        },
        2023: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0005',
          steak: false,
        },
        2022: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0005',
          steak: true,
        },
        2021: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0005',
          steak: true,
        },
        2020: {
          steak: false,
        },
      },
    },
    {
      name: `Kevin O'Brien`,
      teams: {
        2025: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0001',
          steak: false,
        },
        2024: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0001',
          steak: false,
        },
        2023: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0001',
          steak: false,
        },
        2022: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0001',
          steak: true,
        },
        2021: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0001',
          steak: false,
        },
        2020: {
          steak: false,
        },
        2019: {
          steak: false,
        },
        2018: {
          steak: true,
        },
        2017: {
          steak: false,
        },
        2016: {
          steak: true,
        },
        2014: {
          champion: true,
        },
      },
    },
    {
      name: 'Jim Coventry',
      teams: {
        2024: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0006',
          steak: false,
        },
        2023: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0006',
          steak: false,
        },
      },
    },
    {
      name: 'Nick Rawling',
      teams: {
        2022: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0006',
          steak: true,
        },
      },
    },
    {
      name: 'Mario Puig',
      teams: {
        2021: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0006',
          steak: false,
        },
        2019: {
          steak: true,
        },
        2018: {
          steak: true,
        },
      },
    },
    {
      name: 'Steve Bulanda',
      teams: {
        2024: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0014',
          steak: false,
        },
        2023: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0014',
          steak: true,
        },
      },
    },
    {
      name: 'Alan Seslowski',
      teams: {
        2022: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0014',
          steak: false,
        },
        2021: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0014',
          steak: true,
        },
      },
    },
    {
      name: 'Eric Caturia 🪦',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0007',
          steak: false,
        },
        2024: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0007',
          steak: true,
        },
        2023: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0007',
          steak: false,
        },
        2022: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0007',
          steak: true,
        },
        2021: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0007',
          steak: true,
        },
        2020: {
          steak: false,
        },
        2019: {
          steak: false,
        },
        2018: {
          steak: false,
        },
        2017: {
          steak: false,
        },
        2016: {
          steak: true,
        },
      },
    },
    {
      name: 'Jake Letarski 🪦',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0008',
          steak: false,
        },
        2024: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0008',
          steak: false,
        },
        2023: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0008',
          steak: false,
        },
        2022: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0008',
          steak: true,
          champion: true,
        },
        2021: {
          league: 'Madison',
          division: 'Filet Mignon',
          teamID: '0008',
          steak: true,
        },
        2020: {
          steak: true,
        },
        2019: {
          steak: true,
        },
        2018: {
          steak: true,
        },
        2017: {
          steak: false,
        },
        2016: {
          steak: false,
        },
      },
    },
    {
      name: 'Chris Knudsvig',
      teams: {
        2025: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0009',
          steak: true,
        },
        2024: {
          league: 'Madison',
          division: 'Au Poivre',
          teamID: '0009',
          steak: true,
        },
      },
    },
    {
      name: 'Paul Martinez',
      teams: {
        2025: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0001',
          champion: true,
        },
        2024: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0001',
          champion: true,
        },
        2023: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0001',
        },
        2022: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0001',
        },
        2021: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0001',
        },
      },
    },
    {
      name: 'Peter Schoenke',
      teams: {
        2025: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0004',
          steak: true,
        },
        2024: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0004',
          steak: true,
        },
        2023: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0004',
          steak: false,
        },
        2022: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0004',
          steak: true,
        },
        2021: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0004',
          steak: false,
        },
        2020: {
          steak: false,
        },
        2019: {
          steak: true,
        },
        2018: {
          steak: false,
        },
        2017: {
          steak: false,
        },
        2016: {
          steak: false,
        },
        2010: {
          champion: true,
        },
        2008: {
          champion: true,
        },
      },
    },
    {
      name: 'Ken Crites',
      teams: {
        2025: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0012',
          steak: true,
        },
        2024: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0012',
          steak: false,
        },
        2023: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0012',
          steak: false,
        },
        2022: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0012',
          steak: true,
        },
        2021: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0012',
          steak: true,
        },
      },
    },
    {
      name: 'Len Hochberg',
      teams: {
        2025: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0006',
        },
        2024: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0006',
        },
        2023: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0006',
        },
        2022: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0006',
        },
        2021: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0006',
        },
        2019: {
          champion: true,
        },
      },
    },
    {
      name: 'Tim Schuler',
      teams: {
        2025: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0009',
        },
        2024: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0009',
        },
        2023: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0009',
        },
        2022: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0009',
        },
        2021: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0009',
        },
        2005: {
          champion: true,
        },
      },
    },
    {
      name: 'Joe Bartel 🪦',
      teams: {
        2025: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0010',
          steak: false,
        },
        2024: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0010',
          steak: true,
        },
        2023: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0010',
          steak: true,
        },
        2022: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0010',
          steak: false,
        },
        2021: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0010',
          steak: true,
        },
        2020: {
          steak: false,
        },
        2019: {
          steak: false,
        },
        2018: {
          steak: false,
        },
        2017: {
          steak: true,
        },
        2016: {
          steak: true,
        },
      },
    },
    {
      name: 'Mike Doria 🪦',
      teams: {
        2025: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0003',
          steak: false,
        },
        2024: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0003',
          steak: false,
        },
        2023: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0003',
          steak: true,
        },
        2022: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0003',
          steak: true,
        },
        2021: {
          league: 'LA',
          division: 'Taylors',
          teamID: '0003',
          steak: true,
        },
        2020: {
          steak: true,
        },
        2019: {
          steak: false,
        },
        2018: {
          steak: true,
        },
        2017: {
          steak: true,
        },
        2016: {
          steak: false,
        },
        2012: {
          champion: true,
        },
      },
    },
    {
      name: 'Chris Liss',
      teams: {
        2025: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0005',
        },
        2024: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0005',
        },
        2023: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0005',
        },
        2022: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0005',
        },
        2021: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0005',
        },
        2007: {
          champion: true,
        },
        2001: {
          champion: true,
        },
      },
    },
    {
      name: 'Herb Ilk 🪦',
      teams: {
        2025: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0011',
          steak: false,
        },
        2024: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0011',
          steak: true,
        },
        2023: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0011',
          steak: true,
        },
        2022: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0011',
          steak: false,
        },
        2021: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0011',
          steak: true,
        },
        2020: {
          steak: true,
        },
        2019: {
          steak: true,
        },
        2018: {
          steak: false,
        },
        2017: {
          steak: false,
        },
        2016: {
          steak: false,
        },
      },
    },
    {
      name: 'Scott Jenstad',
      teams: {
        2025: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0008',
        },
        2024: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0008',
        },
        2023: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0008',
        },
        2022: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0008',
        },
        2021: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0008',
        },
        2018: {
          champion: true,
        },
      },
    },
    {
      name: 'Jeff Erickson',
      teams: {
        2025: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0007',
        },
        2024: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0007',
        },
        2023: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0007',
        },
        2022: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0007',
        },
        2021: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0007',
        },
        2003: {
          champion: true,
        },
      },
    },
    {
      name: 'Jason Thornbury',
      teams: {
        2025: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0013',
        },
        2024: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0013',
        },
        2023: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0013',
        },
        2022: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0013',
        },
        2021: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0013',
        },
      },
    },
    {
      name: 'Erik Siegrist',
      teams: {
        2025: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0002',
        },
        2024: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0002',
        },
        2023: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0002',
        },
        2022: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0002',
        },
        2021: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0002',
        },
        2016: {
          champion: true,
        },
        2013: {
          champion: true,
        },
      },
    },
    {
      name: 'Josh Ross',
      teams: {
        2025: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0014',
        },
        2024: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0014',
        },
        2023: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0014',
          champion: true,
        },
        2022: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0014',
        },
        2021: {
          league: 'LA',
          division: 'Tornado Room',
          teamID: '0014',
        },
      },
    },
    {
      name: 'Derek VanRiper',
      teams: {
        2015: {
          champion: true,
        },
      },
    },
    {
      name: 'Joe Sheehan',
      teams: {
        2006: {
          champion: true,
        },
      },
    },
    {
      name: 'Mike Romanowski',
      teams: {
        2004: {
          champion: true,
        },
      },
    },
    {
      name: 'Josh White',
      teams: {
        2002: {
          champion: true,
        },
      },
    },
    {
      name: 'Dalton Del Don',
      teams: {
        2011: {
          champion: true,
        },
        2009: {
          champion: true,
        },
      },
    },
  ];
  return managers;
}
