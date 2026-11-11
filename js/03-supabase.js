/* EducMind · js/03-supabase.js
   Kết nối Supabase: địa chỉ dự án, khóa công khai, client, và EducMindDB (mọi lệnh đọc/ghi cơ sở dữ liệu).
   Lưu ý: Chỉ dùng khóa công khai (publishable key). Mọi quyền truy cập dữ liệu do RLS trong cơ sở dữ liệu quyết định. */
/* Supabase project configuration: publishable key only. All protected records rely on database RLS. */
const SUPABASE_URL='https://jzjaxxhvhfzjkinbbuxf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_VOx-63Nb8xNbmSbeF5sVJA_uARLSAqp';
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})||null;
let backendBusy=false,backendClasses=[],backendJoinCode='',backendModeNotice='',backendRecovery=false;
let backendPane='classes',backendClassId='',backendCourseId='',backendCourses=[],backendTopics=[],backendLessons=[],backendAssignments=[],backendSubmissions=[],backendActiveAssignment='',backendQuestions=[],backendAssessments=[],backendSelectedAssessment='',backendAttempts=[],backendAttemptQuestions=[],backendCurrentAttempt=null,backendAnswerDraft={};
if(supabaseClient)supabaseClient.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){backendRecovery=true;authMode='reset';authErr='';if(appReady)render()}});
const EducMindDB={
  listClasses:()=>supabaseClient.from('classes').select('id,name,grade,school_year,owner_teacher_id,created_at').order('created_at',{ascending:false}),
  createClass:(name,grade,year)=>supabaseClient.rpc('create_class_with_code',{n:name,g:grade||null,y:year||null}),
  joinClass:(code)=>supabaseClient.rpc('join_class_with_code',{k:code}),
  listCourses:(classId)=>supabaseClient.from('courses').select('id,class_id,title,description').eq('class_id',classId).is('deleted_at',null),
  listTopics:(courseId)=>supabaseClient.from('course_topics').select('id,course_id,title,description,display_order,status').eq('course_id',courseId).order('display_order'),
  listLessons:(courseId)=>supabaseClient.from('lessons').select('id,course_id,topic_id,title,description,display_order,status').eq('course_id',courseId).order('display_order'),
  listAssignments:(courseId)=>supabaseClient.from('assignments').select('id,course_id,title,description,due_at,allow_late,late_close_at,max_score,status').eq('course_id',courseId).order('due_at'),
  submitAssignment:(row)=>supabaseClient.from('assignment_submissions').upsert(row,{onConflict:'assignment_id,student_id'}).select().single(),
  listAssessments:(courseId)=>supabaseClient.from('assessments').select('id,course_id,title,duration_minutes,max_attempts,open_at,close_at,status').eq('course_id',courseId).order('open_at'),
  getAssessmentQuestions:(assessmentId)=>supabaseClient.rpc('student_assessment_questions',{x:assessmentId}),
  joinClassWithCode:(code)=>supabaseClient.rpc('join_class_with_code',{k:code}),
  listMembers:(classId)=>supabaseClient.from('class_members').select('class_id,student_id,joined_at,profiles(id,email,full_name,role)').eq('class_id',classId),
  createCourse:(row)=>supabaseClient.from('courses').insert(row).select().single(),
  updateCourse:(id,row)=>supabaseClient.from('courses').update(row).eq('id',id).select().single(),
  deleteCourse:(id)=>supabaseClient.from('courses').delete().eq('id',id),
  createTopic:(row)=>supabaseClient.from('course_topics').insert(row).select().single(),
  updateTopic:(id,row)=>supabaseClient.from('course_topics').update(row).eq('id',id).select().single(),
  createLesson:(row)=>supabaseClient.from('lessons').insert(row).select().single(),
  updateLesson:(id,row)=>supabaseClient.from('lessons').update(row).eq('id',id).select().single(),
  listObjectives:(lessonId)=>supabaseClient.from('learning_objectives').select('*').eq('lesson_id',lessonId),
  createObjective:(row)=>supabaseClient.from('learning_objectives').insert(row).select().single(),
  listResources:(courseId)=>supabaseClient.from('resources').select('*').eq('course_id',courseId).is('deleted_at',null),
  createResource:(row)=>supabaseClient.from('resources').insert(row).select().single(),
  createAssignment:(row)=>supabaseClient.from('assignments').insert(row).select().single(),
  updateAssignment:(id,row)=>supabaseClient.from('assignments').update(row).eq('id',id).select().single(),
  deleteAssignment:(id)=>supabaseClient.from('assignments').delete().eq('id',id),
  listAssignmentSubmissions:(assignmentId)=>supabaseClient.from('assignment_submissions').select('*,profiles!assignment_submissions_student_id_fkey(id,email,full_name)').eq('assignment_id',assignmentId),
  gradeAssignmentSubmission:(id,row)=>supabaseClient.from('assignment_submissions').update({...row,graded_by:sess?.userId,graded_at:new Date().toISOString()}).eq('id',id).select().single(),
  listRubricCriteria:(assignmentId)=>supabaseClient.from('rubric_criteria').select('*').eq('assignment_id',assignmentId).order('display_order'),
  createRubricCriterion:(row)=>supabaseClient.from('rubric_criteria').insert(row).select().single(),
  saveRubricScore:(row)=>supabaseClient.from('rubric_scores').upsert({...row,graded_by:sess?.userId},{onConflict:'submission_id,criterion_id'}).select().single(),
  createQuestion:(row)=>supabaseClient.from('questions').insert({...row,created_by:sess?.userId}).select().single(),
  listQuestions:(courseId)=>supabaseClient.from('questions').select('*').eq('course_id',courseId).is('deleted_at',null),
  createAssessment:(row)=>supabaseClient.from('assessments').insert({...row,created_by:sess?.userId}).select().single(),
  updateAssessment:(id,row)=>supabaseClient.from('assessments').update(row).eq('id',id).select().single(),
  listAssessmentQuestions:(assessmentId)=>supabaseClient.from('assessment_questions').select('assessment_id,question_id,weight,display_order,questions(id,content,kind,options)').eq('assessment_id',assessmentId).order('display_order'),
  addAssessmentQuestion:(row)=>supabaseClient.from('assessment_questions').insert(row).select().single(),
  async startAttempt(assessmentId){const {data:user}=await supabaseClient.auth.getUser();if(!user?.user)return {data:null,error:{message:'Not signed in'}};const {count,error:countError}=await supabaseClient.from('assessment_attempts').select('id',{count:'exact',head:true}).eq('assessment_id',assessmentId).eq('student_id',user.user.id);if(countError)return {data:null,error:countError};return supabaseClient.from('assessment_attempts').insert({assessment_id:assessmentId,student_id:user.user.id,attempt_number:(count||0)+1,status:'IN_PROGRESS'}).select().single()},
  saveAssessmentAnswer:(row)=>supabaseClient.from('submission_answers').upsert(row,{onConflict:'attempt_id,question_id'}).select().single(),
  submitAttempt:(id)=>supabaseClient.from('assessment_attempts').update({status:'SUBMITTED',submitted_at:new Date().toISOString()}).eq('id',id).select().single(),
  listMyAttempts:()=>supabaseClient.from('assessment_attempts').select('*').order('started_at',{ascending:false}),
  gradeAnswer:(id,row)=>supabaseClient.from('submission_answers').update({...row,graded_by:sess?.userId,graded_at:new Date().toISOString()}).eq('id',id).select().single(),
  listMastery:(studentId)=>supabaseClient.from('mastery').select('*').eq('student_id',studentId),
  listLearningEvidence:(studentId)=>supabaseClient.from('learning_evidence').select('*').eq('student_id',studentId).order('created_at',{ascending:false}),
  listKnowledgeGaps:(studentId)=>supabaseClient.from('knowledge_gaps').select('*').eq('student_id',studentId).order('opened_at',{ascending:false}),
  listRecommendations:(studentId)=>supabaseClient.from('recommendations').select('*').eq('student_id',studentId).order('created_at',{ascending:false}),
  respondRecommendation:(id,status)=>supabaseClient.from('recommendations').update({status,responded_at:new Date().toISOString()}).eq('id',id).select().single(),
  listNotifications:()=>supabaseClient.from('notifications').select('*').order('created_at',{ascending:false}),
  markNotificationRead:(id)=>supabaseClient.from('notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('id',id),
  listRevisions:(classId)=>supabaseClient.from('content_revisions').select('*').eq('class_id',classId).order('created_at',{ascending:false}).limit(250),
  createRevision:(row)=>supabaseClient.from('content_revisions').insert({...row,actor_id:sess?.userId}).select().single(),
  createAIGenerationRequest:(row)=>supabaseClient.from('ai_generation_requests').insert({...row,teacher_id:sess?.userId}).select().single(),
  listAIOutputs:(requestId)=>supabaseClient.from('ai_generation_outputs').select('*').eq('request_id',requestId),
  reviewAIOutput:(id,row)=>supabaseClient.from('ai_generation_outputs').update({...row,reviewed_by:sess?.userId,reviewed_at:new Date().toISOString()}).eq('id',id).select().single()
};
