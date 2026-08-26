import { EventInjector } from './injector';
import { SimulatorEventType } from '../types';

export class SimulatorScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private intervalMs: number;
  private autoFireEnabled: boolean;

  private static EVENT_POOL: SimulatorEventType[] = [
    'BATTLE_WON',
    'BATTLE_LOST',
    'RARE_ITEM_DISCOVERED',
    'ZONE_TRANSITION',
    'HOSTILE_ACTION_DETECTED',
    'REWARD_POOL_SPIKE',
  ];

  constructor(
    private injector: EventInjector,
    options: { intervalSeconds?: number; enabled?: boolean } = {}
  ) {
    const envEnabled = process.env.SIM_AUTO_FIRE_ENABLED === 'true';
    const envInterval = parseInt(process.env.SIM_INTERVAL_SECONDS || '90', 10);

    this.autoFireEnabled = options.enabled !== undefined ? options.enabled : envEnabled;
    this.intervalMs = (options.intervalSeconds || envInterval) * 1000;
  }

  public start(): void {
    if (this.isRunning || !this.autoFireEnabled) {
      if (!this.autoFireEnabled) {
        console.log('🎮 [SimulatorScheduler] Auto-fire is disabled (SIM_AUTO_FIRE_ENABLED=false).');
      }
      return;
    }

    this.isRunning = true;
    console.log(`🎮 [SimulatorScheduler] Started auto-fire game event loop (${this.intervalMs / 1000}s interval)...`);

    this.timer = setInterval(async () => {
      if (!this.isRunning) return;

      const randomTokenId = Math.floor(Math.random() * 5); // 0 - 4
      const randomEvent =
        SimulatorScheduler.EVENT_POOL[
          Math.floor(Math.random() * SimulatorScheduler.EVENT_POOL.length)
        ];

      try {
        await this.injector.injectEvent(randomEvent, randomTokenId, 'AUTO_SCHEDULER');
      } catch (err: any) {
        console.warn(`[SimulatorScheduler] Error in scheduled event: ${err.message}`);
      }
    }, this.intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('🎮 [SimulatorScheduler] Stopped auto-fire scheduler.');
  }

  public setEnabled(enabled: boolean): void {
    this.autoFireEnabled = enabled;
    if (enabled && !this.isRunning) {
      this.start();
    } else if (!enabled && this.isRunning) {
      this.stop();
    }
  }

  public isActive(): boolean {
    return this.isRunning;
  }
}
