/* Cấu hình dải khối lớp dùng chung cho giao diện. */
const EDUCMIND_GRADE_MIN = 3;
const EDUCMIND_GRADE_MAX = 12;
const EDUCMIND_GRADE_RANGE_LABEL = `${EDUCMIND_GRADE_MIN}–${EDUCMIND_GRADE_MAX}`;

function educmindGradeValues() {
  return Array.from(
    { length: EDUCMIND_GRADE_MAX - EDUCMIND_GRADE_MIN + 1 },
    (_, index) => EDUCMIND_GRADE_MIN + index,
  );
}

function educmindGradeOptions(selected) {
  const selectedGrade = selected == null ? null : Number(selected);
  return educmindGradeValues()
    .map((grade) => `<option value="${grade}"${grade === selectedGrade ? ' selected' : ''}>Khối ${grade}</option>`)
    .join('');
}

function educmindGradeIsValid(grade) {
  return Number.isInteger(grade) && grade >= EDUCMIND_GRADE_MIN && grade <= EDUCMIND_GRADE_MAX;
}
