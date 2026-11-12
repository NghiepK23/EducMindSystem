/* EducMind · js/03-supabase.js
   Kết nối Supabase: địa chỉ dự án, khóa công khai, client, và EducMindDB (mọi lệnh đọc/ghi cơ sở dữ liệu).
   Lưu ý: Chỉ dùng khóa công khai (publishable key). Mọi quyền truy cập dữ liệu do RLS trong cơ sở dữ liệu quyết định. */
const SUPABASE_URL='https://jzjaxxhvhfzjkinbbuxf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_VOx-63Nb8xNbmSbeF5sVJA_uARLSAqp';
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})||null;
/* backendBusy: đang chờ Supabase trả lời ở màn hình đăng nhập. backendRecovery: người dùng vừa mở liên kết đặt lại mật khẩu. */
let backendBusy=false,backendRecovery=false;
if(supabaseClient)supabaseClient.auth.onAuthStateChange((event)=>{
  if(event==='PASSWORD_RECOVERY'){backendRecovery=true;authMode='reset';authErr='';if(appReady)render()}
  /* Phiên Supabase kết thúc ngoài ý muốn (hết hạn, đăng xuất ở thẻ khác): quay về màn hình đăng nhập.
     Khi người dùng tự bấm Đăng xuất thì logged đã là false trước khi sự kiện này tới, nên nhánh này không chạy. */
  if(event==='SIGNED_OUT'&&appReady&&logged&&sess?.backend){
    if(typeof dbReset==='function')dbReset();
    logged=false;sess=null;role='T';authMode='login';authMsg='';authErr='Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.';render();
  }
});

/* EducMindDB: mỗi hàm là MỘT lệnh gửi tới Supabase và trả về { data, error } như supabase-js.
   Quy ước:
   - Các bảng do máy chủ tự ghi (learning_evidence, mastery, knowledge_gaps, content_revisions, notifications) chỉ được đọc ở đây.
   - Việc có nhiều bước (bắt đầu / nộp bài kiểm tra, tạo lớp, vào lớp) gọi hàm RPC để máy chủ kiểm tra và ghi trong một giao dịch.
   - Không nhúng bảng liên quan trong select; màn hình tự ghép dữ liệu theo mã (id). */
const EducMindDB=(()=>{
  const from=(t)=>supabaseClient.from(t);
  const rpc=(fn,args)=>supabaseClient.rpc(fn,args);
  const now=()=>new Date().toISOString();
  const me=()=>sess?.userId;
  /* Tải tệp lên kho bằng thân nhị phân thô (Supabase Storage nhận body nguyên bản; tránh multipart
     để giữ nguyên từng byte tệp). Trả về { data, error } như supabase-js để dbCall dùng chung. */
  const storageUpload=async(bucket,path,file,contentType,upsert)=>{
    try{
      const { data: s } = await supabaseClient.auth.getSession();
      const r = await fetch(SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path.split('/').map(encodeURIComponent).join('/'), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + (s?.session?.access_token || SUPABASE_PUBLISHABLE_KEY), 'apikey': SUPABASE_PUBLISHABLE_KEY, 'content-type': contentType || file.type || 'application/octet-stream', 'x-upsert': String(!!upsert) },
        body: await file.arrayBuffer(),
      });
      if (!r.ok) { let m = 'HTTP ' + r.status; try { m = (await r.json()).message || m; } catch (_) {} return { data: null, error: { message: m } }; }
      return { data: await r.json(), error: null };
    } catch (e) { return { data: null, error: { message: String(e && e.message || e) } }; }
  };
  return {
    /* ----- Giờ máy chủ (để tính hạn nộp và đồng hồ làm bài không phụ thuộc đồng hồ của máy người dùng) ----- */
    serverNow:()=>rpc('server_now',{}),

    /* ----- Hồ sơ ----- */
    getProfile:(id)=>from('profiles').select('id,email,full_name,role').eq('id',id).maybeSingle(),
    listProfiles:(ids)=>from('profiles').select('id,email,full_name,role').in('id',ids),
    renameMe:(fullName)=>from('profiles').update({full_name:fullName}).eq('id',me()).select('id,email,full_name,role').single(),

    /* ----- Lớp học ----- */
    listClasses:()=>from('classes').select('id,name,grade,school_year,owner_teacher_id,created_at').is('deleted_at',null).order('created_at',{ascending:false}),
    createClass:(name,grade,year)=>rpc('create_class_with_code',{n:name,g:grade||null,y:year||null}),
    updateClass:(id,row)=>from('classes').update(row).eq('id',id).select('id,name,grade,school_year,owner_teacher_id,created_at').single(),
    archiveClass:(id)=>from('classes').update({deleted_at:now()}).eq('id',id).select('id'),
    joinClass:(code)=>rpc('join_class_with_code',{k:code}),
    listInvites:(classIds)=>from('class_invites').select('id,class_id,code,created_at,expires_at,revoked_at').in('class_id',classIds).order('created_at',{ascending:false}),
    listMembers:(classIds)=>from('class_members').select('class_id,student_id,joined_at').in('class_id',classIds).order('joined_at'),
    addStudentByEmail:(classId,email)=>rpc('add_student_by_email',{p_class:classId,p_email:email}),
    removeMember:(classId,studentId)=>from('class_members').delete().eq('class_id',classId).eq('student_id',studentId).select('student_id'),
    /* Mã lớp: tạo mã mới (máy chủ thu hồi mọi mã cũ trong cùng giao dịch) và mở lại lớp đã lưu trữ. */
    regenClassCode:(classId)=>rpc('regen_class_code',{p_class:classId}),
    /* GV tạo tài khoản học sinh (mật khẩu ban đầu do GV đặt) và thêm thẳng vào một lớp của mình. */
    createStudentAccount:(email,fullName,password,classId)=>rpc('create_student_account',{p_email:email,p_full_name:fullName,p_password:password,p_class_id:classId||null}),
    /* Cấp thêm lượt làm bài kiểm tra cho một học sinh. */
    grantExtraAttempts:(assessmentId,studentId,extra,reason)=>rpc('grant_extra_attempts',{p_assessment:assessmentId,p_student:studentId,p_extra:extra,p_reason:reason||''}),
    listExtraAttempts:(assessmentIds)=>from('assessment_extra_attempts').select('id,assessment_id,student_id,extra,reason,granted_by,created_at').in('assessment_id',assessmentIds),
    listArchivedClasses:()=>from('classes').select('id,name,grade,school_year,owner_teacher_id,created_at,deleted_at').not('deleted_at','is',null).order('deleted_at',{ascending:false}),
    restoreClass:(id)=>rpc('restore_class',{p_class:id}),

    /* ----- Khóa học (mỗi lớp dùng một khóa học chứa toàn bộ nội dung) ----- */
    listCourses:(classId)=>from('courses').select('id,class_id,title,description,sequential_unlock,created_at').eq('class_id',classId).is('deleted_at',null).order('created_at'),
    createCourse:(row)=>from('courses').insert(row).select('id,class_id,title,description,sequential_unlock,created_at').single(),
    /* Bật/tắt mở bài học tuần tự của khóa học. */
    updateCourse:(id,row)=>from('courses').update(row).eq('id',id).select('id,class_id,title,description,sequential_unlock,created_at').single(),

    /* ----- Chủ đề, bài học, mục tiêu ----- */
    listTopics:(courseId)=>from('course_topics').select('id,course_id,title,description,display_order,status').eq('course_id',courseId).is('deleted_at',null).order('display_order').order('created_at'),
    createTopic:(row)=>from('course_topics').insert(row).select().single(),
    updateTopic:(id,row)=>from('course_topics').update(row).eq('id',id).select().single(),
    listLessons:(courseId)=>from('lessons').select('id,course_id,topic_id,title,description,display_order,status').eq('course_id',courseId).is('deleted_at',null).order('display_order').order('created_at'),
    createLesson:(row)=>from('lessons').insert(row).select().single(),
    updateLesson:(id,row)=>from('lessons').update(row).eq('id',id).select().single(),
    listObjectives:(lessonIds)=>from('learning_objectives').select('id,lesson_id,code,description').in('lesson_id',lessonIds).order('code'),
    createObjective:(row)=>from('learning_objectives').insert(row).select().single(),
    updateObjective:(id,row)=>from('learning_objectives').update(row).eq('id',id).select().single(),
    deleteObjective:(id)=>from('learning_objectives').delete().eq('id',id).select('id'),

    /* ----- Tài liệu đính kèm bài học (resources + kho educmind-resources) -----
       Đường dẫn tệp: <mã lớp>/<thời gian>-<tên tệp>. Máy chủ kiểm tra quyền đọc/ghi theo đường dẫn. */
    listResources:(courseId)=>from('resources').select('id,course_id,lesson_id,kind,url,file_name,storage_path,file_size_bytes,mime_type,created_at').eq('course_id',courseId).is('deleted_at',null).order('created_at'),
    createResource:(row)=>from('resources').insert(row).select().single(),
    /* Xóa hẳn dòng và tệp trong kho (tệp đã xóa không khôi phục được). */
    deleteResource:(id)=>from('resources').delete().eq('id',id).select('id,storage_path'),
    uploadResourceFile:(path,file,contentType)=>storageUpload('educmind-resources',path,file,contentType,false),
    removeResourceFile:(path)=>supabaseClient.storage.from('educmind-resources').remove([path]),
    resourceFileUrl:(path)=>supabaseClient.storage.from('educmind-resources').createSignedUrl(path,3600),

    /* ----- Tệp bài nộp của học sinh (kho educmind-submissions) -----
       Đường dẫn: <mã lớp>/<mã bài tập>/<mã học sinh>/<tên tệp> (máy chủ xác nhận đúng cấu trúc này). */
    uploadSubmissionFile:(path,file)=>storageUpload('educmind-submissions',path,file,file.type,true),
    removeSubmissionFile:(path)=>supabaseClient.storage.from('educmind-submissions').remove([path]),
    submissionFileUrl:(path)=>supabaseClient.storage.from('educmind-submissions').createSignedUrl(path,3600),

    /* ----- Bài tập và bài nộp ----- */
    listAssignments:(courseId)=>from('assignments').select('id,course_id,topic_id,lesson_id,title,description,due_at,allow_late,late_close_at,max_score,status,created_at').eq('course_id',courseId).is('deleted_at',null).order('due_at'),
    createAssignment:(row)=>from('assignments').insert({...row,created_by:me()}).select().single(),
    updateAssignment:(id,row)=>from('assignments').update(row).eq('id',id).select().single(),
    listAssignmentObjectives:(assignmentIds)=>from('assignment_objectives').select('assignment_id,objective_id').in('assignment_id',assignmentIds),
    addAssignmentObjectives:(rows)=>from('assignment_objectives').insert(rows).select(),
    removeAssignmentObjectives:(assignmentId,objectiveIds)=>from('assignment_objectives').delete().eq('assignment_id',assignmentId).in('objective_id',objectiveIds).select(),
    listSubmissions:(assignmentIds)=>from('assignment_submissions').select('id,assignment_id,student_id,text_content,storage_path,status,score,feedback,graded_at,is_edited,submitted_at').in('assignment_id',assignmentIds),
    /* Học sinh nộp hoặc sửa bài: một bài nộp cho mỗi (bài tập, học sinh). status: SUBMITTED trước hạn, LATE sau hạn (khi bài cho nộp muộn). */
    submitAssignment:(row)=>from('assignment_submissions').upsert({...row,student_id:me()},{onConflict:'assignment_id,student_id'}).select().single(),
    gradeSubmission:(id,row)=>from('assignment_submissions').update({...row,graded_by:me(),graded_at:now()}).eq('id',id).select().single(),

    /* ----- Rubric (thang điểm chi tiết của bài tập) -----
       Giáo viên đặt các tiêu chí; khi chấm, điểm mỗi tiêu chí được lưu vào rubric_scores
       và tổng điểm rubric chính là điểm bài nộp. */
    listRubricCriteria:(assignmentIds)=>from('rubric_criteria').select('id,assignment_id,title,description,max_score,display_order').in('assignment_id',assignmentIds).order('display_order'),
    createRubricCriterion:(row)=>from('rubric_criteria').insert(row).select().single(),
    updateRubricCriterion:(id,row)=>from('rubric_criteria').update(row).eq('id',id).select().single(),
    deleteRubricCriterion:(id)=>from('rubric_criteria').delete().eq('id',id).select('id'),
    listRubricScores:(submissionIds)=>from('rubric_scores').select('submission_id,criterion_id,score,feedback,updated_at').in('submission_id',submissionIds),
    saveRubricScores:(rows)=>from('rubric_scores').upsert(rows.map((r)=>({...r,graded_by:me()})),{onConflict:'submission_id,criterion_id'}).select(),

    /* ----- Thùng rác: mục đã xóa mềm (deleted_at) chờ khôi phục ----- */
    listDeletedTopics:(courseId)=>from('course_topics').select('id,title,deleted_at').eq('course_id',courseId).not('deleted_at','is',null),
    listDeletedLessons:(courseId)=>from('lessons').select('id,topic_id,title,deleted_at').eq('course_id',courseId).not('deleted_at','is',null),
    listDeletedAssignments:(courseId)=>from('assignments').select('id,title,deleted_at').eq('course_id',courseId).not('deleted_at','is',null),
    listDeletedQuestions:(courseId)=>from('questions').select('id,content,deleted_at').eq('course_id',courseId).not('deleted_at','is',null),
    restoreTopic:(id)=>from('course_topics').update({deleted_at:null}).eq('id',id).select('id'),
    restoreLesson:(id)=>from('lessons').update({deleted_at:null}).eq('id',id).select('id'),
    restoreAssignment:(id)=>from('assignments').update({deleted_at:null}).eq('id',id).select('id'),
    restoreQuestion:(id)=>from('questions').update({deleted_at:null}).eq('id',id).select('id'),

    /* ----- Ngân hàng câu hỏi -----
       options: mảng chuỗi lựa chọn. correct_answer: SINGLE_CHOICE = số thứ tự lựa chọn (từ 0); MULTIPLE_CHOICE = mảng số thứ tự;
       TRUE_FALSE = true/false; SHORT_ANSWER, ESSAY = null hoặc đáp án tham khảo (giáo viên chấm tay). */
    listQuestions:(courseId)=>from('questions').select('id,course_id,content,kind,options,correct_answer,difficulty,grade,bloom_level').eq('course_id',courseId).is('deleted_at',null),
    /* Nhập hàng loạt từ tệp Excel/CSV. */
    createQuestions:(rows)=>from('questions').insert(rows.map((r)=>({...r,created_by:me()}))).select('id'),
    createQuestion:(row)=>from('questions').insert({...row,created_by:me()}).select().single(),
    updateQuestion:(id,row)=>from('questions').update(row).eq('id',id).select().single(),
    listQuestionObjectives:(questionIds)=>from('question_objectives').select('question_id,objective_id').in('question_id',questionIds),
    addQuestionObjectives:(rows)=>from('question_objectives').insert(rows).select(),
    removeQuestionObjectives:(questionId,objectiveIds)=>from('question_objectives').delete().eq('question_id',questionId).in('objective_id',objectiveIds).select(),

    /* ----- Bài kiểm tra ----- */
    listAssessments:(courseId)=>from('assessments').select('id,course_id,topic_id,lesson_id,title,duration_minutes,max_attempts,open_at,close_at,status,created_at').eq('course_id',courseId).is('deleted_at',null).order('open_at'),
    createAssessment:(row)=>from('assessments').insert({...row,created_by:me()}).select().single(),
    updateAssessment:(id,row)=>from('assessments').update(row).eq('id',id).select().single(),
    listAssessmentQuestions:(assessmentIds)=>from('assessment_questions').select('assessment_id,question_id,weight,display_order').in('assessment_id',assessmentIds).order('display_order'),
    addAssessmentQuestions:(rows)=>from('assessment_questions').insert(rows).select(),
    updateAssessmentQuestion:(assessmentId,questionId,row)=>from('assessment_questions').update(row).eq('assessment_id',assessmentId).eq('question_id',questionId).select(),
    removeAssessmentQuestion:(assessmentId,questionId)=>from('assessment_questions').delete().eq('assessment_id',assessmentId).eq('question_id',questionId).select(),
    listAttempts:(assessmentIds)=>from('assessment_attempts').select('id,assessment_id,student_id,attempt_number,status,started_at,submitted_at,graded_at,total_score').in('assessment_id',assessmentIds).order('started_at',{ascending:false}),
    /* Trả về { status: STARTED | RESUMED | CLOSED | NO_ATTEMPTS_LEFT, attempt, ends_at }. Máy chủ đếm lượt và tính giờ. */
    startAttempt:(assessmentId)=>rpc('start_assessment_attempt',{p_assessment:assessmentId}),
    /* Đề bài cho học sinh: không có đáp án đúng. */
    getAssessmentQuestions:(assessmentId)=>rpc('student_assessment_questions',{x:assessmentId}),
    listAnswers:(attemptIds)=>from('submission_answers').select('id,attempt_id,question_id,answer_content,score,feedback,graded_at').in('attempt_id',attemptIds),
    saveAnswer:(attemptId,questionId,answer)=>from('submission_answers').upsert({attempt_id:attemptId,question_id:questionId,answer_content:answer},{onConflict:'attempt_id,question_id'}).select('id,attempt_id,question_id,answer_content').single(),
    submitAttempt:(attemptId)=>rpc('submit_assessment_attempt',{p_attempt:attemptId}),
    /* Xem lại lượt đã nộp: câu hỏi, câu trả lời, điểm, nhận xét (không có đáp án đúng). */
    reviewAttempt:(attemptId)=>rpc('student_attempt_review',{p_attempt:attemptId}),
    gradeAnswer:(id,row)=>from('submission_answers').update({...row,graded_by:me(),graded_at:now()}).eq('id',id).select().single(),
    regradeAssessment:(assessmentId)=>rpc('regrade_assessment',{p_assessment:assessmentId}),
    finalizeExpiredAttempts:(assessmentId)=>rpc('finalize_expired_attempts',assessmentId?{p_assessment:assessmentId}:{}),

    /* ----- Đánh giá học tập (máy chủ tự tính; ở đây chỉ đọc) ----- */
    listMastery:(objectiveIds)=>from('mastery').select('student_id,objective_id,mastery_score,evidence_count,updated_at').in('objective_id',objectiveIds),
    listEvidence:(objectiveIds)=>from('learning_evidence').select('id,student_id,objective_id,source_type,source_id,score,observed_at').in('objective_id',objectiveIds).order('observed_at',{ascending:false}),
    listGaps:(objectiveIds)=>from('knowledge_gaps').select('id,student_id,objective_id,status,reason,dismiss_reason,opened_at,resolved_at,dismissed_at').in('objective_id',objectiveIds).order('opened_at',{ascending:false}),
    dismissGap:(gapId,reason)=>rpc('dismiss_knowledge_gap',{p_gap:gapId,p_reason:reason}),
    listRecommendations:()=>from('recommendations').select('id,student_id,objective_id,assessment_id,kind,reason,status,created_at,responded_at').order('created_at',{ascending:false}),
    /* Học sinh trả lời gợi ý: ACCEPTED hoặc DISMISSED. */
    respondRecommendation:(id,status)=>from('recommendations').update({status,responded_at:now()}).eq('id',id).select('id,status').single(),

    /* ----- Thông báo ----- */
    listNotifications:(limit)=>from('notifications').select('id,type,title,content,is_read,created_at,payload').order('created_at',{ascending:false}).limit(limit||30),
    markNotificationRead:(id)=>from('notifications').update({is_read:true,read_at:now()}).eq('id',id).select('id'),
    markAllNotificationsRead:()=>from('notifications').update({is_read:true,read_at:now()}).eq('user_id',me()).eq('is_read',false).select('id'),

    /* ----- Lịch sử chỉnh sửa (trigger ở máy chủ ghi; giáo viên chỉ đọc) ----- */
    listRevisions:(classId,limit)=>from('content_revisions').select('id,class_id,entity_type,entity_id,action,actor_id,before_state,after_state,created_at').eq('class_id',classId).order('created_at',{ascending:false}).limit(limit||200),

    /* ----- Nhóm 3: AI tạo câu hỏi nháp ----- */
    listAiRequests:()=>from('ai_generation_requests').select('id,lesson_id,quantity,parameters,status,error_message,created_at,completed_at').eq('teacher_id',me()).order('created_at',{ascending:false}),
    createAiRequest:(lessonId,quantity,params)=>rpc('create_ai_request',{p_lesson:lessonId,p_quantity:quantity,p_parameters:params||{}}),
    runAiGeneration:(requestId)=>rpc('run_ai_generation',{p_request:requestId}),
    listAiOutputs:(requestIds)=>from('ai_generation_outputs').select('id,request_id,content,kind,objective_id,difficulty,bloom_level,options,correct_answer,review_status,review_note,approved_question_id').in('request_id',requestIds).order('content'),
    /* Từ chối / ghi chú một bản nháp (reviewed_by luôn là người duyệt). */
    updateAiOutput:(id,row)=>from('ai_generation_outputs').update({...row,reviewed_by:me(),reviewed_at:now()}).eq('id',id).select().single(),
    /* Duyệt bản nháp: máy chủ tạo câu hỏi thật, gắn mục tiêu và ghi nhận trạng thái duyệt. */
    approveAiOutput:(id,content,options,correct,difficulty,bloom,grade)=>rpc('approve_ai_output',{p_output:id,p_content:content,p_options:options,p_correct_answer:correct,p_difficulty:difficulty,p_bloom_level:bloom,p_grade:grade}),

    /* ----- Nhóm 3: trò chơi ôn tập ----- */
    /* Câu hỏi trắc nghiệm cho trò chơi (học sinh chỉ đọc được qua RPC này). */
    gameQuestions:(courseId)=>rpc('game_questions',{p_course:courseId}),
    listGameSessions:(courseId)=>from('game_sessions').select('id,student_id,course_id,mode,source,question_count,correct_count,score,duration_seconds,played_at').eq('course_id',courseId).order('played_at',{ascending:false}).limit(100),
    createGameSession:(row)=>from('game_sessions').insert({...row,student_id:me()}).select().single(),
  };
})();
