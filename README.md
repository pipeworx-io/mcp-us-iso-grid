# mcp-us-iso-grid

US ISO Grid MCP — real-time electricity generation, fuel mix, demand,

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `caiso_fuel_mix` | CAISO (California) real-time grid fuel mix for today: solar, wind, geothermal, biomass, biogas, small hydro, coal, nuclear, natural gas, large hydro, batteries, imports per 5-minute interval. Returns timestamped MW values per fuel type. Use for "what is California using to make electricity right now", "solar curtailment today", "battery contribution this evening". |
| `caiso_demand` | CAISO (California) real-time electricity demand vs. forecast for today. Returns 5-minute demand series + day-ahead forecast + hour-ahead forecast (MW). Use for "is California load tracking forecast", peak-demand timing, demand-response triggers. |
| `caiso_renewables` | CAISO (California) real-time renewable generation breakdown for today: solar, wind, geothermal, biomass, biogas, small hydro, nuclear, large hydro, batteries (MW per 5-min interval). Subset of caiso_fuel_mix focused on zero-/low-carbon sources. Use for "California renewable share right now", "duck curve today". |
| `caiso_co2` | CAISO (California) real-time grid carbon intensity for today: metric tons CO2 emitted per 5-minute interval, plus marginal CO2 (lbs/MWh). Use for "what is California grid carbon intensity right now", climate-aware load shifting, hourly emissions reporting. |
| `ercot_fuel_mix` | ERCOT (Texas) real-time grid fuel mix: coal/lignite, natural gas, nuclear, hydro, wind, solar, power storage, other (MW). Returns the most recent 5-minute snapshot plus monthly installed capacity per fuel type, so percent-of-installed can be computed. Use for "Texas grid mix right now", "ERCOT wind output", "is Texas burning coal today". |
| `ercot_supply_demand` | ERCOT (Texas) real-time supply (capacity) vs. demand: hourly capacity, current demand, ERCOT load forecast (MW). Returns the recent day plus today's forecast. Use for "is ERCOT close to its reserve margin", "Texas demand vs. capacity", emergency-alert proximity during heatwaves. |
| `nyiso_lmp_zonal` | NYISO (New York) zonal LMP (locational marginal price, $/MWh) for the most recent published day, broken down by load zone (CAPITL, CENTRL, DUNWOD, GENESE, HUD VL, LONGIL, MHK VL, MILLWD, N.Y.C., NORTH, WEST). Returns LBMP, marginal cost of losses, marginal cost of congestion per 5-min interval. Use for NY wholesale electricity prices, zonal congestion analysis. |
| `nyiso_fuel_mix` | NYISO (New York) real-time grid fuel mix for the most recent published day: dual fuel (gas/oil-capable), natural gas, nuclear, other fossil fuels, hydro, wind, solar, other renewables (MW per 5-min interval). Use for "New York grid mix yesterday", NYC clean-energy progress tracking. |
| `nyiso_load` | NYISO (New York) actual zonal load (MW) per 5-minute interval for the most recent published day, by zone (CAPITL, CENTRL, DUNWOD, GENESE, HUD VL, LONGIL, MHK VL, MILLWD, N.Y.C., NORTH, WEST). Use for NY zonal demand analysis, peak-time identification, NYC load profile vs. upstate. |
| `nyiso_load_forecast` | NYISO (New York) ISO load forecast (ISOLF) for the most recent published day, per zone, MW. Use for "what does NYISO expect demand to be today", forecast-error tracking vs. nyiso_load. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "us-iso-grid": {
      "url": "https://gateway.pipeworx.io/us-iso-grid/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/us-iso-grid/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Us Iso Grid data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/caiso_fuel_mix \
  -H 'Content-Type: application/json' \
  -d '{"limit":12}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/caiso_fuel_mix`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.
