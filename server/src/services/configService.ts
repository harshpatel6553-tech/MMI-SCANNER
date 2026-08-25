import fs from 'fs';
import path from 'path';

const userDataPath = process.env.USER_DATA_PATH || process.cwd();
const CONFIG_FILE_PATH = path.join(userDataPath, 'user_config.json');

export interface UserConfig {
  RAPIDAPI_KEY?: string;
  GEMINI_API_KEY?: string;
  [key: string]: any;
}

class ConfigService {
  private config: UserConfig = {};

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
        this.config = JSON.parse(data);
        console.log('[CONFIG] Successfully loaded user_config.json');
      }
    } catch (error) {
      console.error('[CONFIG] Error loading user_config.json:', error);
    }
  }

  public getConfig(): UserConfig {
    return {
      ...this.config,
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || this.config.RAPIDAPI_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || this.config.GEMINI_API_KEY,
    };
  }

  public updateConfig(newConfig: Partial<UserConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
      console.log('[CONFIG] Successfully updated user_config.json');
    } catch (error) {
      console.error('[CONFIG] Error saving user_config.json:', error);
    }
  }

  public getKey(key: string): string | undefined {
    return process.env[key] || this.config[key];
  }
}

export const configService = new ConfigService();
