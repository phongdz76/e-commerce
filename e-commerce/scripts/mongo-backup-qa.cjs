const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

function validateBackupTargets(source, target, application) {
  const from = new URL(source),
    to = new URL(target),
    app = new URL(application);
  assert.match(from.pathname, /^\/sgtech_ops_qa_\d+_[a-f0-9]+$/);
  assert.match(to.pathname, /^\/sgtech_restore_qa_\d+_[a-f0-9]+$/);
  assert.notEqual(from.pathname, to.pathname);
  assert.notEqual(from.pathname, app.pathname);
  assert.notEqual(to.pathname, app.pathname);
  assert.equal(from.host, to.host);
  return {
    sourceName: from.pathname.slice(1),
    targetName: to.pathname.slice(1),
  };
}

function runTool(binary, connection, args, directory) {
  const filename = path.join(
    directory,
    "mongo-private-" + randomUUID() + ".json",
  );
  fs.writeFileSync(filename, JSON.stringify({ uri: connection }), {
    mode: 0o600,
    flag: "wx",
  });
  try {
    const result = spawnSync(binary, ["--config", filename, ...args], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 120000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error || result.status !== 0)
      throw new Error(
        "MongoDB backup/restore tool failed; private connection details were withheld",
      );
  } finally {
    fs.unlinkSync(filename);
  }
}

async function verifyBackupRestore({
  sourceUrl,
  targetUrl,
  applicationUrl,
  sourcePrisma,
  targetPrisma,
  directory = path.resolve(".artifacts"),
  dumpBinary = process.env.MONGODUMP_BIN || "mongodump",
  restoreBinary = process.env.MONGORESTORE_BIN || "mongorestore",
}) {
  const { sourceName, targetName } = validateBackupTargets(
    sourceUrl,
    targetUrl,
    applicationUrl,
  );
  const collections = (
    await sourcePrisma.$runCommandRaw({ listCollections: 1, nameOnly: true })
  ).cursor.firstBatch
    .map((row) => row.name)
    .filter((name) => !name.startsWith("system."))
    .sort();
  assert.equal(
    (await targetPrisma.$runCommandRaw({ listCollections: 1, nameOnly: true }))
      .cursor.firstBatch.length,
    0,
  );
  fs.mkdirSync(directory, { recursive: true });
  const archive = path.join(
    directory,
    "p0-qa-backup-" + randomUUID() + ".archive.gz",
  );
  // Fixtures are quiescent here. This scoped dump is not a consistent live-replica-set backup.
  runTool(
    dumpBinary,
    sourceUrl,
    ["--archive=" + archive, "--gzip", "--db=" + sourceName],
    directory,
  );
  runTool(
    restoreBinary,
    targetUrl,
    [
      "--archive=" + archive,
      "--gzip",
      "--nsInclude=" + sourceName + ".*",
      "--nsFrom=" + sourceName + ".*",
      "--nsTo=" + targetName + ".*",
    ],
    directory,
  );
  const counts = {};
  const canonical = (documents) =>
    documents.sort((a, b) =>
      JSON.stringify(a._id).localeCompare(JSON.stringify(b._id)),
    );
  for (const collection of collections) {
    const command = { find: collection, batchSize: 1000 };
    const from = await sourcePrisma.$runCommandRaw(command),
      to = await targetPrisma.$runCommandRaw(command);
    assert.equal(
      String(from.cursor.id?.$numberLong || from.cursor.id || 0),
      "0",
    );
    assert.equal(String(to.cursor.id?.$numberLong || to.cursor.id || 0), "0");
    assert.deepEqual(
      canonical(to.cursor.firstBatch),
      canonical(from.cursor.firstBatch),
      "Restored documents differ: " + collection,
    );
    const fromIndexes = await sourcePrisma.$runCommandRaw({
        listIndexes: collection,
      }),
      toIndexes = await targetPrisma.$runCommandRaw({
        listIndexes: collection,
      });
    const keys = (result) =>
      result.cursor.firstBatch
        .map(({ name, key, unique }) => ({
          name,
          key,
          unique: Boolean(unique),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(
      keys(toIndexes),
      keys(fromIndexes),
      "Restored indexes differ: " + collection,
    );
    counts[collection] = from.cursor.firstBatch.length;
  }
  return {
    collections: collections.length,
    counts,
    bsonTypesAndIndexesPreserved: true,
    applicationDatabaseWrites: 0,
  };
}
module.exports = { validateBackupTargets, verifyBackupRestore };
