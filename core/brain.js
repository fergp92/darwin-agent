// darwin/core/brain.js
import { createLogger } from './logger.js';
import { eventBus, EVENTS } from './events.js';
import fs from 'node:fs';
import path from 'node:path';

const log = createLogger('brain');

export const PRIORITIES = Object.freeze({
  SURVIVAL: 0,
  POST_MORTEM: 1,
  REBALANCE: 2,
  PREDICTION: 3,
});

const PRIORITY_NAMES = ['survival', 'post_mortem', 'rebalance', 'prediction'];

// Resolve prompts directory relative to this module file
const PROMPTS_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')),
  '..',
  'prompts',
);

export class Brain {
  #config;
  #queue;
  #processing;
  #stats;

  constructor(config) {
    this.#config = {
      timeoutMs: config.timeoutMs || 60000,
      maxRetries: config.maxRetries ?? 1,
      maxQueueSize: config.maxQueueSize || 3,
    };
    this.#queue = [];
    this.#processing = false;
    this.#stats = { totalInvocations: 0, totalErrors: 0, queueSize: 0 };
  }

  async invoke(type, context, priority = PRIORITIES.PREDICTION, schema) {
    if (this.#queue.length >= this.#config.maxQueueSize && this.#processing) {
      throw new Error('Brain queue full — dropping lowest priority request');
    }

    return new Promise((resolve, reject) => {
      this.#queue.push({ type, context, priority, schema, resolve, reject });
      this.#queue.sort((a, b) => a.priority - b.priority);
      this.#stats.queueSize = this.#queue.length;
      this.#processQueue();
    });
  }

  getStats() {
    return {
      totalInvocations: this.#stats.totalInvocations,
      totalErrors: this.#stats.totalErrors,
      queueSize: this.#queue.length,
      isProcessing: this.#processing,
    };
  }

  async #processQueue() {
    if (this.#processing || this.#queue.length === 0) return;

    this.#processing = true;
    const item = this.#queue.shift();
    this.#stats.queueSize = this.#queue.length;

    const startTime = Date.now();

    try {
      const response = await this._spawnCli(item.type, item.context);
      const parsed = JSON.parse(response);

      if (item.schema) {
        item.schema.parse(parsed);
      }

      this.#stats.totalInvocations++;
      const duration = Date.now() - startTime;

      eventBus.emit(EVENTS.BRAIN_DECISION, {
        type: item.type,
        duration,
        success: true,
      });

      log.info({ type: item.type, duration }, 'Brain invocation successful');
      item.resolve(parsed);
    } catch (err) {
      this.#stats.totalErrors++;
      log.error({ type: item.type, err: err.message }, 'Brain invocation failed');
      item.reject(err);
    } finally {
      this.#processing = false;
      if (this.#queue.length > 0) {
        setImmediate(() => this.#processQueue());
      }
    }
  }

  /**
   * Build a full prompt from system template + type-specific template,
   * replacing {{placeholder}} variables with context values.
   */
  _buildPrompt(type, context) {
    const systemTemplate = fs.readFileSync(path.join(PROMPTS_DIR, 'system.md'), 'utf-8');
    const typeTemplate = fs.readFileSync(path.join(PROMPTS_DIR, `${type}.md`), 'utf-8');

    let system = systemTemplate;
    let prompt = typeTemplate;

    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{{${key}}}`;
      const strValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      system = system.replaceAll(placeholder, strValue);
      prompt = prompt.replaceAll(placeholder, strValue);
    }

    return `${system}\n\n---\n\n${prompt}`;
  }

  /**
   * Spawn Claude CLI with the given prompt type and context.
   * Public (underscore convention) so tests can mock it.
   *
   * @param {string} type - Prompt template type (e.g. 'prediction-analysis')
   * @param {object} context - Template variable values
   * @returns {Promise<string>} Raw JSON string from CLI stdout
   */
  async _spawnCli(type, context) {
    const prompt = this._buildPrompt(type, context);

    const { promisify } = await import('node:util');
    const { execFile: execFileCb } = await import('node:child_process');
    const execFileAsync = promisify(execFileCb);

    const claudePath = process.env.CLAUDE_CLI_PATH || 'claude';
    const { stdout } = await execFileAsync(
      claudePath,
      ['-p', prompt, '--output-format', 'json'],
      {
        timeout: this.#config.timeoutMs,
        maxBuffer: 1024 * 1024,
        env: { ...process.env },
      }
    );

    return stdout.trim();
  }
}
