'use strict';

// Synthetic fixtures. The model uses daily allocated power × 24 hours × regional factor.
const EcoTelemetry = (() => {
  const VERSION = 'ES-FIXTURE-2026.11';
  const providers = [
    { name: 'AWS', service: 'EC2', region: 'eu-west-1', factor: 400 },
    { name: 'Azure', service: 'Azure VM', region: 'westeurope', factor: 310 },
    { name: 'GCP', service: 'Compute Engine', region: 'europe-west1', factor: 280 }
  ];
  const names = ['app-staging-03', 'api-prod', 'batch-prod', 'cache-stage', 'web-prod',
    'search-dev', 'worker-stage', 'standby-dr', 'jobs-dev', 'api-stage'];
  const round = value => Math.round((value + Number.EPSILON) * 1000000) / 1000000;
  const mean = values => round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const resources = Array.from({ length: 30 }, (_, i) => {
    const cloud = providers[i % providers.length];
    const group = Math.floor(i / providers.length);
    const low = [0, 3, 6].includes(group) || i === 21;
    const standby = [19, 20].includes(i);
    const environment = standby ? 'Production' : low ? 'Staging' :
      ['Production', 'Development', 'Staging'][group % 3];
    const name = (i === 0 ? names[0] : names[group] + '-' + cloud.name.toLowerCase());
    const days = Array.from({ length: 14 }, (_, day) => {
      if (i === 29) return null;
      const previous = day < 7;
      const cpu = i === 0 ? [1.1, 1.2, 1.3, 1.2, 1.0, 1.4, 1.2][day % 7] :
        (low || standby ? 0.9 + (i % 5) * 0.6 : 8 + (i * 7) % 60) + (day % 3 - 1) * 0.2;
      const memory = i === 0 ? 12 : low || standby ? 9 + i % 8 : 24 + i % 56;
      const power = i === 0 ? 0.04 : 0.032 + (i % 9) * 0.017;
      const allocatedKw = round(power * (i === 0 ? 1 : (1 + (day % 7 - 3) * 0.028) * (previous ? 1.08 : 1)));
      const kwh = round(allocatedKw * 24);
      return { cpu, memory, allocatedKw, kwh, emissions: round(kwh * cloud.factor) };
    });
    return { id: 'r' + i, name, environment, region: cloud.region, service: cloud.service,
      provider: cloud.name, factor: cloud.factor, standby, days };
  });

  function windowRows(resource, previous = false) {
    return previous ? resource.days.slice(0, 7) : resource.days.slice(7);
  }
  function describe(resource, previous = false) {
    const readings = windowRows(resource, previous);
    const valid = readings.every(Boolean);
    return {
      ...resource,
      health: valid ? 'Fresh' : 'Missing data',
      cpu: valid ? mean(readings.map(row => row.cpu)) : null,
      memory: valid ? mean(readings.map(row => row.memory)) : null,
      kwh: valid ? round(readings.reduce((sum, row) => sum + row.kwh, 0)) : null,
      emissions: valid ? round(readings.reduce((sum, row) => sum + row.emissions, 0)) : null
    };
  }
  function comparison(rows) {
    const matched = rows.filter(row => windowRows(row).every(Boolean) && windowRows(row, true).every(Boolean));
    const series = previous => Array.from({ length: 7 }, (_, day) =>
      round(matched.reduce((sum, row) => sum + windowRows(row, previous)[day].emissions, 0)));
    const current = series(false);
    const baseline = series(true);
    const currentTotal = round(current.reduce((sum, value) => sum + value, 0));
    const baselineTotal = round(baseline.reduce((sum, value) => sum + value, 0));
    return { count: matched.length, current, baseline, currentTotal, baselineTotal,
      delta: baselineTotal ? 100 * (currentTotal - baselineTotal) / baselineTotal : null };
  }
  const current = resources.map(row => describe(row));
  const recommendations = current.filter(row => row.cpu !== null && row.cpu < 5 && row.memory < 20)
    .map(resource => ({
      id: 'rec-' + resource.id,
      resource,
      type: resource.standby ? 'Standby · verify exception' : 'Low utilisation',
      reduction: resource.standby ? 0 : resource.emissions * 4 * 0.35,
      window: 7,
      defaultStatus: 'open'
    }));
  return { VERSION, providers, resources, current, windowRows, describe, comparison, recommendations };
})();
