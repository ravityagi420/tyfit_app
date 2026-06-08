import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODELS = {
  simple: "gemini-2.5-flash-lite",
  reasoning: "gemini-2.5-flash",
  fallback: "gemini-2.5-pro",
} as const;

type GeminiTaskType = "simple" | "reasoning";

class GeminiRequestError extends Error {
  status: number;
  details: string;
  model: string;

  constructor(status: number, details: string, model: string) {
    super(`Gemini request failed: ${status} ${details}`);
    this.name = "GeminiRequestError";
    this.status = status;
    this.details = details;
    this.model = model;
  }
}

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(req: Request) {
  const header = req.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function caloriesFromMacros(food: JsonRecord) {
  const carbs = toNumber(food.carbs ?? food.reference_carbs ?? food.referenceCarbs, 0);
  const protein = toNumber(food.protein ?? food.reference_protein ?? food.referenceProtein, 0);
  const fats = toNumber(food.fats ?? food.fat ?? food.reference_fat ?? food.referenceFat, 0);
  return Math.round(carbs * 4 + protein * 4 + fats * 9);
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (_error) {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }
    throw _error;
  }
}

function fallbackResponse(reply = "TyBot is having trouble right now. Please try again.") {
  return {
    success: true,
    intent: "general_diet_question",
    reply,
    needsMoreInfo: false,
    questions: [],
    previewPlan: null,
    replacementOptions: [],
    actions: [],
  };
}

function getSafeErrorReply(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("Missing GEMINI_API_KEY")) {
    return "TyBot setup is missing the Gemini API key in Supabase Function Secrets.";
  }
  if (message.includes("Gemini request failed: 401") || message.includes("Gemini request failed: 403")) {
    return "TyBot could not authenticate with Gemini. Please check the GEMINI_API_KEY Supabase Function Secret.";
  }
  if (message.includes("Gemini request failed: 404")) {
    return "TyBot could not find one of the configured Gemini models. Please check that your Gemini API key has access to Gemini 2.5 models.";
  }
  if (message.includes("Gemini request failed: 429") || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
    return "TyBot is temporarily busy. Please try again in a few minutes.";
  }
  return "TyBot is having trouble right now. Please try again.";
}

function isGeminiQuotaError(error: unknown) {
  if (error instanceof GeminiRequestError && error.status === 429) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error || "");
  return /quota|rate limit|RESOURCE_EXHAUSTED/i.test(message);
}

function getGeminiModelChain(taskType: GeminiTaskType) {
  const fullChain = [
    GEMINI_MODELS.simple,
    GEMINI_MODELS.reasoning,
    GEMINI_MODELS.fallback,
  ];
  const startModel = taskType === "reasoning" ? GEMINI_MODELS.reasoning : GEMINI_MODELS.simple;
  const startIndex = fullChain.indexOf(startModel);
  return fullChain.slice(Math.max(0, startIndex));
}

function getGeminiTaskType(intent: string, action: string, message: string): GeminiTaskType {
  const text = normalizeText(`${action} ${intent} ${message}`);
  const reasoningIntents = new Set([
    "create_diet_plan",
    "suggest_replacement",
    "improve_existing_diet",
    "analyze_diet",
  ]);

  if (reasoningIntents.has(intent)) {
    return "reasoning";
  }

  if (/(create|generate|build|replace|alternative|improve|analyze|review|tdee|activity|full diet|diet chart|meal structure)/i.test(text)) {
    return "reasoning";
  }

  return "simple";
}

function inferIntent(action: string, message: string) {
  const actionMap: Record<string, string> = {
    create_plan: "create_diet_plan",
    suggest_replacement: "suggest_replacement",
    improve_plan: "improve_existing_diet",
    analyze_plan: "analyze_diet",
  };
  if (action && action !== "chat") return actionMap[action] || action;
  const text = normalizeText(message);
  if (/(create|make|build|generate).*(diet|plan|chart)/.test(text)) return "create_diet_plan";
  if (/(replace|instead|alternative|swap|substitute)/.test(text)) return "suggest_replacement";
  if (/(improve|edit|better|higher protein|lower carb|fat loss)/.test(text)) return "improve_existing_diet";
  if (/(analyze|review|missing|good|bad|nutrition)/.test(text)) return "analyze_diet";
  return "general_diet_question";
}

function findLikelyTargetItem(message: string, meals: JsonRecord[]) {
  const normalizedMessage = normalizeText(message);
  let bestItem: JsonRecord | null = null;
  let bestScore = 0;

  for (const meal of meals || []) {
    const items = Array.isArray(meal.items) ? meal.items as JsonRecord[] : [];
    for (const item of items) {
      const foodName = normalizeText(item.food_name);
      if (!foodName) continue;
      const tokens = foodName.split(" ").filter((token) => token.length > 2);
      const score = tokens.reduce((sum, token) => sum + (normalizedMessage.includes(token) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }
  }

  return bestScore > 0 ? bestItem : null;
}

function rankFoodCandidates(message: string, foods: JsonRecord[], limit = 40) {
  const text = normalizeText(message);
  const tokens = text.split(" ").filter((token) => token.length > 2);

  return (foods || [])
    .map((food) => {
      const name = normalizeText(food.food_name);
      const score = tokens.reduce((sum, token) => {
        if (name === token) return sum + 6;
        if (name.startsWith(token)) return sum + 4;
        if (name.includes(token)) return sum + 2;
        return sum;
      }, 0);
      return { ...food, calories: caloriesFromMacros(food), matchScore: score };
    })
    .sort((a, b) => Number(b.matchScore) - Number(a.matchScore) || String(a.food_name).localeCompare(String(b.food_name)))
    .slice(0, limit);
}

function compactDietContext(chart: JsonRecord | null, meals: JsonRecord[]) {
  if (!chart) return null;
  return {
    chart,
    meals: (meals || []).map((meal) => ({
      id: meal.id,
      meal_name: meal.meal_name,
      items: (Array.isArray(meal.items) ? meal.items as JsonRecord[] : []).map((item) => ({
        id: item.id,
        meal_id: item.meal_id,
        food_name: item.food_name,
        quantity: item.quantity,
        quantity_unit: item.quantity_unit,
        reference_quantity: item.reference_quantity,
        reference_unit: item.reference_unit,
        reference_carbs: item.reference_carbs,
        reference_protein: item.reference_protein,
        reference_fat: item.reference_fat,
        reference_fibre: item.reference_fibre,
      })),
    })),
  };
}

function buildSystemPrompt() {
  return `You are TyBot, Tyfit's AI nutrition coach.
You help create and improve diet charts.
You are not a medical doctor.
Give practical, safe nutrition suggestions.
Avoid extreme diets.
Ask clarifying questions when important info is missing.
Respect vegetarian, non-veg, egg, and vegan preferences.
Use food catalog candidates where possible.
If unsure about veg/non-veg classification, state uncertainty.
For blood sugar or diabetes concerns, advise professional consultation.
Always return structured JSON only. Do not include markdown.`;
}

function buildTrainingSystemPrompt() {
  return `You are TyBot, Tyfit's AI training coach.
You help users create practical strength-training plans, improve workout routines, and answer workout questions.
You are not a medical doctor or physiotherapist.
Ask clarifying questions before generating a full plan when time per session, days per week, training age, home/gym setup, or goal is missing.
Prefer exercise names from the provided exercise catalog. Do not invent exercises when catalog candidates are available.
If the user's profile goal is present, ask them to confirm it before assuming it.
For general training guidance, give practical ranges and say when advice depends on recovery, injury history, and technique.
If a question is advanced, risky, or medical/injury related, answer cautiously and advise consulting a qualified professional.
Always return structured JSON only. Do not include markdown.`;
}

function inferTrainingIntent(action: string, message: string) {
  if (action === "create_training_plan") return "create_training_plan";
  if (action === "improve_training_plan") return "improve_training_plan";
  const text = normalizeText(`${action} ${message}`);
  if (/(create|make|build|generate).*(training|workout|plan|split)/.test(text)) return "create_training_plan";
  if (/(improve|edit|better|change).*(training|workout|plan|split)/.test(text)) return "improve_training_plan";
  return "training_question";
}

function buildTrainingUserPrompt(params: {
  action: string;
  message: string;
  intent: string;
  userProfile: JsonRecord | null;
  userAbout: JsonRecord | null;
  currentPlan: unknown;
  trainingDays: unknown;
  exercisesByDay: unknown;
  exerciseCatalog: JsonRecord[];
  workoutLogs: unknown;
  conversation: unknown[];
}) {
  return JSON.stringify({
    task: "Respond as TyBot Training Coach using the requested JSON schema.",
    action: params.action,
    detectedIntent: params.intent,
    userMessage: params.message,
    conversation: params.conversation,
    targetUserProfile: params.userProfile,
    targetUserAbout: params.userAbout,
    currentTrainingPlan: params.currentPlan,
    currentTrainingDays: params.trainingDays,
    currentExercisesByDay: params.exercisesByDay,
    recentWorkoutLogs: params.workoutLogs,
    exerciseCatalogCandidates: params.exerciseCatalog.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      body_part: exercise.body_part,
      equipment: exercise.equipment,
      level: exercise.level,
    })),
    requiredJsonShape: {
      success: true,
      intent: "create_training_plan | improve_training_plan | training_question",
      reply: "short helpful conversational response",
      needsMoreInfo: false,
      questions: ["ask for missing time per session, days per week, training age, home/gym, and goal when needed"],
      previewPlan: null,
      replacementOptions: [],
      actions: [],
      trainingPlanPreview: {
        title: "short plan name",
        split: "Push Pull Legs | Upper Lower | Full Body | custom",
        weeks: 8,
        daysPerWeek: 4,
        sessionLengthMinutes: 60,
        goal: "fat loss | muscle gain | maintain | general fitness",
        days: [
          {
            day_name: "Push",
            focus: "Chest, shoulders, triceps",
            exercises: [
              {
                exercise_catalog_id: "must match catalog id when possible",
                exercise_name: "must match catalog name when possible",
                sets: 3,
                reps: "8-12",
                rest_seconds: 90,
                notes: "brief coaching cue"
              }
            ]
          }
        ]
      }
    },
    rules: [
      "For create_training_plan, ask clarifying questions if time per session, days per week, training age, home/gym setup, or goal is missing.",
      "If targetUserAbout.goal exists, ask the user to confirm that goal before building the plan unless the user already confirmed a different goal.",
      "Use only exerciseCatalogCandidates for generated exercises whenever possible.",
      "Do not write to the database. The app will save only after user confirmation in a later flow.",
      "For basic workout questions, answer concisely with normal coaching ranges.",
      "For advanced or medical questions, include a cautious note and recommend a qualified professional."
    ],
  });
}

function buildUserPrompt(params: {
  action: string;
  message: string;
  intent: string;
  userProfile: JsonRecord | null;
  userAbout: JsonRecord | null;
  dietContext: JsonRecord | null;
  foodCandidates: JsonRecord[];
  targetItem: JsonRecord | null;
  conversation: unknown[];
}) {
  return JSON.stringify({
    task: "Respond as TyBot using the requested JSON schema.",
    action: params.action,
    detectedIntent: params.intent,
    userMessage: params.message,
    conversation: params.conversation,
    targetUserProfile: params.userProfile,
    targetUserAbout: params.userAbout,
    currentDietChart: params.dietContext,
    likelyReplacementTargetItem: params.targetItem,
    foodCatalogCandidates: params.foodCandidates,
    requiredJsonShape: {
      success: true,
      intent: "create_diet_plan | suggest_replacement | improve_existing_diet | analyze_diet | general_diet_question",
      reply: "short helpful conversational response",
      needsMoreInfo: false,
      questions: ["only if important details are missing"],
      previewPlan: {
        title: "12 chars preferred for app tab name, can be longer for preview",
        dailyCalories: 1800,
        protein: 120,
        carbs: 180,
        fats: 55,
        notes: "brief notes",
        meals: [
          {
            meal_name: "Breakfast",
            items: [
              {
                food_name: "Oats",
                quantity: 60,
                quantity_unit: "g",
                reference_quantity: 100,
                reference_unit: "g",
                reference_carbs: 66,
                reference_protein: 17,
                reference_fat: 7,
                reference_fibre: 10,
                inferredDietType: "vegetarian | non_veg | egg | vegan | unknown",
                confidence: "high | medium | low"
              }
            ]
          }
        ]
      },
      replacementOptions: [
        {
          dietItemId: "copy likelyReplacementTargetItem.id when replacing an existing item",
          food_name: "Tofu",
          quantity: 100,
          quantity_unit: "g",
          reference_quantity: 100,
          reference_unit: "g",
          reference_carbs: 2,
          reference_protein: 12,
          reference_fat: 7,
          reference_fibre: 1,
          why: "why it fits",
          inferredDietType: "vegetarian | non_veg | egg | vegan | unknown",
          confidence: "high | medium | low"
        }
      ],
      actions: [],
    },
    rules: [
      "For create_diet_plan, if goal/calories/preference/meals/restrictions are missing, ask concise questions instead of generating.",
      "If calories are unknown but profile has height/weight/gender/activity, you may estimate cautiously and explain it is an estimate.",
      "For replacementOptions, prefer foods from foodCatalogCandidates.",
      "When using a catalog candidate, copy its macro fields to reference_* fields.",
      "Do not write to the database. The frontend saves after user confirmation.",
      "Use quantity_unit values compatible with g, ml, piece, or slice when possible.",
      "If warning is needed, include it in reply or notes.",
    ],
  });
}

async function callGeminiModel(model: string, systemPrompt: string, userPrompt: string, retryPrompt?: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const prompt = retryPrompt ? `${userPrompt}\n\n${retryPrompt}` : userPrompt;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new GeminiRequestError(response.status, details, model);
  }

  const payload = await response.json();
  return String(payload?.candidates?.[0]?.content?.parts?.map((part: JsonRecord) => part.text || "").join("") || "");
}

// Gemini model routing:
// - Simple tasks start on gemini-2.5-flash-lite.
// - Diet/replacement reasoning starts on gemini-2.5-flash.
// - gemini-2.5-pro is reserved as the final quota/rate-limit fallback.
// We only fallback for quota/rate-limit failures; normal validation/auth/model errors are returned immediately.
async function callGeminiWithFallback(systemPrompt: string, userPrompt: string, taskType: GeminiTaskType, retryPrompt?: string) {
  const modelChain = getGeminiModelChain(taskType);
  let lastQuotaError: unknown = null;

  for (const model of modelChain) {
    try {
      console.info(`TyBot Gemini model attempt: ${model} (${taskType})`);
      const text = await callGeminiModel(model, systemPrompt, userPrompt, retryPrompt);
      console.info(`TyBot Gemini model used: ${model}`);
      return { text, model };
    } catch (error) {
      if (!isGeminiQuotaError(error)) {
        throw error;
      }

      lastQuotaError = error;
      console.warn(`TyBot Gemini quota/rate-limit on ${model}; trying next model.`);
    }
  }

  throw lastQuotaError || new Error("Gemini quota/rate-limit fallback exhausted.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ success: false, error: "Missing Supabase function environment." }, 500);
  }

  const jwt = getBearerToken(req);
  if (!jwt) {
    return jsonResponse({ success: false, error: "Authentication required." }, 401);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const serviceClient = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user?.id) {
    return jsonResponse({ success: false, error: "Invalid session." }, 401);
  }

  let body: JsonRecord;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ success: false, error: "Invalid JSON body." }, 400);
  }

  const action = safeString(body.action, "chat");
  const message = safeString(body.message);
  const targetUserId = safeString(body.targetUserId, userData.user.id);
  const dietChartId = safeString(body.dietChartId);
  const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-12) : [];
  const clientContext = (body.context && typeof body.context === "object") ? body.context as JsonRecord : {};

  if (!message) {
    return jsonResponse({ ...fallbackResponse("Ask me anything about your diet chart and I’ll help."), needsMoreInfo: true });
  }

  const { data: actorProfile, error: actorProfileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, first_name, last_name, role, date_of_birth")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (actorProfileError || !actorProfile) {
    return jsonResponse({ success: false, error: "Profile not found." }, 403);
  }

  const isAdmin = String(actorProfile.role || "").toLowerCase() === "admin";
  if (targetUserId !== userData.user.id && !isAdmin) {
    return jsonResponse({ success: false, error: "You can only access your own Tyfit data." }, 403);
  }

  const readClient = isAdmin && serviceClient ? serviceClient : supabase;

  const { data: targetProfile } = await readClient
    .from("profiles")
    .select("id, email, full_name, first_name, last_name, role, date_of_birth")
    .eq("id", targetUserId)
    .maybeSingle();

  const { data: targetAbout } = await readClient
    .from("user_about")
    .select("weight, height, goal, activity_level, gender")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (clientContext.source === "training_plan") {
    const { data: exerciseRows } = await readClient
      .from("exercise_catalog")
      .select("id, name, body_part, equipment, level")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(300);

    const trainingIntent = inferTrainingIntent(action, message);
    const trainingTaskType: GeminiTaskType = trainingIntent === "training_question" ? "simple" : "reasoning";
    const trainingPrompt = buildTrainingUserPrompt({
      action,
      message,
      intent: trainingIntent,
      userProfile: targetProfile || null,
      userAbout: targetAbout || null,
      currentPlan: clientContext.currentPlan || null,
      trainingDays: clientContext.trainingDays || [],
      exercisesByDay: clientContext.exercisesByDay || {},
      exerciseCatalog: (exerciseRows || []) as JsonRecord[],
      workoutLogs: clientContext.workoutLogs || [],
      conversation,
    });

    try {
      const firstGeminiResult = await callGeminiWithFallback(buildTrainingSystemPrompt(), trainingPrompt, trainingTaskType);
      let text = firstGeminiResult.text;
      let parsed: JsonRecord;

      try {
        parsed = extractJson(text);
      } catch (_parseError) {
        const retryResult = await callGeminiWithFallback(
          buildTrainingSystemPrompt(),
          trainingPrompt,
          trainingTaskType,
          "Return valid JSON only using the required JSON shape. No markdown."
        );
        text = retryResult.text;
        parsed = extractJson(text);
      }

      return jsonResponse({
        success: true,
        intent: trainingIntent,
        reply: safeString(parsed.reply, "I can help with that. Tell me your training goal, days per week, and gym/home setup."),
        needsMoreInfo: Boolean(parsed.needsMoreInfo),
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        previewPlan: parsed.previewPlan || null,
        replacementOptions: Array.isArray(parsed.replacementOptions) ? parsed.replacementOptions : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        trainingPlanPreview: parsed.trainingPlanPreview || null,
      });
    } catch (error) {
      console.error("TyBot training error:", error);
      return jsonResponse(fallbackResponse(getSafeErrorReply(error)), 200);
    }
  }

  let chart: JsonRecord | null = null;
  let mealsWithItems: JsonRecord[] = [];

  if (dietChartId) {
    const { data: chartRow, error: chartError } = await readClient
      .from("diet_charts")
      .select("id, user_id, title, notes, created_by")
      .eq("id", dietChartId)
      .maybeSingle();

    if (chartError) {
      return jsonResponse({ success: false, error: chartError.message }, 400);
    }

    if (chartRow) {
      if (String(chartRow.user_id) !== targetUserId && !isAdmin) {
        return jsonResponse({ success: false, error: "Diet chart access denied." }, 403);
      }

      chart = chartRow;
      const { data: meals } = await readClient
        .from("diet_chart_meals")
        .select("id, diet_chart_id, meal_name, sort_order")
        .eq("diet_chart_id", dietChartId)
        .order("sort_order", { ascending: true });

      const mealIds = (meals || []).map((meal: JsonRecord) => meal.id).filter(Boolean);
      let items: JsonRecord[] = [];
      if (mealIds.length > 0) {
        const { data: itemRows } = await readClient
          .from("diet_chart_items")
          .select("id, meal_id, food_name, quantity, quantity_unit, reference_quantity, reference_unit, reference_carbs, reference_protein, reference_fat, reference_fibre, sort_order")
          .in("meal_id", mealIds)
          .order("sort_order", { ascending: true });
        items = itemRows || [];
      }

      mealsWithItems = (meals || []).map((meal: JsonRecord) => ({
        ...meal,
        items: items.filter((item) => item.meal_id === meal.id),
      }));
    }
  } else if (Array.isArray(clientContext.meals)) {
    mealsWithItems = clientContext.meals as JsonRecord[];
  }

  const { data: foods } = await readClient
    .from("food_catalog")
    .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre, is_custom, created_by_user_id")
    .order("food_name", { ascending: true })
    .limit(300);

  const intent = inferIntent(action, message);
  const taskType = getGeminiTaskType(intent, action, message);
  const targetItem = findLikelyTargetItem(message, mealsWithItems);
  const foodCandidates = rankFoodCandidates(message, foods || [], intent === "suggest_replacement" ? 60 : 45);

  const prompt = buildUserPrompt({
    action,
    message,
    intent,
    userProfile: targetProfile || null,
    userAbout: targetAbout || null,
    dietContext: compactDietContext(chart, mealsWithItems),
    foodCandidates,
    targetItem,
    conversation,
  });

  try {
    const firstGeminiResult = await callGeminiWithFallback(buildSystemPrompt(), prompt, taskType);
    let text = firstGeminiResult.text;
    let parsed: JsonRecord;
    try {
      parsed = extractJson(text);
    } catch (_firstError) {
      const repairResult = await callGeminiWithFallback(
        buildSystemPrompt(),
        prompt,
        taskType,
        `Your previous response from ${firstGeminiResult.model} was invalid. Return valid JSON only, matching the requiredJsonShape exactly.`,
      );
      text = repairResult.text;
      parsed = extractJson(text);
    }

    if (!Array.isArray(parsed.replacementOptions)) {
      parsed.replacementOptions = [];
    }
    parsed.replacementOptions = (parsed.replacementOptions as JsonRecord[]).map((option) => ({
      ...option,
      dietItemId: option.dietItemId || option.diet_item_id || option.itemId || targetItem?.id || null,
    }));

    return jsonResponse({
      success: true,
      intent: parsed.intent || intent,
      reply: safeString(parsed.reply, "Here’s what I found."),
      needsMoreInfo: Boolean(parsed.needsMoreInfo),
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      previewPlan: parsed.previewPlan || null,
      replacementOptions: parsed.replacementOptions,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    });
  } catch (error) {
    console.error("TyBot error:", error);
    return jsonResponse({
      ...fallbackResponse(getSafeErrorReply(error)),
      success: false,
    }, 200);
  }
});
