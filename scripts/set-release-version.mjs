#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
const version = input?.replace(/^v/, '');

if (!version || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version: ${input ?? ''}`);
  process.exit(1);
}

function updateJson(path, updater) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  updater(json);
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

updateJson('package.json', (json) => {
  json.version = version;
});

updateJson('package-lock.json', (json) => {
  json.version = version;
  if (json.packages?.['']) {
    json.packages[''].version = version;
  }
});

updateJson('src-tauri/tauri.conf.json', (json) => {
  json.version = version;
});

const cargoTomlPath = 'src-tauri/Cargo.toml';
const cargoToml = readFileSync(cargoTomlPath, 'utf8');
const updatedCargoToml = cargoToml.replace(
  /(^\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,
  `$1"${version}"`,
);

if (updatedCargoToml === cargoToml && !cargoToml.includes(`version = "${version}"`)) {
  console.error(`Could not update package version in ${cargoTomlPath}`);
  process.exit(1);
}

writeFileSync(cargoTomlPath, updatedCargoToml);
