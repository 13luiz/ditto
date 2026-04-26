export interface CareNeeds {
  hunger: number
  happiness: number
  energy: number
  social: number
}

export type MoodLabel = 'ecstatic' | 'happy' | 'neutral' | 'sad' | 'miserable'

export interface CareState {
  needs: CareNeeds
  mood_score: number
  mood_label: MoodLabel
}

export type CareAction = 'feed' | 'pet' | 'chat' | 'sleep'
