import { User, Student, SubjectType, ScheduleItem, Homework, Submission, Leader, AuditLogEntry, SystemSettings } from '../types';
import { getTodayUlaanbaatar } from '../utils/dateUtils';

const today = getTodayUlaanbaatar();

export const INITIAL_SETTINGS: SystemSettings = {
  mode: 'DEMO',
  gasWebAppUrl: '',
  sheetId: '1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM',
  schoolName: 'ЕБС-ийн 1-р сургууль',
  termName: '2026 оны Хаврын улирал',
  lastSyncAt: null,
};

export const INITIAL_USERS: User[] = [
  {
    userId: 'u_teacher1',
    username: 'teacher1',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // admin password: admin / teacher
    role: 'TEACHER',
    active: true,
    displayName: 'Д. Энхжаргал (Математикийн багш)',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    userId: 'u_leader1',
    username: '10a-01',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    role: 'LEADER',
    studentId: 'std_01',
    active: true,
    displayName: 'Т. Болд-Эрдэнэ (1-р хэсгийн ахлагч)',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    userId: 'u_student1',
    username: '10a-02',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    role: 'STUDENT',
    studentId: 'std_02',
    active: true,
    displayName: 'Г. Батбаяр (10А Сурагч)',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    userId: 'u_student2',
    username: '10a-03',
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    role: 'STUDENT',
    studentId: 'std_03',
    active: true,
    displayName: 'С. Анужин (10А Сурагч)',
    createdAt: '2026-01-15T08:00:00Z',
  }
];

export const INITIAL_STUDENTS: Student[] = [
  {
    studentId: 'std_01',
    studentCode: '10A-01',
    fullName: 'Төмөр овогтой Болд-Эрдэнэ',
    classId: '10А',
    active: true,
    publicDisplayName: 'Болд-Эрдэнэ Т.',
    showOnLeaderboard: true,
  },
  {
    studentId: 'std_02',
    studentCode: '10A-02',
    fullName: 'Ганзориг овогтой Батбаяр',
    classId: '10А',
    active: true,
    publicDisplayName: 'Батбаяр Г.',
    showOnLeaderboard: true,
  },
  {
    studentId: 'std_03',
    studentCode: '10A-03',
    fullName: 'Сүхбат овогтой Анужин',
    classId: '10А',
    active: true,
    publicDisplayName: 'Анужин С.',
    showOnLeaderboard: true,
  },
  {
    studentId: 'std_04',
    studentCode: '10A-04',
    fullName: 'Батжаргал овогтой Тэмүүлэн',
    classId: '10А',
    active: true,
    publicDisplayName: 'Тэмүүлэн Б.',
    showOnLeaderboard: true,
  },
  {
    studentId: 'std_05',
    studentCode: '10A-05',
    fullName: 'Баттулга овогтой Номин-Эрдэнэ',
    classId: '10А',
    active: true,
    publicDisplayName: 'Номин-Эрдэнэ Б.',
    showOnLeaderboard: true,
  },
  {
    studentId: 'std_06',
    studentCode: '10A-06',
    fullName: 'Очирбат овогтой Цэлмэг',
    classId: '10А',
    active: true,
    publicDisplayName: 'Цэлмэг О.',
    showOnLeaderboard: true,
  },
  {
    studentId: 'std_07',
    studentCode: '10A-07',
    fullName: 'Алтансүх овогтой Мишээл',
    classId: '10А',
    active: true,
    publicDisplayName: 'Мишээл А.',
    showOnLeaderboard: true,
  },
  {
    studentId: 'std_08',
    studentCode: '10A-08',
    fullName: 'Эрдэнэбаатар овогтой Билгүүн',
    classId: '10А',
    active: true,
    publicDisplayName: 'Билгүүн Э.',
    showOnLeaderboard: true,
  },
  {
    studentId: 'std_09',
    studentCode: '10B-01',
    fullName: 'Баясгалан овогтой Саруул',
    classId: '10Б',
    active: true,
    publicDisplayName: 'Саруул Б.',
    showOnLeaderboard: true,
  },
  {
    studentId: 'std_10',
    studentCode: '10B-02',
    fullName: 'Дорж овогтой Мөнх-Оргил',
    classId: '10Б',
    active: true,
    publicDisplayName: 'Мөнх-Оргил Д.',
    showOnLeaderboard: true,
  }
];

export const INITIAL_SUBJECTS: SubjectType[] = [
  { subjectId: 'sub_math', name: 'Математик', code: 'МАТ', color: 'blue', defaultTeacher: 'Д. Энхжаргал', category: 'Үндсэн', active: true },
  { subjectId: 'sub_phys', name: 'Физик', code: 'ФИЗ', color: 'indigo', defaultTeacher: 'Б. Бат-Очир', category: 'Үндсэн', active: true },
  { subjectId: 'sub_mong', name: 'Монгол хэл', code: 'МОН', color: 'emerald', defaultTeacher: 'Ц. Сарантуяа', category: 'Үндсэн', active: true },
  { subjectId: 'sub_mong_lit', name: 'Уран зохиол', code: 'УЗО', color: 'teal', defaultTeacher: 'Ц. Сарантуяа', category: 'Үндсэн', active: true },
  { subjectId: 'sub_eng', name: 'Англи хэл', code: 'АНГ', color: 'violet', defaultTeacher: 'Г. Мөнхцэцэг', category: 'Үндсэн', active: true },
  { subjectId: 'sub_cs', name: 'Мэдээлэл зүй', code: 'МЗ', color: 'cyan', defaultTeacher: 'О. Тулга', category: 'Үндсэн', active: true },
  { subjectId: 'sub_chem', name: 'Хими', code: 'ХИМ', color: 'rose', defaultTeacher: 'П. Жаргалсайхан', category: 'Үндсэн', active: true },
  { subjectId: 'sub_bio', name: 'Биологи', code: 'БИО', color: 'green', defaultTeacher: 'С. Өлзийсайхан', category: 'Үндсэн', active: true },
  { subjectId: 'sub_hist', name: 'Түүх', code: 'ТҮҮ', color: 'amber', defaultTeacher: 'Х. Цогтбаатар', category: 'Үндсэн', active: true },
  { subjectId: 'sub_social', name: 'Нийгэм судлал', code: 'НИЙ', color: 'orange', defaultTeacher: 'Х. Цогтбаатар', category: 'Үндсэн', active: true },
  { subjectId: 'sub_geo', name: 'Газар зүй', code: 'ГАЗ', color: 'yellow', defaultTeacher: 'Ж. Бат-Эрдэнэ', category: 'Үндсэн', active: true },
  { subjectId: 'sub_pe', name: 'Биеийн тамир', code: 'БТА', color: 'red', defaultTeacher: 'Л. Чинбат', category: 'Спорт', active: true },
  { subjectId: 'sub_art', name: 'Дүрслэх урлаг', code: 'ДУР', color: 'pink', defaultTeacher: 'М. Нарантуяа', category: 'Урлаг', active: true },
  { subjectId: 'sub_tech', name: 'Технологи', code: 'ТЕХ', color: 'slate', defaultTeacher: 'Б. Баасандорж', category: 'Технологи', active: true },
];

export const INITIAL_SCHEDULE: ScheduleItem[] = [
  // Даваа (Monday)
  { scheduleId: 'sch_1', classId: '10А', weekday: 1, period: 1, subjectId: 'sub_math', subjectName: 'Математик', teacherName: 'Д. Энхжаргал', startTime: '08:00', endTime: '08:45', active: true, notes: '102 тоот' },
  { scheduleId: 'sch_2', classId: '10А', weekday: 1, period: 2, subjectId: 'sub_phys', subjectName: 'Физик', teacherName: 'Б. Бат-Очир', startTime: '08:50', endTime: '09:35', active: true, notes: 'Физикийн лаборатори' },
  { scheduleId: 'sch_3', classId: '10А', weekday: 1, period: 3, subjectId: 'sub_mong', subjectName: 'Монгол хэл', teacherName: 'Ц. Сарантуяа', startTime: '09:45', endTime: '10:30', active: true, notes: '204 тоот' },
  { scheduleId: 'sch_4', classId: '10А', weekday: 1, period: 4, subjectId: 'sub_eng', subjectName: 'Англи хэл', teacherName: 'Г. Мөнхцэцэг', startTime: '10:40', endTime: '11:25', active: true, notes: '301 тоот' },
  { scheduleId: 'sch_5', classId: '10А', weekday: 1, period: 5, subjectId: 'sub_cs', subjectName: 'Мэдээлэл зүй', teacherName: 'О. Тулга', startTime: '11:35', endTime: '12:20', active: true, notes: 'Компьютерийн өрөө' },
  
  // Мягмар (Tuesday)
  { scheduleId: 'sch_6', classId: '10А', weekday: 2, period: 1, subjectId: 'sub_chem', subjectName: 'Хими', teacherName: 'П. Жаргалсайхан', startTime: '08:00', endTime: '08:45', active: true, notes: 'Химийн лаборатори' },
  { scheduleId: 'sch_7', classId: '10А', weekday: 2, period: 2, subjectId: 'sub_math', subjectName: 'Математик', teacherName: 'Д. Энхжаргал', startTime: '08:50', endTime: '09:35', active: true, notes: '102 тоот' },
  { scheduleId: 'sch_8', classId: '10А', weekday: 2, period: 3, subjectId: 'sub_hist', subjectName: 'Түүх', teacherName: 'Х. Цогтбаатар', startTime: '09:45', endTime: '10:30', active: true, notes: '205 тоот' },
  { scheduleId: 'sch_9', classId: '10А', weekday: 2, period: 4, subjectId: 'sub_bio', subjectName: 'Биологи', teacherName: 'С. Өлзийсайхан', startTime: '10:40', endTime: '11:25', active: true, notes: '208 тоот' },

  // Лхагва (Wednesday)
  { scheduleId: 'sch_10', classId: '10А', weekday: 3, period: 1, subjectId: 'sub_mong_lit', subjectName: 'Уран зохиол', teacherName: 'Ц. Сарантуяа', startTime: '08:00', endTime: '08:45', active: true, notes: '204 тоот' },
  { scheduleId: 'sch_11', classId: '10А', weekday: 3, period: 2, subjectId: 'sub_math', subjectName: 'Математик', teacherName: 'Д. Энхжаргал', startTime: '08:50', endTime: '09:35', active: true, notes: '102 тоот' },
  { scheduleId: 'sch_12', classId: '10А', weekday: 3, period: 3, subjectId: 'sub_eng', subjectName: 'Англи хэл', teacherName: 'Г. Мөнхцэцэг', startTime: '09:45', endTime: '10:30', active: true, notes: '301 тоот' },
  { scheduleId: 'sch_13', classId: '10А', weekday: 3, period: 4, subjectId: 'sub_phys', subjectName: 'Физик', teacherName: 'Б. Бат-Очир', startTime: '10:40', endTime: '11:25', active: true, notes: 'Физикийн лаборатори' },

  // Пүрэв (Thursday)
  { scheduleId: 'sch_14', classId: '10А', weekday: 4, period: 1, subjectId: 'sub_geo', subjectName: 'Газар зүй', teacherName: 'Ж. Бат-Эрдэнэ', startTime: '08:00', endTime: '08:45', active: true, notes: '106 тоот' },
  { scheduleId: 'sch_15', classId: '10А', weekday: 4, period: 2, subjectId: 'sub_cs', subjectName: 'Мэдээлэл зүй', teacherName: 'О. Тулга', startTime: '08:50', endTime: '09:35', active: true, notes: 'Компьютерийн өрөө' },
  { scheduleId: 'sch_16', classId: '10А', weekday: 4, period: 3, subjectId: 'sub_social', subjectName: 'Нийгэм судлал', teacherName: 'Х. Цогтбаатар', startTime: '09:45', endTime: '10:30', active: true, notes: '205 тоот' },

  // Баасан (Friday)
  { scheduleId: 'sch_17', classId: '10А', weekday: 5, period: 1, subjectId: 'sub_math', subjectName: 'Математик', teacherName: 'Д. Энхжаргал', startTime: '08:00', endTime: '08:45', active: true, notes: '102 тоот' },
  { scheduleId: 'sch_18', classId: '10А', weekday: 5, period: 2, subjectId: 'sub_eng', subjectName: 'Англи хэл', teacherName: 'Г. Мөнхцэцэг', startTime: '08:50', endTime: '09:35', active: true, notes: '301 тоот' },
  { scheduleId: 'sch_19', classId: '10А', weekday: 5, period: 3, subjectId: 'sub_pe', subjectName: 'Биеийн тамир', teacherName: 'Л. Чинбат', startTime: '09:45', endTime: '10:30', active: true, notes: 'Спорт заал' },
];

export const INITIAL_HOMEWORK: Homework[] = [
  {
    homeworkId: 'hw_01',
    classId: '10А',
    subjectId: 'sub_math',
    subjectName: 'Математик',
    title: 'Тригонометрийн адилтгалууд бодох',
    description: 'Сурах бичгийн хуудас 78, бодлого 14-22 хүртэлх бодолтыг дэвтэрт бүрэн гүйцэтгэх.',
    assignedDate: today,
    dueDate: today,
    createdBy: 'u_teacher1',
    status: 'ACTIVE',
    createdAt: `${today}T08:00:00Z`
  },
  {
    homeworkId: 'hw_02',
    classId: '10А',
    subjectId: 'sub_phys',
    subjectName: 'Физик',
    title: 'Ньютоны 2-р хуулийн лабораторийн тооцоолол',
    description: 'Хүчний векторуудын тэнцвэрийн график зураглал болон алдааны тооцоог тайланд бичих.',
    assignedDate: today,
    dueDate: today,
    createdBy: 'u_teacher1',
    status: 'ACTIVE',
    createdAt: `${today}T08:50:00Z`
  },
  {
    homeworkId: 'hw_03',
    classId: '10А',
    subjectId: 'sub_eng',
    subjectName: 'Англи хэл',
    title: '5-р бүлэг: Байгаль орчны эсээ',
    description: 'Цэвэр эрчим хүч, хотын ногоон шийдлийн талаар 150 үгтэй эсээ дэвтэртээ бичих.',
    assignedDate: today,
    dueDate: today,
    createdBy: 'u_teacher1',
    status: 'ACTIVE',
    createdAt: `${today}T09:45:00Z`
  },
  {
    homeworkId: 'hw_04',
    classId: '10А',
    subjectId: 'sub_mong',
    subjectName: 'Монгол хэл',
    title: 'Уран зохиолын эх бичвэрийн задлал',
    description: 'Эх зохиолын хэл найруулга, дүрслэх ур маягийн 5 онцлогийг тэмдэглэл болгон бичих.',
    assignedDate: today,
    dueDate: today,
    createdBy: 'u_teacher1',
    status: 'ACTIVE',
    createdAt: `${today}T10:00:00Z`
  }
];

export const INITIAL_SUBMISSIONS: Submission[] = [
  // hw_01 (Математик)
  {
    submissionId: 'subm_101',
    homeworkId: 'hw_01',
    studentId: 'std_01',
    status: 'DONE',
    submittedAt: `${today}T14:30:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T16:00:00Z`,
    teacherComment: 'Бодолт цэвэр, бүх хариу зөв байна. Сайн байна!',
    updatedAt: `${today}T16:00:00Z`
  },
  {
    submissionId: 'subm_102',
    homeworkId: 'hw_01',
    studentId: 'std_02',
    status: 'DONE',
    submittedAt: `${today}T15:10:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T16:10:00Z`,
    teacherComment: '18-р бодлогын тэмдгийн алдааг анхаараарай. Бусад нь сайн.',
    updatedAt: `${today}T16:10:00Z`
  },
  {
    submissionId: 'subm_103',
    homeworkId: 'hw_01',
    studentId: 'std_03',
    status: 'DONE',
    submittedAt: `${today}T13:45:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T16:15:00Z`,
    teacherComment: 'Онцсайн гүйцэтгэл!',
    updatedAt: `${today}T16:15:00Z`
  },
  {
    submissionId: 'subm_104',
    homeworkId: 'hw_01',
    studentId: 'std_04',
    status: 'SUBMITTED_FOR_REVIEW',
    submittedAt: `${today}T17:00:00Z`,
    studentNote: 'Багшаа 21-р бодлогыг 2 янзаар бодсон шүү.',
    updatedAt: `${today}T17:00:00Z`
  },
  {
    submissionId: 'subm_105',
    homeworkId: 'hw_01',
    studentId: 'std_05',
    status: 'IN_PROGRESS',
    updatedAt: `${today}T12:00:00Z`
  },
  {
    submissionId: 'subm_106',
    homeworkId: 'hw_01',
    studentId: 'std_06',
    status: 'LATE',
    submittedAt: `${today}T18:30:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T19:00:00Z`,
    teacherComment: 'Хугацаа хоцорсон тул анхаарна уу.',
    updatedAt: `${today}T19:00:00Z`
  },
  {
    submissionId: 'subm_107',
    homeworkId: 'hw_01',
    studentId: 'std_07',
    status: 'NOT_DONE',
    updatedAt: `${today}T12:00:00Z`
  },
  {
    submissionId: 'subm_108',
    homeworkId: 'hw_01',
    studentId: 'std_08',
    status: 'DONE',
    submittedAt: `${today}T14:00:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T16:20:00Z`,
    teacherComment: 'Сайн байна.',
    updatedAt: `${today}T16:20:00Z`
  },

  // hw_02 (Физик)
  {
    submissionId: 'subm_201',
    homeworkId: 'hw_02',
    studentId: 'std_01',
    status: 'DONE',
    submittedAt: `${today}T15:00:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T17:00:00Z`,
    teacherComment: 'Лабораторийн график маш сайн зурагдсан.',
    updatedAt: `${today}T17:00:00Z`
  },
  {
    submissionId: 'subm_202',
    homeworkId: 'hw_02',
    studentId: 'std_02',
    status: 'DONE',
    submittedAt: `${today}T15:40:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T17:05:00Z`,
    teacherComment: 'Сайн байна.',
    updatedAt: `${today}T17:05:00Z`
  },
  {
    submissionId: 'subm_203',
    homeworkId: 'hw_02',
    studentId: 'std_03',
    status: 'DONE',
    submittedAt: `${today}T14:10:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T17:10:00Z`,
    teacherComment: 'Маш сайн.',
    updatedAt: `${today}T17:10:00Z`
  },
  {
    submissionId: 'subm_204',
    homeworkId: 'hw_02',
    studentId: 'std_04',
    status: 'IN_PROGRESS',
    updatedAt: `${today}T13:00:00Z`
  },
  {
    submissionId: 'subm_205',
    homeworkId: 'hw_02',
    studentId: 'std_05',
    status: 'DONE',
    submittedAt: `${today}T16:00:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T17:20:00Z`,
    teacherComment: 'Тооцоолол зөв.',
    updatedAt: `${today}T17:20:00Z`
  },
  {
    submissionId: 'subm_206',
    homeworkId: 'hw_02',
    studentId: 'std_06',
    status: 'NOT_DONE',
    updatedAt: `${today}T12:00:00Z`
  },
  {
    submissionId: 'subm_207',
    homeworkId: 'hw_02',
    studentId: 'std_07',
    status: 'NOT_DONE',
    updatedAt: `${today}T12:00:00Z`
  },
  {
    submissionId: 'subm_208',
    homeworkId: 'hw_02',
    studentId: 'std_08',
    status: 'DONE',
    submittedAt: `${today}T16:10:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T17:30:00Z`,
    teacherComment: 'Хэвийн байна.',
    updatedAt: `${today}T17:30:00Z`
  },

  // hw_03 (Англи хэл)
  {
    submissionId: 'subm_301',
    homeworkId: 'hw_03',
    studentId: 'std_01',
    status: 'DONE',
    submittedAt: `${today}T16:30:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T18:00:00Z`,
    teacherComment: 'Great vocabulary and argument structure.',
    updatedAt: `${today}T18:00:00Z`
  },
  {
    submissionId: 'subm_302',
    homeworkId: 'hw_03',
    studentId: 'std_02',
    status: 'SUBMITTED_FOR_REVIEW',
    submittedAt: `${today}T18:00:00Z`,
    studentNote: 'Essay attached.',
    updatedAt: `${today}T18:00:00Z`
  },
  {
    submissionId: 'subm_303',
    homeworkId: 'hw_03',
    studentId: 'std_03',
    status: 'DONE',
    submittedAt: `${today}T15:20:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T18:05:00Z`,
    teacherComment: 'Маш сайн бичсэн байна!',
    updatedAt: `${today}T18:05:00Z`
  },
  {
    submissionId: 'subm_304',
    homeworkId: 'hw_03',
    studentId: 'std_05',
    status: 'DONE',
    submittedAt: `${today}T16:50:00Z`,
    checkedBy: 'u_teacher1',
    checkedAt: `${today}T18:10:00Z`,
    teacherComment: 'Сайн байна.',
    updatedAt: `${today}T18:10:00Z`
  }
];

export const INITIAL_LEADERS: Leader[] = [
  {
    leaderId: 'lead_01',
    userId: 'u_leader1',
    classId: '10А',
    assignedBy: 'u_teacher1',
    active: true,
    createdAt: '2026-01-15T08:00:00Z'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    logId: 'log_01',
    userId: 'u_teacher1',
    userName: 'Д. Энхжаргал',
    action: 'CREATE',
    targetType: 'HOMEWORK',
    targetId: 'hw_01',
    timestamp: `${today} 08:05:12`,
    details: '10А ангид Математикийн шинэ даалгавар үүсгэсэн.'
  },
  {
    logId: 'log_02',
    userId: 'u_teacher1',
    userName: 'Д. Энхжаргал',
    action: 'ASSIGN_LEADER',
    targetType: 'LEADER',
    targetId: 'lead_01',
    timestamp: `${today} 08:10:30`,
    details: 'Т. Болд-Эрдэнэ сурагчид 10А ангийн хэсгийн ахлагчийн эрх олгов.'
  },
  {
    logId: 'log_03',
    userId: 'u_leader1',
    userName: 'Т. Болд-Эрдэнэ',
    action: 'UPDATE_STATUS',
    targetType: 'SUBMISSION',
    targetId: 'hw_01',
    timestamp: `${today} 14:35:45`,
    details: '10А ангийн сурагчдын даалгаврын гүйцэтгэлийг анхан шатанд бүртгэв.'
  },
  {
    logId: 'log_04',
    userId: 'u_teacher1',
    userName: 'Д. Энхжаргал',
    action: 'VERIFY_SUBMISSION',
    targetType: 'SUBMISSION',
    targetId: 'subm_101',
    timestamp: `${today} 16:00:15`,
    details: 'Сурагч Т. Болд-Эрдэнийн Математикийн даалгаврыг шалгаж баталгаажуулсан.'
  }
];
