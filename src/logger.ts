import * as fs from 'fs';
import * as path from 'path';

// Log klasörü
const logDir = path.join(__dirname, '../logs');

// Log klasörünü oluştur
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log seviyeleri
enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

// Renk kodları (terminal için)
const colors = {
  INFO: '\x1b[36m',    // Cyan
  WARN: '\x1b[33m',    // Yellow
  ERROR: '\x1b[31m',   // Red
  DEBUG: '\x1b[35m',   // Magenta
  RESET: '\x1b[0m'     // Reset
};

// Log formatı
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private getLogFileName(category: string): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(logDir, `${category}-${date}.log`);
  }

  private formatLog(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.padEnd(5);
    const category = entry.category.padEnd(15);
    const message = entry.message;
    const data = entry.data ? ` | Data: ${JSON.stringify(entry.data)}` : '';
    
    return `[${timestamp}] ${level} [${category}] ${message}${data}\n`;
  }

  private writeToFile(category: string, logEntry: LogEntry) {
    const fileName = this.getLogFileName(category);
    const logLine = this.formatLog(logEntry);
    
    fs.appendFileSync(fileName, logLine, 'utf8');
  }

  private log(level: LogLevel, category: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level,
      category,
      message,
      data
    };

    // Konsola yazdır (renkli)
    const color = colors[level] || colors.RESET;
    const consoleMessage = `[${timestamp}] ${color}${level}${colors.RESET} [${category}] ${message}`;
    console.log(consoleMessage);
    if (data) {
      console.log('  Data:', data);
    }

    // Dosyaya yaz
    this.writeToFile(category, logEntry);
    
    // Genel log dosyasına da yaz
    this.writeToFile('general', logEntry);
  }

  info(category: string, message: string, data?: any) {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, error?: any) {
    const errorData = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    this.log(LogLevel.ERROR, category, message, errorData);
  }

  debug(category: string, message: string, data?: any) {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  // Özel log kategorileri
  user(userId: number, action: string, data?: any) {
    this.info('USER', `User ${userId}: ${action}`, data);
  }

  command(userId: number, command: string, data?: any) {
    this.info('COMMAND', `User ${userId} executed: /${command}`, data);
  }

  message(userId: number, chatId: number, type: string, data?: any) {
    this.debug('MESSAGE', `User ${userId} in chat ${chatId}: ${type}`, data);
  }

  admin(userId: number, action: string, data?: any) {
    this.info('ADMIN', `Admin ${userId}: ${action}`, data);
  }

  errorHandler(error: any, context?: string) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const contextInfo = context ? ` in ${context}` : '';
    this.error('ERROR', `Error occurred${contextInfo}`, error);
  }
}

// Singleton instance
export const logger = new Logger();
export default logger;

