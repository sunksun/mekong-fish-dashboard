// User Types
export const USER_ROLES = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher', 
  GOVERNMENT: 'government',
  COMMUNITY_MANAGER: 'community_manager',
  FISHER: 'fisher' // จาก Mobile App
};

// Fishing Data Types
export const FISH_CATEGORIES = {
  SMALL: 'small',
  MEDIUM: 'medium', 
  LARGE: 'large'
};

export const WATER_SOURCES = {
  MAIN_RIVER: 'main_river',
  TRIBUTARY: 'tributary',
  POND: 'pond',
  LAKE: 'lake'
};

export const FISHING_METHODS = {
  NET: 'net',
  HOOK: 'hook',
  TRAP: 'trap',
  SPEAR: 'spear',
  OTHER: 'other'
};

// Dashboard KPI Types
export const KPI_TYPES = {
  TOTAL_USERS: 'total_users',
  DAILY_CATCH: 'daily_catch',
  MONTHLY_CATCH: 'monthly_catch',
  TOTAL_WEIGHT: 'total_weight',
  TOTAL_VALUE: 'total_value',
  ACTIVE_FISHERS: 'active_fishers'
};

// Report Types
export const REPORT_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly', 
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom'
};

export const EXPORT_FORMATS = {
  PDF: 'pdf',
  EXCEL: 'excel',
  CSV: 'csv',
  JSON: 'json'
};