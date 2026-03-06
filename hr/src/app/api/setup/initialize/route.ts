import { NextRequest, NextResponse } from 'next/server';
import { isSQLiteMode } from '@/lib/db-utils';
import { isSetupComplete } from '@/lib/setup-config';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

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
      const dbUrl = process.env.DATABASE_URL || 'file:./msa-hr.db';
      const dbPath = dbUrl.replace('file:', '');

      // Try using pre-generated SQL file first (packaged Electron app)
      const initSqlPath = path.join(process.cwd(), 'prisma-init.sql');
      if (fs.existsSync(initSqlPath)) {
        try {
          const Database = require('better-sqlite3');
          const db = new Database(dbPath);
          const initSql = fs.readFileSync(initSqlPath, 'utf-8')
            .replace(/CREATE TABLE /g, 'CREATE TABLE IF NOT EXISTS ')
            .replace(/CREATE UNIQUE INDEX /g, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
            .replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ');
          db.exec(initSql);
          db.close();
        } catch (sqlErr) {
          const errMsg = sqlErr instanceof Error ? sqlErr.message : String(sqlErr);
          return NextResponse.json({
            success: false,
            message: `DB 스키마 적용 실패: ${errMsg}`,
          }, { status: 500 });
        }
      } else {
        // Development mode: use prisma db push
        try {
          execSync('npx prisma db push --accept-data-loss', {
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: dbUrl, DB_PROVIDER: 'sqlite' },
            stdio: 'pipe',
            timeout: 30000,
          });
        } catch (pushErr) {
          const errMsg = pushErr instanceof Error ? pushErr.message : String(pushErr);
          return NextResponse.json({
            success: false,
            message: `DB 스키마 적용 실패: ${errMsg}`,
          }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, message: '데이터베이스 초기화 완료' });
    }

    // PostgreSQL mode: existing logic
    let dbUrl: string;
    if (body.host) {
      dbUrl = `postgresql://${body.user || 'msa'}:${encodeURIComponent(body.password || '')}@${body.host}:${body.port || 5432}/${body.database || 'msa_hr'}`;
    } else if (process.env.DATABASE_URL) {
      dbUrl = process.env.DATABASE_URL;
    } else {
      return NextResponse.json({
        success: false,
        message: 'DATABASE_URL 환경변수가 설정되지 않았습니다.',
      }, { status: 400 });
    }

    // Try to create database if it doesn't exist
    try {
      const { Client } = require('pg');
      const connUrl = new URL(dbUrl.replace('postgresql://', 'http://'));
      const database = connUrl.pathname.replace('/', '');

      // Validate database name to prevent SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) {
        return NextResponse.json({
          success: false,
          message: '유효하지 않은 데이터베이스 이름입니다.',
        }, { status: 400 });
      }

      const client = new Client({
        host: connUrl.hostname,
        port: parseInt(connUrl.port) || 5432,
        user: connUrl.username,
        password: decodeURIComponent(connUrl.password),
        database: 'postgres',
      });
      await client.connect();

      const res = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`, [database]
      );

      if (res.rowCount === 0) {
        await client.query(`CREATE DATABASE "${database}"`);
      }

      await client.end();
    } catch (e) {
      console.log('DB creation attempt:', e);
    }

    // Run Prisma db push
    try {
      execSync('npx prisma db push --accept-data-loss', {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'pipe',
        timeout: 30000,
      });
    } catch (pushErr) {
      const errMsg = pushErr instanceof Error ? pushErr.message : String(pushErr);
      return NextResponse.json({
        success: false,
        message: `DB 스키마 적용 실패: ${errMsg}`,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '데이터베이스 초기화 완료' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ success: false, message: `초기화 실패: ${msg}` }, { status: 500 });
  }
}
