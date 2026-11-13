import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QUESTION_KINDS = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"] as const;
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
const BLOOM_LEVELS = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const normalizedContent = content.trim();
    const normalizedOptions = options.map((option) => option.trim());
    const uniqueIndices = new Set(correctIndices);
    if (uniqueIndices.size !== correctIndices.length) {
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
      content: normalizedContent,
      options: normalizedOptions,
      correct_indices: correctIndices,
      model_answer: modelAnswer.trim(),
      difficulty,
      bloom_level: bloomLevel,
    };
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Chỉ hỗ trợ POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = req.headers.get("Authorization");
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or public key in Edge Function environment.");
    return jsonResponse({ error: "Edge Function chưa được cấu hình Supabase." }, 500);
  }
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Cần đăng nhập để tạo câu hỏi." }, 401);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await supabase.auth.getUser(authorization.slice(7));
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

  const requestId = body.request_id;
  const { data: generationRequest, error: requestError } = await supabase
    .from("ai_generation_requests")
    .select("id,teacher_id,lesson_id,quantity,parameters,status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) {
    console.error("Could not read AI generation request:", requestError.message);
    return jsonResponse({ error: "Không đọc được yêu cầu AI từ Supabase." }, 500);
  }
  if (!generationRequest) return jsonResponse({ error: "Không tìm thấy yêu cầu AI." }, 404);
  if (generationRequest.teacher_id !== userData.user.id) return jsonResponse({ error: "Bạn không có quyền với yêu cầu AI này." }, 403);
  if (generationRequest.status !== "PROCESSING") return jsonResponse({ error: "Yêu cầu AI này đã được xử lý." }, 409);

  const markFailed = async (message: string): Promise<string | null> => {
    const { error } = await supabase.rpc("save_ai_output", {
      p_request: requestId,
      p_items: null,
      p_error: message,
    });
    return error?.message ?? null;
  };

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL")?.trim();
    if (!apiKey || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) {
      throw new Error("Thiếu hoặc sai cấu hình GEMINI_API_KEY / GEMINI_MODEL trong Supabase Secrets.");
    }
    if (!Number.isInteger(generationRequest.quantity) || generationRequest.quantity < 1 || generationRequest.quantity > 20) {
      throw new Error("Số lượng câu hỏi trong yêu cầu không hợp lệ.");
    }

    const parameters = isRecord(generationRequest.parameters) ? generationRequest.parameters : {};
    const requestedKind = setting(parameters.kind, QUESTION_KINDS, "dạng câu hỏi");
    const requestedDifficulty = setting(parameters.difficulty, DIFFICULTIES, "độ khó");
    const requestedBloom = setting(parameters.bloom, BLOOM_LEVELS, "cấp độ Bloom");
    const selectedIds = parameters.objectives ?? [];
    if (!Array.isArray(selectedIds) || !selectedIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
      throw new Error("Danh sách mục tiêu trong yêu cầu không hợp lệ.");
    }

    const { data: lesson, error: lessonError } = await supabase
      .from("lessons").select("id,course_id,topic_id,title,description")
      .eq("id", generationRequest.lesson_id).maybeSingle();
    if (lessonError || !lesson) throw new Error("Không đọc được bài học của yêu cầu.");

    const { data: topic, error: topicError } = await supabase
      .from("course_topics").select("title").eq("id", lesson.topic_id).maybeSingle();
    if (topicError || !topic) throw new Error("Không đọc được chủ đề của bài học.");

    const { data: course, error: courseError } = await supabase
      .from("courses").select("class_id").eq("id", lesson.course_id).maybeSingle();
    if (courseError || !course) throw new Error("Không đọc được lớp của bài học.");

    const { data: classroom, error: classError } = await supabase
      .from("classes").select("name").eq("id", course.class_id).maybeSingle();
    if (classError || !classroom) throw new Error("Không đọc được tên lớp của bài học.");

    const { data: allObjectives, error: objectivesError } = await supabase
      .from("learning_objectives").select("id,code,description")
      .eq("lesson_id", generationRequest.lesson_id).order("code");
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
    const objectiveContext = objectives.map(({ id, code, description }) => ({ id, code, description }));
    const context = JSON.stringify({
      class_name: classroom.name,
      topic_title: topic.title,
      lesson_title: lesson.title,
      lesson_description: lesson.description,
      learning_objectives: objectiveContext,
    });
    if (context.length > 20000) throw new Error("Tổng thông tin bài học và mục tiêu quá dài để tạo câu hỏi.");

    const prompt = [
      `Bạn là giáo viên giàu kinh nghiệm. Hãy tạo chính xác ${generationRequest.quantity} câu hỏi bằng tiếng Việt.`,
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

    const geminiResponse = await fetch(
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
      },
    );

    let geminiPayload: unknown;
    try {
      geminiPayload = await geminiResponse.json();
    } catch {
      throw new Error(`Gemini trả về phản hồi không hợp lệ (HTTP ${geminiResponse.status}).`);
    }
    if (!geminiResponse.ok) {
      const error = isRecord(geminiPayload) && isRecord(geminiPayload.error) ? geminiPayload.error.message : null;
      throw new Error(typeof error === "string" ? `Gemini: ${error}` : `Gemini gặp lỗi (HTTP ${geminiResponse.status}).`);
    }

    const candidates = isRecord(geminiPayload) && Array.isArray(geminiPayload.candidates) ? geminiPayload.candidates : [];
    const firstCandidate = isRecord(candidates[0]) ? candidates[0] : null;
    const generatedContent = firstCandidate && isRecord(firstCandidate.content) ? firstCandidate.content : null;
    const parts = generatedContent && Array.isArray(generatedContent.parts) ? generatedContent.parts : [];
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
    const items = parseGeneratedQuestions(
      generatedJson,
      generationRequest.quantity,
      objectiveIds,
      requestedKind,
      requestedDifficulty,
      requestedBloom,
    );

    const { data: savedCount, error: saveError } = await supabase.rpc("save_ai_output", {
      p_request: requestId,
      p_items: items,
      p_error: null,
    });
    if (saveError) throw new Error(`Không lưu được câu hỏi nháp: ${saveError.message}`);
    if (typeof savedCount !== "number" || savedCount !== generationRequest.quantity) {
      throw new Error("Máy chủ không xác nhận đã lưu đủ câu hỏi.");
    }
    return jsonResponse({ count: savedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tạo câu hỏi AI.";
    let failureError: string | null;
    try {
      failureError = await markFailed(message);
    } catch (recordError) {
      failureError = recordError instanceof Error ? recordError.message : "Không ghi được trạng thái thất bại.";
    }
    if (failureError) {
      console.error("Failed to record AI generation failure:", failureError);
      return jsonResponse({ error: `${message} Trạng thái yêu cầu chưa được cập nhật; hãy tải lại lịch sử.` }, 500);
    }
    return jsonResponse({ error: message }, 502);
  }
});
