#!/usr/bin/env tsx

import postgres from "postgres";
import fs from "fs";
import path from "path";

// Database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, {
  prepare: false,
  ssl: "require",
});

// Migration tracking table is in drizzle schema

interface MigrationRecord {
  id: number;
  hash: string;
  created_at: number;
}

interface LocalMigration {
  folder: string;
  hash: string;
  created_at: number;
  hasDownMigration: boolean;
}

async function getAppliedMigrations(): Promise<MigrationRecord[]> {
  try {
    const result = await client`
      SELECT id, hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY created_at ASC
    `;

    // Ensure created_at is properly converted to number
    const converted = result.map((row) => ({
      id: Number(row.id),
      hash: String(row.hash),
      created_at: Number(row.created_at),
    }));

    // Debug: Show what we got from database
    console.log("🔍 Raw database results:");
    result.forEach((row, idx) => {
      console.log(
        `   ${idx + 1}. created_at: ${
          row.created_at
        } (type: ${typeof row.created_at})`
      );
    });
    console.log("");

    return converted;
  } catch (error: unknown) {
    // Type guard for error objects
    const isErrorWithCodeAndMessage = (
      err: unknown
    ): err is { code?: string; message?: string } => {
      return typeof err === "object" && err !== null;
    };

    // Check if it's specifically a "table doesn't exist" error
    if (
      isErrorWithCodeAndMessage(error) &&
      (error.code === "42P01" || error.message?.includes("does not exist"))
    ) {
      console.log("ℹ️  No migrations table found (no migrations applied yet)");
      return [];
    }

    // For other errors (connection, auth, etc.), show the real problem
    console.error("❌ Database connection error:");

    if (isErrorWithCodeAndMessage(error)) {
      console.error(`   Error: ${error.message || "Unknown error"}`);
      console.error(`   Code: ${error.code || "unknown"}`);

      if (
        error.message?.includes("ENOTFOUND") ||
        error.message?.includes("ECONNREFUSED")
      ) {
        console.error(
          "   💡 This looks like a connection issue. Check your DATABASE_URL."
        );
      } else if (
        error.message?.includes("authentication") ||
        error.message?.includes("password")
      ) {
        console.error(
          "   💡 This looks like an authentication issue. Check your database credentials."
        );
      }
    } else {
      console.error(`   Error: ${String(error)}`);
    }

    process.exit(1);
  }
}

function getLocalMigrations(): LocalMigration[] {
  const migrationsDir = path.join(process.cwd(), "drizzle", "migrations");
  const journalPath = path.join(migrationsDir, "meta", "_journal.json");

  if (!fs.existsSync(journalPath)) {
    return [];
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const migrations: LocalMigration[] = [];

  for (const entry of journal.entries || []) {
    const migrationFolder = entry.tag;
    const folderPath = path.join(migrationsDir, migrationFolder);
    const downPath = path.join(folderPath, "down.sql");

    // We don't have the actual content hash locally, just use tag
    migrations.push({
      folder: migrationFolder,
      hash: entry.tag, // This is just the tag, not the actual content hash
      created_at: entry.when,
      hasDownMigration: fs.existsSync(downPath),
    });
  }

  return migrations.sort((a, b) => a.created_at - b.created_at);
}

async function showMigrationStatus(): Promise<void> {
  console.log("🔍 Migration Status Report");
  console.log("=".repeat(50));

  const appliedMigrations = await getAppliedMigrations();
  const localMigrations = getLocalMigrations();

  if (localMigrations.length === 0) {
    console.log("📭 No local migrations found");
    return;
  }

  // Calculate actual pending by checking timestamp matches
  const appliedCount = localMigrations.filter((local) =>
    appliedMigrations.some((applied) => applied.created_at === local.created_at)
  ).length;
  const pendingCount = localMigrations.length - appliedCount;

  console.log(`📊 Total local migrations: ${localMigrations.length}`);
  console.log(`✅ Applied migrations: ${appliedCount}`);
  console.log(`⏳ Pending migrations: ${pendingCount}`);
  console.log("");

  // Show current migration
  const currentMigration = appliedMigrations[appliedMigrations.length - 1];
  if (currentMigration) {
    const currentLocal = localMigrations.find(
      (m) => m.created_at === currentMigration.created_at
    );
    console.log("🎯 Current Migration:");
    console.log(`   Hash: ${currentMigration.hash}`);
    console.log(`   Folder: ${currentLocal?.folder || "Unknown"}`);

    // Handle invalid timestamps gracefully
    try {
      const date = new Date(currentMigration.created_at);
      if (isNaN(date.getTime())) {
        console.log(
          `   Applied: Invalid timestamp (${currentMigration.created_at})`
        );
      } else {
        console.log(`   Applied: ${date.toISOString()}`);
      }
    } catch {
      console.log(
        `   Applied: Invalid timestamp (${currentMigration.created_at})`
      );
    }
    console.log("");
  } else {
    console.log("🎯 Current Migration: None (clean database)");
    console.log("");
  }

  // Debug: Show all applied migrations vs local ones
  if (appliedMigrations.length !== localMigrations.length) {
    console.log("🔍 DEBUG: Migration mismatch detected!");
    console.log("📁 Applied migrations in database:");
    appliedMigrations.forEach((migration, idx) => {
      const localMatch = localMigrations.find(
        (l) => l.created_at === migration.created_at
      );
      const timestamp = new Date(migration.created_at).toLocaleString();
      console.log(
        `   ${idx + 1}. Hash: ${migration.hash.substring(
          0,
          12
        )}... Time: ${timestamp} ${
          localMatch ? `✅ (${localMatch.folder})` : "❌ (not in local)"
        }`
      );
    });
    console.log("");
  }

  // Show all migrations with status
  console.log("📋 Migration List:");

  for (const local of localMigrations) {
    // Match by timestamp instead of hash-to-tag
    const isApplied = appliedMigrations.some(
      (applied) => applied.created_at === local.created_at
    );
    const statusIcon = isApplied ? "✅" : "⏳";
    const statusText = isApplied ? "Applied" : "Pending";
    const downIcon = local.hasDownMigration ? "✅" : "❌";
    const downText = local.hasDownMigration ? "Has rollback" : "No rollback";
    const date = new Date(local.created_at).toLocaleString();

    console.log(`   ${statusIcon} ${local.folder}`);
    console.log(`      Status: ${statusText}`);
    console.log(`      Rollback: ${downIcon} ${downText}`);
    console.log(`      Created: ${date}`);
    console.log("");
  }
}

// Run status check
showMigrationStatus()
  .catch(console.error)
  .finally(() => client.end());
