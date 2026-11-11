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
  return {
    /* ----- Giờ máy chủ (để tính hạn nộp và đồng hồ làm bài không phụ thuộc đồng hồ của máy người dùng) ----- */
    serverNow:()=>rpc('server_now',{}),

    /* ----- Hồ sơ ----- */
    getProfile:(id)=>from('profiles').select('id,email,full_name,role').eq('id',id).maybeSingle(),
    listProfiles:(ids)=>from('profiles').select('id,email,full_name,role').in('id',ids),
    renameMe:(fullName)=>from('profiles').update({full_name:fullName}).eq('id',me()).select('id,email,full_name,role').single(),

    /* ----- Lớp học ----- */
    listClasses:()=>from('classes').select('id,name,grade,school_year,owner_teacher_id,created_at').order('created_at',{ascending:false}),
    createClass:(name,grade,year)=>rpc('create_class_with_code',{n:name,g:grade||null,y:year||null}),
    updateClass:(id,row)=>from('classes').update(row).eq('id',id).select('id,name,grade,school_year,owner_teacher_id,created_at').single(),
    archiveClass:(id)=>from('classes').update({deleted_at:now()}).eq('id',id).select('id'),
    joinClass:(code)=>rpc('join_class_with_code',{k:code}),
    listInvites:(classIds)=>from('class_invites').select('id,class_id,code,created_at,expires_at,revoked_at').in('class_id',classIds).order('created_at',{ascending:false}),
    listMembers:(classIds)=>from('class_members').select('class_id,student_id,joined_at').in('class_id',classIds).order('joined_at'),
    addStudentByEmail:(classId,email)=>rpc('add_student_by_email',{p_class:classId,p_email:email}),
    removeMember:(classId,studentId)=>from('class_members').delete().eq('class_id',classId).eq('student_id',studentId).select('student_id'),

    /* ----- Khóa học (mỗi lớp dùng một khóa học chứa toàn bộ nội dung) ----- */
    listCourses:(classId)=>from('courses').select('id,class_id,title,description,created_at').eq('class_id',classId).is('deleted_at',null).order('created_at'),
    createCourse:(row)=>from('courses').insert(row).select('id,class_id,title,description,created_at').single(),

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

    /* ----- Ngân hàng câu hỏi -----
       options: mảng chuỗi lựa chọn. correct_answer: SINGLE_CHOICE = số thứ tự lựa chọn (từ 0); MULTIPLE_CHOICE = mảng số thứ tự;
       TRUE_FALSE = true/false; SHORT_ANSWER, ESSAY = null hoặc đáp án tham khảo (giáo viên chấm tay). */
    listQuestions:(courseId)=>from('questions').select('id,course_id,content,kind,options,correct_answer,difficulty').eq('course_id',courseId).is('deleted_at',null),
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
  };
})();
