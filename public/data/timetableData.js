// Timetable Data for Saranathan College of Engineering (Autonomous)
// Department of Computer Science and Engineering
// Batch: 2026-27 ODD Semester (I Year) - Branch: CSE - A | Hall: RV 402
// Source: Screenshot 2026-09-16 192313.png

export const appSettingsData = {
  id: 'default',
  college_name: 'Saranathan College of Engineering (Autonomous)',
  city: 'Tiruchirappalli - 620 012',
  department: 'Department of Computer Science and Engineering',
  semester: 'I',
  section: 'A',
  hall: 'RV 402',
  class_coordinator: 'Dr. R. Buvaneswari (Maths)',
  mentors: 'Mr. L. Parthipan, Ms. A. Rachel Roselin Arul, Ms. G. Sathya',
  timezone: 'Asia/Kolkata',
  college_start_time: '09:10',
  college_end_time: '16:45',
  anchor_date: '2026-09-17',
  anchor_day_order: 1
};

export const subjectsData = {
  '24EN101A': {
    code: '24EN101A',
    name: 'Professional English',
    faculty: 'Dr. A. Lakshmi (Eng)',
    department: 'English',
    hours: 4,
    type: 'theory',
    color: '#0284c7' // sky blue
  },
  '24MA101A': {
    code: '24MA101A',
    name: 'Engineering Mathematics I',
    faculty: 'Dr. R. Buvaneswari (Mat)',
    department: 'Mathematics',
    hours: 5,
    type: 'theory',
    color: '#8b5cf6' // purple
  },
  '24PH101A': {
    code: '24PH101A',
    name: 'Engineering Physics I',
    faculty: 'Dr. M. Murali (Phy)',
    department: 'Physics',
    hours: 5,
    type: 'theory',
    color: '#10b981' // emerald
  },
  '24CH101A': {
    code: '24CH101A',
    name: 'Engineering Chemistry I',
    faculty: 'Dr. G. Thulasi (Che)',
    department: 'Chemistry',
    hours: 5,
    type: 'theory',
    color: '#f59e0b' // amber
  },
  '24ES101A': {
    code: '24ES101A',
    name: 'Problem Solving and Python Programming',
    faculty: 'Ms. P. Rohini (CSE)',
    department: 'CSE',
    hours: 5,
    type: 'theory',
    color: '#06b6d4' // cyan
  },
  '24ES102A': {
    code: '24ES102A',
    name: 'Engineering Graphics',
    faculty: 'Mr. P. Vigneshwar (Mech) & Dr. G. Mahesh (Mech)',
    department: 'Mechanical',
    hours: 6,
    type: 'practical',
    color: '#ec4899' // pink
  },
  '24TA101A': {
    code: '24TA101A',
    name: 'Heritage of Tamils',
    faculty: 'Dr. M. Thangam (Tam)',
    department: 'Tamil',
    hours: 1,
    type: 'theory',
    color: '#d97706' // ochre
  },
  '24PH111A': {
    code: '24PH111A',
    name: 'Physics / Chemistry Laboratory',
    faculty: 'Dr. M. Murali (Phy), Dr. Nivetha G.F (Phy), Dr. R. Mariappan (Phy) / Dr. G. Thulasi (Che), Dr. L. Muruganandam (Che), Mr. A. Lakshmanan (Che)',
    department: 'Science Labs',
    hours: 3,
    type: 'lab',
    color: '#14b8a6' // teal
  },
  '24ES111A': {
    code: '24ES111A',
    name: 'Python Programming Laboratory',
    faculty: 'Ms. P. Rohini (CSE), Mr. L. Parthipan (CSE)',
    department: 'CSE',
    hours: 3,
    type: 'lab',
    color: '#3b82f6' // royal blue
  },
  '24EM111A': {
    code: '24EM111A',
    name: 'Communication Laboratory I',
    faculty: 'Dr. A. Lakshmi (Eng)',
    department: 'English',
    hours: 2,
    type: 'lab',
    color: '#6366f1' // indigo
  },
  '24MA101A(T)': {
    code: '24MA101A(T)',
    name: 'Engineering Mathematics I (Tutorial)',
    faculty: 'Dr. R. Buvaneswari (Mat), Dr. N. Subashini (Mat)',
    department: 'Mathematics',
    hours: 1,
    type: 'tutorial',
    color: '#a855f7' // violet
  }
};

// Complete Day Orders 1 to 5 periods with standard college break and lunch intervals
export const dayOrderTimetables = {
  1: [
    {
      period: 1,
      label: 'Period 1',
      start: '09:10',
      end: '10:00',
      subjectCode: '24ES101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 2,
      label: 'Period 2',
      start: '10:00',
      end: '10:50',
      subjectCode: '24PH101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 0,
      label: 'Morning Break',
      start: '10:50',
      end: '11:05',
      subjectCode: null,
      subjectName: 'Morning Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 3,
      label: 'Period 3',
      start: '11:05',
      end: '11:55',
      subjectCode: '24CH101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 4,
      label: 'Period 4',
      start: '11:55',
      end: '12:45',
      subjectCode: '24MA101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 0,
      label: 'Lunch Break',
      start: '12:45',
      end: '13:30',
      subjectCode: null,
      subjectName: 'Lunch Break',
      faculty: '-',
      room: 'Food Court / Dining Hall',
      type: 'lunch'
    },
    {
      period: 5,
      label: 'Period 5',
      start: '13:30',
      end: '14:15',
      subjectCode: '24ES101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 6,
      label: 'Period 6',
      start: '14:15',
      end: '15:00',
      subjectCode: '24MA101A(T)',
      room: 'RV 402',
      type: 'tutorial'
    },
    {
      period: 0,
      label: 'Afternoon Break',
      start: '15:00',
      end: '15:15',
      subjectCode: null,
      subjectName: 'Tea & Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 7,
      label: 'Period 7',
      start: '15:15',
      end: '16:00',
      subjectCode: '24EM111A',
      room: 'Communication Lab',
      type: 'lab',
      spansNext: true
    },
    {
      period: 8,
      label: 'Period 8',
      start: '16:00',
      end: '16:45',
      subjectCode: '24EM111A',
      room: 'Communication Lab',
      type: 'lab'
    }
  ],

  2: [
    {
      period: 1,
      label: 'Period 1',
      start: '09:10',
      end: '10:00',
      subjectCode: '24MA101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 2,
      label: 'Period 2',
      start: '10:00',
      end: '10:50',
      subjectCode: '24EN101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 0,
      label: 'Morning Break',
      start: '10:50',
      end: '11:05',
      subjectCode: null,
      subjectName: 'Morning Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 3,
      label: 'Period 3',
      start: '11:05',
      end: '11:55',
      subjectCode: '24PH101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 4,
      label: 'Period 4',
      start: '11:55',
      end: '12:45',
      subjectCode: '24CH101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 0,
      label: 'Lunch Break',
      start: '12:45',
      end: '13:30',
      subjectCode: null,
      subjectName: 'Lunch Break',
      faculty: '-',
      room: 'Food Court / Dining Hall',
      type: 'lunch'
    },
    {
      period: 5,
      label: 'Period 5',
      start: '13:30',
      end: '14:15',
      subjectCode: '24TA101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 6,
      label: 'Period 6',
      start: '14:15',
      end: '15:00',
      subjectCode: '24ES102A',
      room: 'Graphics Hall',
      type: 'practical',
      spansNext: true
    },
    {
      period: 0,
      label: 'Afternoon Break',
      start: '15:00',
      end: '15:15',
      subjectCode: null,
      subjectName: 'Tea & Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 7,
      label: 'Period 7',
      start: '15:15',
      end: '16:00',
      subjectCode: '24ES102A',
      room: 'Graphics Hall',
      type: 'practical',
      spansNext: true
    },
    {
      period: 8,
      label: 'Period 8',
      start: '16:00',
      end: '16:45',
      subjectCode: '24ES102A',
      room: 'Graphics Hall',
      type: 'practical'
    }
  ],

  3: [
    {
      period: 1,
      label: 'Period 1',
      start: '09:10',
      end: '10:00',
      subjectCode: '24CH101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 2,
      label: 'Period 2',
      start: '10:00',
      end: '10:50',
      subjectCode: '24PH101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 0,
      label: 'Morning Break',
      start: '10:50',
      end: '11:05',
      subjectCode: null,
      subjectName: 'Morning Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 3,
      label: 'Period 3',
      start: '11:05',
      end: '11:55',
      subjectCode: '24ES101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 4,
      label: 'Period 4',
      start: '11:55',
      end: '12:45',
      subjectCode: '24EN101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 0,
      label: 'Lunch Break',
      start: '12:45',
      end: '13:30',
      subjectCode: null,
      subjectName: 'Lunch Break',
      faculty: '-',
      room: 'Food Court / Dining Hall',
      type: 'lunch'
    },
    {
      period: 5,
      label: 'Period 5',
      start: '13:30',
      end: '14:15',
      subjectCode: '24CH101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 6,
      label: 'Period 6',
      start: '14:15',
      end: '15:00',
      subjectCode: '24PH111A',
      room: 'Physics / Chemistry Lab',
      type: 'lab',
      spansNext: true
    },
    {
      period: 0,
      label: 'Afternoon Break',
      start: '15:00',
      end: '15:15',
      subjectCode: null,
      subjectName: 'Tea & Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 7,
      label: 'Period 7',
      start: '15:15',
      end: '16:00',
      subjectCode: '24PH111A',
      room: 'Physics / Chemistry Lab',
      type: 'lab',
      spansNext: true
    },
    {
      period: 8,
      label: 'Period 8',
      start: '16:00',
      end: '16:45',
      subjectCode: '24PH111A',
      room: 'Physics / Chemistry Lab',
      type: 'lab'
    }
  ],

  4: [
    {
      period: 1,
      label: 'Period 1',
      start: '09:10',
      end: '10:00',
      subjectCode: '24MA101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 2,
      label: 'Period 2',
      start: '10:00',
      end: '10:50',
      subjectCode: '24ES111A',
      room: 'Python Lab',
      type: 'lab',
      spansNext: true
    },
    {
      period: 0,
      label: 'Morning Break',
      start: '10:50',
      end: '11:05',
      subjectCode: null,
      subjectName: 'Morning Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 3,
      label: 'Period 3',
      start: '11:05',
      end: '11:55',
      subjectCode: '24ES111A',
      room: 'Python Lab',
      type: 'lab',
      spansNext: true
    },
    {
      period: 4,
      label: 'Period 4',
      start: '11:55',
      end: '12:45',
      subjectCode: '24ES111A',
      room: 'Python Lab',
      type: 'lab'
    },
    {
      period: 0,
      label: 'Lunch Break',
      start: '12:45',
      end: '13:30',
      subjectCode: null,
      subjectName: 'Lunch Break',
      faculty: '-',
      room: 'Food Court / Dining Hall',
      type: 'lunch'
    },
    {
      period: 5,
      label: 'Period 5',
      start: '13:30',
      end: '14:15',
      subjectCode: '24ES101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 6,
      label: 'Period 6',
      start: '14:15',
      end: '15:00',
      subjectCode: '24MA101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 0,
      label: 'Afternoon Break',
      start: '15:00',
      end: '15:15',
      subjectCode: null,
      subjectName: 'Tea & Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 7,
      label: 'Period 7',
      start: '15:15',
      end: '16:00',
      subjectCode: '24EN101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 8,
      label: 'Period 8',
      start: '16:00',
      end: '16:45',
      subjectCode: '24PH101A',
      room: 'RV 402',
      type: 'lecture'
    }
  ],

  5: [
    {
      period: 1,
      label: 'Period 1',
      start: '09:10',
      end: '10:00',
      subjectCode: '24PH101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 2,
      label: 'Period 2',
      start: '10:00',
      end: '10:50',
      subjectCode: '24ES102A',
      room: 'Graphics Hall',
      type: 'practical',
      spansNext: true
    },
    {
      period: 0,
      label: 'Morning Break',
      start: '10:50',
      end: '11:05',
      subjectCode: null,
      subjectName: 'Morning Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 3,
      label: 'Period 3',
      start: '11:05',
      end: '11:55',
      subjectCode: '24ES102A',
      room: 'Graphics Hall',
      type: 'practical',
      spansNext: true
    },
    {
      period: 4,
      label: 'Period 4',
      start: '11:55',
      end: '12:45',
      subjectCode: '24ES102A',
      room: 'Graphics Hall',
      type: 'practical'
    },
    {
      period: 0,
      label: 'Lunch Break',
      start: '12:45',
      end: '13:30',
      subjectCode: null,
      subjectName: 'Lunch Break',
      faculty: '-',
      room: 'Food Court / Dining Hall',
      type: 'lunch'
    },
    {
      period: 5,
      label: 'Period 5',
      start: '13:30',
      end: '14:15',
      subjectCode: '24EN101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 6,
      label: 'Period 6',
      start: '14:15',
      end: '15:00',
      subjectCode: '24MA101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 0,
      label: 'Afternoon Break',
      start: '15:00',
      end: '15:15',
      subjectCode: null,
      subjectName: 'Tea & Refreshment Break',
      faculty: '-',
      room: 'Campus',
      type: 'break'
    },
    {
      period: 7,
      label: 'Period 7',
      start: '15:15',
      end: '16:00',
      subjectCode: '24CH101A',
      room: 'RV 402',
      type: 'lecture'
    },
    {
      period: 8,
      label: 'Period 8',
      start: '16:00',
      end: '16:45',
      subjectCode: '24ES101A',
      room: 'RV 402',
      type: 'lecture'
    }
  ]
};
