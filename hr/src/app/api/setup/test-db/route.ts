import { NextRequest, NextResponse } from 'next/server';
import { isSQLiteMode } from '@/lib/db-utils';
import { isSetupComplete } from '@/lib/setup-config';

export async function POST(request: NextRequest) {
  try {
    // Optional setup secret check (if SETUP_SECRET is configured, require it)
    const setupSecret = process.env.SETUP_SECRET;
    if (setupSecret && request.headers.get('x-setup-secret') !== setupSecret) {
      return NextResponse.json(
        { success: false, message: '설정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Guard: block if setup already completed
    if (await isSetupComplete()) {
      return NextResponse.json(
        { success: false, message: '이미 초기 설정이 완료되었습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    if (isSQLiteMode()) {
      // SQLite/D1 mode: on Cloudflare, D1 is always available
      if (process.env.DEPLOY_TARGET === 'cloudflare') {
        return NextResponse.json({
          success: true,
          message: 'Cloudflare D1 데이터베이스 준비 완료',
          version: 'D1 (Cloudflare)',
        });
      }
      // Local SQLite: check that we can write to the DB path
      const dbUrl = process.env.DATABASE_URL || 'file:./keystonehr.db';
      const dbPath = dbUrl.replace('file:', '');
      const path = await import('path');
      const fs = await import('fs');
      const dbDir = path.dirname(dbPath);

      try {
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

    // Non-SQLite mode: external database connection test
    let clientConfig: { connectionString?: string; host?: string; port?: number; user?: string; password?: string; database?: string; connectionTimeoutMillis: number };

    if (body.host) {
      clientConfig = {
        host: body.host || 'localhost',
        port: parseInt(body.port) || 5432,
        user: body.user || 'keystonehr',
        password: body.password || '',
        database: body.database || 'keystonehr',
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

    // Dynamic require prevents esbuild from tracing pg into Cloudflare bundle
    const _require = new Function('m', 'return require(m)') as NodeRequire;
    const { Client } = _require('pg');
    const client = new Client(clientConfig);
    await client.connect();

    const result = await client.query('SELECT version()');
    const version = result.rows[0].version;

    await client.end();

    return NextResponse.json({
      success: true,
      message: '데이터베이스 연결 성공',
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

    console.error('DB test connection error:', error);
    return NextResponse.json({
      success: false,
      message: '데이터베이스 연결에 실패했습니다.',
    }, { status: 400 });
  }
}
