import { NextRequest, NextResponse } from 'next/server';
import { isSQLiteMode } from '@/lib/db-utils';
import { isSetupComplete } from '@/lib/setup-config';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    // Guard: block if setup already completed
    if (await isSetupComplete()) {
      return NextResponse.json(
        { success: false, message: '이미 초기 설정이 완료되었습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    if (isSQLiteMode()) {
      // SQLite mode: check that we can write to the DB path
      const dbUrl = process.env.DATABASE_URL || 'file:./msa-hr.db';
      const dbPath = dbUrl.replace('file:', '');
      const dbDir = path.dirname(dbPath);

      try {
        // Check if directory exists and is writable
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
        fs.accessSync(dbDir, fs.constants.W_OK);

        return NextResponse.json({
          success: true,
          message: 'SQLite 데이터베이스 준비 완료',
          version: 'SQLite (내장)',
        });
      } catch {
        return NextResponse.json({
          success: false,
          message: `데이터베이스 경로에 쓰기 권한이 없습니다: ${dbDir}`,
        }, { status: 400 });
      }
    }

    // PostgreSQL mode: existing logic
    let clientConfig: { connectionString?: string; host?: string; port?: number; user?: string; password?: string; database?: string; connectionTimeoutMillis: number };

    if (body.host) {
      clientConfig = {
        host: body.host || 'localhost',
        port: parseInt(body.port) || 5432,
        user: body.user || 'msa',
        password: body.password || '',
        database: body.database || 'msa_hr',
        connectionTimeoutMillis: 5000,
      };
    } else if (process.env.DATABASE_URL) {
      clientConfig = {
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
      };
    } else {
      return NextResponse.json({
        success: false,
        message: 'DATABASE_URL 환경변수가 설정되지 않았습니다.',
      }, { status: 400 });
    }

    const { Client } = require('pg');
    const client = new Client(clientConfig);
    await client.connect();

    const result = await client.query('SELECT version()');
    const version = result.rows[0].version;

    await client.end();

    return NextResponse.json({
      success: true,
      message: 'PostgreSQL 연결 성공',
      version: version,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    if (errorMessage.includes('does not exist')) {
      return NextResponse.json({
        success: false,
        message: '데이터베이스가 존재하지 않습니다. 자동으로 생성을 시도합니다.',
        needsCreate: true,
      });
    }

    return NextResponse.json({
      success: false,
      message: `연결 실패: ${errorMessage}`,
    }, { status: 400 });
  }
}
