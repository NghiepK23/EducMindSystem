import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { decryptTeacherKey } from "../_shared/ai-keys.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ai-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QUESTION_KINDS = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"] as const;
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
const BLOOM_LEVELS = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERATION_TIMEOUT_MS = 120_000;

type QuestionKind = (typeof QUESTION_KINDS)[number];
type Difficulty = (typeof DIFFICULTIES)[number];
type BloomLevel = (typeof BLOOM_LEVELS)[number];
type GeneratedQuestion = {
  objective_id: string;
  kind: QuestionKind;
  content: string;
  options: string[];
  correct_indices: number[];
  model_answer: string;
  difficulty: Difficulty;
  bloom_level: BloomLevel;
};
type GenerationJob = { id: string; request_id: string; question_count: number; status: string };
type GenerationRequest = {
  id: string;
  teacher_id: string;
  lesson_id: string;
  quantity: number;
  parameters: unknown;
};

const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      objective_id: { type: "STRING" },
      kind: { type: "STRING", enum: [...QUESTION_KINDS] },
      content: { type: "STRING" },
      options: { type: "ARRAY", items: { type: "STRING" } },
      correct_indices: { type: "ARRAY", items: { type: "INTEGER" } },
      model_answer: { type: "STRING" },
      difficulty: { type: "STRING", enum: [...DIFFICULTIES] },
      bloom_level: { type: "STRING", enum: [...BLOOM_LEVELS] },
    },
    required: ["objective_id", "kind", "content", "options", "correct_indices", "model_answer", "difficulty", "bloom_level"],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function setting<T extends string>(value: unknown, values: readonly T[], name: string): T | "AUTO" {
  if (value === undefined || value === null || value === "" || value === "AUTO") return "AUTO";
  if (!isOneOf(value, values)) throw new Error(`Giá trị ${name} trong yêu cầu không hợp lệ.`);
  return value;
}

function parseGeneratedQuestions(
  value: unknown,
  quantity: number,
  objectives: Set<string>,
  requestedKind: QuestionKind | "AUTO",
  requestedDifficulty: Difficulty | "AUTO",
  requestedBloom: BloomLevel | "AUTO",
): GeneratedQuestion[] {
  if (!Array.isArray(value) || value.length !== quantity) {
    throw new Error(`Gemini không trả về đủ ${quantity} câu hỏi.`);
  }

  return value.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`Câu hỏi ${index + 1} có định dạng không hợp lệ.`);
    const {
      objective_id: objectiveId,
      kind,
      content,
      options,
      correct_indices: correctIndices,
      model_answer: modelAnswer,
      difficulty,
      bloom_level: bloomLevel,
    } = raw;

    if (typeof objectiveId !== "string" || !objectives.has(objectiveId)) {
      throw new Error(`Câu hỏi ${index + 1} gắn với mục tiêu không thuộc bài học.`);
    }
    if (!isOneOf(kind, QUESTION_KINDS) || (requestedKind !== "AUTO" && kind !== requestedKind)) {
      throw new Error(`Dạng câu hỏi ${index + 1} không khớp yêu cầu.`);
    }
    if (!isOneOf(difficulty, DIFFICULTIES) || (requestedDifficulty !== "AUTO" && difficulty !== requestedDifficulty)) {
      throw new Error(`Độ khó câu hỏi ${index + 1} không khớp yêu cầu.`);
    }
    if (!isOneOf(bloomLevel, BLOOM_LEVELS) || (requestedBloom !== "AUTO" && bloomLevel !== requestedBloom)) {
      throw new Error(`Cấp độ Bloom câu hỏi ${index + 1} không khớp yêu cầu.`);
    }
    if (typeof content !== "string" || !content.trim() || content.length > 5000) {
      throw new Error(`Nội dung câu hỏi ${index + 1} không hợp lệ.`);
    }
    if (!Array.isArray(options) || !options.every((option): option is string => typeof option === "string")) {
      throw new Error(`Lựa chọn câu hỏi ${index + 1} không hợp lệ.`);
    }
    if (!Array.isArray(correctIndices) || !correctIndices.every((answer): answer is number => Number.isInteger(answer))) {
      throw new Error(`Đáp án câu hỏi ${index + 1} không hợp lệ.`);
    }
    if (typeof modelAnswer !== "string" || modelAnswer.length > 5000) {
      throw new Error(`Đáp án tham khảo câu hỏi ${index + 1} không hợp lệ.`);
    }

    const normalizedOptions = options.map((option) => option.trim());
    if (new Set(correctIndices).size !== correctIndices.length) {
      throw new Error(`Câu hỏi ${index + 1} có chỉ số đáp án bị lặp.`);
    }
    if (kind === "SINGLE_CHOICE" || kind === "MULTIPLE_CHOICE") {
      if (normalizedOptions.length !== 4 || normalizedOptions.some((option) => !option || option.length > 500)) {
        throw new Error(`Câu trắc nghiệm ${index + 1} phải có đúng 4 lựa chọn hợp lệ.`);
      }
      if (new Set(normalizedOptions.map((option) => option.toLocaleLowerCase())).size !== normalizedOptions.length) {
        throw new Error(`Câu trắc nghiệm ${index + 1} có lựa chọn bị trùng.`);
      }
      if (correctIndices.length < (kind === "SINGLE_CHOICE" ? 1 : 2)
        || (kind === "SINGLE_CHOICE" && correctIndices.length !== 1)
        || correctIndices.some((answer) => answer < 0 || answer >= normalizedOptions.length)) {
        throw new Error(`Chỉ số đáp án câu hỏi ${index + 1} nằm ngoài phạm vi.`);
      }
    } else if (kind === "TRUE_FALSE") {
      if (normalizedOptions.length !== 0 || correctIndices.length !== 1 || ![0, 1].includes(correctIndices[0])) {
        throw new Error(`Câu Đúng/Sai ${index + 1} cần một đáp án hợp lệ.`);
      }
    } else if (normalizedOptions.length !== 0 || correctIndices.length !== 0 || !modelAnswer.trim()) {
      throw new Error(`Câu trả lời mở ${index + 1} cần đáp án tham khảo và không có lựa chọn.`);
    }

    return {
      objective_id: objectiveId,
      kind,
      content: content.trim(),
      options: normalizedOptions,
      correct_indices: correctIndices,
      model_answer: modelAnswer.trim(),
      difficulty,
      bloom_level: bloomLevel,
    };
  });
}

function failureMessage(error: unknown, apiKey?: string): string {
  let message = error instanceof Error ? error.message : "Không thể tạo câu hỏi AI.";
  if (apiKey) message = message.split(apiKey).join("[đã ẩn API key]");
  return message.slice(0, 1000);
}

async function dispatchJob(
  supabaseUrl: string,
  publicKey: string,
  authorization: string,
  workerToken: string,
  jobId: string,
): Promise<void> {
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      apikey: publicKey,
      "Content-Type": "application/json",
      "x-ai-worker-token": workerToken,
    },
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not start AI job worker (HTTP ${response.status}): ${detail.slice(0, 300)}`);
  }
}

async function dispatchNextJob(
  admin: SupabaseClient,
  supabaseUrl: string,
  publicKey: string,
  authorization: string,
  workerToken: string,
  requestId: string,
): Promise<void> {
  const { data: nextJob, error } = await admin.rpc("claim_next_ai_generation_job", { p_request: requestId });
  if (error) {
    console.error("Could not claim next AI generation job:", error.message);
    return;
  }
  if (!nextJob) return;
  try {
    await dispatchJob(supabaseUrl, publicKey, authorization, workerToken, nextJob.id);
  } catch (error) {
    const { error: releaseError } = await admin.rpc("release_ai_generation_job", { p_job: nextJob.id });
    if (releaseError) console.error("Could not release undispatched AI job:", releaseError.message);
    console.error("Could not dispatch next AI generation job:", error instanceof Error ? error.message : "unknown error");
  }
}

async function loadAndGenerate(
  admin: SupabaseClient,
  request: GenerationRequest,
  job: GenerationJob,
  apiKey: string,
): Promise<GeneratedQuestion[]> {
  const parameters = isRecord(request.parameters) ? request.parameters : {};
  const requestedKind = setting(parameters.kind, QUESTION_KINDS, "dạng câu hỏi");
  const requestedDifficulty = setting(parameters.difficulty, DIFFICULTIES, "độ khó");
  const requestedBloom = setting(parameters.bloom, BLOOM_LEVELS, "cấp độ Bloom");
  const selectedIds = parameters.objectives ?? [];
  if (!Array.isArray(selectedIds) || !selectedIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
    throw new Error("Danh sách mục tiêu trong yêu cầu không hợp lệ.");
  }

  const { data: lesson, error: lessonError } = await admin
    .from("lessons").select("id,course_id,topic_id,title,description")
    .eq("id", request.lesson_id).maybeSingle();
  if (lessonError || !lesson) throw new Error("Không đọc được bài học của yêu cầu.");
  const { data: topic, error: topicError } = await admin
    .from("course_topics").select("title").eq("id", lesson.topic_id).maybeSingle();
  if (topicError || !topic) throw new Error("Không đọc được chủ đề của bài học.");
  const { data: course, error: courseError } = await admin
    .from("courses").select("class_id").eq("id", lesson.course_id).maybeSingle();
  if (courseError || !course) throw new Error("Không đọc được lớp của bài học.");
  const { data: classroom, error: classError } = await admin
    .from("classes").select("name").eq("id", course.class_id).maybeSingle();
  if (classError || !classroom) throw new Error("Không đọc được tên lớp của bài học.");
  const { data: allObjectives, error: objectivesError } = await admin
    .from("learning_objectives").select("id,code,description")
    .eq("lesson_id", request.lesson_id).order("code");
  if (objectivesError || !allObjectives) throw new Error("Không đọc được mục tiêu học tập của bài học.");
  const objectives = selectedIds.length
    ? allObjectives.filter((objective) => selectedIds.includes(objective.id))
    : allObjectives;
  if (objectives.length === 0 || (selectedIds.length > 0 && objectives.length !== selectedIds.length)) {
    throw new Error("Bài học chưa có mục tiêu phù hợp với yêu cầu.");
  }

  const contextFields = [classroom.name, topic.title, lesson.title, lesson.description];
  if (contextFields.some((value) => typeof value !== "string")) throw new Error("Thông tin bài học không hợp lệ.");
  if (classroom.name.length > 100 || topic.title.length > 300 || lesson.title.length > 300 || lesson.description.length > 8000) {
    throw new Error("Tên lớp, chủ đề hoặc mô tả bài học quá dài; hãy rút gọn rồi thử lại.");
  }
  if (objectives.some((objective) => objective.code.length > 80 || objective.description.length > 2000)) {
    throw new Error("Mô tả mục tiêu quá dài; hãy rút gọn rồi thử lại.");
  }

  const objectiveIds = new Set(objectives.map((objective) => objective.id));
  const context = JSON.stringify({
    class_name: classroom.name,
    topic_title: topic.title,
    lesson_title: lesson.title,
    lesson_description: lesson.description,
    learning_objectives: objectives.map(({ id, code, description }) => ({ id, code, description })),
  });
  if (context.length > 20000) throw new Error("Tổng thông tin bài học và mục tiêu quá dài để tạo câu hỏi.");
  const prompt = [
    `Bạn là giáo viên giàu kinh nghiệm. Hãy tạo chính xác ${job.question_count} câu hỏi bằng tiếng Việt.`,
    "Chỉ sử dụng thông tin trong CONTEXT bên dưới; không tự thêm kiến thức ngoài phạm vi mục tiêu.",
    "Không đưa dữ liệu cá nhân hoặc thông tin học sinh vào câu hỏi.",
    "Mỗi objective_id phải giữ nguyên đúng một id trong learning_objectives.",
    `Dạng câu hỏi yêu cầu: ${requestedKind}. Nếu AUTO, phân bổ đa dạng các dạng phù hợp.`,
    `Độ khó yêu cầu: ${requestedDifficulty}. Nếu AUTO, phân bổ hợp lý EASY, MEDIUM, HARD.`,
    `Cấp độ Bloom yêu cầu: ${requestedBloom}. Nếu AUTO, phân bổ hợp lý các cấp độ.`,
    "SINGLE_CHOICE và MULTIPLE_CHOICE phải có đúng 4 lựa chọn; correct_indices bắt đầu từ 0.",
    "SINGLE_CHOICE có đúng 1 chỉ số đáp án; MULTIPLE_CHOICE có từ 2 chỉ số trở lên.",
    "TRUE_FALSE dùng options=[] và correct_indices=[0] cho Đúng hoặc [1] cho Sai.",
    "SHORT_ANSWER và ESSAY dùng options=[], correct_indices=[] và model_answer là đáp án tham khảo.",
    "Với dạng trắc nghiệm, đặt model_answer thành chuỗi rỗng. Tránh câu hỏi mơ hồ; đáp án cần đúng và duy nhất theo mục tiêu.",
    `CONTEXT:\n${context}`,
  ].join("\n");
  const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-3.8-flash";
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("Cấu hình GEMINI_MODEL không hợp lệ.");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.6,
          maxOutputTokens: 8192,
        },
      }),
      signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    },
  );
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Gemini trả về phản hồi không hợp lệ (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const message = isRecord(payload) && isRecord(payload.error) ? payload.error.message : null;
    throw new Error(typeof message === "string" ? `Gemini: ${message}` : `Gemini gặp lỗi (HTTP ${response.status}).`);
  }

  const candidates = isRecord(payload) && Array.isArray(payload.candidates) ? payload.candidates : [];
  const candidate = isRecord(candidates[0]) ? candidates[0] : null;
  const content = candidate && isRecord(candidate.content) ? candidate.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  const textPart = parts.find((part) => isRecord(part) && typeof part.text === "string");
  if (!isRecord(textPart) || typeof textPart.text !== "string") {
    throw new Error("Gemini không trả về nội dung câu hỏi; hãy thử lại.");
  }
  let generatedJson: unknown;
  try {
    generatedJson = JSON.parse(textPart.text);
  } catch {
    throw new Error("Gemini trả về JSON không hợp lệ; hãy thử lại.");
  }
  return parseGeneratedQuestions(
    generatedJson,
    job.question_count,
    objectiveIds,
    requestedKind,
    requestedDifficulty,
    requestedBloom,
  );
}

async function processJob(
  admin: SupabaseClient,
  jobId: string,
  supabaseUrl: string,
  publicKey: string,
  authorization: string,
  workerToken: string,
  encryptionSecret: string,
): Promise<void> {
  let requestId: string | null = null;
  let apiKey: string | undefined;
  try {
    const { data: job, error: jobError } = await admin
      .from("ai_generation_jobs").select("id,request_id,question_count,status").eq("id", jobId).maybeSingle();
    if (jobError || !job) throw new Error("Không đọc được tác vụ AI.");
    requestId = job.request_id;
    if (job.status !== "PROCESSING") return;
    const { data: request, error: requestError } = await admin
      .from("ai_generation_requests")
      .select("id,teacher_id,lesson_id,quantity,parameters")
      .eq("id", job.request_id).maybeSingle();
    if (requestError || !request) throw new Error("Không đọc được yêu cầu AI.");

    const { data: credential, error: credentialError } = await admin
      .from("teacher_ai_credentials").select("ciphertext,nonce")
      .eq("teacher_id", request.teacher_id).maybeSingle();
    if (credentialError) throw new Error("Không đọc được API key Gemini của giáo viên.");
    if (!credential) throw new Error("Bạn chưa thêm API key Gemini. Mở Tài khoản → API key Gemini để thiết lập.");
    try {
      apiKey = await decryptTeacherKey(encryptionSecret, request.teacher_id, credential.ciphertext, credential.nonce);
    } catch {
      throw new Error("Không giải mã được API key; hãy kiểm tra cấu hình mã hóa của Supabase.");
    }

    const items = await loadAndGenerate(admin, request, job, apiKey);
    const { error: saveError } = await admin.rpc("complete_ai_generation_job", {
      p_job: jobId,
      p_items: items,
      p_error: null,
    });
    if (saveError) throw new Error(`Không lưu được câu hỏi nháp: ${saveError.message}`);
  } catch (error) {
    const message = failureMessage(error, apiKey);
    const { error: failureError } = await admin.rpc("complete_ai_generation_job", {
      p_job: jobId,
      p_items: null,
      p_error: message,
    });
    if (failureError) {
      console.error("Could not record AI job failure:", failureError.message);
      return;
    }
    console.error("AI generation job failed:", message);
  }

  if (requestId) {
    await dispatchNextJob(admin, supabaseUrl, publicKey, authorization, workerToken, requestId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Chỉ hỗ trợ POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const encryptionSecret = Deno.env.get("AI_KEY_ENCRYPTION_KEY");
  const workerToken = Deno.env.get("AI_WORKER_TOKEN");
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !publicKey || !serviceRoleKey || !encryptionSecret || encryptionSecret.length < 32
    || !workerToken || workerToken.length < 32) {
    console.error("AI generation function is missing required Supabase secrets.");
    return jsonResponse({ error: "Edge Function chưa được cấu hình đầy đủ." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (req.headers.get("x-ai-worker-token")) {
    if (req.headers.get("x-ai-worker-token") !== workerToken || !authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Không có quyền chạy tác vụ nền." }, 403);
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Nội dung yêu cầu không phải JSON hợp lệ." }, 400);
    }
    if (!isRecord(body) || typeof body.job_id !== "string" || !UUID_PATTERN.test(body.job_id)) {
      return jsonResponse({ error: "Mã tác vụ AI không hợp lệ." }, 400);
    }
    const workerUserClient = createClient(supabaseUrl, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: workerUser, error: workerAuthError } = await workerUserClient.auth.getUser(authorization.slice(7));
    if (workerAuthError || !workerUser.user) return jsonResponse({ error: "Phiên xử lý nền không hợp lệ." }, 401);
    const { data: job, error: jobError } = await admin
      .from("ai_generation_jobs").select("request_id").eq("id", body.job_id).maybeSingle();
    if (jobError || !job) return jsonResponse({ error: "Không tìm thấy tác vụ AI." }, 404);
    const { data: owner, error: ownerError } = await admin
      .from("ai_generation_requests").select("teacher_id").eq("id", job.request_id).maybeSingle();
    if (ownerError || !owner) return jsonResponse({ error: "Không tìm thấy yêu cầu AI." }, 404);
    if (owner.teacher_id !== workerUser.user.id) return jsonResponse({ error: "Bạn không có quyền với tác vụ AI này." }, 403);

    const task = processJob(admin, body.job_id, supabaseUrl, publicKey, authorization, workerToken, encryptionSecret)
      .catch((error) => console.error("AI background task failed unexpectedly:", failureMessage(error)));
    EdgeRuntime.waitUntil(task);
    return jsonResponse({ accepted: true }, 202);
  }

  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Cần đăng nhập để tạo câu hỏi." }, 401);
  const userClient = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(authorization.slice(7));
  if (authError || !userData.user) return jsonResponse({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Nội dung yêu cầu không phải JSON hợp lệ." }, 400);
  }
  if (!isRecord(body) || typeof body.request_id !== "string" || !UUID_PATTERN.test(body.request_id)) {
    return jsonResponse({ error: "Mã yêu cầu AI không hợp lệ." }, 400);
  }
  if (body.retry !== undefined && typeof body.retry !== "boolean") {
    return jsonResponse({ error: "Tùy chọn thử lại không hợp lệ." }, 400);
  }

  const { data: generationRequest, error: requestError } = await userClient
    .from("ai_generation_requests")
    .select("id,teacher_id,status")
    .eq("id", body.request_id)
    .maybeSingle();
  if (requestError) {
    console.error("Could not read AI generation request:", requestError.message);
    return jsonResponse({ error: "Không đọc được yêu cầu AI từ Supabase." }, 500);
  }
  if (!generationRequest) return jsonResponse({ error: "Không tìm thấy yêu cầu AI." }, 404);
  if (generationRequest.teacher_id !== userData.user.id) return jsonResponse({ error: "Bạn không có quyền với yêu cầu AI này." }, 403);
  if (generationRequest.status === "COMPLETED") return jsonResponse({ accepted: true, already_completed: true });

  const { error: enqueueError } = await userClient.rpc("enqueue_ai_generation", {
    p_request: body.request_id,
    p_retry: body.retry === true,
  });
  if (enqueueError) {
    return jsonResponse({ error: enqueueError.message || "Không thể đưa yêu cầu vào hàng đợi." }, 409);
  }

  const { data: nextJob, error: claimError } = await admin.rpc("claim_next_ai_generation_job", {
    p_request: body.request_id,
  });
  if (claimError) {
    console.error("Could not claim first AI generation job:", claimError.message);
    return jsonResponse({ error: "Không khởi động được tác vụ AI; hãy tải lại trang để thử tiếp." }, 500);
  }
  if (nextJob) {
    try {
      await dispatchJob(supabaseUrl, publicKey, authorization, workerToken, nextJob.id);
    } catch (error) {
      const { error: releaseError } = await admin.rpc("release_ai_generation_job", { p_job: nextJob.id });
      if (releaseError) console.error("Could not release initial AI job:", releaseError.message);
      console.error("Could not start initial AI job:", error instanceof Error ? error.message : "unknown error");
      return jsonResponse({ error: "Không khởi động được tác vụ nền; hãy thử lại sau ít phút." }, 503);
    }
  }
  return jsonResponse({ accepted: true }, 202);
});
