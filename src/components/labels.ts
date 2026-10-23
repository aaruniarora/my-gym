import type { DayMode, Equipment, Settings } from '../lib/types'

// 'none' is left out: it is never a choice
export const EQUIPMENT: [Equipment, string][] = [
  ['pull_up_bar', 'Pull-up bar'], ['dip_station', 'Dip station / parallel bars'], ['trx', 'TRX / suspension trainer'],
  ['band', 'Resistance bands'], ['door_anchor', 'Door anchor (for bands)'], ['dumbbell', 'Dumbbells'], ['kettlebell', 'Kettlebells'],
  ['slam_ball', 'Slam ball'], ['box', 'Box / sturdy chair'], ['bench', 'Bench'], ['wall', 'Wall'], ['floor', 'Floor / mat'], ['jump_rope', 'Jump rope'],
]

// same as the db.ts defaults, for settings loaded before equipment existed
export const DEFAULT_EQUIPMENT: NonNullable<Settings['equipment']> = {
  gym: ['pull_up_bar', 'dip_station', 'trx', 'band', 'dumbbell', 'kettlebell', 'box', 'bench', 'jump_rope', 'slam_ball', 'wall', 'floor', 'door_anchor'],
  home: ['band', 'door_anchor', 'box', 'wall', 'floor'],
}

// old 'bare' sessions read as low energy
export const modeLabel = (m: DayMode | 'bare') => (m === 'normal' ? 'Normal' : m === 'push' ? 'Feeling strong' : 'Low energy')
