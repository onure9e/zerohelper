export interface CLIOptions {
  config: string;
}

export interface DBOptions extends CLIOptions {
  table?: string;
  count?: number;
  format?: string;
  output?: string;
}

export interface MigrationOptions extends CLIOptions {
  migrationsDir: string;
  steps?: number;
}

export interface ImportOptions extends CLIOptions {
  table: string;
  format: string;
}

export interface ExportOptions extends CLIOptions {
  table: string;
  format: string;
  output: string;
}
