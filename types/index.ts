export type Role = 'admin' | 'student'

export interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  bio: string | null
  phone: string | null
  role: Role
  created_at: string
}

export interface Cohort {
  id: string
  name: string
  program_name: string
  description: string | null
  slido_url: string | null
  kakao_url: string | null
  instagram_url: string | null
  created_at: string
}

export interface CohortMember {
  cohort_id: string
  user_id: string
  joined_at: string
  profile?: Profile
}

export interface Channel {
  id: string
  cohort_id: string
  name: string
  description: string | null
  order_index: number
  created_at: string
}

export interface ContentFolder {
  id: string
  cohort_id: string
  name: string
  order_index: number
  created_at: string
}

export interface ZoomLecture {
  id: string
  cohort_id: string
  zoom_meeting_id: string
  title: string
  recording_url: string | null
  start_time: string | null
  duration: number | null
  folder_id?: string | null
  created_at: string
}

export type SurveyQuestion =
  | { type: 'text'; label: string }
  | { type: 'rating'; label: string; max: number }
  | { type: 'choice'; label: string; options: string[] }

export interface Survey {
  id: string
  cohort_id: string
  title: string
  description: string | null
  questions: SurveyQuestion[]
  deadline: string | null
  folder_id?: string | null
  is_published: boolean
  created_at: string
}

export interface SurveyResponse {
  id: string
  survey_id: string
  user_id: string
  responses: Record<string, string | number>
  submitted_at: string
}

export interface Challenge {
  id: string
  cohort_id: string
  title: string
  description: string | null
  emoji: string
  start_at: string
  end_at: string
  is_closed: boolean
  created_at: string
  submission_count?: number
  user_submitted?: boolean
}

export interface ChallengeSubmission {
  id: string
  challenge_id: string
  user_id: string
  content: string | null
  submitted_at: string
  profile?: Profile
}

export interface PostAttachment {
  id: string
  post_id: string
  storage_path: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
  public_url?: string
  created_at: string
}

export interface Post {
  id: string
  cohort_id: string
  user_id: string
  title: string
  content: string
  category: string
  channel_id?: string | null
  is_pinned?: boolean
  type?: 'general' | 'notice'
  created_at: string
  profile?: Profile
  comment_count?: number
  likes_count?: number
  user_liked?: boolean
  star_count?: number
  clap_count?: number
  user_starred?: boolean
  user_clapped?: boolean
  attachments?: PostAttachment[]
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  parent_id: string | null
  profile?: Profile
}

export interface Assignment {
  id: string
  cohort_id: string
  title: string
  description: string | null
  deadline: string | null
  order_index: number
  is_published: boolean
  created_at: string
  submission_count?: number
  user_submitted?: boolean
  my_submission?: AssignmentSubmission | null
}

export interface AssignmentSubmission {
  id: string
  assignment_id: string
  user_id: string
  content: string | null
  submitted_at: string
  profile?: Profile
  attachments?: AssignmentAttachment[]
}

export interface AssignmentAttachment {
  id: string
  submission_id: string
  storage_path: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
  public_url?: string
  created_at: string
}

export interface PhotoAlbum {
  id: string
  cohort_id: string
  name: string
  description: string | null
  cover_path: string | null
  order_index: number
  created_at: string
  photo_count?: number
}

export interface Photo {
  id: string
  cohort_id: string
  user_id: string
  album_id: string | null
  storage_path: string
  caption: string | null
  created_at: string
  profile?: Profile
}

export interface Shortcut {
  id: string
  cohort_id: string
  label: string
  url: string
  color: string
  order: number
  created_at: string
}

export interface ChatbotFaq {
  id: string
  cohort_id: string
  question: string
  answer: string
  keywords: string[]
  order_index: number
  created_at: string
}

export interface MaterialAttachment {
  id: string
  material_id: string
  storage_path: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
  public_url?: string
  created_at: string
}

export interface Material {
  id: string
  cohort_id: string
  user_id: string | null
  title: string
  content: string | null
  created_at: string
  profile?: Profile | null
  attachments?: MaterialAttachment[]
}

export interface AttendanceSession {
  id: string
  cohort_id: string
  title: string
  type: 'offline' | 'zoom' | 'hybrid'
  session_date: string
  start_time: string
  end_time: string
  zoom_meeting_id: string | null
  created_at: string
}

export interface OfflineAttendance {
  id: string
  session_id: string
  user_id: string
  check_in: string | null
  check_out: string | null
  note: string | null
  created_at: string
  profile?: Profile
}

export interface Notification {
  id: string
  cohort_id: string
  user_id: string
  title: string
  body: string | null
  type: 'manual' | 'deadline' | 'community'
  related_id: string | null
  is_read: boolean
  created_at: string
  sender_id: string | null
  sender?: { name: string | null; avatar_url: string | null } | null
}
