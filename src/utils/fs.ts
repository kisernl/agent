// src/utils/fs.ts
import { promises as fs } from 'fs';
import path from 'path';

export class FileSystem {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.projectRoot, filePath);
    return fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.projectRoot, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectRoot, filePath));
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(dirPath: string, options?: { recursive: boolean }): Promise<string | undefined> {
    const fullPath = path.join(this.projectRoot, dirPath);
    return fs.mkdir(fullPath, { recursive: options?.recursive });
  }

  async listFiles(dirPath: string): Promise<string[]> {
    try {
      const fullPath = path.join(this.projectRoot, dirPath);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files: string[] = [];
      
      for (const entry of entries) {
        const fullEntryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await this.listFiles(fullEntryPath);
          files.push(...subFiles);
        } else {
          files.push(fullEntryPath);
        }
      }
      
      return files;
    } catch (error) {
      console.error(`Error listing directory ${dirPath}:`, error);
      return [];
    }
  }
}