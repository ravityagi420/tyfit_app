import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://miqghbmmnmmqyegctnzy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcWdoYm1tbm1tcXllZ2N0bnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2NTI4NSwiZXhwIjoyMDkwMDQxMjg1fQ.j3Hs0-uJoBesWEzfB_SUOudUOgbI9PXNN6PZIMtjCUs",
);

const raw = fs.readFileSync("./assets/exercises.json", "utf-8");
const exercises = JSON.parse(raw);

function makeSlug(ex) {
  const primary = Array.isArray(ex.primaryMuscles)
    ? ex.primaryMuscles[0]
    : ex.primaryMuscles;

  const equipment = Array.isArray(ex.equipment)
    ? ex.equipment[0]
    : ex.equipment;

  const base = [
    ex.title,
    primary,
    equipment
  ]
    .filter(Boolean)
    .join("-");

  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function mapBodyPart(primary) {
  const firstPrimary = Array.isArray(primary) ? primary[0] : primary;
  const m = firstPrimary?.toLowerCase();

  if (["chest"].includes(m)) return "chest";
  if (["lats", "middle back", "lower back", "back"].includes(m)) return "back";
  if (["shoulders"].includes(m)) return "shoulders";
  if (["biceps", "triceps", "forearms"].includes(m)) return "arms";
  if (["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"].includes(m)) return "legs";
  if (["abdominals", "abs"].includes(m)) return "core";

  return "full_body";
}

function normalize(ex) {
  return {
    name: ex.title,
    slug: makeSlug({
      title: ex.title,
      primaryMuscles: ex.primary,
      equipment: ex.equipment
    }),

    body_part: mapBodyPart(ex.primary),

    target_muscle: Array.isArray(ex.primary)
      ? ex.primary[0] || null
      : ex.primary || null,

    secondary_muscles: Array.isArray(ex.secondary)
      ? ex.secondary
      : ex.secondary
        ? [ex.secondary]
        : [],

    equipment: Array.isArray(ex.equipment)
      ? ex.equipment.join(", ")
      : ex.equipment || null,

    instructions: Array.isArray(ex.steps)
      ? ex.steps
      : ex.steps
        ? [ex.steps]
        : [],

    image_url: null,
    video_url: null,
    source: "everkinetic",
    is_active: true,
  };
}

const seen = new Set();

const rows = exercises
  .map(normalize)
  .filter((row) => {
    if (!row.slug) return false;

    if (seen.has(row.slug)) {
      console.log("Skipping duplicate:", row.slug);
      return false;
    }

    seen.add(row.slug);
    return true;
  });

async function main() {
  const batchSize = 300;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const { error } = await supabase
      .from("exercise_catalog")
      .upsert(batch, { onConflict: "slug" });

    if (error) {
      console.error("Error:", error);
      return;
    }

    console.log(`Inserted ${i + batch.length}/${rows.length}`);
  }

  console.log("✅ Import complete");
}

main();