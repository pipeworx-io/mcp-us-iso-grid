interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * US ISO Grid MCP — real-time electricity generation, fuel mix, demand,
 * and locational marginal prices (LMPs) for the major United States
 * regional transmission operators / independent system operators.
 *
 * V1 covers the three ISOs with public no-auth endpoints:
 *   - CAISO  (California ISO)         outlook CSVs at caiso.com/outlook/current
 *   - ERCOT  (Texas, Electric Reliability Council of Texas) dashboard JSONs at ercot.com
 *   - NYISO  (New York ISO)           MIS CSV reports at mis.nyiso.com/public/csv
 *
 * Pairs with energy-charts (EU) for combined US + EU grid coverage.
 *
 * Notes:
 * - CAISO outlook CSVs hold the running current-day data, 5-minute
 *   granularity. The first column is the minute-of-day; future minutes
 *   are blank or 0. We filter to intervals that actually have data and
 *   return the most recent N.
 * - ERCOT dashboards are publicly served JSON files; they lag the live
 *   system by 5-15 minutes but cover fuel mix + supply/demand cleanly.
 * - NYISO MIS reports are published per UTC day; today's file may not
 *   exist until late evening NY time. Tools default to yesterday so the
 *   call almost always succeeds without an explicit date arg.
 */


const UA = 'pipeworx-mcp-us-iso-grid/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'caiso_fuel_mix',
    description:
      'CAISO (California) real-time grid fuel mix for today: solar, wind, geothermal, biomass, biogas, small hydro, coal, nuclear, natural gas, large hydro, batteries, imports per 5-minute interval. Returns timestamped MW values per fuel type. Use for "what is California using to make electricity right now", "solar curtailment today", "battery contribution this evening".',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Latest N intervals to return (default 12 = most-recent hour at 5-min granularity).' },
      },
    },
  },
  {
    name: 'caiso_demand',
    description:
      'CAISO (California) real-time electricity demand vs. forecast for today. Returns 5-minute demand series + day-ahead forecast + hour-ahead forecast (MW). Use for "is California load tracking forecast", peak-demand timing, demand-response triggers.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Latest N intervals (default 12).' },
      },
    },
  },
  {
    name: 'caiso_renewables',
    description:
      'CAISO (California) real-time renewable generation breakdown for today: solar, wind, geothermal, biomass, biogas, small hydro, nuclear, large hydro, batteries (MW per 5-min interval). Subset of caiso_fuel_mix focused on zero-/low-carbon sources. Use for "California renewable share right now", "duck curve today".',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Latest N intervals (default 12).' },
      },
    },
  },
  {
    name: 'caiso_co2',
    description:
      'CAISO (California) real-time grid carbon intensity for today: metric tons CO2 emitted per 5-minute interval, plus marginal CO2 (lbs/MWh). Use for "what is California grid carbon intensity right now", climate-aware load shifting, hourly emissions reporting.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Latest N intervals (default 12).' },
      },
    },
  },
  {
    name: 'ercot_fuel_mix',
    description:
      'ERCOT (Texas) real-time grid fuel mix: coal/lignite, natural gas, nuclear, hydro, wind, solar, power storage, other (MW). Returns the most recent 5-minute snapshot plus monthly installed capacity per fuel type, so percent-of-installed can be computed. Use for "Texas grid mix right now", "ERCOT wind output", "is Texas burning coal today".',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ercot_supply_demand',
    description:
      'ERCOT (Texas) real-time supply (capacity) vs. demand: hourly capacity, current demand, ERCOT load forecast (MW). Returns the recent day plus today\'s forecast. Use for "is ERCOT close to its reserve margin", "Texas demand vs. capacity", emergency-alert proximity during heatwaves.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'nyiso_lmp_zonal',
    description:
      'NYISO (New York) zonal LMP (locational marginal price, $/MWh) for the most recent published day, broken down by load zone (CAPITL, CENTRL, DUNWOD, GENESE, HUD VL, LONGIL, MHK VL, MILLWD, N.Y.C., NORTH, WEST). Returns LBMP, marginal cost of losses, marginal cost of congestion per 5-min interval. Use for NY wholesale electricity prices, zonal congestion analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD (NY local). Defaults to yesterday — today\'s file may not be published yet.' },
        zone: { type: 'string', description: 'Optional zone filter, e.g. "N.Y.C." or "CAPITL". Default: all 11 zones.' },
      },
    },
  },
  {
    name: 'nyiso_fuel_mix',
    description:
      'NYISO (New York) real-time grid fuel mix for the most recent published day: dual fuel (gas/oil-capable), natural gas, nuclear, other fossil fuels, hydro, wind, solar, other renewables (MW per 5-min interval). Use for "New York grid mix yesterday", NYC clean-energy progress tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to yesterday.' },
      },
    },
  },
  {
    name: 'nyiso_load',
    description:
      'NYISO (New York) actual zonal load (MW) per 5-minute interval for the most recent published day, by zone (CAPITL, CENTRL, DUNWOD, GENESE, HUD VL, LONGIL, MHK VL, MILLWD, N.Y.C., NORTH, WEST). Use for NY zonal demand analysis, peak-time identification, NYC load profile vs. upstate.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to yesterday.' },
        zone: { type: 'string', description: 'Optional zone filter. Default: all 11 zones.' },
      },
    },
  },
  {
    name: 'nyiso_load_forecast',
    description:
      'NYISO (New York) ISO load forecast (ISOLF) for the most recent published day, per zone, MW. Use for "what does NYISO expect demand to be today", forecast-error tracking vs. nyiso_load.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD. Defaults to yesterday.' },
        zone: { type: 'string', description: 'Optional zone filter. Default: all 11 zones.' },
      },
    },
  },
];

// ── CAISO ────────────────────────────────────────────────────────────

async function caisoOutlook(file: string): Promise<{ headers: string[]; rows: Record<string, string | number>[] }> {
  const url = `https://www.caiso.com/outlook/current/${file}.csv`;
  const res = await fetch(url, { headers: { Accept: 'text/csv', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CAISO ${file}: ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string | number>[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    // Filter intervals where every non-time cell is empty/0 (future).
    let hasData = false;
    for (let i = 1; i < cells.length; i++) {
      if (cells[i] && cells[i] !== '0') { hasData = true; break; }
    }
    if (!hasData) continue;
    const row: Record<string, string | number> = {};
    for (let i = 0; i < headers.length; i++) {
      const v = (cells[i] ?? '').trim();
      row[headers[i]] = i === 0 ? v : (v === '' ? 0 : Number(v));
    }
    rows.push(row);
  }
  return { headers, rows };
}

async function caisoLimited(file: string, limit: number) {
  const { headers, rows } = await caisoOutlook(file);
  const tail = rows.slice(-Math.max(1, Math.min(288, limit))); // 288 = full day at 5-min
  return { source: 'CAISO outlook', file, columns: headers, count: tail.length, intervals: tail };
}

// ── ERCOT ────────────────────────────────────────────────────────────

async function ercotDashboard(name: string): Promise<unknown> {
  const url = `https://www.ercot.com/api/1/services/read/dashboards/${name}.json`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`ERCOT ${name}: ${res.status}`);
  return res.json();
}

// ── NYISO ────────────────────────────────────────────────────────────

function nyisoDate(input: string | undefined): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input.replace(/-/g, '');
  // Default: yesterday in UTC (close enough; NYISO publishes after midnight ET).
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

// NYISO directory and file basename are not always identical (e.g. dir
// "/realtime/" → file "<date>realtime_zone.csv"). Pass both explicitly.
async function nyisoCsv(dir: string, base: string, yyyymmdd: string): Promise<{ headers: string[]; rows: string[][] }> {
  const url = `http://mis.nyiso.com/public/csv/${dir}/${yyyymmdd}${base}.csv`;
  const res = await fetch(url, { headers: { Accept: 'text/csv', 'User-Agent': UA } });
  if (res.status === 404) throw new Error(`NYISO ${dir} not yet published for ${yyyymmdd}. Try the previous day.`);
  if (!res.ok) throw new Error(`NYISO ${dir}: ${res.status}`);
  return parseQuotedCsv(await res.text());
}

// Minimal RFC-4180-ish parser: quoted fields, embedded commas, escaped quotes.
function parseQuotedCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 1) return { headers: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let buf = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') { buf += '"'; i++; } else { inQ = false; }
        } else buf += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { out.push(buf); buf = ''; }
        else buf += c;
      }
    }
    out.push(buf);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

// ── Tool dispatch ────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'caiso_fuel_mix':
      return caisoLimited('fuelsource', (args.limit as number | undefined) ?? 12);
    case 'caiso_demand':
      return caisoLimited('demand', (args.limit as number | undefined) ?? 12);
    case 'caiso_renewables':
      return caisoLimited('renewables', (args.limit as number | undefined) ?? 12);
    case 'caiso_co2':
      return caisoLimited('co2', (args.limit as number | undefined) ?? 12);

    case 'ercot_fuel_mix': {
      const raw = (await ercotDashboard('fuel-mix')) as {
        lastUpdated?: string;
        monthlyCapacity?: Record<string, number>;
        types?: string[];
        data?: Record<string, Record<string, Record<string, { gen?: number }>>>;
      };
      const days = raw.data ?? {};
      const dayKeys = Object.keys(days).sort();
      const lastDay = dayKeys[dayKeys.length - 1];
      const intervals = lastDay ? Object.keys(days[lastDay]).sort() : [];
      const lastInterval = intervals[intervals.length - 1];
      const snapshot = lastDay && lastInterval ? days[lastDay][lastInterval] : null;
      return {
        source: 'ERCOT fuel-mix dashboard',
        last_updated: raw.lastUpdated,
        monthly_installed_capacity_mw: raw.monthlyCapacity ?? null,
        latest_timestamp: lastInterval ?? null,
        latest_generation_mw: snapshot
          ? Object.fromEntries(Object.entries(snapshot).map(([k, v]) => [k, v.gen ?? null]))
          : null,
      };
    }
    case 'ercot_supply_demand': {
      const raw = (await ercotDashboard('supply-demand')) as {
        lastUpdated?: string;
        data?: Array<Record<string, number | string>>;
        forecast?: Array<Record<string, number | string>>;
      };
      return {
        source: 'ERCOT supply-demand dashboard',
        last_updated: raw.lastUpdated,
        recent: (raw.data ?? []).slice(-24),
        forecast: (raw.forecast ?? []).slice(0, 24),
      };
    }

    case 'nyiso_lmp_zonal': {
      const date = nyisoDate(args.date as string | undefined);
      const zone = (args.zone as string | undefined)?.trim();
      const { headers, rows } = await nyisoCsv('realtime', 'realtime_zone', date);
      const filtered = zone ? rows.filter((r) => r[1] === zone) : rows;
      const intervals = filtered.map((r) => ({
        timestamp: r[0],
        zone: r[1],
        ptid: Number(r[2]),
        lbmp_per_mwh: Number(r[3]),
        loss_cost_per_mwh: Number(r[4]),
        congestion_cost_per_mwh: Number(r[5]),
      }));
      return { source: 'NYISO realtime LBMP', report_date: date, columns: headers, count: intervals.length, intervals };
    }
    case 'nyiso_fuel_mix': {
      const date = nyisoDate(args.date as string | undefined);
      const { headers, rows } = await nyisoCsv('rtfuelmix', 'rtfuelmix', date);
      const intervals = rows.map((r) => ({
        timestamp: r[0],
        time_zone: r[1],
        fuel_category: r[2],
        generation_mw: Number(r[3]),
      }));
      return { source: 'NYISO real-time fuel mix', report_date: date, columns: headers, count: intervals.length, intervals };
    }
    case 'nyiso_load': {
      const date = nyisoDate(args.date as string | undefined);
      const zone = (args.zone as string | undefined)?.trim();
      const { headers, rows } = await nyisoCsv('pal', 'pal', date);
      const filtered = zone ? rows.filter((r) => r[2] === zone) : rows;
      const intervals = filtered.map((r) => ({
        timestamp: r[0],
        time_zone: r[1],
        zone: r[2],
        ptid: Number(r[3]),
        load_mw: Number(r[4]),
      }));
      return { source: 'NYISO real-time zonal load', report_date: date, columns: headers, count: intervals.length, intervals };
    }
    case 'nyiso_load_forecast': {
      const date = nyisoDate(args.date as string | undefined);
      const zone = (args.zone as string | undefined)?.trim();
      const { headers, rows } = await nyisoCsv('isolf', 'isolf', date);
      const zoneIdx = zone ? headers.findIndex((h) => h.toLowerCase() === zone.toLowerCase()) : -1;
      const intervals = rows.map((r) => {
        const out: Record<string, string | number> = { timestamp: r[0] };
        if (zoneIdx > 0) {
          out[headers[zoneIdx]] = Number(r[zoneIdx]);
        } else {
          for (let i = 1; i < headers.length; i++) out[headers[i]] = Number(r[i]);
        }
        return out;
      });
      return { source: 'NYISO ISO load forecast (ISOLF)', report_date: date, columns: headers, count: intervals.length, intervals };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
