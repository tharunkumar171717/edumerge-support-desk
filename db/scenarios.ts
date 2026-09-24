import type { Category, Priority, Role, Team } from "../src/lib/domain/types";

export interface SeedUser {
  name: string;
  email: string;
  role: Role;
  team?: Team;
  rollNo?: string;
}

export const USERS: SeedUser[] = [
  { name: "Dr. Meera Krishnan", email: "dean@demo-college.edu", role: "MANAGER" },
  { name: "Ramesh Iyer", email: "ramesh.accounts@demo-college.edu", role: "STAFF", team: "ACCOUNTS" },
  { name: "Lakshmi Nair", email: "lakshmi.accounts@demo-college.edu", role: "STAFF", team: "ACCOUNTS" },
  { name: "Priya Deshmukh", email: "priya.academics@demo-college.edu", role: "STAFF", team: "ACADEMICS" },
  { name: "Anil Kumar", email: "anil.admin@demo-college.edu", role: "STAFF", team: "ADMIN_OFFICE" },
  { name: "Kavya Reddy", email: "kavya.admin@demo-college.edu", role: "STAFF", team: "ADMIN_OFFICE" },
  { name: "Suresh Rao", email: "suresh.exams@demo-college.edu", role: "STAFF", team: "EXAMS" },
  { name: "Aarav Sharma", email: "aarav@students.demo-college.edu", role: "STUDENT", rollNo: "22BCS014" },
  { name: "Diya Patel", email: "diya@students.demo-college.edu", role: "STUDENT", rollNo: "22BCS027" },
  { name: "Rohan Gupta", email: "rohan@students.demo-college.edu", role: "STUDENT", rollNo: "23BEC009" },
  { name: "Ananya Iyer", email: "ananya@students.demo-college.edu", role: "STUDENT", rollNo: "22BME031" },
  { name: "Vikram Singh", email: "vikram@students.demo-college.edu", role: "STUDENT", rollNo: "24LBCS003" },
  { name: "Sneha Reddy", email: "sneha@students.demo-college.edu", role: "STUDENT", rollNo: "23BCS052" },
  { name: "Karthik Menon", email: "karthik@students.demo-college.edu", role: "STUDENT", rollNo: "22BEE018" },
  { name: "Fatima Shaikh", email: "fatima@students.demo-college.edu", role: "STUDENT", rollNo: "23BCE044" },
];

// `at` values are hours before "now" at seed time.
export type Step =
  | { at: number; do: "start" | "close" }
  | { at: number; do: "comment" | "internal" | "requestInfo" | "reply" | "resolve" | "reopen" | "cancel"; text: string }
  | { at: number; do: "priority"; priority: Priority; text: string }
  | { at: number; do: "assign"; to: string }
  | { at: number; do: "pickUp"; by: string };

export interface Scenario {
  student: string;
  category: Category;
  subject: string;
  description: string;
  created: number;
  neededInDays?: number;
  steps?: Step[];
}

// Suresh (the only Examination Cell staff member) is on leave between these hours.
export const EXAMS_LEAVE = { from: 60, to: 20, who: "Suresh Rao" };

const s = (student: string, category: Category, subject: string, description: string, created: number, steps: Step[] = [], neededInDays?: number): Scenario =>
  ({ student, category, subject, description, created, steps, neededInDays });

export const SCENARIOS: Scenario[] = [
  s("Aarav Sharma", "FEES", "Fee receipt for Semester 3 not generated", "I paid the Semester 3 tuition fee on 2 Sep through the portal (UPI) but no receipt was generated.", 330, [
    { at: 327, do: "start" }, { at: 320, do: "resolve", text: "Receipt regenerated and emailed to your college mail." }, { at: 300, do: "close" }]),
  s("Diya Patel", "ATTENDANCE", "Attendance marked absent on 12 Sep though present", "I was present for all periods on 12 Sep but the portal shows me absent for period 3.", 320, [
    { at: 318, do: "start" }, { at: 316, do: "requestInfo", text: "Please share the subject and faculty name for period 3." },
    { at: 290, do: "reply", text: "Period 3 was DBMS with Prof. Rao." }, { at: 280, do: "resolve", text: "Corrected after confirmation from Prof. Rao." }, { at: 270, do: "close" }]),
  s("Rohan Gupta", "ID_CARD", "Lost ID card, need replacement", "I lost my ID card in the college bus on Monday. I need a replacement for library and lab access.", 310, [
    { at: 300, do: "start" }, { at: 299, do: "comment", text: "Please pay the Rs 200 replacement fee at the accounts counter and share the receipt." },
    { at: 250, do: "resolve", text: "Replacement card issued; collect it from the admin office." }]),
  s("Ananya Iyer", "CERTIFICATES", "Bonafide certificate for bank loan", "I need a bonafide certificate for my education loan application at SBI.", 300, [
    { at: 299, do: "start" }, { at: 280, do: "resolve", text: "Certificate ready at the Examination Cell counter." }, { at: 270, do: "close" }]),
  s("Vikram Singh", "DOCUMENTS", "Need transfer certificate copy for scholarship", "The state scholarship portal asks for an attested copy of my transfer certificate.", 290, [
    { at: 285, do: "start" }, { at: 250, do: "resolve", text: "Attested copy handed over." }, { at: 240, do: "close" }]),
  s("Sneha Reddy", "FEES", "Late fee charged though paid before due date", "I paid on 5 Sep, before the 10 Sep due date, but a Rs 500 late fee was added.", 280, [
    { at: 262, do: "start" }, { at: 240, do: "resolve", text: "Late fee waived; the bank settlement was delayed on our side." }, { at: 230, do: "close" }]),
  s("Karthik Menon", "OTHER", "Wi-Fi login not working in hostel block C", "My hostel Wi-Fi login fails with 'invalid credentials' since the password reset.", 270, [
    { at: 250, do: "start" }, { at: 240, do: "resolve", text: "Account unlocked by the IT team." }]),
  s("Fatima Shaikh", "ATTENDANCE", "Medical leave not reflected in attendance", "I submitted a medical certificate for 3 days of leave but attendance still shows absent.", 260, [
    { at: 258, do: "start" }, { at: 257, do: "requestInfo", text: "Please upload a copy of the medical certificate here." },
    { at: 230, do: "reply", text: "Uploaded to the office by email today." }, { at: 200, do: "resolve", text: "Medical leave applied to all three days." }, { at: 190, do: "close" }]),
  s("Aarav Sharma", "CERTIFICATES", "Provisional degree certificate required for job offer", "My employer needs a provisional certificate before joining.", 250, [
    { at: 249, do: "priority", priority: "URGENT", text: "Offer letter deadline in two days" }, { at: 249, do: "start" },
    { at: 240, do: "resolve", text: "Provisional certificate issued." }, { at: 235, do: "close" }]),
  s("Diya Patel", "FEES", "Hostel fee paid twice, need refund", "Hostel fee got debited twice from my father's account on 1 Sep.", 240, [
    { at: 238, do: "start" }, { at: 237, do: "internal", text: "Checked with the bank: duplicate debit confirmed, refund needs principal's approval." },
    { at: 170, do: "resolve", text: "Refund of Rs 45,000 initiated to the source account." }, { at: 160, do: "close" }]),
  s("Rohan Gupta", "ID_CARD", "Name spelled wrong on ID card", "My name is printed as 'Rohan Gupata' on the ID card.", 230, [
    { at: 229, do: "cancel", text: "I will visit the office in person instead." }]),
  s("Ananya Iyer", "DOCUMENTS", "Original 12th marksheet to be returned", "I need my original 10th and 12th marksheets returned for a passport application.", 220, [
    { at: 210, do: "start" }, { at: 200, do: "resolve", text: "Originals returned." },
    { at: 190, do: "reopen", text: "Only the 12th marksheet was returned; the 10th is still with the office." },
    { at: 185, do: "start" }, { at: 170, do: "resolve", text: "10th marksheet located and returned." }, { at: 160, do: "close" }]),
  s("Vikram Singh", "ATTENDANCE", "On-duty for hackathon not updated in attendance", "I attended the Smart India Hackathon on 8-9 Sep with OD approval.", 200, [
    { at: 198, do: "start" }, { at: 190, do: "resolve", text: "OD applied for both days." }]),
  s("Sneha Reddy", "OTHER", "Library shows book overdue that I returned", "The library portal shows 'Operating Systems' overdue, but I returned it on 1 Sep.", 190, [
    { at: 170, do: "start" }, { at: 150, do: "resolve", text: "Library record corrected and fine removed." }, { at: 140, do: "close" }]),
  s("Karthik Menon", "FEES", "Need fee structure letter for education loan", "My bank needs the year-wise fee structure on letterhead.", 180, [
    { at: 179, do: "start" }, { at: 175, do: "resolve", text: "Letter issued." }, { at: 170, do: "close" }]),
  s("Fatima Shaikh", "CERTIFICATES", "Consolidated marks memo needed for higher studies", "Applying to universities abroad; need consolidated marks memo for semesters 1-4.", 170, [
    { at: 168, do: "start" }, { at: 150, do: "resolve", text: "Memo ready for collection." }]),
  s("Diya Patel", "FEES", "Refund for dropped hostel not received", "I vacated the hostel in August but the caution deposit refund hasn't come.", 110, [
    { at: 108, do: "start" }, { at: 90, do: "resolve", text: "Refund processed." },
    { at: 40, do: "reopen", text: "Amount has still not been credited to my account." }, { at: 38, do: "start" }]),
  s("Aarav Sharma", "FEES", "Scholarship amount not adjusted in fee balance", "The Rs 25,000 merit scholarship was sanctioned but my fee balance still shows the full amount.", 120, [
    { at: 110, do: "start" }, { at: 109, do: "internal", text: "Waiting on the scholarship cell to send the sanction list." }]),
  s("Ananya Iyer", "ATTENDANCE", "Attendance shortage warning in Data Structures is wrong", "I got a shortage warning for Data Structures (68%) but by my count I'm at 81%.", 100),
  s("Aarav Sharma", "CERTIFICATES", "Bonafide certificate for internship", "My internship at Infosys needs a bonafide certificate.", 70, [
    { at: 68, do: "start" }, { at: 62, do: "resolve", text: "Certificate signed; collect from the counter." }]),
  s("Karthik Menon", "FEES", "UPI payment debited but portal shows pending", "Paid the exam fee via UPI; money debited but portal still shows pending.", 70, [
    { at: 69, do: "start" }, { at: 68, do: "requestInfo", text: "Please share the UTR number and a screenshot of the debit." }]),
  s("Rohan Gupta", "CERTIFICATES", "Grade card correction for Semester 2", "My Semester 2 grade card shows 'AB' for Maths though I wrote the exam.", 65, [
    { at: 64, do: "start" }, { at: 18, do: "pickUp", by: "Suresh Rao" }, { at: 17, do: "start" }]),
  s("Vikram Singh", "DOCUMENTS", "Request for course completion letter", "I need a course completion letter for my lateral-entry diploma records.", 58, [{ at: 55, do: "start" }]),
  s("Diya Patel", "CERTIFICATES", "Bonafide certificate for passport application", "Passport office asked for a bonafide certificate as address proof.", 50),
  s("Rohan Gupta", "OTHER", "Request to change elective from Cloud Computing to IoT", "The HoD approved my elective change; please update it in the portal.", 45, [
    { at: 40, do: "start" }, { at: 20, do: "resolve", text: "Elective updated to IoT in the portal." }]),
  s("Sneha Reddy", "ID_CARD", "ID card photo is blurred, library scanner rejects it", "The library barcode scanner can't read my card; the photo and barcode are blurred.", 40, [
    { at: 30, do: "assign", to: "Kavya Reddy" }]),
  s("Rohan Gupta", "CERTIFICATES", "Revaluation result not updated in marks memo", "Revaluation raised my Physics marks from 38 to 52 but the memo is unchanged.", 30),
  s("Diya Patel", "DOCUMENTS", "Need attested copies of semester grade cards", "Need 3 attested copies of each grade card for a scholarship.", 30, [
    { at: 28, do: "start" }, { at: 10, do: "resolve", text: "Attested copies ready at counter 3." }]),
  s("Karthik Menon", "ATTENDANCE", "Attendance not updated after makeup class", "The makeup class on Saturday for Signals isn't reflected.", 26, [
    { at: 25, do: "start" }, { at: 24, do: "comment", text: "Checking with the faculty; will update by tomorrow." }]),
  s("Fatima Shaikh", "ATTENDANCE", "Biometric not recording my entry since last week", "The biometric device at gate 2 doesn't register my thumb since last Monday.", 20, [
    { at: 18, do: "start" }, { at: 17, do: "requestInfo", text: "Which gate and at what time do you usually enter?" }]),
  s("Karthik Menon", "DOCUMENTS", "Migration certificate submitted, need acknowledgement", "I submitted my migration certificate from Anna University; need an acknowledgement.", 12, [
    { at: 11, do: "start" }, { at: 11, do: "comment", text: "We'll verify with your previous university and share the acknowledgement." }]),
  s("Sneha Reddy", "ATTENDANCE", "Attendance for 18 Sep lab session missing", "The Networks lab on 18 Sep is missing from my attendance.", 10, [{ at: 9, do: "start" }]),
  s("Ananya Iyer", "FEES", "Exam fee challan not generating on portal", "The exam fee challan download fails with an error.", 6),
  s("Vikram Singh", "ID_CARD", "ID card not issued yet for lateral entry student", "Joined in 2nd year via lateral entry; ID card not issued yet.", 3),
  s("Fatima Shaikh", "OTHER", "Hostel room maintenance request not addressed", "The ceiling fan in room C-214 hasn't worked for a week; parents visiting soon.", 2, [], 1),
];
