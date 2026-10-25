// GitHub Integration
// Hook into git operations to track changes

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface GitIntegrationConfig {
  projectRoot: string;
  piDir: string;
}

interface GitChange {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  diff?: string;
}

export class GitIntegration {
  private projectRoot: string;

  constructor(config: GitIntegrationConfig) {
    this.projectRoot = config.projectRoot;
  }

  /**
   * Get files changed in the last commit
   */
  getLastChangedFiles(): GitChange[] {
    try {
      const output = execSync('git diff --name-status HEAD~1 HEAD', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      });

      return output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [status, file] = line.split('\t');
          return {
            file,
            type: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified',
          };
        });
    } catch {
      return [];
    }
  }

  /**
   * Get files changed but not yet committed
   */
  getUncommittedChanges(): GitChange[] {
    try {
      const output = execSync('git diff --name-status', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      });

      return output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [status, file] = line.split('\t');
          return {
            file,
            type: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified',
          };
        });
    } catch {
      return [];
    }
  }

  /**
   * Get recent commits
   */
  getRecentCommits(count = 10): {
    hash: string;
    message: string;
    date: string;
    author: string;
  }[] {
    try {
      const output = execSync(`git log --oneline -${count}`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      });

      return output
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, ...messageParts] = line.split(' ');
          return {
            hash,
            message: messageParts.join(' '),
            date: '',
            author: '',
          };
        });
    } catch {
      return [];
    }
  }

  /**
   * Generate a commit message based on changes
   */
  async generateCommitMessage(changes: GitChange[]): Promise<string> {
    const added = changes.filter(c => c.type === 'added');
    const modified = changes.filter(c => c.type === 'modified');
    const deleted = changes.filter(c => c.type === 'deleted');

    const parts: string[] = [];

    if (added.length > 0) {
      const files = added.map(c => path.basename(c.file)).slice(0, 3);
      parts.push(`Add ${files.join(', ')}${added.length > 3 ? ` and ${added.length - 3} more` : ''}`);
    }

    if (modified.length > 0) {
      const files = modified.map(c => path.basename(c.file)).slice(0, 3);
      parts.push(`Update ${files.join(', ')}${modified.length > 3 ? ` and ${modified.length - 3} more` : ''}`);
    }

    if (deleted.length > 0) {
      parts.push(`Remove ${deleted.length} file(s)`);
    }

    return parts.join('; ') || 'No changes';
  }

  /**
   * Check if working directory is clean
   */
  isClean(): boolean {
    try {
      const output = execSync('git status --porcelain', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      });
      return !output.trim();
    } catch {
      return false;
    }
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    try {
      const output = execSync('git branch --show-current', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      });
      return output.trim();
    } catch {
      return '';
    }
  }
}