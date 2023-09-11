import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { BufferList } from 'bl';
import { ConfigService } from '@nestjs/config';
import { Config } from 'src/config';

export interface CointegrationResult {
  cointFlag: boolean;
  pValue: number;
  tValue: number;
  criticalValue: number;
  hedgeRatio: number;
  zeroCrossing: number;
  zscoreList: number[];
}

@Injectable()
export class CointService {
  constructor(private readonly config: ConfigService<Config, true>) {}

  async calculateCointegration(series1: number[], series2: number[]) {
    const window = this.config.get('Z_SCORE_WINDOW', { infer: true });

    const cointResultJson = await this.asyncSpawn('poetry', [
      'run',
      'python',
      'python/cointegration.py',
      'calculate_cointegration',
      JSON.stringify(series1),
      JSON.stringify(series2),
      window.toString(),
    ]);

    const cointResult = JSON.parse(cointResultJson) as CointegrationResult;
    return cointResult;
  }

  private asyncSpawn(command: string, args: string[]) {
    const child = spawn(command, args);
    const stdout = new BufferList();
    const stderr = new BufferList();

    child.stdout.on('data', (data) => {
      stdout.append(data);
    });

    child.stderr.on('data', (data) => {
      stderr.append(data);
    });

    const promise: Promise<string> = new Promise((resolve, reject) => {
      child.on('error', reject);

      child.on('close', (code) => {
        if (code === 0) resolve(stdout.toString());
        else reject(new Error(stderr.toString()));
      });
    });

    return promise;
  }
}
