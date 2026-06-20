/**
 * Logger ที่ honor NODE_ENV
 * - production: log แค่ error และ warn
 * - development: log ทุกระดับ
 *
 * ใช้แทน console.log/info/debug ตรงๆ
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  debug: (...args) => {
    if (isDev) console.debug('[DEBUG]', ...args);
  },
  info: (...args) => {
    if (isDev) console.info('[INFO]', ...args);
  },
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
};

export default logger;
