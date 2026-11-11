import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

// Load all message files
const messagesDir = path.join(__dirname, "../../messages");
const enData = JSON.parse(
  fs.readFileSync(path.join(messagesDir, "en.json"), "utf8")
);

// Get all flattened keys from a messages object
function getFlattenedKeys(obj: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return keys;
  }
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.add(fullKey);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const nested of getFlattenedKeys(value, fullKey)) {
        keys.add(nested);
      }
    }
  }
  return keys;
}

// Get value from nested object by flattened key
function getValueByKey(obj: unknown, key: string): unknown {
  const parts = key.split(".");
  let current = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Extract ICU placeholder names from a string (e.g., {name} -> "name")
function getPlaceholderNames(str: string): Set<string> {
  const placeholders = new Set<string>();
  const regex = /\{(\w+)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    placeholders.add(match[1]);
  }
  return placeholders;
}

const enKeys = getFlattenedKeys(enData);

// Get all locale files except en.json, SC.json, and zh-TW.json
const localeFiles = fs
  .readdirSync(messagesDir)
  .filter(
    (f) =>
      f.endsWith(".json") &&
      f !== "en.json" &&
      f !== "SC.json" &&
      f !== "zh-TW.json"
  )
  .sort();

describe("messages parity", () => {
  localeFiles.forEach((file) => {
    const locale = file.replace(".json", "");
    const filePath = path.join(messagesDir, file);
    const localeData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const localeKeys = getFlattenedKeys(localeData);

    describe(`${locale}.json`, () => {
      it("should not contain keys not present in en.json", () => {
        const orphanKeys = Array.from(localeKeys).filter(
          (key) => !enKeys.has(key)
        );
        expect(
          orphanKeys,
          `Found orphan keys in ${locale}.json that don't exist in en.json: ${orphanKeys.join(", ")}`
        ).toEqual([]);
      });

      it("should have matching ICU placeholder sets for all string keys", () => {
        const mismatchedPlaceholders: string[] = [];

        for (const key of localeKeys) {
          if (!enKeys.has(key)) {
            // Already checked in previous test
            continue;
          }

          const localeValue = getValueByKey(localeData, key);
          const enValue = getValueByKey(enData, key);

          if (
            typeof localeValue === "string" &&
            typeof enValue === "string"
          ) {
            const localePlaceholders = getPlaceholderNames(localeValue);
            const enPlaceholders = getPlaceholderNames(enValue);

            // Check if placeholder sets match
            if (
              localePlaceholders.size !== enPlaceholders.size ||
              ![...localePlaceholders].every((p) =>
                enPlaceholders.has(p)
              )
            ) {
              mismatchedPlaceholders.push(
                `${key}: en has {${[...enPlaceholders].join("},{")}} but ${locale} has {${[...localePlaceholders].join("},{")}} (or empty)`
              );
            }
          }
        }

        expect(
          mismatchedPlaceholders,
          `Placeholder mismatches in ${locale}.json:\n${mismatchedPlaceholders.join("\n")}`
        ).toEqual([]);
      });
    });
  });
});
