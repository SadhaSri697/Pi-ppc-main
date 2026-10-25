import * as fs from 'fs';
import * as path from 'path';

export interface StatusOptions {
  projectRoot: string;
  format?: 'json' | 'markdown' | 'text';
}

interface StatusData {
  currentFocus: {
    focus: string;
    focusSince: string | null;
    priority: string;
  };
  activeTasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
  }[];
  openQuestions: {
    id: string;
    question: string;
    status: string;
  }[];
  roadmap: {
    currentPhase: string;
    milestones: {
      title: string;
      status: string;
    }[];
  };
  stats: {
    totalTasks: number;
    completedTasks: number;
    totalEvents: number;
    sessions: number;
  };
}

export class StatusCommand {
  private projectRoot: string;
  private piDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.piDir = path.join(projectRoot, '.pi');
  }

  async run(options: StatusOptions): Promise<string> {
    const data = await this.gatherStatus();

    if (options.format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return this.formatStatus(data);
  }

  private async gatherStatus(): Promise<StatusData> {
    const [focus, tasks, questions, roadmap, eventCount, sessionCount] = await Promise.all([
      this.readJson<{ focus: string; focus_since: string | null; priority: string }>(
        path.join(this.piDir, 'state', 'current_focus.json')
      ),
      this.readJson<{ tasks: StatusData['activeTasks']; last_updated: string }>(
        path.join(this.piDir, 'state', 'active_tasks.json')
      ),
      this.readJson<{ questions: StatusData['openQuestions']; last_updated: string }>(
        path.join(this.piDir, 'state', 'open_questions.json')
      ),
      this.readJson<{ milestones: { title: string; status: string }[]; current_phase: string }>(
        path.join(this.piDir, 'state', 'roadmap.json')
      ),
      this.countEvents(),
      this.countSessions(),
    ]);

    const allTasks = tasks?.tasks || [];
    const completedCount = allTasks.filter((t: { status: string }) => t.status === 'completed').length;

    return {
      currentFocus: {
        focus: focus?.focus || 'Not set',
        focusSince: focus?.focus_since ?? null,
        priority: focus?.priority || 'medium',
      },
      activeTasks: allTasks.filter((t: { status: string }) => t.status !== 'completed'),
      openQuestions: questions?.questions?.filter((q: { status: string }) => q.status === 'open') || [],
      roadmap: {
        currentPhase: roadmap?.current_phase || 'Not set',
        milestones: roadmap?.milestones || [],
      },
      stats: {
        totalTasks: allTasks.length,
        completedTasks: completedCount,
        totalEvents: eventCount,
        sessions: sessionCount,
      },
    };
  }

  private formatStatus(data: StatusData): string {
    const lines: string[] = [];
    const divider = '─'.repeat(50);

    lines.push('┌' + divider + '┐');
    lines.push('│' + ' Project Status '.padStart(28).padEnd(51) + '│');
    lines.push('└' + divider + '┘');
    lines.push('');

    // Current Focus
    lines.push('📍 Current Focus');
    lines.push('─'.repeat(30));
    if (data.currentFocus.focus === 'Not set') {
      lines.push('  (not set)');
    } else {
      const since = data.currentFocus.focusSince
        ? ` since ${new Date(data.currentFocus.focusSince).toLocaleDateString()}`
        : '';
      lines.push(`  ${data.currentFocus.focus}${since}`);
      lines.push(`  Priority: ${data.currentFocus.priority}`);
    }
    lines.push('');

    // Active Tasks
    lines.push('📋 Active Tasks');
    lines.push('─'.repeat(30));
    if (data.activeTasks.length === 0) {
      lines.push('  (no active tasks)');
    } else {
      const inProgress = data.activeTasks.filter(t => t.status === 'in_progress');
      const pending = data.activeTasks.filter(t => t.status === 'pending');
      const blocked = data.activeTasks.filter(t => t.status === 'blocked');

      if (inProgress.length > 0) {
        lines.push(`  🔄 In Progress (${inProgress.length}):`);
        inProgress.forEach((t: { title: string }) => {
          lines.push(`     • ${t.title}`);
        });
      }

      if (pending.length > 0) {
        lines.push(`  ⏳ Pending (${pending.length}):`);
        pending.forEach((t: { title: string }) => {
          lines.push(`     • ${t.title}`);
        });
      }

      if (blocked.length > 0) {
        lines.push(`  🚫 Blocked (${blocked.length}):`);
        blocked.forEach((t: { title: string }) => {
          lines.push(`     • ${t.title}`);
        });
      }
    }
    lines.push('');

    // Open Questions
    lines.push('❓ Open Questions');
    lines.push('─'.repeat(30));
    if (data.openQuestions.length === 0) {
      lines.push('  (none)');
    } else {
      data.openQuestions.forEach((q: { question: string }) => {
        lines.push(`  • ${q.question}`);
      });
    }
    lines.push('');

    // Progress
    lines.push('📊 Progress');
    lines.push('─'.repeat(30));
    const progress = data.stats.totalTasks > 0
      ? Math.round((data.stats.completedTasks / data.stats.totalTasks) * 100)
      : 0;
    const progressBar = '█'.repeat(Math.round(progress / 10)) + '░'.repeat(10 - Math.round(progress / 10));
    lines.push(`  Tasks: [${progressBar}] ${progress}% (${data.stats.completedTasks}/${data.stats.totalTasks})`);
    lines.push(`  Events: ${data.stats.totalEvents}`);
    lines.push(`  Sessions: ${data.stats.sessions}`);
    lines.push('');

    return lines.join('\n');
  }

  private readJson<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
      return null;
    }
  }

  private async countEvents(): Promise<number> {
    const eventsPath = path.join(this.piDir, 'memory', 'episodic', 'events.jsonl');
    if (!fs.existsSync(eventsPath)) return 0;
    const content = fs.readFileSync(eventsPath, 'utf-8');
    return content.split('\n').filter((l: string) => l.trim()).length;
  }

  private async countSessions(): Promise<number> {
    const sessionsDir = path.join(this.piDir, 'memory', 'episodic', 'sessions');
    if (!fs.existsSync(sessionsDir)) return 0;
    return fs.readdirSync(sessionsDir).filter((f: string) => f.endsWith('.json')).length;
  }
}