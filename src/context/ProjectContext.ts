import { FileSystem } from '../utils/fs.js';

export class ProjectContext {
  private fs: FileSystem;
  private context: Map<string, any>;
  private fileCache: Map<string, string> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.fs = new FileSystem(projectRoot);
    this.context = new Map();
  }

  async scanProject(): Promise<void> {
    try {
      // Read package.json for project metadata
      const packageJson = await this.fs.readFile('package.json');
      if (packageJson) {
        const pkg = JSON.parse(packageJson);
        this.context.set('project', {
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          main: pkg.main || 'index.js',
          dependencies: pkg.dependencies || {},
          devDependencies: pkg.devDependencies || {},
          scripts: pkg.scripts || {}
        });
      }

      // Scan source directory structure
      const srcFiles = await this.scanDirectory('src');
      this.context.set('sourceFiles', srcFiles);

      // Cache important files for quick access
      await this.cacheImportantFiles();

    } catch (error) {
      console.error('Error scanning project:', error);
      throw error;
    }
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    try {
      const entries = await this.fs.listFiles(dir);
      const result: string[] = [];

      for (const entry of entries) {
        const fullPath = `${dir}/${entry}`;
        try {
          const isDir = (await this.fs.fileExists(`${fullPath}/`)) && 
                       !(await this.fs.fileExists(fullPath));
          
          if (isDir) {
            const subFiles = await this.scanDirectory(fullPath);
            result.push(...subFiles);
          } else {
            result.push(fullPath);
          }
        } catch (err) {
          console.warn(`Error scanning ${fullPath}:`, err);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
      return [];
    }
  }

  private async cacheImportantFiles(): Promise<void> {
    const importantFiles = [
      'tsconfig.json',
      'package.json',
      'README.md',
      '.gitignore'
    ];

    for (const file of importantFiles) {
      try {
        if (await this.fs.fileExists(file)) {
          const content = await this.fs.readFile(file);
          this.fileCache.set(file, content);
        }
      } catch (error) {
        console.warn(`Could not cache ${file}:`, error);
      }
    }
  }

  getContext(): Record<string, any> {
    return {
      ...Object.fromEntries(this.context.entries()),
      cachedFiles: Object.fromEntries(this.fileCache.entries())
    };
  }

  async updateContext(key: string, value: any): Promise<void> {
    this.context.set(key, value);
  }

  async getFileContent(filePath: string): Promise<string | null> {
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath) || null;
    }

    try {
      const content = await this.fs.readFile(filePath);
      this.fileCache.set(filePath, content);
      return content;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }

  async updateFile(filePath: string, content: string): Promise<boolean> {
    try {
      await this.fs.writeFile(filePath, content);
      this.fileCache.set(filePath, content);
      return true;
    } catch (error) {
      console.error(`Error updating file ${filePath}:`, error);
      return false;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    return this.fs.fileExists(filePath);
  }

  async listDirectory(dirPath: string): Promise<string[]> {
    try {
      return await this.fs.listFiles(dirPath);
    } catch (error) {
      console.error(`Error listing directory ${dirPath}:`, error);
      return [];
    }
  }
}