export type Role = 'admin' | 'student'

export interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: Role
  created_at: string
}

export interface Cohort {
  id: string
  name: string
  program_name: string
  description: string | null
  created_at: string
}

export interface CohortMember {
  cohort_id: string
  user_id: string
  joined_at: string
  profile?: Profile
}

export interface ZoomLecture {
  id: string
  cohort_id: string
  zoom_meeting_id: string
  title: string
  recording_url: string | null
  start_time: string | null
  duration: number | null
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

export interface Post {
  id: string
  cohort_id: string
  user_id: string
  title: string
  content: string
  category: string
  created_at: string
  profile?: Profile
  comment_count?: number
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
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
