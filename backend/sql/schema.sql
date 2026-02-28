IF OBJECT_ID('evaluations', 'U') IS NOT NULL DROP TABLE evaluations;
IF OBJECT_ID('question_answers', 'U') IS NOT NULL DROP TABLE question_answers;
IF OBJECT_ID('answer_pages', 'U') IS NOT NULL DROP TABLE answer_pages;
IF OBJECT_ID('answer_scripts', 'U') IS NOT NULL DROP TABLE answer_scripts;
IF OBJECT_ID('questions', 'U') IS NOT NULL DROP TABLE questions;
IF OBJECT_ID('tests', 'U') IS NOT NULL DROP TABLE tests;
IF OBJECT_ID('students', 'U') IS NOT NULL DROP TABLE students;
IF OBJECT_ID('teachers', 'U') IS NOT NULL DROP TABLE teachers;
IF OBJECT_ID('schools', 'U') IS NOT NULL DROP TABLE schools;

CREATE TABLE schools (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  name NVARCHAR(200) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE teachers (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  school_id UNIQUEIDENTIFIER NOT NULL,
  email NVARCHAR(200) NOT NULL UNIQUE,
  password_hash NVARCHAR(200) NOT NULL,
  display_name NVARCHAR(200) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_teachers_schools FOREIGN KEY (school_id) REFERENCES schools(id)
);

CREATE TABLE students (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  school_id UNIQUEIDENTIFIER NOT NULL,
  external_id NVARCHAR(50) NULL,
  display_name NVARCHAR(200) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_students_schools FOREIGN KEY (school_id) REFERENCES schools(id)
);

CREATE TABLE tests (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  school_id UNIQUEIDENTIFIER NOT NULL,
  teacher_id UNIQUEIDENTIFIER NOT NULL,
  subject NVARCHAR(50) NOT NULL,
  class_level NVARCHAR(20) NOT NULL,
  board NVARCHAR(50) NOT NULL,
  test_date DATE NOT NULL,
  total_marks INT NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_tests_schools FOREIGN KEY (school_id) REFERENCES schools(id),
  CONSTRAINT FK_tests_teachers FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

CREATE TABLE questions (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  test_id UNIQUEIDENTIFIER NOT NULL,
  question_no INT NOT NULL,
  question_text NVARCHAR(MAX) NOT NULL,
  max_marks INT NOT NULL,
  solution_outline NVARCHAR(MAX) NOT NULL DEFAULT '',
  marking_rubric_json NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_questions_tests FOREIGN KEY (test_id) REFERENCES tests(id)
);

CREATE TABLE answer_scripts (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  test_id UNIQUEIDENTIFIER NOT NULL,
  student_id UNIQUEIDENTIFIER NULL,
  status NVARCHAR(30) NOT NULL,
  total_marks_awarded FLOAT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_scripts_tests FOREIGN KEY (test_id) REFERENCES tests(id),
  CONSTRAINT FK_scripts_students FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE answer_pages (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  script_id UNIQUEIDENTIFIER NOT NULL,
  page_no INT NOT NULL,
  blob_url NVARCHAR(1000) NOT NULL,
  mime_type NVARCHAR(200) NOT NULL,
  ocr_result_url NVARCHAR(1000) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_pages_scripts FOREIGN KEY (script_id) REFERENCES answer_scripts(id)
);

CREATE TABLE question_answers (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  script_id UNIQUEIDENTIFIER NOT NULL,
  question_id UNIQUEIDENTIFIER NOT NULL,
  answer_text NVARCHAR(MAX) NULL,
  answer_bounding_boxes_json NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_qas_scripts FOREIGN KEY (script_id) REFERENCES answer_scripts(id),
  CONSTRAINT FK_qas_questions FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE evaluations (
  id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  question_answer_id UNIQUEIDENTIFIER NOT NULL,
  marks_awarded FLOAT NOT NULL,
  max_marks FLOAT NOT NULL,
  confidence FLOAT NOT NULL,
  steps_json NVARCHAR(MAX) NOT NULL,
  feedback_en NVARCHAR(MAX) NOT NULL,
  feedback_hi NVARCHAR(MAX) NULL,
  error_tags_json NVARCHAR(MAX) NOT NULL,
  needs_manual_review BIT NOT NULL,
  model_name NVARCHAR(100) NOT NULL,
  raw_response_json NVARCHAR(MAX) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_evals_qas FOREIGN KEY (question_answer_id) REFERENCES question_answers(id)
);

