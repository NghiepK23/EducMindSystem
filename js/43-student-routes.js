/* EducMind · js/43-student-routes.js
   Bảng trang của học sinh (SP): mã trang → hàm vẽ trang.
   Lưu ý: Phải nạp SAU các tệp khai báo sDashboard, calendarPage, sLessons, sAssign, sQuiz, sResults, sMastery, sGaps, sRecs, insStu. */
const SP={dashboard:sDashboard,calendar:calendarPage,lessons:sLessons,assignments:sAssign,assessments:sQuiz,results:sResults,mastery:sMastery,gaps:sGaps,recommend:sRecs};
SP.results=(f=>()=>f()+insStu())(SP.results);
