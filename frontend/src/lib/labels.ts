import type { Item } from './types'

export const ACTION_LABEL: Record<Item['learner_action'], string> = {
  use_now: 'Use now',
  recognise_now: 'Recognise now',
  later: 'Later',
}

export const REGION_LABEL: Record<Item['region_tag'], string> = {
  standard: 'Standard',
  dach: 'All German-speaking',
  austria: 'Austria',
  vienna: 'Vienna',
  recognition: 'Recognition only',
}
