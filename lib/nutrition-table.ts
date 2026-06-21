// lib/nutrition-table.ts
//
// Static food database for the diet entry page.
// Calories and macronutrients are approximate values from ICMR/NIN Indian food
// composition tables and USDA references. Each item declares which meal slots
// it belongs to; the diet entry page filters by slot.

import type { HistoryResponses, ActivityResponses, DietMeal, DietLog, MacroNutrients, ActivityLevel, DietaryGoal, DietPace } from './types'

export type MealSlot = 'breakfast' | 'midMorning' | 'lunch' | 'evening' | 'dinner' | 'beverages'

export interface FoodPortion {
  label:     string   // button label, e.g. "2 pcs" or "1 medium bowl"
  kcal:      number
  protein_g: number
  fat_g:     number
  carb_g:    number
  fiber_g:   number
}

export interface FoodItem {
  id:       string
  name:     string
  meals:    MealSlot[]
  portions: FoodPortion[]
}

export const FOOD_DB: FoodItem[] = [

  // ── BREAKFAST ────────────────────────────────────────────────────────────────
  { id: 'idli', name: 'Idli', meals: ['breakfast'],
    portions: [
      { label: '2 pcs',  kcal:  78, protein_g:  3, fat_g: 0, carb_g: 16, fiber_g: 1 },
      { label: '3 pcs',  kcal: 117, protein_g:  4, fat_g: 0, carb_g: 24, fiber_g: 1 },
      { label: '4 pcs',  kcal: 156, protein_g:  6, fat_g: 0, carb_g: 32, fiber_g: 2 },
    ] },

  { id: 'dosa_plain', name: 'Dosa (plain)', meals: ['breakfast'],
    portions: [
      { label: '1 small',  kcal: 110, protein_g:  3, fat_g: 2, carb_g: 21, fiber_g: 1 },
      { label: '1 medium', kcal: 145, protein_g:  4, fat_g: 3, carb_g: 27, fiber_g: 1 },
      { label: '1 large',  kcal: 190, protein_g:  5, fat_g: 4, carb_g: 36, fiber_g: 2 },
    ] },

  { id: 'masala_dosa', name: 'Masala Dosa', meals: ['breakfast'],
    portions: [
      { label: '1', kcal: 215, protein_g:  5, fat_g:  6, carb_g: 37, fiber_g: 2 },
      { label: '2', kcal: 430, protein_g: 10, fat_g: 12, carb_g: 74, fiber_g: 4 },
    ] },

  { id: 'uthappam', name: 'Uthappam', meals: ['breakfast'],
    portions: [
      { label: '1', kcal: 145, protein_g:  4, fat_g: 3, carb_g: 25, fiber_g: 2 },
      { label: '2', kcal: 290, protein_g:  8, fat_g: 6, carb_g: 50, fiber_g: 4 },
    ] },

  { id: 'upma', name: 'Upma', meals: ['breakfast'],
    portions: [
      { label: '1 small bowl',  kcal: 175, protein_g: 5, fat_g: 4, carb_g: 30, fiber_g: 2 },
      { label: '1 medium bowl', kcal: 260, protein_g: 7, fat_g: 6, carb_g: 44, fiber_g: 3 },
    ] },

  { id: 'poha', name: 'Poha', meals: ['breakfast'],
    portions: [
      { label: '1 small bowl',  kcal: 180, protein_g: 3, fat_g: 3, carb_g: 35, fiber_g: 1 },
      { label: '1 medium bowl', kcal: 270, protein_g: 5, fat_g: 5, carb_g: 52, fiber_g: 2 },
    ] },

  { id: 'oats', name: 'Oats / Porridge', meals: ['breakfast'],
    portions: [
      { label: '1 small bowl',  kcal: 130, protein_g: 5, fat_g: 3, carb_g: 22, fiber_g: 3 },
      { label: '1 medium bowl', kcal: 200, protein_g: 7, fat_g: 4, carb_g: 34, fiber_g: 4 },
    ] },

  { id: 'pongal', name: 'Ven Pongal', meals: ['breakfast'],
    portions: [
      { label: '1 small bowl',  kcal: 200, protein_g: 6, fat_g: 5, carb_g: 34, fiber_g: 2 },
      { label: '1 medium bowl', kcal: 295, protein_g: 9, fat_g: 8, carb_g: 50, fiber_g: 3 },
    ] },

  { id: 'appam', name: 'Appam', meals: ['breakfast'],
    portions: [
      { label: '2 pcs', kcal: 160, protein_g: 3, fat_g: 2, carb_g: 32, fiber_g: 1 },
      { label: '3 pcs', kcal: 240, protein_g: 4, fat_g: 3, carb_g: 48, fiber_g: 1 },
    ] },

  { id: 'idiyappam', name: 'Idiyappam', meals: ['breakfast'],
    portions: [
      { label: '2 pcs', kcal: 120, protein_g: 2, fat_g: 0, carb_g: 26, fiber_g: 1 },
      { label: '3 pcs', kcal: 180, protein_g: 3, fat_g: 0, carb_g: 39, fiber_g: 1 },
    ] },

  { id: 'pesarattu', name: 'Pesarattu', meals: ['breakfast'],
    portions: [
      { label: '1', kcal: 120, protein_g:  7, fat_g: 2, carb_g: 18, fiber_g: 2 },
      { label: '2', kcal: 240, protein_g: 14, fat_g: 4, carb_g: 36, fiber_g: 4 },
    ] },

  { id: 'omelette', name: 'Omelette', meals: ['breakfast'],
    portions: [
      { label: '1 egg',  kcal: 110, protein_g:  7, fat_g:  8, carb_g: 1, fiber_g: 0 },
      { label: '2 eggs', kcal: 185, protein_g: 13, fat_g: 13, carb_g: 2, fiber_g: 0 },
    ] },

  // shared across multiple slots
  { id: 'bread_toast', name: 'Bread / Toast', meals: ['breakfast', 'evening'],
    portions: [
      { label: '1 slice',  kcal:  79, protein_g: 3, fat_g: 1, carb_g: 15, fiber_g: 1 },
      { label: '2 slices', kcal: 158, protein_g: 6, fat_g: 2, carb_g: 30, fiber_g: 2 },
      { label: '3 slices', kcal: 237, protein_g: 9, fat_g: 3, carb_g: 45, fiber_g: 3 },
    ] },

  { id: 'egg_boiled', name: 'Egg (boiled)', meals: ['breakfast', 'lunch', 'dinner'],
    portions: [
      { label: '1', kcal:  78, protein_g:  6, fat_g:  5, carb_g: 1, fiber_g: 0 },
      { label: '2', kcal: 156, protein_g: 12, fat_g: 10, carb_g: 1, fiber_g: 0 },
      { label: '3', kcal: 234, protein_g: 18, fat_g: 15, carb_g: 2, fiber_g: 0 },
    ] },

  { id: 'paratha', name: 'Paratha (plain)', meals: ['breakfast', 'lunch', 'dinner'],
    portions: [
      { label: '1', kcal: 175, protein_g: 4, fat_g:  7, carb_g: 24, fiber_g: 1 },
      { label: '2', kcal: 350, protein_g: 8, fat_g: 14, carb_g: 48, fiber_g: 2 },
    ] },

  // ── MID-MORNING & EVENING SNACKS ─────────────────────────────────────────────
  { id: 'fruit', name: 'Fresh fruit', meals: ['midMorning', 'evening'],
    portions: [
      { label: '1 small',  kcal:  55, protein_g: 1, fat_g: 0, carb_g: 13, fiber_g: 2 },
      { label: '1 medium', kcal:  85, protein_g: 1, fat_g: 0, carb_g: 20, fiber_g: 3 },
      { label: '1 large',  kcal: 125, protein_g: 2, fat_g: 0, carb_g: 30, fiber_g: 4 },
    ] },

  { id: 'nuts', name: 'Nuts (mixed)', meals: ['midMorning', 'evening'],
    portions: [
      { label: 'Small handful 15 g', kcal:  90, protein_g: 4, fat_g:  7, carb_g: 3, fiber_g: 1 },
      { label: 'Large handful 30 g', kcal: 175, protein_g: 7, fat_g: 14, carb_g: 6, fiber_g: 2 },
    ] },

  { id: 'groundnuts', name: 'Groundnuts', meals: ['midMorning', 'evening'],
    portions: [
      { label: 'Small handful', kcal: 120, protein_g: 6, fat_g:  9, carb_g: 4, fiber_g: 1 },
      { label: 'Medium handful', kcal: 190, protein_g: 9, fat_g: 15, carb_g: 6, fiber_g: 2 },
    ] },

  { id: 'biscuits', name: 'Biscuits / Cookies', meals: ['midMorning', 'evening'],
    portions: [
      { label: '2 pcs', kcal:  70, protein_g: 1, fat_g: 3, carb_g: 10, fiber_g: 0 },
      { label: '4 pcs', kcal: 140, protein_g: 2, fat_g: 6, carb_g: 20, fiber_g: 0 },
      { label: '6 pcs', kcal: 210, protein_g: 3, fat_g: 9, carb_g: 30, fiber_g: 0 },
    ] },

  { id: 'medu_vada', name: 'Medu Vada', meals: ['midMorning', 'evening'],
    portions: [
      { label: '1', kcal: 100, protein_g: 4, fat_g: 4, carb_g: 13, fiber_g: 1 },
      { label: '2', kcal: 200, protein_g: 8, fat_g: 8, carb_g: 26, fiber_g: 2 },
    ] },

  { id: 'sundal', name: 'Sundal', meals: ['midMorning', 'evening'],
    portions: [
      { label: '1 small cup',  kcal: 130, protein_g:  7, fat_g: 4, carb_g: 18, fiber_g: 4 },
      { label: '1 medium cup', kcal: 195, protein_g: 10, fat_g: 6, carb_g: 27, fiber_g: 6 },
    ] },

  { id: 'roasted_chana', name: 'Roasted chana', meals: ['midMorning', 'evening'],
    portions: [
      { label: '1 small cup',  kcal: 120, protein_g:  7, fat_g: 2, carb_g: 18, fiber_g: 4 },
      { label: '1 medium cup', kcal: 190, protein_g: 11, fat_g: 3, carb_g: 28, fiber_g: 6 },
    ] },

  { id: 'sprouted_moong', name: 'Sprouted moong', meals: ['midMorning', 'lunch', 'dinner'],
    portions: [
      { label: '1 small cup',  kcal:  80, protein_g: 6, fat_g: 0, carb_g: 14, fiber_g: 3 },
      { label: '1 medium cup', kcal: 120, protein_g: 9, fat_g: 1, carb_g: 21, fiber_g: 5 },
    ] },

  // ── EVENING-ONLY SNACKS ───────────────────────────────────────────────────────
  { id: 'murukku', name: 'Murukku', meals: ['evening'],
    portions: [
      { label: '2 pcs', kcal: 120, protein_g: 2, fat_g:  6, carb_g: 16, fiber_g: 0 },
      { label: '4 pcs', kcal: 240, protein_g: 4, fat_g: 12, carb_g: 32, fiber_g: 0 },
    ] },

  { id: 'samosa_bajji', name: 'Samosa / Bajji', meals: ['evening'],
    portions: [
      { label: '1 pc',  kcal: 130, protein_g: 3, fat_g:  7, carb_g: 15, fiber_g: 1 },
      { label: '2 pcs', kcal: 260, protein_g: 6, fat_g: 14, carb_g: 30, fiber_g: 2 },
    ] },

  { id: 'banana_chips', name: 'Banana chips', meals: ['evening'],
    portions: [
      { label: 'Small pack 30 g', kcal: 155, protein_g: 1, fat_g:  9, carb_g: 18, fiber_g: 1 },
      { label: 'Large pack 50 g', kcal: 260, protein_g: 2, fat_g: 15, carb_g: 30, fiber_g: 2 },
    ] },

  // ── LUNCH & DINNER ────────────────────────────────────────────────────────────
  { id: 'rice', name: 'Rice (cooked)', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small bowl 150 g',  kcal: 195, protein_g: 4, fat_g: 0, carb_g: 43, fiber_g: 0 },
      { label: '1 medium bowl 200 g', kcal: 260, protein_g: 5, fat_g: 0, carb_g: 57, fiber_g: 0 },
      { label: '1 large bowl 300 g',  kcal: 390, protein_g: 7, fat_g: 1, carb_g: 86, fiber_g: 1 },
    ] },

  { id: 'roti_chapati', name: 'Roti / Chapati', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1', kcal:  80, protein_g: 3, fat_g: 1, carb_g: 15, fiber_g: 2 },
      { label: '2', kcal: 160, protein_g: 6, fat_g: 2, carb_g: 30, fiber_g: 4 },
      { label: '3', kcal: 240, protein_g: 9, fat_g: 3, carb_g: 45, fiber_g: 6 },
    ] },

  { id: 'dal', name: 'Dal', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small cup',  kcal: 100, protein_g: 6, fat_g: 1, carb_g: 16, fiber_g: 3 },
      { label: '1 medium cup', kcal: 150, protein_g: 9, fat_g: 1, carb_g: 24, fiber_g: 5 },
    ] },

  { id: 'sambar', name: 'Sambar', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small cup',  kcal: 65, protein_g: 3, fat_g: 2, carb_g: 10, fiber_g: 2 },
      { label: '1 medium cup', kcal: 95, protein_g: 4, fat_g: 3, carb_g: 15, fiber_g: 3 },
    ] },

  { id: 'rasam', name: 'Rasam', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 cup',  kcal: 40, protein_g: 1, fat_g: 1, carb_g:  7, fiber_g: 1 },
      { label: '2 cups', kcal: 80, protein_g: 2, fat_g: 2, carb_g: 14, fiber_g: 2 },
    ] },

  { id: 'vegetable_sabzi', name: 'Vegetable curry / sabzi', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small bowl',  kcal:  80, protein_g: 2, fat_g: 4, carb_g:  9, fiber_g: 2 },
      { label: '1 medium bowl', kcal: 130, protein_g: 3, fat_g: 6, carb_g: 15, fiber_g: 3 },
    ] },

  { id: 'curd_raita', name: 'Curd / Raita', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small cup',  kcal:  70, protein_g: 4, fat_g: 3, carb_g: 6, fiber_g: 0 },
      { label: '1 medium cup', kcal: 100, protein_g: 6, fat_g: 4, carb_g: 8, fiber_g: 0 },
    ] },

  { id: 'salad', name: 'Raw vegetable salad', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 bowl', kcal: 40, protein_g: 1, fat_g: 0, carb_g: 8, fiber_g: 3 },
    ] },

  { id: 'chicken_curry', name: 'Chicken curry', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small portion',  kcal: 240, protein_g: 22, fat_g: 14, carb_g: 5, fiber_g: 0 },
      { label: '1 medium portion', kcal: 360, protein_g: 33, fat_g: 21, carb_g: 8, fiber_g: 0 },
    ] },

  { id: 'fish_curry', name: 'Fish curry', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small portion',  kcal: 170, protein_g: 18, fat_g:  8, carb_g: 5, fiber_g: 0 },
      { label: '1 medium portion', kcal: 255, protein_g: 27, fat_g: 12, carb_g: 7, fiber_g: 0 },
    ] },

  { id: 'egg_curry', name: 'Egg curry', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 serving (2 eggs)', kcal: 180, protein_g: 13, fat_g: 12, carb_g: 5, fiber_g: 0 },
    ] },

  { id: 'mutton_curry', name: 'Mutton / Lamb curry', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small portion',  kcal: 270, protein_g: 22, fat_g: 18, carb_g: 4, fiber_g: 0 },
      { label: '1 medium portion', kcal: 400, protein_g: 33, fat_g: 27, carb_g: 6, fiber_g: 0 },
    ] },

  { id: 'paneer_dish', name: 'Paneer dish', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small portion',  kcal: 190, protein_g: 10, fat_g: 14, carb_g: 5, fiber_g: 0 },
      { label: '1 medium portion', kcal: 285, protein_g: 15, fat_g: 21, carb_g: 8, fiber_g: 0 },
    ] },

  { id: 'rajma_chole', name: 'Rajma / Chole', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small bowl',  kcal: 110, protein_g:  7, fat_g: 2, carb_g: 18, fiber_g: 5 },
      { label: '1 medium bowl', kcal: 165, protein_g: 10, fat_g: 3, carb_g: 27, fiber_g: 7 },
    ] },

  { id: 'biryani', name: 'Biryani', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 plate veg',     kcal: 380, protein_g:  8, fat_g: 10, carb_g: 65, fiber_g: 3 },
      { label: '1 plate non-veg', kcal: 475, protein_g: 24, fat_g: 16, carb_g: 60, fiber_g: 2 },
    ] },

  { id: 'khichdi', name: 'Khichdi', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 small bowl',  kcal: 180, protein_g:  7, fat_g: 4, carb_g: 30, fiber_g: 3 },
      { label: '1 medium bowl', kcal: 270, protein_g: 10, fat_g: 6, carb_g: 45, fiber_g: 5 },
    ] },

  { id: 'papad_pickle', name: 'Papad / Pickle', meals: ['lunch', 'dinner'],
    portions: [
      { label: '1 papad',  kcal: 35, protein_g: 1, fat_g: 1, carb_g: 5, fiber_g: 0 },
      { label: '2 papads', kcal: 70, protein_g: 2, fat_g: 2, carb_g: 10, fiber_g: 0 },
    ] },

  { id: 'ghee_oil', name: 'Ghee / Oil (added)', meals: ['breakfast', 'lunch', 'dinner'],
    portions: [
      { label: '1 tsp',  kcal:  40, protein_g: 0, fat_g:  5, carb_g: 0, fiber_g: 0 },
      { label: '1 tbsp', kcal: 120, protein_g: 0, fat_g: 14, carb_g: 0, fiber_g: 0 },
    ] },

  // ── BEVERAGES ─────────────────────────────────────────────────────────────────
  { id: 'chai', name: 'Chai (milk + sugar)', meals: ['beverages'],
    portions: [
      { label: '1 cup',  kcal:  60, protein_g: 2, fat_g: 2, carb_g:  8, fiber_g: 0 },
      { label: '2 cups', kcal: 120, protein_g: 4, fat_g: 4, carb_g: 16, fiber_g: 0 },
      { label: '3 cups', kcal: 180, protein_g: 6, fat_g: 6, carb_g: 24, fiber_g: 0 },
    ] },

  { id: 'coffee_milk', name: 'Coffee (milk + sugar)', meals: ['beverages'],
    portions: [
      { label: '1 cup',  kcal:  60, protein_g: 2, fat_g: 2, carb_g:  8, fiber_g: 0 },
      { label: '2 cups', kcal: 120, protein_g: 4, fat_g: 4, carb_g: 16, fiber_g: 0 },
    ] },

  { id: 'black_tea_coffee', name: 'Black tea / coffee', meals: ['beverages'],
    portions: [
      { label: '1 cup',     kcal:  5, protein_g: 0, fat_g: 0, carb_g: 1, fiber_g: 0 },
      { label: '2–3 cups',  kcal: 10, protein_g: 0, fat_g: 0, carb_g: 2, fiber_g: 0 },
    ] },

  { id: 'milk_plain', name: 'Milk (plain)', meals: ['beverages'],
    portions: [
      { label: '1 glass 200 ml',   kcal: 130, protein_g:  7, fat_g: 5, carb_g: 10, fiber_g: 0 },
      { label: '1.5 glasses 300 ml', kcal: 195, protein_g: 10, fat_g: 7, carb_g: 15, fiber_g: 0 },
    ] },

  { id: 'coconut_water', name: 'Coconut water', meals: ['beverages'],
    portions: [
      { label: '1', kcal: 45, protein_g: 1, fat_g: 0, carb_g: 10, fiber_g: 0 },
      { label: '2', kcal: 90, protein_g: 2, fat_g: 0, carb_g: 20, fiber_g: 0 },
    ] },

  { id: 'fresh_juice', name: 'Fresh fruit juice', meals: ['beverages'],
    portions: [
      { label: '1 glass 200 ml',    kcal:  90, protein_g: 1, fat_g: 0, carb_g: 22, fiber_g: 1 },
      { label: '1.5 glasses 300 ml', kcal: 135, protein_g: 1, fat_g: 0, carb_g: 33, fiber_g: 1 },
    ] },

  { id: 'buttermilk', name: 'Buttermilk / Moru', meals: ['beverages'],
    portions: [
      { label: '1 glass',  kcal: 35, protein_g: 2, fat_g: 1, carb_g: 4, fiber_g: 0 },
      { label: '2 glasses', kcal: 70, protein_g: 4, fat_g: 2, carb_g: 8, fiber_g: 0 },
    ] },

  { id: 'lassi_sweet', name: 'Lassi (sweet)', meals: ['beverages'],
    portions: [
      { label: '1 glass', kcal: 190, protein_g: 5, fat_g: 5, carb_g: 32, fiber_g: 0 },
    ] },

  { id: 'soft_drink', name: 'Soft drink / Soda', meals: ['beverages'],
    portions: [
      { label: '1 can or glass', kcal: 130, protein_g: 0, fat_g: 0, carb_g: 35, fiber_g: 0 },
    ] },

  { id: 'protein_shake', name: 'Protein shake', meals: ['beverages'],
    portions: [
      { label: 'With milk',  kcal: 200, protein_g: 25, fat_g: 5, carb_g: 15, fiber_g: 1 },
      { label: 'With water', kcal: 120, protein_g: 24, fat_g: 2, carb_g:  5, fiber_g: 0 },
    ] },
]

// O(1) lookup by id
export const FOOD_MAP: Record<string, FoodItem> = Object.fromEntries(
  FOOD_DB.map(f => [f.id, f]),
)

// ── Calorie helpers ───────────────────────────────────────────────────────────

export function mealKcal(meal: DietMeal): number {
  const selKcal = Object.entries(meal.selections).reduce((sum, [foodId, portionLabel]) => {
    const portion = FOOD_MAP[foodId]?.portions.find(p => p.label === portionLabel)
    return sum + (portion?.kcal ?? 0)
  }, 0)
  return selKcal + (meal.freeTextKcal ?? 0)
}

export function estimateDietCalories(log: DietLog): number {
  return (
    mealKcal(log.breakfast) +
    mealKcal(log.midMorning) +
    mealKcal(log.lunch) +
    mealKcal(log.evening) +
    mealKcal(log.dinner) +
    mealKcal(log.beverages)
  )
}

// ── Macro helpers ─────────────────────────────────────────────────────────────

const ZERO_MACROS: MacroNutrients = { protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0 }

function addMacros(a: MacroNutrients, b: MacroNutrients): MacroNutrients {
  return {
    protein_g: a.protein_g + b.protein_g,
    fat_g:     a.fat_g     + b.fat_g,
    carb_g:    a.carb_g    + b.carb_g,
    fiber_g:   a.fiber_g   + b.fiber_g,
  }
}

export function mealMacros(meal: DietMeal): MacroNutrients {
  const selMacros = Object.entries(meal.selections).reduce((sum, [foodId, portionLabel]) => {
    const portion = FOOD_MAP[foodId]?.portions.find(p => p.label === portionLabel)
    if (!portion) return sum
    return addMacros(sum, {
      protein_g: portion.protein_g,
      fat_g:     portion.fat_g,
      carb_g:    portion.carb_g,
      fiber_g:   portion.fiber_g,
    })
  }, { ...ZERO_MACROS })
  return addMacros(selMacros, meal.freeTextMacros ?? ZERO_MACROS)
}

export function estimateDietMacros(log: DietLog): MacroNutrients {
  return [log.breakfast, log.midMorning, log.lunch, log.evening, log.dinner, log.beverages]
    .reduce((sum, slot) => addMacros(sum, mealMacros(slot)), { ...ZERO_MACROS })
}

// ── TDEE estimate (Mifflin-St Jeor × activity multiplier) ─────────────────────
// Returns null when weight / height / age are missing from history.
export function computeTDEE(
  history: HistoryResponses,
  activity: ActivityResponses,
): number | null {
  let wkg: number | null = null
  let hcm: number | null = null

  if (history.unit === 'metric') {
    wkg = parseFloat(history.weightKg) || null
    hcm = parseFloat(history.heightCm) || null
  } else {
    const lbs = parseFloat(history.weightLbs)
    const ft  = parseFloat(history.heightFt) || 0
    const ins = parseFloat(history.heightIn) || 0
    wkg = lbs  ? lbs * 0.453592          : null
    hcm = (ft || ins) ? (ft * 12 + ins) * 2.54 : null
  }

  const age = history.age
  if (!wkg || !hcm || !age) return null

  const base = 10 * wkg + 6.25 * hcm - 5 * age
  const bmr  = history.sex === 'Male' ? base + 5 : base - 161

  const d = activity.mvpaDays
  const factor = d === 0 ? 1.2 : d <= 2 ? 1.375 : d <= 5 ? 1.55 : 1.725

  return Math.round(bmr * factor)
}

// ── Macro targets ─────────────────────────────────────────────────────────────

export interface MacroTargets {
  protein_g: number
  fat_g:     number
  carb_g:    number
  fiber_g:   number
}

export function computeMacroTargets(
  history: HistoryResponses,
  activity: ActivityResponses,
): MacroTargets | null {
  let weightKg: number | null = null
  if (history.unit === 'metric') {
    weightKg = parseFloat(history.weightKg) || null
  } else {
    const lbs = parseFloat(history.weightLbs)
    weightKg = lbs ? lbs * 0.453592 : null
  }

  const tdee = computeTDEE(history, activity)
  if (!weightKg || !tdee) return null

  const isFemale = /female|woman/i.test(history.sex)
  const age      = history.age ?? 35
  const mvpaMin  = (activity.mvpaDays || 0) * (activity.mvpaMinutes || 0)

  // Protein: 0.8 g/kg baseline → 1.2 if active (≥150 min/week) → 1.4 if age ≥50
  const proteinMult = age >= 50 ? 1.4 : mvpaMin >= 150 ? 1.2 : 0.8

  return {
    protein_g: Math.round(weightKg * proteinMult),
    fat_g:     Math.round(tdee * 0.30 / 9),
    carb_g:    Math.round(tdee * 0.50 / 4),
    fiber_g:   isFemale ? 25 : 38,
  }
}

// ── Activity level derivation from IPAQ-style questionnaire ──────────────────
export function deriveActivityLevel(activity: {
  mvpaDays: number; mvpaMinutes: number; strengthDays: number; sittingHours: number
}): ActivityLevel {
  const weeklyMvpaMin = (activity.mvpaDays || 0) * (activity.mvpaMinutes || 0)
  const strengthMin   = (activity.strengthDays || 0) * 30
  const totalActive   = weeklyMvpaMin + strengthMin
  const sitting       = activity.sittingHours || 0
  if (totalActive >= 300 || activity.mvpaDays >= 5) return 'very_active'
  if (totalActive >= 150 || activity.mvpaDays >= 3) return 'active'
  if (totalActive >= 60  || activity.mvpaDays >= 1) return 'moderate'
  if (sitting >= 8) return 'sedentary'
  return 'light'
}

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary:   1.20,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.90,
}

export const ACTIVITY_LABEL_SHORT: Record<ActivityLevel, string> = {
  sedentary:   'Sedentary',
  light:       'Lightly active',
  moderate:    'Moderately active',
  active:      'Active',
  very_active: 'Very active',
}

export const ACTIVITY_LABEL_FULL: Record<ActivityLevel, string> = {
  sedentary:   'Sedentary (desk job, little movement)',
  light:       'Lightly active (walking, light activity)',
  moderate:    'Moderately active (3–4 workouts/week)',
  active:      'Active (5+ workouts/week)',
  very_active: 'Very active (daily intense training)',
}

export function computeTDEEFromLevel(
  history: { unit: string; weightKg: string; weightLbs: string; heightCm: string;
             heightFt: string; heightIn: string; age: number | null; sex: string },
  level: ActivityLevel,
): number | null {
  let wkg: number | null = null
  let hcm: number | null = null
  if (history.unit === 'metric') {
    wkg = parseFloat(history.weightKg) || null
    hcm = parseFloat(history.heightCm) || null
  } else {
    const lbs = parseFloat(history.weightLbs)
    const ft  = parseFloat(history.heightFt) || 0
    const ins = parseFloat(history.heightIn) || 0
    wkg = lbs ? lbs * 0.453592 : null
    hcm = (ft || ins) ? (ft * 12 + ins) * 2.54 : null
  }
  const age = history.age
  if (!wkg || !hcm || !age) return null
  const base = 10 * wkg + 6.25 * hcm - 5 * age
  const bmr  = /male/i.test(history.sex) && !/female/i.test(history.sex) ? base + 5 : base - 161
  return Math.round(bmr * ACTIVITY_MULTIPLIER[level])
}

export const PACE_KCAL: Record<DietPace, number> = {
  gentle: 275,
  steady: 550,
  faster: 1000,
}

export function computeTargetCalories(
  tdee: number, goal: DietaryGoal, pace: DietPace = 'steady',
): number {
  if (goal === 'maintain') return tdee
  const delta = PACE_KCAL[pace]
  if (goal === 'lose_weight') return Math.max(1200, tdee - delta)
  if (goal === 'gain_muscle') return tdee + Math.min(delta, 275)
  return tdee + delta
}

export function computeMacroTargetsV2(
  weightKg: number,
  targetCalories: number,
  approach: string = 'balanced',
  sex: string = 'female',
): { protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } {
  const isFemale = /female/i.test(sex)
  let proteinG: number, fatG: number, carbG: number
  if (approach === 'high_protein') {
    proteinG = Math.round(weightKg * 2.0)
    fatG     = Math.round(targetCalories * 0.25 / 9)
    carbG    = Math.max(50, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4))
  } else if (approach === 'low_carb') {
    carbG    = Math.min(100, Math.round(targetCalories * 0.15 / 4))
    proteinG = Math.round(weightKg * 1.4)
    fatG     = Math.round((targetCalories - proteinG * 4 - carbG * 4) / 9)
  } else {
    proteinG = Math.round(weightKg * 1.2)
    fatG     = Math.round(targetCalories * 0.30 / 9)
    carbG    = Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4)
  }
  return { protein_g: proteinG, carbs_g: Math.max(50, carbG), fat_g: Math.max(20, fatG), fiber_g: isFemale ? 25 : 38 }
}
