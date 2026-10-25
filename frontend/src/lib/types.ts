export type Gender = 'der' | 'die' | 'das' | null

export interface DialogueTurn {
  who: string
  de: string
  en: string
}

export interface Item {
  /** stable slug */
  id: string
  slug: string
  deck: string
  kind: string
  de: string
  en: string
  alt_de: string[]
  gender: Gender
  plural: string | null
  register: 'formal' | 'informal' | 'neutral'
  region_tag: 'standard' | 'dach' | 'austria' | 'vienna' | 'recognition'
  learner_action: 'use_now' | 'recognise_now' | 'later'
  context: string
  likely_reply_de: string | null
  likely_reply_en: string | null
  austria_note: string | null
  mini_dialogue: DialogueTurn[]
  mission: string | null
  verify_source: string | null
  week: number
  cefr: Cefr
  status: string
  introduced: boolean
}

export type CardType = 'recognise' | 'produce' | 'reply'

export interface ReviewCard {
  id: number
  card_type: CardType
  state: number
  due: string
  item: Item
}

export interface Mission {
  id: number
  day: string
  item_id: string | null
  situation: string
  text: string
  status: 'planned' | 'done' | 'skipped'
  outcome: 'no_chance' | 'tried' | 'exchange' | 'conversation' | null
  reply_heard: string | null
  understood_reply: boolean | null
  switched_to_english: boolean | null
  notes: string | null
}

export interface Daily {
  day: string
  manzil: { due_now: number; reviewed_today: number; unlock_needed: number; unlocked: boolean }
  sabqi: Item[]
  sabaq: { new_items: Item[]; introduced_today: Item[]; done: boolean }
  bolna: { done: boolean }
  missions: Mission[]
  produced: number
  study_day: boolean
  streak: { days: number; freezes_used_this_week: number }
  level: Level
  conversation: ConversationSummary | null
}

export interface Dashboard {
  today: string
  week: { day: string; study_day: boolean }[]
  study_days_this_week: number
  target_study_days: number
  speaking_minutes_this_week: number
  real_world_attempts_this_week: number
  target_attempts: number
  mature_chunks: number
  streak: { days: number; freezes_used_this_week: number }
  next_target: string
}

export type Rating = 1 | 2 | 3 | 4

export type Cefr = 'A1' | 'A2' | 'B1'

export interface ConversationTurn extends DialogueTurn {
  alt?: string[]
}

export interface ConversationSummary {
  /** stable slug */
  id: string
  slug: string
  cefr: Cefr
  week: number
  title: string
  title_de: string
  partner: string
  setting: string
  register: 'formal' | 'informal' | 'neutral'
  turns: number
  practised: number
  readiness: 'ready' | 'stretch'
}

export interface ConversationDetail extends ConversationSummary {
  goal: string
  patterns: string[]
  turns_list: ConversationTurn[]
  key_phrases: { de: string; en: string }[]
  notes: string[]
}

export interface Level {
  week: number
  cefr: Cefr
}
